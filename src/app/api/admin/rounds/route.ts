import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { quizRoundSchema } from "@/lib/validation";

export async function GET() {
  const rounds = await prisma.quizRound.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ rounds });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = quizRoundSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const round = await prisma.quizRound.create({ data: parsed.data });
  return NextResponse.json({ round }, { status: 201 });
}
