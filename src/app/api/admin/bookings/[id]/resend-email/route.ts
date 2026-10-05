import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingEmails } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { event: { select: { title: true, date: true, venueName: true, venueArea: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  try {
    const sent = await sendBookingEmails(booking);
    if (!sent) {
      return NextResponse.json({ error: "RESEND_API_KEY isn't configured" }, { status: 503 });
    }
    await prisma.booking.update({ where: { id }, data: { emailSent: true } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to resend booking emails:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }
}
