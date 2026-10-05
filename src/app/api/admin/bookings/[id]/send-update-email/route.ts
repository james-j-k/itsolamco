import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingUpdateEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// Manually triggered by the admin — never called automatically when a
// booking's status or team size changes. Sends one combined email covering
// whichever of (status, teamSize) actually differ from what was last
// notified; refuses if nothing has changed since the last send.
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { event: { select: { title: true, date: true, venueName: true, venueArea: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const statusChanged = booking.status !== "pending" && booking.status !== booking.statusEmailSentFor;
  const sizeChanged = booking.teamSize !== booking.teamSizeEmailSentFor;
  if (!statusChanged && !sizeChanged) {
    return NextResponse.json({ error: "Nothing to notify" }, { status: 400 });
  }

  try {
    const sent = await sendBookingUpdateEmail(booking, { statusChanged, sizeChanged });
    if (!sent) {
      return NextResponse.json({ error: "RESEND_API_KEY isn't configured" }, { status: 503 });
    }
    const updated = await prisma.booking.update({
      where: { id },
      data: { statusEmailSentFor: booking.status, teamSizeEmailSentFor: booking.teamSize },
    });
    return NextResponse.json({
      statusEmailSentFor: updated.statusEmailSentFor,
      teamSizeEmailSentFor: updated.teamSizeEmailSentFor,
    });
  } catch (err) {
    console.error("Failed to send booking update email:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }
}
