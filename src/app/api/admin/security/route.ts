import { NextResponse } from "next/server";
import { currentAdminRecord, unauthorized } from "@/lib/adminSecurity";

export const dynamic = "force-dynamic";

// Is two-step login on for the signed-in admin? (Never returns any secret.)
export async function GET() {
  const admin = await currentAdminRecord();
  if (!admin) return unauthorized();
  return NextResponse.json({
    email: admin.email,
    enabled: Boolean(admin.totpEnabledAt && admin.totpSecret),
    enabledAt: admin.totpEnabledAt,
    recoveryLeft: admin.recoveryHashes.length,
  });
}
