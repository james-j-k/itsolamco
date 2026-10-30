import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { submitGuess } from "@/lib/liveQuiz";

type Params = { params: Promise<{ code: string }> };

const bodySchema = z.object({ teamId: z.string().min(1).max(64), value: z.number().int() });

// The tie-breaker: each tied team sends one number.
export async function POST(request: NextRequest, { params }: Params) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a whole number." }, { status: 400 });
  const { code } = await params;
  const result = await submitGuess(code, parsed.data.teamId, request.headers.get("x-team-token") ?? "", parsed.data.value);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
