import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReminderEmail } from "@/lib/email";
import { generateRsvpToken, rsvpUrlFor } from "@/lib/rsvp";

type Params = { params: Promise<{ id: string }> };

// A deliberate click can resend as often as the admin likes, but two clicks
// within this window are almost certainly an accident (double-click, two tabs)
// and would just email the guest twice in a row.
const COOLDOWN_MS = 30_000;

// Sends (or resends) the day-before reminder to ONE team. Same email and the
// same private RSVP link as the batch send; the batch panel is untouched.
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY isn't configured" }, { status: 503 });
  }

  const booking = await prisma.booking.findUnique({ where: { id }, include: { event: true } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "confirmed") {
    return NextResponse.json({ error: "Only confirmed teams get a reminder." }, { status: 400 });
  }
  if (!booking.event) {
    return NextResponse.json({ error: "This booking isn't tied to a night yet." }, { status: 400 });
  }
  if (booking.event.date.getTime() < Date.now()) {
    return NextResponse.json({ error: "That night has already happened." }, { status: 400 });
  }
  if (booking.reminderSentAt && Date.now() - booking.reminderSentAt.getTime() < COOLDOWN_MS) {
    return NextResponse.json(
      { error: "A reminder was just sent to this team. Give it a few seconds." },
      { status: 429 }
    );
  }

  try {
    let token = booking.rsvpToken;
    if (!token) {
      token = generateRsvpToken();
      await prisma.booking.update({ where: { id }, data: { rsvpToken: token } });
    }
    await sendReminderEmail(booking, booking.event, rsvpUrlFor(token));
    const updated = await prisma.booking.update({ where: { id }, data: { reminderSentAt: new Date() } });
    return NextResponse.json({ reminderSentAt: updated.reminderSentAt?.toISOString() ?? null });
  } catch (err) {
    console.error(`Failed to send reminder to booking ${id}:`, err);
    const reason = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Couldn't send: ${reason}` }, { status: 502 });
  }
}
