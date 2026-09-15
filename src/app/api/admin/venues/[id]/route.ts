import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { venueSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = venueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { area, ...rest } = parsed.data;

  try {
    const venue = await prisma.venue.update({ where: { id }, data: { ...rest, area: area || null } });
    return NextResponse.json({ venue });
  } catch {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.venue.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }
}
