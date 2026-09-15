import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: { event: { select: { title: true, date: true } } },
  });
  return NextResponse.json({ bookings });
}
