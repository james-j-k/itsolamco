import { NextRequest, NextResponse } from "next/server";
import { currentVersion, getTeamState, sessionIdForCode, tick } from "@/lib/liveQuiz";

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

  const sessionId = await sessionIdForCode(code);
  if (!sessionId) return NextResponse.json({ error: "We can't find that night." }, { status: 404, headers: noStore });
  await tick(sessionId);
  const version = await currentVersion(sessionId);
  if (version !== null && Number.isFinite(known) && known === version) {
    return NextResponse.json({ unchanged: true, now: Date.now() }, { headers: noStore });
  }

  const state = await getTeamState(code, teamId, token);
  if ("ok" in state && state.ok === false) return NextResponse.json({ error: state.error }, { status: state.status, headers: noStore });
  return NextResponse.json({ state }, { headers: noStore });
}
