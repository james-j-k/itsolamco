import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendNudgeEmail, sendReminderEmail } from "@/lib/email";
import { generateRsvpToken, rsvpUrlFor } from "@/lib/rsvp";

type Params = { params: Promise<{ id: string }> };

// Resend allows ~2 requests/second, so sends are spaced out, and each call
// handles only a few bookings so no single request runs long enough to hit a
// platform time limit (even a 10s one). The admin page keeps calling with the
// returned cursor until it's done.
const CHUNK = 5;
const GAP_MS = 600;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const bodySchema = z.object({
  mode: z.enum(["reminder", "nudge"]),
  cursor: z.string().nullish(),
});

type Mode = z.infer<typeof bodySchema>["mode"];

// Who gets what:
//  - reminder: confirmed bookings that haven't been reminded yet
//  - nudge:    confirmed bookings that were reminded, haven't replied, and
//              haven't already been nudged
function isEligible(
  b: { status: string; reminderSentAt: Date | null; nudgeSentAt: Date | null; rsvpStatus: string | null },
  mode: Mode
) {
  if (b.status !== "confirmed") return false;
  return mode === "reminder"
    ? b.reminderSentAt === null
    : b.reminderSentAt !== null && b.rsvpStatus === null && b.nudgeSentAt === null;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { mode, cursor } = parsed.data;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY isn't configured" }, { status: 503 });
  }

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.date.getTime() < Date.now()) {
    return NextResponse.json({ error: "That night has already happened." }, { status: 400 });
  }

  const eligibleWhere =
    mode === "reminder"
      ? { reminderSentAt: null }
      : { reminderSentAt: { not: null }, rsvpStatus: null, nudgeSentAt: null };

  const batch = await prisma.booking.findMany({
    where: {
      eventId: id,
      status: "confirmed",
      ...eligibleWhere,
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take: CHUNK,
  });

  const sentIds: string[] = [];
  let stopped: string | null = null;
  const failed: { teamName: string; reason: string }[] = [];

  for (const [i, queued] of batch.entries()) {
    if (i > 0) await sleep(GAP_MS);

    // Re-read right before sending: if the admin clicked in another tab (or a
    // customer just replied), this booking may no longer need the email.
    const booking = await prisma.booking.findUnique({ where: { id: queued.id } });
    if (!booking || !isEligible(booking, mode)) continue;

    try {
      let token = booking.rsvpToken;
      if (!token) {
        token = generateRsvpToken();
        await prisma.booking.update({ where: { id: booking.id }, data: { rsvpToken: token } });
      }
      const rsvpUrl = rsvpUrlFor(token);

      if (mode === "reminder") await sendReminderEmail(booking, event, rsvpUrl);
      else await sendNudgeEmail(booking, event, rsvpUrl);

      await prisma.booking.update({
        where: { id: booking.id },
        data: mode === "reminder" ? { reminderSentAt: new Date() } : { nudgeSentAt: new Date() },
      });
      sentIds.push(booking.id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to send ${mode} to booking ${booking.id}:`, err);
      failed.push({ teamName: booking.teamName, reason });
      // Out of sending quota: every remaining email would fail too, so stop.
      if (/quota/i.test(reason)) {
        stopped = reason;
        break;
      }
    }
  }

  const nextCursor = !stopped && batch.length === CHUNK ? batch[batch.length - 1].id : null;
  return NextResponse.json({ sentIds, failed, stopped, nextCursor });
}
