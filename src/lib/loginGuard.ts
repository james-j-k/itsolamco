// Failed-login limiter and lockout for the admin sign-in.
//
// The counters live in the database (the AuthThrottle table), so every serverless copy of the site sees the same
// numbers. The old limiter kept its count in memory, which meant each copy had its own, so an attacker simply got
// a fresh allowance on every copy.
//
// Three things are counted, each on its own key, and a lock on any one of them blocks the attempt:
//   ip    - failures from one address                      (stops one machine hammering the site)
//   acct  - failures against one email, from anywhere     (stops a spread-out guessing run on the owner's account)
//   mfa   - wrong second-step codes for one admin          (a 6-digit code must never be guessable)
// Each time a key trips, the next lock on it is twice as long (up to a cap) until it has been quiet for a day.
// The caps are deliberately modest, so a stranger who keeps failing against the owner's email can slow the owner
// down for at most half an hour, never lock them out for good.
import { prisma } from "@/lib/prisma";

export type Rule = { key: string; max: number; windowMs: number; lockMs: number; maxLockMs: number };

const MIN = 60_000;
const HOUR = 60 * MIN;
const STRIKE_MEMORY_MS = 24 * HOUR;

export const rules = {
  ip: (ip: string): Rule => ({ key: `ip:${ip}`, max: 10, windowMs: 15 * MIN, lockMs: 15 * MIN, maxLockMs: 6 * HOUR }),
  account: (email: string): Rule => ({ key: `acct:${email.trim().toLowerCase()}`, max: 8, windowMs: 15 * MIN, lockMs: 10 * MIN, maxLockMs: 30 * MIN }),
  secondStep: (adminId: string): Rule => ({ key: `mfa:${adminId}`, max: 5, windowMs: 15 * MIN, lockMs: 15 * MIN, maxLockMs: 2 * HOUR }),
};

/** The visitor's address. On Vercel the platform sets these headers itself, so a visitor can't choose them. */
export function clientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** How many milliseconds the longest lock among these keys still has to run (0 = none are locked). */
export async function lockedForMs(keys: string[]): Promise<number> {
  const now = Date.now();
  const rows = await prisma.authThrottle.findMany({
    where: { key: { in: keys }, lockedUntil: { gt: new Date(now) } },
    select: { lockedUntil: true },
  });
  let longest = 0;
  for (const r of rows) if (r.lockedUntil) longest = Math.max(longest, r.lockedUntil.getTime() - now);
  return longest;
}

/** Counts one failure against a key, and locks it when the allowance is used up. Returns the lock length if it just locked. */
export async function recordFailure(rule: Rule): Promise<number> {
  // One single statement does the whole job: add the row if it's new, otherwise count the failure, start a fresh
  // window if the old one ran out, and lock the key when the allowance is used up. Because it is one statement,
  // the database lines up simultaneous failures by itself and counts every one exactly once, and no request has to
  // sit holding a connection while it waits for its turn (which is what a flood of attempts would exploit).
  // All times are computed inside the database, in UTC, the same way Prisma stores them.
  const rows = await prisma.$queryRaw<{ lockMs: number }[]>`
    INSERT INTO "AuthThrottle" AS t ("key", "count", "windowStart", "strikes", "lockedUntil", "updatedAt")
    VALUES (${rule.key}, 1, (now() AT TIME ZONE 'utc'), 0, NULL, (now() AT TIME ZONE 'utc'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN ((CASE WHEN (now() AT TIME ZONE 'utc') - t."windowStart" > (${rule.windowMs}::float8 * interval '1 millisecond') THEN 1 ELSE t."count" + 1 END) >= ${rule.max}::int) THEN 0
        WHEN (now() AT TIME ZONE 'utc') - t."windowStart" > (${rule.windowMs}::float8 * interval '1 millisecond') THEN 1
        ELSE t."count" + 1 END,
      "windowStart" = CASE
        WHEN ((CASE WHEN (now() AT TIME ZONE 'utc') - t."windowStart" > (${rule.windowMs}::float8 * interval '1 millisecond') THEN 1 ELSE t."count" + 1 END) >= ${rule.max}::int) THEN (now() AT TIME ZONE 'utc')
        WHEN (now() AT TIME ZONE 'utc') - t."windowStart" > (${rule.windowMs}::float8 * interval '1 millisecond') THEN (now() AT TIME ZONE 'utc')
        ELSE t."windowStart" END,
      "strikes" = (CASE WHEN (now() AT TIME ZONE 'utc') - t."updatedAt" > (${STRIKE_MEMORY_MS}::float8 * interval '1 millisecond') THEN 0 ELSE t."strikes" END)
        + (CASE WHEN ((CASE WHEN (now() AT TIME ZONE 'utc') - t."windowStart" > (${rule.windowMs}::float8 * interval '1 millisecond') THEN 1 ELSE t."count" + 1 END) >= ${rule.max}::int) THEN 1 ELSE 0 END),
      "lockedUntil" = CASE
        WHEN ((CASE WHEN (now() AT TIME ZONE 'utc') - t."windowStart" > (${rule.windowMs}::float8 * interval '1 millisecond') THEN 1 ELSE t."count" + 1 END) >= ${rule.max}::int)
        THEN (now() AT TIME ZONE 'utc') + (LEAST(${rule.lockMs}::float8 * power(2, LEAST((CASE WHEN (now() AT TIME ZONE 'utc') - t."updatedAt" > (${STRIKE_MEMORY_MS}::float8 * interval '1 millisecond') THEN 0 ELSE t."strikes" END), 20)), ${rule.maxLockMs}::float8) * interval '1 millisecond')
        ELSE t."lockedUntil" END,
      "updatedAt" = (now() AT TIME ZONE 'utc')
    RETURNING CASE WHEN "count" = 0 AND "lockedUntil" > (now() AT TIME ZONE 'utc')
      THEN (extract(epoch FROM ("lockedUntil" - (now() AT TIME ZONE 'utc'))) * 1000)::float8 ELSE 0 END AS "lockMs"`;
  const lockedNow = Math.round(Number(rows[0]?.lockMs ?? 0));

  // Housekeeping: now and then, drop counters nobody has touched for two days.
  if (Math.random() < 0.05) {
    const old = new Date(Date.now() - 2 * 24 * HOUR);
    await prisma.authThrottle.deleteMany({ where: { updatedAt: { lt: old }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] } }).catch(() => {});
  }
  return lockedNow;
}

/** A clean sign-in wipes that key's counters (used for the email and the second step, never for the address). */
export async function clearFailures(key: string): Promise<void> {
  await prisma.authThrottle.deleteMany({ where: { key } }).catch(() => {});
}

export function waitText(ms: number): string {
  const mins = Math.ceil(ms / MIN);
  if (mins <= 1) return "a minute";
  if (mins < 60) return `${mins} minutes`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "an hour" : `${hrs} hours`;
}
