import { prisma } from "@/lib/prisma";
import HomePage from "@/components/HomePage";
import type { EventDTO } from "@/types/event";
import type { QuizRoundDTO, VenueDTO } from "@/types/content";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [events, rounds, venues, unassignedBookingCount] = await Promise.all([
    prisma.event.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 6,
      // Cancelled bookings shouldn't count toward the public "teams booked"
      // social-proof number — the count should reflect real interest.
      include: { _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } } },
    }),
    prisma.quizRound.findMany({ orderBy: { order: "asc" } }),
    prisma.venue.findMany({ orderBy: { order: "asc" } }),
    // Bookings made for "Any upcoming night" (no specific event picked)
    // aren't tied to an event's id, so they'd otherwise be invisible to
    // the count above — they belong to whichever night comes first.
    prisma.booking.count({ where: { eventId: null, status: { not: "cancelled" } } }),
  ]);

  const eventDTOs: EventDTO[] = events.map((e, i) => ({
    id: e.id,
    title: e.title,
    theme: e.theme,
    date: e.date.toISOString(),
    venueName: e.venueName,
    venueArea: e.venueArea,
    teamsBooked: e._count.bookings + (i === 0 ? unassignedBookingCount : 0),
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

  return <HomePage events={eventDTOs} rounds={roundDTOs} venues={venueDTOs} />;
}
