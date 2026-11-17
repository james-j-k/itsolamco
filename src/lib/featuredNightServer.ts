import { prisma } from "@/lib/prisma";
import { FEATURED_NIGHT, defaultFeaturedInfo, nightInfoFrom, type NightInfo } from "@/lib/featuredNight";

// Makes sure the night exists as a real event. Creates it once if it is missing and
// leaves it exactly as it is otherwise, so edits made in the admin are never undone.
export async function ensureFeaturedEvent(): Promise<void> {
  // "Insert, and do nothing if it is already there" is one atomic step. A plain upsert is not: two
  // visitors arriving at the same moment could both try to create it and one of them would fail.
  await prisma.event.createMany({
    data: [
      {
        id: FEATURED_NIGHT.id,
        title: FEATURED_NIGHT.title,
        date: new Date(FEATURED_NIGHT.startsAt),
        venueName: FEATURED_NIGHT.venueName,
        venueArea: FEATURED_NIGHT.venueArea,
        mapsUrl: FEATURED_NIGHT.mapsUrl,
      },
    ],
    skipDuplicates: true,
  });
}

// The featured night as it is in the admin right now (so an edit there changes the banner and the page).
export async function loadFeaturedNight(): Promise<NightInfo> {
  await ensureFeaturedEvent();
  const e = await prisma.event.findUnique({ where: { id: FEATURED_NIGHT.id } });
  return e ? nightInfoFrom(e) : defaultFeaturedInfo();
}
