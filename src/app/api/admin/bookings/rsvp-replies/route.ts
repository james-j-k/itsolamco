import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Read-only and deliberately tiny: the admin dashboard polls this every few
// seconds-to-minutes to pick up RSVP replies without a page reload. Behind the
// same admin login as the rest of /api/admin (see middleware).
export async function GET() {
  const replies = await prisma.booking.findMany({
    where: { rsvpAt: { not: null } },
    select: { id: true, rsvpStatus: true, rsvpHeadcount: true, rsvpTableBooked: true, rsvpAt: true },
  });
  return NextResponse.json({ replies }, { headers: { "Cache-Control": "no-store" } });
}
