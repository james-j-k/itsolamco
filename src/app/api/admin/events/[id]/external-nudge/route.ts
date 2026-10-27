import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendExternalTicketEmail } from "@/lib/email";
import { safeHttpUrl } from "@/lib/eventLinks";

type Params = { params: Promise<{ id: string }> };

// Same pacing as the reminder emails: a few per call, spaced for Resend's rate
// limit; the admin page keeps calling with the cursor until it's done.
const CHUNK = 5;
const GAP_MS = 600;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Registered on our site for this night, never confirmed, not asked yet.
const waitingWhere = (eventId: string) => ({
  eventId,
  status: "pending",
  source: "website",
});

async function loadNight(id: string) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) } as const;
  const url = safeHttpUrl(event.externalTicketUrl);
  if (!url) return { error: NextResponse.json({ error: "This night isn't set to book on another site." }, { status: 400 }) } as const;
  if (event.date.getTime() < Date.now()) {
    return { error: NextResponse.json({ error: "That night has already happened." }, { status: 400 }) } as const;
  }
  return { event, url, label: event.externalTicketLabel || "the ticket site" } as const;
}

// Counts only; sends nothing.
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const night = await loadNight(id);
  if ("error" in night) return night.error;
  const [toAsk, alreadyAsked] = await Promise.all([
    prisma.booking.count({ where: { ...waitingWhere(id), externalAskedAt: null } }),
    prisma.booking.count({ where: { ...waitingWhere(id), externalAskedAt: { not: null } } }),
  ]);
  return NextResponse.json({ toAsk, alreadyAsked, label: night.label, url: night.url }, { headers: { "Cache-Control": "no-store" } });
}

const bodySchema = z.object({ cursor: z.string().nullish() });

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY isn't configured" }, { status: 503 });

  const night = await loadNight(id);
  if ("error" in night) return night.error;

  const batch = await prisma.booking.findMany({
    where: { ...waitingWhere(id), externalAskedAt: null, ...(parsed.data.cursor ? { id: { gt: parsed.data.cursor } } : {}) },
    orderBy: { id: "asc" },
    take: CHUNK,
  });

  const sentIds: string[] = [];
  const failed: { teamName: string; reason: string }[] = [];
  let stopped: string | null = null;

  for (const [i, queued] of batch.entries()) {
    if (i > 0) await sleep(GAP_MS);

    // Claim the booking before sending, so two clicks (or two tabs) can't email
    // the same person twice. If the send fails, the claim is released.
    const claim = await prisma.booking.updateMany({
      where: { id: queued.id, ...waitingWhere(id), externalAskedAt: null },
      data: { externalAskedAt: new Date() },
    });
    if (claim.count === 0) continue;

    try {
      await sendExternalTicketEmail(queued, night.event, night.url, night.label);
      sentIds.push(queued.id);
    } catch (err) {
      await prisma.booking.update({ where: { id: queued.id }, data: { externalAskedAt: null } });
      const reason = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to send the book-elsewhere email to booking ${queued.id}:`, err);
      failed.push({ teamName: queued.teamName, reason });
      if (/quota/i.test(reason)) {
        stopped = reason;
        break;
      }
    }
  }

  const nextCursor = !stopped && batch.length === CHUNK ? batch[batch.length - 1].id : null;
  return NextResponse.json({ sentIds, failed, stopped, nextCursor });
}
