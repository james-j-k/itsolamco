import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
    teamSize: z.number().int().min(1).max(15).optional(),
  })
  .refine((data) => data.status !== undefined || data.teamSize !== undefined, {
    message: "Provide status and/or teamSize",
  });

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const booking = await prisma.booking.update({
      where: { id },
      data: parsed.data,
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
