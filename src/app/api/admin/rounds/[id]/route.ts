import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { quizRoundSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = quizRoundSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const round = await prisma.quizRound.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ round });
  } catch {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.quizRound.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
}
