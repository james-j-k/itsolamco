import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hostAction } from "@/lib/liveQuiz";

type Params = { params: Promise<{ id: string }> };

// Behind the admin login (middleware covers /api/admin/*).
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("continue") }),
  z.object({ type: z.literal("correct"), buzzId: z.number().int() }),
  z.object({ type: z.literal("wrong"), buzzId: z.number().int() }),
  z.object({ type: z.literal("skip"), buzzId: z.number().int() }),
  z.object({ type: z.literal("reveal") }),
  z.object({ type: z.literal("undo") }),
  z.object({ type: z.literal("release"), teamId: z.string().min(1).max(64) }),
  z.object({ type: z.literal("setHide"), hideFromRound: z.number().int().min(1).max(20) }),
  z.object({ type: z.literal("setCarry"), teamId: z.string().min(1).max(64), points: z.number().int().min(-100000).max(100000) }),
  z.object({ type: z.literal("finish") }),
  z.object({ type: z.literal("reopen") }),
  z.object({ type: z.literal("showWinners") }),
  z.object({ type: z.literal("showEnding") }),
]);

// The screen's tap says which step it was made on, so a double tap or a late retry can't act on the wrong question.
const expectSchema = z.object({ step: z.string().max(120), version: z.number().int() });

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const expect = expectSchema.safeParse((body as { expect?: unknown } | null)?.expect);
  const result = await hostAction(id, parsed.data, expect.success ? expect.data : undefined);
  if (!result.ok) return NextResponse.json({ error: result.error, ...(result.stale ? { stale: true } : {}) }, { status: result.status });
  return NextResponse.json({ ok: true });
}
