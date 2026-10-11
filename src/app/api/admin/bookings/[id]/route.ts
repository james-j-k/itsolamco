import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
    teamSize: z.number().int().min(1).max(15).optional(),
    email: z.string().trim().email("Enter a valid email").optional(),
    attended: z.boolean().optional(),
    // Tie a booking that has no night yet to an upcoming night.
    eventId: z.string().min(1).max(64).optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.teamSize !== undefined ||
      data.email !== undefined ||
      data.attended !== undefined ||
      data.eventId !== undefined,
    { message: "Provide status, teamSize, email, attended and/or eventId" }
  );

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, ...fields } = parsed.data;

  if (fields.eventId !== undefined) {
    const [existing, event] = await Promise.all([
      prisma.booking.findUnique({ where: { id }, select: { eventId: true } }),
      prisma.event.findUnique({ where: { id: fields.eventId }, select: { date: true } }),
    ]);
    if (!existing) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (existing.eventId) {
      return NextResponse.json({ error: "That team is already tied to a night." }, { status: 409 });
    }
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (event.date.getTime() < Date.now()) {
      return NextResponse.json({ error: "You can only attach a team to an upcoming night." }, { status: 400 });
    }
  }

  try {
    // Everything sent so far (registration + any update emails) went to the
    // old address, so a changed email wipes the "sent" tracking and the admin
    // can resend to the right one. teamSizeEmailSentFor goes back to the
    // current size so only a real size change re-lights the notify button.
    // The same goes for the day-before reminder: the old address's owner may
    // hold a working RSVP link and the real guest never got one, so the token,
    // any reply given through it, and the reminder/nudge flags are all reset
    // (a fresh link is created when the reminder is next sent).
    let emailChange: {
      email?: string;
      emailSent?: boolean;
      statusEmailSentFor?: string | null;
      teamSizeEmailSentFor?: number;
      rsvpToken?: null;
      rsvpStatus?: null;
      rsvpHeadcount?: null;
      rsvpTableBooked?: null;
      rsvpAt?: null;
      reminderSentAt?: null;
      nudgeSentAt?: null;
    } = {};
    if (email !== undefined) {
      const existing = await prisma.booking.findUnique({
        where: { id },
        select: { email: true, teamSize: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      if (existing.email !== email) {
        emailChange = {
          email,
          emailSent: false,
          statusEmailSentFor: null,
          teamSizeEmailSentFor: fields.teamSize ?? existing.teamSize,
          rsvpToken: null,
          rsvpStatus: null,
          rsvpHeadcount: null,
          rsvpTableBooked: null,
          rsvpAt: null,
          reminderSentAt: null,
          nudgeSentAt: null,
        };
      }
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: { ...fields, ...emailChange },
    });
    return NextResponse.json({ booking });
  } catch {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.booking.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
}
