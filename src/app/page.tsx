import { prisma } from "@/lib/prisma";
import HomePage from "@/components/HomePage";
import type { EventDTO } from "@/types/event";
import type { QuizRoundDTO, VenueDTO } from "@/types/content";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [events, rounds, venues] = await Promise.all([
    prisma.event.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 6,
    }),
    prisma.quizRound.findMany({ orderBy: { order: "asc" } }),
    prisma.venue.findMany({ orderBy: { order: "asc" } }),
  ]);

  const eventDTOs: EventDTO[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    theme: e.theme,
    date: e.date.toISOString(),
    venueName: e.venueName,
    venueArea: e.venueArea,
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
