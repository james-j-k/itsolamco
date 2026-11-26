import { prisma } from "@/lib/prisma";
import { TICKETING_SOURCE } from "@/lib/bookingSource";
import { getPublishedRecaps } from "@/lib/recaps";
import { safeHttpUrl } from "@/lib/eventLinks";
import QRCode from "qrcode";
import { FEATURED_NIGHT, featuredNightUrl, nightIsLive } from "@/lib/featuredNight";
import { loadFeaturedNight } from "@/lib/featuredNightServer";
import HomePage from "@/components/HomePage";
import { BUSINESS } from "@/lib/business";
import { FLAGSHIP, flagshipInfo } from "@/lib/flagship";
import type { EventDTO } from "@/types/event";
import type { QuizRoundDTO, VenueDTO } from "@/types/content";

export const dynamic = "force-dynamic";

// The flagship night's banner at the very top of the page, while that night is still to come.
// Neither banner may ever be the reason the home page fails to load.
async function loadFlagship() {
  try {
    const event = await prisma.event.findUnique({ where: { id: FLAGSHIP.eventId } });
    if (!event) return null;
    const night = flagshipInfo(event);
    if (!nightIsLive(night.startsAt)) return null;
    const [teamsBooked, qrSvg] = await Promise.all([
      prisma.booking.count({ where: { eventId: FLAGSHIP.eventId, status: { not: "cancelled" }, source: { not: TICKETING_SOURCE } } }),
      QRCode.toString(`${BUSINESS.siteUrl}/book/${FLAGSHIP.eventId}`, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1B1434", light: "#FFFFFF" } }),
    ]);
    return { night, teamsBooked, qrSvg };
  } catch (err) {
    console.error("Couldn't load the flagship banner:", err);
    return null;
  }
}

// The Falooda Nation banner, used when there is no flagship night to show.
async function loadFeatured() {
  try {
    const night = await loadFeaturedNight();
    if (!nightIsLive(night.startsAt)) return null;
    const [teamsBooked, qrSvg] = await Promise.all([
      prisma.booking.count({ where: { eventId: FEATURED_NIGHT.id, status: { not: "cancelled" }, source: { not: TICKETING_SOURCE } } }),
      QRCode.toString(featuredNightUrl("qr"), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#2C2C2C", light: "#FFFFFF" } }),
    ]);
    return { night, teamsBooked, qrSvg };
  } catch (err) {
    console.error("Couldn't load the featured night banner:", err);
    return null;
  }
}

export default async function Page() {
  // First, so a brand-new night is already in the list the queries below read.
  const flagship = await loadFlagship();
  const featured = flagship ? null : await loadFeatured();
  const [events, rounds, venues, unassignedBookingCount, recaps] = await Promise.all([
    prisma.event.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 6,
      // Cancelled bookings shouldn't count toward the public "teams booked"
      // social-proof number — the count should reflect real interest.
      include: { _count: { select: { bookings: { where: { status: { not: "cancelled" }, source: { not: TICKETING_SOURCE } } } } } },
    }),
    prisma.quizRound.findMany({ orderBy: { order: "asc" } }),
    prisma.venue.findMany({ orderBy: { order: "asc" } }),
    // Ticketing-app attendees are individuals, not teams we signed up, so they
    // are left out of both counts here (they still count in the admin totals).
    // Bookings made for "Any upcoming night" (no specific event picked)
    // aren't tied to an event's id, so they'd otherwise be invisible to
    // the count above — they belong to whichever night comes first.
    prisma.booking.count({ where: { eventId: null, status: { not: "cancelled" }, source: { not: TICKETING_SOURCE } } }),
    // The home page must never fail just because the recap lookup did.
    getPublishedRecaps(1).catch((err) => {
      console.error("Couldn't load the latest recap:", err);
      return [];
    }),
  ]);

  const eventDTOs: EventDTO[] = events.map((e, i) => ({
    id: e.id,
    title: e.title,
    theme: e.theme,
    date: e.date.toISOString(),
    venueName: e.venueName,
    venueArea: e.venueArea,
    teamsBooked: e._count.bookings + (i === 0 ? unassignedBookingCount : 0),
    externalUrl: safeHttpUrl(e.externalTicketUrl),
    externalLabel: e.externalTicketLabel,
    registrationClosed: e.registrationClosed,
  }));

  const roundDTOs: QuizRoundDTO[] = rounds.map((r) => ({
    id: r.id,
    order: r.order,
    title: r.title,
    description: r.description,
  }));

  const venueDTOs: VenueDTO[] = venues.map((v) => ({
    id: v.id,
    order: v.order,
    name: v.name,
    area: v.area,
  }));

  return (
    <HomePage
      events={eventDTOs}
      rounds={roundDTOs}
      venues={venueDTOs}
      recap={recaps[0] ?? null}
      flagship={
        flagship && {
          ...flagship,
          others: eventDTOs.filter((e) => e.id !== FLAGSHIP.eventId).slice(0, 5),
        }
      }
      featured={
        featured && {
          ...featured,
          // The other nights coming up, for the "more nights" strip under the banner
          others: eventDTOs.filter((e) => e.id !== FEATURED_NIGHT.id).slice(0, 5),
        }
      }
    />
  );
}
