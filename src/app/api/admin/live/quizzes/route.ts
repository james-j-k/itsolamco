import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { importQuiz } from "@/lib/liveQuiz";

// Behind the admin login (middleware covers /api/admin/*).
const questionSchema = z.object({
  kind: z.enum(["text", "emoji", "audio"]),
  prompt: z.string().trim().min(1).max(600),
  hint: z.string().trim().max(200).nullish(),
  answer: z.string().trim().min(1).max(200),
  note: z.string().trim().max(400).nullish(),
  audioUrl: z.string().trim().max(500).nullish(),
});

const quizSchema = z.object({
  title: z.string().trim().min(1).max(160),
  tiebreak: z.object({ prompt: z.string().trim().min(1).max(400), answer: z.string().trim().regex(/^\d{1,6}$/) }).nullish(),
  rounds: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        blurb: z.string().trim().max(400).optional(),
        rightPoints: z.number().int().min(1).max(1000),
        wrongPenalty: z.number().int().min(0).max(1000),
        placeDecay: z.boolean(),
        questions: z.array(questionSchema).min(1).max(100),
      })
    )
    .min(1)
    .max(12),
});

export async function POST(request: NextRequest) {
  const parsed = quizSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That quiz file isn't valid.", issues: parsed.error.flatten() }, { status: 400 });
  const id = await importQuiz(parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}
