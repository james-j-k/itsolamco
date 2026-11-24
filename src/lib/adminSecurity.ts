// Shared bits for the "Security" routes (turn two-step login on or off, new recovery codes).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/session";
import { clientIp, lockedForMs, recordFailure, rules, waitText, type Rule } from "@/lib/loginGuard";

/** The signed-in admin's full record, or null when nobody is signed in. (The middleware already blocks strangers; this is a second lock.) */
export async function currentAdminRecord() {
  const session = await getCurrentAdmin();
  if (!session) return null;
  return prisma.admin.findUnique({ where: { id: session.adminId } });
}

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

/** Every step that checks a code or a password is limited exactly like the sign-in page. */
export async function guardAttempt(request: NextRequest, adminId: string, email: string, extra: Rule[] = []) {
  const ipRule = rules.ip(clientIp(request));
  const mfaRule = rules.secondStep(adminId);
  const keys = [ipRule.key, mfaRule.key, ...extra.map((r) => r.key)];
  const locked = await lockedForMs(keys);
  const res = (ms: number) =>
    NextResponse.json({ error: `Too many attempts. Please try again in ${waitText(ms)}.`, locked: true }, { status: 429, headers: { "Retry-After": String(Math.ceil(ms / 1000)) } });

  return {
    blocked: locked > 0 ? res(locked) : null,
    /** Count a wrong answer and return the response to send. */
    fail: async (message: string, rulesToCount: Rule[] = [ipRule, mfaRule, ...extra]) => {
      const locks = await Promise.all(rulesToCount.map((r) => recordFailure(r)));
      const longest = Math.max(0, ...locks);
      return longest > 0 ? res(longest) : NextResponse.json({ error: message }, { status: 401 });
    },
    email,
  };
}
