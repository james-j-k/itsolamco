import { NextRequest, NextResponse } from "next/server";
import { currentVersion, getLiveState, tick } from "@/lib/liveQuiz";

type Params = { params: Promise<{ id: string }> };
const noStore = { "Cache-Control": "no-store" };

// The projector (view=screen) and the quizmaster's phone (view=host) poll this.
// Pass the version you already have as ?v= and an unchanged night answers in one tiny query.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const view = request.nextUrl.searchParams.get("view") === "host" ? "host" : "screen";
  const vParam = request.nextUrl.searchParams.get("v");
  const known = vParam === null || vParam === "" ? NaN : Number(vParam); // no ?v= means "send me everything"

  await tick(id);
  const version = await currentVersion(id);
  if (version === null) return NextResponse.json({ error: "Session not found" }, { status: 404, headers: noStore });
  if (Number.isFinite(known) && known === version) return NextResponse.json({ unchanged: true, now: Date.now() }, { headers: noStore });

  const state = await getLiveState(id, view);
  if (!state) return NextResponse.json({ error: "Session not found" }, { status: 404, headers: noStore });
  return NextResponse.json({ state }, { headers: noStore });
}
