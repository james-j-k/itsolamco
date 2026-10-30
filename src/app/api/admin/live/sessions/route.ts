import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/liveQuiz";

// Behind the admin login (middleware covers /api/admin/*).
const bodySchema = z.object({ quizId: z.string().min(1).max(64) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a quiz." }, { status: 400 });
  const quiz = await prisma.liveQuiz.findUnique({ where: { id: parsed.data.quizId }, select: { id: true } });
  if (!quiz) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  const session = await createSession(quiz.id);
  return NextResponse.json({ id: session.id, code: session.code }, { status: 201 });
}
