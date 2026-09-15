import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookingSchema, isLikelyBot } from "@/lib/validation";
import { isRateLimited } from "@/lib/rateLimit";
import { sendBookingEmails } from "@/lib/email";

export async function POST(request: NextRequest) {
  if (isRateLimited(request, "bookings")) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Bots get a fake success so they don't learn they were caught.
  if (isLikelyBot(parsed.data)) {
    return NextResponse.json({ id: "ok" }, { status: 201 });
  }

  const { teamName, contactName, email, teamSize, eventId, phone, message } = parsed.data;

  const booking = await prisma.booking.create({
    data: {
      teamName,
      contactName,
      email,
      teamSize,
      phone: phone || null,
      message: message || null,
      eventId: eventId || null,
    },
    include: { event: { select: { title: true, date: true } } },
  });

  sendBookingEmails(booking).catch((err) => console.error("Failed to send booking emails:", err));

  return NextResponse.json({ id: booking.id }, { status: 201 });
}
