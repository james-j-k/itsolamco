import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentAdminRecord, guardAttempt, unauthorized } from "@/lib/adminSecurity";
import { verifyTotp } from "@/lib/totp";
import { decryptSecret, hashRecovery, newRecoveryCodes } from "@/lib/twoFactor";
import { clearFailures, rules } from "@/lib/loginGuard";

const schema = z.object({ code: z.string().trim().min(6).max(12) });

// Step 2: the admin types the 6-digit code their app is showing. Only a correct code switches two-step login on,
// so a typo in the key can never lock the owner out. The one-time recovery codes are returned here, once.
export async function POST(request: NextRequest) {
  const admin = await currentAdminRecord();
  if (!admin) return unauthorized();
  if (admin.totpEnabledAt && admin.totpSecret) return NextResponse.json({ error: "Two-step login is already on." }, { status: 409 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the 6-digit code from your app" }, { status: 400 });

  const guard = await guardAttempt(request, admin.id, admin.email);
  if (guard.blocked) return guard.blocked;

  const secret = admin.totpPending ? decryptSecret(admin.totpPending) : null;
  if (!secret) return NextResponse.json({ error: "Start the setup again to get a new key.", restart: true }, { status: 409 });

  const step = verifyTotp(secret, parsed.data.code.replace(/\s+/g, ""), null);
  if (step === null) return guard.fail("That code isn't right. Check the code in your app and try again.");

  const codes = newRecoveryCodes();
  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      totpSecret: admin.totpPending,
      totpPending: null,
      totpEnabledAt: new Date(),
      totpLastStep: step,
      recoveryHashes: codes.map(hashRecovery),
    },
  });
  await clearFailures(rules.secondStep(admin.id).key);
  return NextResponse.json({ ok: true, recoveryCodes: codes });
}
