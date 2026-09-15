import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventSchema } from "@/lib/validation";

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { date: "asc" },
    include: { _count: { select: { bookings: true } } },
  });
  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { theme, date, ...rest } = parsed.data;
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: { ...rest, theme: theme || null, date: parsedDate },
  });

  return NextResponse.json({ event }, { status: 201 });
}
