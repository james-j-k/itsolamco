import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rateLimit";
import { normalizeEmail, verifyUnsubscribeToken } from "@/lib/unsubscribe";

// Public. Records that someone doesn't want emails about new nights.
// Reached two ways: the confirm button on /unsubscribe (a normal form post) and
// the one-tap "Unsubscribe" in mail apps (a POST with List-Unsubscribe=One-Click).
// Either way the signed link must match the address, so it can't be used on
// someone else's. A GET never changes anything.
export async function POST(request: NextRequest) {
  if (isRateLimited(request, "unsubscribe", 30)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  let email = params.get("e") ?? "";
  let token = params.get("t") ?? "";
  let fromForm = false;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = new URLSearchParams(await request.text().catch(() => ""));
    if (form.has("e") && form.has("t")) {
      email = form.get("e") ?? "";
      token = form.get("t") ?? "";
      fromForm = true;
    }
  }

  if (!verifyUnsubscribeToken(email, token)) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 400 });
  }

  const normalized = normalizeEmail(email);
  await prisma.emailOptOut.upsert({ where: { email: normalized }, create: { email: normalized }, update: {} });

  if (fromForm) {
    const url = new URL("/unsubscribe", request.url);
    url.searchParams.set("e", normalized);
    url.searchParams.set("t", token);
    url.searchParams.set("done", "1");
    return NextResponse.redirect(url, 303);
  }
  return NextResponse.json({ ok: true });
}
