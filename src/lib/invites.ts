import { prisma } from "@/lib/prisma";
import { TICKETING_SOURCE } from "@/lib/bookingSource";
import { normalizeEmail } from "@/lib/unsubscribe";

export type InviteAudience = "attended" | "all";

export type InviteGuest = { email: string; name: string };

export type InviteCounts = {
  pastGuests: number; // distinct people who match the chosen group
  optedOut: number;
  alreadyBooked: number; // already on this night
  alreadyInvited: number; // already got this night's invite
  eligible: number;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Works out who an invite for `eventId` would go to right now. Past guests are
// people with a confirmed booking on a night that has already happened. Anyone
// who opted out, is already on this night, or already got this invite is left
// out; the counts say how many were left out for each reason.
export async function inviteAudience(
  eventId: string,
  audience: InviteAudience,
  includeTicketing: boolean
): Promise<{ eligible: InviteGuest[]; counts: InviteCounts }> {
  const past = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      event: { date: { lt: new Date() } },
      ...(audience === "attended" ? { attended: true } : {}),
      ...(includeTicketing ? {} : { source: { not: TICKETING_SOURCE } }),
    },
    select: { email: true, contactName: true, event: { select: { date: true } } },
  });

  // One entry per person; their most recent night supplies the name.
  const people = new Map<string, { name: string; when: number }>();
  for (const b of past) {
    const email = normalizeEmail(b.email);
    if (!EMAIL_PATTERN.test(email)) continue;
    const when = b.event?.date.getTime() ?? 0;
    const seen = people.get(email);
    if (!seen || when > seen.when) people.set(email, { name: b.contactName, when });
  }
  const emails = [...people.keys()];

  const [optOuts, booked, invited] = await Promise.all([
    prisma.emailOptOut.findMany({ where: { email: { in: emails } }, select: { email: true } }),
    prisma.booking.findMany({
      where: { eventId, status: { not: "cancelled" } },
      select: { email: true },
    }),
    prisma.nightInvite.findMany({ where: { eventId }, select: { email: true } }),
  ]);
  const optedOut = new Set(optOuts.map((o) => o.email));
  const alreadyBooked = new Set(booked.map((b) => normalizeEmail(b.email)));
  const alreadyInvited = new Set(invited.map((i) => i.email));

  const eligible: InviteGuest[] = [];
  const counts: InviteCounts = { pastGuests: emails.length, optedOut: 0, alreadyBooked: 0, alreadyInvited: 0, eligible: 0 };
  for (const email of emails.sort()) {
    if (optedOut.has(email)) counts.optedOut++;
    else if (alreadyBooked.has(email)) counts.alreadyBooked++;
    else if (alreadyInvited.has(email)) counts.alreadyInvited++;
    else eligible.push({ email, name: people.get(email)!.name });
  }
  counts.eligible = eligible.length;
  return { eligible, counts };
}
