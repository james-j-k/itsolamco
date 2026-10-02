import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
    teamSize: z.number().int().min(1).max(15).optional(),
    email: z.string().trim().email("Enter a valid email").optional(),
  })
  .refine((data) => data.status !== undefined || data.teamSize !== undefined || data.email !== undefined, {
    message: "Provide status, teamSize and/or email",
  });

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, ...fields } = parsed.data;

  try {
    // Everything sent so far (registration + any update emails) went to the
    // old address, so a changed email wipes the "sent" tracking and the admin
    // can resend to the right one. teamSizeEmailSentFor goes back to the
    // current size so only a real size change re-lights the notify button.
    let emailChange: {
      email?: string;
      emailSent?: boolean;
      statusEmailSentFor?: string | null;
      teamSizeEmailSentFor?: number;
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
