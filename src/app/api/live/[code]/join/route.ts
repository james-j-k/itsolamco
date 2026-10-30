import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRateLimited } from "@/lib/rateLimit";
import { joinTeam } from "@/lib/liveQuiz";

type Params = { params: Promise<{ code: string }> };

const bodySchema = z.object({ name: z.string().max(60), token: z.string().min(16).max(80) });

// A team's phone joins the night. Many phones share the pub's Wi-Fi (one address),
// so the limit is generous: it only stops a script hammering the endpoint.
export async function POST(request: NextRequest, { params }: Params) {
  if (isRateLimited(request, "live-join", 300)) return NextResponse.json({ error: "Too many tries. Wait a minute." }, { status: 429 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a team name." }, { status: 400 });
  const { code } = await params;
  const result = await joinTeam(code, parsed.data.name, parsed.data.token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ team: result.team });
}
