import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";
import { inviteAudience, type InviteAudience } from "@/lib/invites";
import { bookNightUrl, normalizeEmail, unsubscribeOneClickUrl, unsubscribePageUrl } from "@/lib/unsubscribe";

type Params = { params: Promise<{ id: string }> };

// Same pacing as the reminder emails: Resend allows ~2 requests a second, and
// a few emails per call keeps every request short. The admin page keeps calling
// until nobody is left.
const CHUNK = 5;
const GAP_MS = 600;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const audienceSchema = z.enum(["attended", "all"]);

async function upcomingEvent(id: string) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) } as const;
  if (event.date.getTime() < Date.now()) {
    return { error: NextResponse.json({ error: "That night has already happened." }, { status: 400 }) } as const;
  }
  return { event } as const;
}

// Counts only; sends nothing. Lets the admin see who an invite would reach.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const found = await upcomingEvent(id);
  if ("error" in found) return found.error;

  const audience = audienceSchema.safeParse(request.nextUrl.searchParams.get("audience") ?? "all");
  if (!audience.success) return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  const includeTicketing = request.nextUrl.searchParams.get("ticketing") !== "0";

  const { counts, eligible } = await inviteAudience(id, audience.data, includeTicketing);
  // With ?list=1 the people themselves come back too (for picking individuals).
  const guests = request.nextUrl.searchParams.get("list") === "1" ? eligible : undefined;
  return NextResponse.json({ counts, guests }, { headers: { "Cache-Control": "no-store" } });
}

const sendSchema = z.object({
  audience: audienceSchema,
  includeTicketing: z.boolean(),
  // Addresses that failed earlier in this run, so they aren't retried forever.
  exclude: z.array(z.string().max(320)).max(500).optional(),
  // When given, only these people are invited (still subject to every skip rule).
  emails: z.array(z.string().max(320)).min(1).max(300).optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { audience, includeTicketing } = parsed.data;
  const exclude = new Set((parsed.data.exclude ?? []).map(normalizeEmail));
  const only = parsed.data.emails ? new Set(parsed.data.emails.map(normalizeEmail)) : null;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY isn't configured" }, { status: 503 });
  }
  const found = await upcomingEvent(id);
  if ("error" in found) return found.error;
  const event = found.event;

  const { eligible } = await inviteAudience(id, audience as InviteAudience, includeTicketing);
  const pending = eligible.filter((g) => !exclude.has(g.email) && (!only || only.has(g.email)));
  const batch = pending.slice(0, CHUNK);

  let sent = 0;
  let stopped: string | null = null;
  const failed: { email: string; reason: string }[] = [];

  for (const [i, guest] of batch.entries()) {
    if (i > 0) await sleep(GAP_MS);

    // Re-check right before sending: they may have opted out or booked since
    // the list was worked out.
    const [optedOut, booked] = await Promise.all([
      prisma.emailOptOut.findUnique({ where: { email: guest.email } }),
      prisma.booking.findFirst({
        where: { eventId: id, status: { not: "cancelled" }, email: { equals: guest.email, mode: "insensitive" } },
        select: { id: true },
      }),
    ]);
    if (optedOut || booked) continue;

    // Claim this guest before emailing. The (night, email) pair is unique, so if
    // two sends run at once (a double click, two tabs) only one of them gets the
    // claim and the other skips this guest: nobody is emailed twice.
    const claim = await prisma.nightInvite.createMany({ data: [{ eventId: id, email: guest.email }], skipDuplicates: true });
    if (claim.count === 0) continue;

    try {
      await sendInviteEmail(guest, event, {
        bookUrl: bookNightUrl(id),
        unsubscribePageUrl: unsubscribePageUrl(guest.email),
        unsubscribeOneClickUrl: unsubscribeOneClickUrl(guest.email),
      });
      sent++;
    } catch (err) {
      // It didn't go out, so release the claim; they stay eligible for another try.
      await prisma.nightInvite.deleteMany({ where: { eventId: id, email: guest.email } }).catch(() => {});
      const reason = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to send invite for ${id} to ${guest.email}:`, err);
      failed.push({ email: guest.email, reason });
      // Out of sending quota: every remaining email would fail too, so stop.
      if (/quota/i.test(reason)) {
        stopped = reason;
        break;
      }
    }
  }

  const remaining = stopped ? pending.length - sent - failed.length : Math.max(0, pending.length - batch.length);
  return NextResponse.json({ sent, failed, stopped, remaining });
}
