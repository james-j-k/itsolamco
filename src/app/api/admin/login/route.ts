import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createChallengeToken, createSessionToken, sessionCookieOptions, verifyChallengeToken } from "@/lib/auth";
import { loginSchema, loginSecondStepSchema } from "@/lib/validation";
import { clearFailures, clientIp, lockedForMs, recordFailure, rules, waitText } from "@/lib/loginGuard";
import { checkSecondFactor } from "@/lib/twoFactor";

// A real-looking hash to compare against when the email doesn't exist, so an unknown email takes as long to
// reject as a wrong password does (otherwise the response time would reveal which emails are admins).
const DUMMY_HASH = "$2b$12$jAkAp71X2Jjzpq0CfMOqhOMIh/guf7nSj7CGPT8qD8wlM55xLJN4i";

function tooMany(ms: number) {
  const res = NextResponse.json(
    { error: `Too many attempts. Please try again in ${waitText(ms)}.`, locked: true, retryAfterSeconds: Math.ceil(ms / 1000) },
    { status: 429 },
  );
  res.headers.set("Retry-After", String(Math.ceil(ms / 1000)));
  return res;
}

async function startSession(admin: { id: string; email: string }) {
  const token = await createSessionToken({ adminId: admin.id, email: admin.email });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieOptions.name, token, sessionCookieOptions);
  return response;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ip = clientIp(request);

  // ---- second step: the ticket from the password step plus an authenticator (or recovery) code ----
  if (body && typeof body === "object" && "challenge" in body) {
    const parsed = loginSecondStepSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter your code" }, { status: 400 });

    const ticket = await verifyChallengeToken(parsed.data.challenge);
    if (!ticket) {
      return NextResponse.json({ error: "That sign-in timed out. Please start again.", expired: true }, { status: 401 });
    }

    const ipRule = rules.ip(ip);
    const mfaRule = rules.secondStep(ticket.adminId);
    const locked = await lockedForMs([ipRule.key, mfaRule.key]);
    if (locked > 0) return tooMany(locked);

    const admin = await prisma.admin.findUnique({ where: { id: ticket.adminId }, select: { id: true, email: true, totpEnabledAt: true } });
    const result = admin?.totpEnabledAt ? await checkSecondFactor(admin.id, parsed.data.code) : { ok: false as const };
    if (!admin || !result.ok) {
      const [a, b] = await Promise.all([recordFailure(ipRule), recordFailure(mfaRule)]);
      if (a || b) return tooMany(Math.max(a, b));
      return NextResponse.json({ error: "That code isn't right. Check the code and try again." }, { status: 401 });
    }

    await clearFailures(mfaRule.key);
    return startSession(admin);
  }

  // ---- first step: email and password ----
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const ipRule = rules.ip(ip);
  const acctRule = rules.account(email);
  const locked = await lockedForMs([ipRule.key, acctRule.key]);
  if (locked > 0) return tooMany(locked);

  const admin = await prisma.admin.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);

  if (!admin || !valid) {
    const [a, b] = await Promise.all([recordFailure(ipRule), recordFailure(acctRule)]);
    if (a || b) return tooMany(Math.max(a, b));
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await clearFailures(acctRule.key);

  if (admin.totpEnabledAt && admin.totpSecret) {
    // Password is right, but no session yet: hand back a short-lived ticket and ask for the code.
    return NextResponse.json({ ok: true, needsCode: true, challenge: await createChallengeToken(admin.id) });
  }

  return startSession(admin);
}
