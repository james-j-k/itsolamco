import { createHmac, timingSafeEqual } from "node:crypto";

// Unsubscribe links carry the email plus a signature only this server can
// make, so nobody can opt someone else out by guessing a URL. No tokens are
// stored: the signature is recomputed and compared on every visit.

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET isn't configured");
  return value;
}

function sign(email: string): string {
  return createHmac("sha256", secret()).update(`unsubscribe:${normalizeEmail(email)}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!email || !token) return false;
  const expected = Buffer.from(sign(email));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://itsolamco.in").replace(/\/$/, "");
}

// The page a person lands on (asks "stop these emails?" before doing anything).
export function unsubscribePageUrl(email: string): string {
  return `${siteBase()}/unsubscribe?e=${encodeURIComponent(normalizeEmail(email))}&t=${sign(email)}`;
}

// The endpoint mail apps call for the one-tap "Unsubscribe" button.
export function unsubscribeOneClickUrl(email: string): string {
  return `${siteBase()}/api/unsubscribe?e=${encodeURIComponent(normalizeEmail(email))}&t=${sign(email)}`;
}

export function bookNightUrl(eventId: string): string {
  return `${siteBase()}/?book=${encodeURIComponent(eventId)}`;
}
