import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ bookingIds: z.array(z.string().min(1).max(64)).min(1).max(300) });

// Ties bookings that have no night yet (people who picked "any upcoming night"
// while nothing was scheduled) to an upcoming night. Only bookings with no night
// are touched; one that already has a night is left exactly as it is.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { id }, select: { date: true } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.date.getTime() < Date.now()) {
    return NextResponse.json({ error: "You can only attach teams to an upcoming night." }, { status: 400 });
  }

  const result = await prisma.booking.updateMany({
    where: { id: { in: parsed.data.bookingIds }, eventId: null },
    data: { eventId: id },
  });
  return NextResponse.json({ attached: result.count });
}
