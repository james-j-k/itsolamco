import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRsvpToken, rsvpUrlFor } from "@/lib/rsvp";

type Params = { params: Promise<{ id: string }> };

// Hands the admin a team's private RSVP link so it can be pasted into a chat
// (Instagram / WhatsApp) instead of emailing. Sends nothing and doesn't mark
// the team as reminded; it just creates the link on first use. Admin-only.
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({ where: { id }, select: { status: true, rsvpToken: true } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "confirmed") {
    return NextResponse.json({ error: "Only confirmed teams have an RSVP link." }, { status: 400 });
  }

  let token = booking.rsvpToken;
  if (!token) {
    token = generateRsvpToken();
    await prisma.booking.update({ where: { id }, data: { rsvpToken: token } });
  }
  return NextResponse.json({ url: rsvpUrlFor(token) }, { headers: { "Cache-Control": "no-store" } });
}
