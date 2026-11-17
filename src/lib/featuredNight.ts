import { BUSINESS } from "@/lib/business";

// The night we are pushing hardest right now. It drives the banner at the top of the home page, the QR code
// on it, and the registration page at /falooda-nation. These are only the starting details: the night is created
// as a real event in the admin the first time it is needed, and from then on whatever is saved in the admin
// (title, date, time, venue, map link) is what the banner and the page show.
export const FEATURED_NIGHT = {
  // A fixed id, so the banner, the QR code and every booking all point at one real night in the admin.
  id: "falooda-nation-2026-11-21",
  title: "Mollywood Quiz Night",
  venueName: "Falooda Nation",
  venueArea: "Edappally",
  city: "Kochi",
  startsAt: "2026-11-21T20:00:00+05:30",
  path: "/falooda-nation",
  minTeamSize: 1,
  maxTeamSize: 4,
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Falooda%20Nation%20Edappally%20Kochi",
} as const;

// Falooda Nation's own logo, shown beside ours on the registration page. Left empty until the venue's logo file is in
// /public: then set it to { src: "/falooda-nation-logo.png", width: <pixels wide>, height: <pixels tall> }.
// Until then their name is shown in their colours instead.
export const FALOODA_LOGO: { src: string; width: number; height: number } | null = null;

// Every other night: teams of up to 6, the company's usual format.
export const DEFAULT_MAX_TEAM_SIZE = 6;
const NIGHT_LENGTH_HOURS = 2.5; // only used for the "add to calendar" file
const HIDE_AFTER_HOURS = 5; // the banner and the page come down by themselves this long after the start

// Everything the banner and the registration page need to know about a night. Plain data, safe to pass to the browser.
export type NightInfo = {
  id: string;
  title: string;
  venueName: string;
  venueArea: string;
  city: string;
  startsAt: string; // ISO
  mapsUrl: string;
  minTeamSize: number;
  maxTeamSize: number;
};

type EventLike = { id: string; title: string; theme?: string | null; date: Date | string; venueName: string; venueArea: string; mapsUrl?: string | null };

export function nightInfoFrom(e: EventLike): NightInfo {
  const featured = e.id === FEATURED_NIGHT.id;
  const query = encodeURIComponent(`${e.venueName} ${e.venueArea} Kochi`);
  return {
    id: e.id,
    title: e.title,
    venueName: e.venueName,
    venueArea: e.venueArea,
    city: FEATURED_NIGHT.city,
    startsAt: new Date(e.date).toISOString(),
    mapsUrl: e.mapsUrl && /^https?:\/\//i.test(e.mapsUrl) ? e.mapsUrl : `https://www.google.com/maps/search/?api=1&query=${query}`,
    minTeamSize: FEATURED_NIGHT.minTeamSize,
    maxTeamSize: featured ? FEATURED_NIGHT.maxTeamSize : DEFAULT_MAX_TEAM_SIZE,
  };
}

// The night as first set up in code, used until the event exists in the database.
export function defaultFeaturedInfo(): NightInfo {
  return nightInfoFrom({ ...FEATURED_NIGHT, date: FEATURED_NIGHT.startsAt });
}

export function nightIsLive(startsAt: string, now: number = Date.now()): boolean {
  return now < Date.parse(startsAt) + HIDE_AFTER_HOURS * 3600_000;
}

export function nightEndsAt(startsAt: string): string {
  return new Date(Date.parse(startsAt) + NIGHT_LENGTH_HOURS * 3600_000).toISOString();
}

// Always read in Indian time, so the server and every visitor's phone print the same thing wherever they are.
const IST = "Asia/Kolkata";
export function formatNight(startsAt: string) {
  const d = new Date(startsAt);
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: IST, ...o }).format(d);
  const weekdayShort = part({ weekday: "short" });
  const weekdayLong = part({ weekday: "long" });
  const month = part({ month: "short" });
  const day = part({ day: "numeric" });
  const time = part({ hour: "numeric", minute: "2-digit", hour12: true }).replace(/[  ]/g, " "); // some browsers use a special no-break space before PM; normalise so every device matches the server
  const shortTime = time.replace(":00", "");
  return {
    weekdayShort,
    weekdayLong,
    dayMonth: `${day} ${month}`,
    time, // 8:00 PM
    shortTime, // 8 PM
    short: `${weekdayShort}, ${day} ${month}`, // Sat, 21 Nov
  };
}

export function featuredNightUrl(source?: string): string {
  const base = `${BUSINESS.siteUrl}${FEATURED_NIGHT.path}`;
  return source ? `${base}?s=${encodeURIComponent(source)}` : base;
}

// Where "register" should take someone for a given night
export function registerPath(eventId: string): string {
  return eventId === FEATURED_NIGHT.id ? FEATURED_NIGHT.path : `/book/${eventId}`;
}
