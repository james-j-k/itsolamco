// The flagship night: the one the home page leads with, in its own poster's look. It is a real event made in the
// admin; this file only says which one, and holds the poster wording that the admin has no field for.
// Date, time, map link and "registration closed" always follow whatever is saved in the admin.
// To retire it, nothing needs doing: it comes down by itself a few hours after the night starts.
import { nightInfoFrom, type NightInfo } from "@/lib/featuredNight";

export const FLAGSHIP = {
  // The registration address the ads point at is /book/<this id>. It must not change while they run.
  eventId: "cmvc58bce0000ig07cnc72sfo",
  title: "Mollywood Quiz Night",
  venueName: "Kadavu Waterfront Bar & Kitchen",
  venueArea: "Aquaria, Thrippunithura",
  shortName: "Kadavu",
  offer: "Happy hour",
  offerAt: "at Kadavu",
} as const;

export function isFlagship(eventId: string): boolean {
  return eventId === FLAGSHIP.eventId;
}

type EventLike = Parameters<typeof nightInfoFrom>[0];

// The night as the banner and its registration page show it: the poster's names, everything else from the admin.
export function flagshipInfo(e: EventLike): NightInfo {
  const base = nightInfoFrom(e);
  const saved = e.mapsUrl && /^https?:\/\//i.test(e.mapsUrl);
  return {
    ...base,
    title: FLAGSHIP.title,
    venueName: FLAGSHIP.venueName,
    venueArea: FLAGSHIP.venueArea,
    mapsUrl: saved ? base.mapsUrl : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${FLAGSHIP.venueName} ${FLAGSHIP.venueArea}`)}`,
  };
}
