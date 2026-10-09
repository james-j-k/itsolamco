import { prisma } from "@/lib/prisma";
import { isBlobUrl, type RecapMedia } from "@/lib/media";

const TZ = "Asia/Kolkata";

export type RecapDTO = {
  id: string;
  title: string;
  dateText: string;
  venue: string;
  winnerTeam: string | null;
  stats: string | null;
  summary: string | null;
  cover: RecapMedia | null; // the featured winners photo (or the first photo)
  photos: RecapMedia[]; // every photo, cover first
  videos: RecapMedia[];
};

type MediaRow = {
  id: string;
  kind: string;
  role: string;
  url: string;
  posterUrl: string | null;
  caption: string | null;
};

function toMedia(row: MediaRow): RecapMedia | null {
  // Only ever render files from our own storage, even if a row were bad.
  if (!isBlobUrl(row.url)) return null;
  return {
    id: row.id,
    kind: row.kind === "video" ? "video" : "image",
    role: row.role === "winners" ? "winners" : "gallery",
    url: row.url,
    posterUrl: isBlobUrl(row.posterUrl) ? row.posterUrl : null,
    caption: row.caption,
  };
}

function toRecap(event: {
  id: string;
  title: string;
  date: Date;
  venueName: string;
  venueArea: string;
  winnerTeam: string | null;
  recapStats: string | null;
  recapSummary: string | null;
  media: MediaRow[];
}): RecapDTO {
  const media = event.media.map(toMedia).filter((m): m is RecapMedia => m !== null);
  const images = media.filter((m) => m.kind === "image");
  const cover = images.find((m) => m.role === "winners") ?? images[0] ?? null;
  return {
    id: event.id,
    title: event.title,
    dateText: event.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: TZ }),
    venue: `${event.venueName}, ${event.venueArea}`,
    winnerTeam: event.winnerTeam,
    stats: event.recapStats,
    summary: event.recapSummary,
    cover,
    photos: cover ? [cover, ...images.filter((m) => m.id !== cover.id)] : images,
    videos: media.filter((m) => m.kind === "video"),
  };
}

const publishedWhere = () => ({ recapPublished: true, date: { lt: new Date() } });
const mediaSelect = { select: { id: true, kind: true, role: true, url: true, posterUrl: true, caption: true }, orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] };

// Newest published recaps first.
export async function getPublishedRecaps(limit?: number): Promise<RecapDTO[]> {
  const events = await prisma.event.findMany({
    where: publishedWhere(),
    orderBy: { date: "desc" },
    take: limit,
    include: { media: mediaSelect },
  });
  return events.map(toRecap);
}

export async function getPublishedRecap(id: string): Promise<RecapDTO | null> {
  const event = await prisma.event.findFirst({
    where: { id, ...publishedWhere() },
    include: { media: mediaSelect },
  });
  return event ? toRecap(event) : null;
}
