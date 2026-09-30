import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingStatusEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// Manually triggered by the admin — never called automatically when a
// booking's status changes. Sends whatever email matches the booking's
// *current* status (confirmed/cancelled); there's no email for "pending".
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { event: { select: { title: true, date: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "confirmed" && booking.status !== "cancelled") {
    return NextResponse.json({ error: "No status email for a pending booking" }, { status: 400 });
  }

  try {
    const sent = await sendBookingStatusEmail(booking, booking.status);
    if (!sent) {
      return NextResponse.json({ error: "RESEND_API_KEY isn't configured" }, { status: 503 });
    }
    const updated = await prisma.booking.update({
      where: { id },
      data: { statusEmailSentFor: booking.status },
    });
    return NextResponse.json({ statusEmailSentFor: updated.statusEmailSentFor });
  } catch (err) {
    console.error("Failed to send booking status email:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }
}
