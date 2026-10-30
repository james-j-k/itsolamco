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
  z.object({ type: z.literal("finish") }),
]);

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const result = await hostAction(id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
