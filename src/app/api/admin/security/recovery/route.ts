import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentAdminRecord, guardAttempt, unauthorized } from "@/lib/adminSecurity";
import { checkSecondFactor, hashRecovery, newRecoveryCodes } from "@/lib/twoFactor";
import { clearFailures, rules } from "@/lib/loginGuard";

const schema = z.object({ code: z.string().trim().min(6).max(30) });

// Make a fresh set of recovery codes (the old ones stop working). Needs a current code from the app.
export async function POST(request: NextRequest) {
  const admin = await currentAdminRecord();
  if (!admin) return unauthorized();
  if (!(admin.totpEnabledAt && admin.totpSecret)) return NextResponse.json({ error: "Turn on two-step login first." }, { status: 409 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a code from your app" }, { status: 400 });

  const guard = await guardAttempt(request, admin.id, admin.email);
  if (guard.blocked) return guard.blocked;

  if (!(await checkSecondFactor(admin.id, parsed.data.code)).ok) return guard.fail("That code isn't right.");

  const codes = newRecoveryCodes();
  await prisma.admin.update({ where: { id: admin.id }, data: { recoveryHashes: codes.map(hashRecovery) } });
  await clearFailures(rules.secondStep(admin.id).key);
  return NextResponse.json({ ok: true, recoveryCodes: codes });
}
