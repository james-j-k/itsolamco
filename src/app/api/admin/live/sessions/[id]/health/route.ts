import { NextRequest, NextResponse } from "next/server";
import { getTeamHealth } from "@/lib/liveQuiz";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// How each team's phone is connected (its quickest round trip, its clock, when it last checked in).
// Behind the admin login (middleware covers /api/admin/*). Kept apart from the quiz state so checking in never changes the version.
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  return NextResponse.json(await getTeamHealth(id), { headers: { "Cache-Control": "no-store" } });
}
