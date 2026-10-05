import { randomBytes } from "crypto";

// The token is the only secret in a customer's RSVP link, so it has to be
// unguessable: 24 random bytes (192 bits), URL-safe.
export function generateRsvpToken(): string {
  return randomBytes(24).toString("base64url");
}

export function rsvpUrlFor(token: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://itsolamco.in").replace(/\/+$/, "");
  return `${base}/rsvp/${token}`;
}
