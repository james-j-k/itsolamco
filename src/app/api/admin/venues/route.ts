import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { venueSchema } from "@/lib/validation";

export async function GET() {
  const venues = await prisma.venue.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ venues });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = venueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { area, ...rest } = parsed.data;
  const venue = await prisma.venue.create({ data: { ...rest, area: area || null } });
  return NextResponse.json({ venue }, { status: 201 });
}
