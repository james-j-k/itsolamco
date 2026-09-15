import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  await prisma.booking.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
}
