import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buzz, pollHead, reportHealth } from "@/lib/liveQuiz";

type Params = { params: Promise<{ code: string }> };

// pressedAt: when the button was pressed, on the server's clock (the phone works that out), so a slow connection doesn't cost a place.
const bodySchema = z.object({ teamId: z.string().min(1).max(64), questionId: z.string().min(1).max(64).optional(), pressedAt: z.number().finite().optional(), warm: z.boolean().optional(), rttMs: z.number().finite().min(0).max(120000).optional(), offsetMs: z.number().finite().min(-86400000).max(86400000).optional() });

export async function POST(request: NextRequest, { params }: Params) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { code } = await params;
  // A phone pings this every so often before the quiz starts, so the server is already awake (not a cold start)
  // when the first real buzz arrives. It never buzzes.
  // It also carries how the phone's connection is doing, for the quizmaster's pre-night check.
  if (parsed.data.warm) {
    await pollHead({ code });
    await reportHealth(code, parsed.data.teamId, request.headers.get("x-team-token") ?? "", parsed.data.rttMs, parsed.data.offsetMs);
    return NextResponse.json({ ok: true, warm: true });
  }
  const result = await buzz(code, parsed.data.teamId, request.headers.get("x-team-token") ?? "", { questionId: parsed.data.questionId, pressedAt: parsed.data.pressedAt });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, place: result.place });
}
