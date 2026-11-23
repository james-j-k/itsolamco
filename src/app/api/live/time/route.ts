import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The server's clock, and nothing else: no database, so the answer is stamped about halfway through the round trip.
// Every screen and phone asks this a few times to work out how far its own clock is off, which is what lets a
// buzz be ranked by when it was pressed instead of when it arrived.
export async function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
