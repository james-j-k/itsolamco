import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  await prisma.venueInquiry.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
}
