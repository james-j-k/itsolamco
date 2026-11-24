import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentAdminRecord, guardAttempt, unauthorized } from "@/lib/adminSecurity";
import { checkSecondFactor } from "@/lib/twoFactor";
import { clearFailures, rules } from "@/lib/loginGuard";

const schema = z.object({ password: z.string().min(1).max(500), code: z.string().trim().min(6).max(30) });

// Turning two-step login off needs BOTH the password and a current code, so a stolen sign-in alone can't switch it off.
export async function POST(request: NextRequest) {
  const admin = await currentAdminRecord();
  if (!admin) return unauthorized();
  if (!(admin.totpEnabledAt && admin.totpSecret)) return NextResponse.json({ error: "Two-step login is already off." }, { status: 409 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your password and a code" }, { status: 400 });

  const acct = rules.account(admin.email);
  const guard = await guardAttempt(request, admin.id, admin.email, [acct]);
  if (guard.blocked) return guard.blocked;

  const passwordOk = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  const codeOk = (await checkSecondFactor(admin.id, parsed.data.code)).ok;
  if (!passwordOk || !codeOk) return guard.fail("The password or the code isn't right.");

  await prisma.admin.update({
    where: { id: admin.id },
    data: { totpSecret: null, totpPending: null, totpEnabledAt: null, totpLastStep: null, recoveryHashes: [] },
  });
  await Promise.all([clearFailures(rules.secondStep(admin.id).key), clearFailures(acct.key)]);
  return NextResponse.json({ ok: true });
}
