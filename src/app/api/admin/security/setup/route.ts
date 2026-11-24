import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { currentAdminRecord, unauthorized } from "@/lib/adminSecurity";
import { generateTotpSecret, groupKey, otpauthUri } from "@/lib/totp";
import { encryptSecret } from "@/lib/twoFactor";

// Step 1 of turning on two-step login: make a fresh secret and show it as a QR code, a tappable link and a typed key.
// Nothing is switched on yet; that happens only after the admin proves their app works (the "enable" step).
export async function POST() {
  const admin = await currentAdminRecord();
  if (!admin) return unauthorized();
  if (admin.totpEnabledAt && admin.totpSecret) {
    return NextResponse.json({ error: "Two-step login is already on." }, { status: 409 });
  }

  const secret = generateTotpSecret();
  await prisma.admin.update({ where: { id: admin.id }, data: { totpPending: encryptSecret(secret) } });

  const uri = otpauthUri(admin.email, secret);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return NextResponse.json({ uri, qr, key: groupKey(secret) });
}
