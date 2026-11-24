// Authenticator-app codes (RFC 6238 TOTP over RFC 4226 HOTP, SHA-1, 6 digits, 30-second steps).
// This is what Google Authenticator, Microsoft Authenticator, Authy, 1Password etc. all speak.
// No dependencies other than node:crypto, so it can be tested on its own.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("bad base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random secret: 20 bytes (160 bits) as base32, which is what authenticator apps expect. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin =
    ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function stepAt(timeMs: number): number {
  return Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
}

export function totpAt(secretBase32: string, timeMs: number): string {
  return hotp(base32Decode(secretBase32), stepAt(timeMs));
}

/**
 * Checks a 6-digit code against the current 30-second slot and the one either side (phone clocks drift).
 * Returns the slot number that matched, or null. `lastStep` is the newest slot already accepted for this
 * admin: a code from that slot or an older one is refused, so a code can only ever be used once.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  lastStep: number | null,
  nowMs: number = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const now = stepAt(nowMs);
  let matched: number | null = null;
  for (let step = now - 1; step <= now + 1; step++) {
    const expected = Buffer.from(hotp(secret, step));
    const given = Buffer.from(code);
    // Check every slot (no early exit) so the time taken doesn't reveal which one matched.
    if (timingSafeEqual(expected, given) && (lastStep === null || step > lastStep)) matched = step;
  }
  return matched;
}

/** The link an authenticator app opens (also what the QR code holds). */
export function otpauthUri(email: string, secretBase32: string, issuer = "It's Olam Company"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

/** "ABCD EFGH ..." for reading the key out loud or typing it by hand. */
export function groupKey(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, "$1 ").trim();
}
