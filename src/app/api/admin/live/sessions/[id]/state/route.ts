import { NextRequest, NextResponse } from "next/server";
import { getLiveState, pollHead } from "@/lib/liveQuiz";

type Params = { params: Promise<{ id: string }> };
const noStore = { "Cache-Control": "no-store" };

// The projector (view=screen) and the quizmaster's phone (view=host) poll this.
// Pass the version you already have as ?v= and an unchanged night answers in one tiny query.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const view = request.nextUrl.searchParams.get("view") === "host" ? "host" : "screen";
  const vParam = request.nextUrl.searchParams.get("v");
  const known = vParam === null || vParam === "" ? NaN : Number(vParam); // no ?v= means "send me everything"

  const head = await pollHead({ id }); // one query when nothing has changed
  if (!head) return NextResponse.json({ error: "Session not found" }, { status: 404, headers: noStore });
  if (Number.isFinite(known) && known === head.version) return NextResponse.json({ unchanged: true, now: Date.now() }, { headers: noStore });

  const state = await getLiveState(id, view);
  if (!state) return NextResponse.json({ error: "Session not found" }, { status: 404, headers: noStore });
  return NextResponse.json({ state }, { headers: noStore });
}
