import { NextRequest, NextResponse } from "next/server";
import { getTeamState, pollHead } from "@/lib/liveQuiz";

type Params = { params: Promise<{ code: string }> };
const noStore = { "Cache-Control": "no-store" };

// A team phone's view of the night. The phone's secret travels in a header, not the address.
// It never contains scores or answers.
export async function GET(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const teamId = request.nextUrl.searchParams.get("team") ?? "";
  const token = request.headers.get("x-team-token") ?? "";
  const vParam = request.nextUrl.searchParams.get("v");
  const known = vParam === null || vParam === "" ? NaN : Number(vParam); // no ?v= means "send me everything"

  const head = await pollHead({ code }); // one query when nothing has changed
  if (!head) return NextResponse.json({ error: "We can't find that night." }, { status: 404, headers: noStore });
  if (Number.isFinite(known) && known === head.version) return NextResponse.json({ unchanged: true, now: Date.now() }, { headers: noStore });

  const state = await getTeamState(code, teamId, token);
  if ("ok" in state && state.ok === false) return NextResponse.json({ error: state.error }, { status: state.status, headers: noStore });
  return NextResponse.json({ state }, { headers: noStore });
}
