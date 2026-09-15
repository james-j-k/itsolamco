import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { venueInquirySchema, isLikelyBot } from "@/lib/validation";
import { isRateLimited } from "@/lib/rateLimit";
import { sendVenueInquiryEmails } from "@/lib/email";

export async function POST(request: NextRequest) {
  if (isRateLimited(request, "venue-inquiries")) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = venueInquirySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (isLikelyBot(parsed.data)) {
    return NextResponse.json({ id: "ok" }, { status: 201 });
  }

  const { venueName, contactName, email, phone, message } = parsed.data;

  const inquiry = await prisma.venueInquiry.create({
    data: {
      venueName,
      contactName,
      email,
      phone: phone || null,
      message: message || null,
    },
  });

  sendVenueInquiryEmails(inquiry).catch((err) => console.error("Failed to send venue inquiry emails:", err));

  return NextResponse.json({ id: inquiry.id }, { status: 201 });
}
