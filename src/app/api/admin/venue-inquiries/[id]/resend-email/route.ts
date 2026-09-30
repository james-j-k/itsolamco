import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVenueInquiryEmails } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const inquiry = await prisma.venueInquiry.findUnique({ where: { id } });
  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  try {
    const sent = await sendVenueInquiryEmails(inquiry);
    if (!sent) {
      return NextResponse.json({ error: "RESEND_API_KEY isn't configured" }, { status: 503 });
    }
    await prisma.venueInquiry.update({ where: { id }, data: { emailSent: true } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to resend venue inquiry emails:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }
}
