import { NextRequest, NextResponse, after } from "next/server";
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

  // Same email registering twice for the same night is almost always a
  // mistake (or a change of mind) rather than a second real team — point
  // them at Instagram to fix it instead of silently creating a duplicate
  // for the admin to spot and clean up by hand. Cancelled bookings don't
  // count, so someone can always re-register after cancelling.
  const existing = await prisma.booking.findFirst({
    where: { email, eventId: eventId || null, status: { not: "cancelled" } },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "You've already got a booking in for this night. DM us on Instagram if you need to change your team size or details.",
      },
      { status: 409 }
    );
  }

  const booking = await prisma.booking.create({
    data: {
      teamName,
      contactName,
      email,
      teamSize,
      phone: phone || null,
      message: message || null,
      eventId: eventId || null,
      // Starts equal to the just-registered size so the admin panel's
      // "notify" button doesn't light up until the size is actually edited.
      teamSizeEmailSentFor: teamSize,
    },
    include: { event: { select: { title: true, date: true } } },
  });

  // Fire-and-forget alone isn't enough here: on Vercel's serverless runtime,
  // the function execution can be frozen the instant the response is sent,
  // killing any still-pending promise before it finishes. after() keeps the
  // invocation alive (via Vercel's waitUntil) until this completes.
  after(async () => {
    try {
      const sent = await sendBookingEmails(booking);
      if (sent) {
        await prisma.booking.update({ where: { id: booking.id }, data: { emailSent: true } });
      }
    } catch (err) {
      console.error("Failed to send booking emails:", err);
    }
  });

  return NextResponse.json({ id: booking.id }, { status: 201 });
}
