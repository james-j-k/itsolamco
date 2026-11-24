// Server-side helpers for two-step login: keeping the authenticator secret encrypted in the database,
// and the one-time recovery codes (stored only as hashes).
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyTotp } from "@/lib/totp";

// The database never holds the authenticator secret in the clear: if only the database leaks, the codes can't
// be generated. The key comes from TOTP_ENCRYPTION_KEY when that is set, otherwise from SESSION_SECRET.
function encryptionKey(): Buffer {
  const base = process.env.TOTP_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!base) throw new Error("SESSION_SECRET is not set");
  return Buffer.from(hkdfSync("sha256", base, "olam-admin-2fa", "totp-secret-v1", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string | null {
  try {
    const [v, iv, tag, ct] = stored.split(":");
    if (v !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong key (e.g. the session secret was changed) or damaged data
  }
}

// ---- recovery codes: 10 characters from an alphabet with no look-alikes, shown as xxxxx-xxxxx ----
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const RECOVERY_COUNT = 8;

export function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_COUNT }, () => {
    const bytes = randomBytes(10);
    let s = "";
    for (const b of bytes) s += RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length];
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

/** What someone types is forgiving: spaces, dashes and capitals don't matter. */
export function normalizeRecovery(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hashRecovery(code: string): string {
  return createHash("sha256").update(`olam-recovery:${normalizeRecovery(code)}`).digest("hex");
}

export type CodeCheck =
  | { ok: true; kind: "totp" | "recovery" }
  | { ok: false };

/**
 * Checks a 6-digit authenticator code or a recovery code for this admin. A good authenticator code is
 * remembered (so it can't be replayed); a good recovery code is used up. Both writes are conditional, so two
 * requests racing with the same code can't both succeed.
 */
export async function checkSecondFactor(adminId: string, rawCode: string): Promise<CodeCheck> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { totpSecret: true, totpLastStep: true, recoveryHashes: true },
  });
  if (!admin?.totpSecret) return { ok: false };

  const compact = rawCode.replace(/\s+/g, "");
  if (/^\d{6}$/.test(compact)) {
    const secret = decryptSecret(admin.totpSecret);
    if (!secret) return { ok: false };
    const step = verifyTotp(secret, compact, admin.totpLastStep);
    if (step === null) return { ok: false };
    const claimed = await prisma.admin.updateMany({
      where: { id: adminId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return claimed.count === 1 ? { ok: true, kind: "totp" } : { ok: false };
  }

  const wanted = normalizeRecovery(rawCode);
  if (wanted.length !== 10) return { ok: false };
  const hash = hashRecovery(wanted);
  const found = admin.recoveryHashes.find((h) => h.length === hash.length && timingSafeEqual(Buffer.from(h), Buffer.from(hash)));
  if (!found) return { ok: false };
  // Remove exactly that hash, but only if it is still there (a conditional update).
  const used = await prisma.$executeRaw`
    UPDATE "Admin" SET "recoveryHashes" = array_remove("recoveryHashes", ${found}) WHERE "id" = ${adminId} AND ${found} = ANY("recoveryHashes")`;
  return used === 1 ? { ok: true, kind: "recovery" } : { ok: false };
}
