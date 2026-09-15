import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const statusSchema = z.object({
  status: z.enum(["new", "contacted", "closed"]),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const inquiry = await prisma.venueInquiry.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return NextResponse.json({ inquiry });
  } catch {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.venueInquiry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }
}
