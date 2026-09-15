import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const inquiries = await prisma.venueInquiry.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ inquiries });
}
