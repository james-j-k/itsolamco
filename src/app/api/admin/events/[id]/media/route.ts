import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isBlobUrl, pathnameBelongsToEvent } from "@/lib/media";

type Params = { params: Promise<{ id: string }> };

const MAX_MEDIA_PER_EVENT = 60;

const mediaSchema = z.object({
  kind: z.enum(["image", "video"]),
  role: z.enum(["winners", "gallery"]).default("gallery"),
  url: z.string().max(1000),
  pathname: z.string().max(500),
  posterUrl: z.string().max(1000).nullish(),
  posterPathname: z.string().max(500).nullish(),
  caption: z.string().trim().max(200).nullish(),
});

// Saves a file the browser has already uploaded to Blob as part of a night's recap.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = mediaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  if (!isBlobUrl(d.url) || (d.posterUrl && !isBlobUrl(d.posterUrl))) {
    return NextResponse.json({ error: "That file isn't from this site's storage." }, { status: 400 });
  }
  if (!pathnameBelongsToEvent(d.pathname, id) || (d.posterPathname && !pathnameBelongsToEvent(d.posterPathname, id))) {
    return NextResponse.json({ error: "That file belongs to a different night." }, { status: 400 });
  }
  if (d.role === "winners" && d.kind !== "image") {
    return NextResponse.json({ error: "The winners photo has to be a photo." }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if ((await prisma.eventMedia.count({ where: { eventId: id } })) >= MAX_MEDIA_PER_EVENT) {
    return NextResponse.json({ error: `A night can have up to ${MAX_MEDIA_PER_EVENT} files.` }, { status: 400 });
  }

  const media = await prisma.$transaction(async (tx) => {
    // Only one featured winners photo per night: a new one replaces the label on the old.
    if (d.role === "winners") {
      await tx.eventMedia.updateMany({ where: { eventId: id, role: "winners" }, data: { role: "gallery" } });
    }
    const last = await tx.eventMedia.aggregate({ where: { eventId: id, kind: d.kind }, _max: { sortOrder: true } });
    return tx.eventMedia.create({
      data: {
        eventId: id,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        kind: d.kind,
        role: d.role,
        url: d.url,
        pathname: d.pathname,
        posterUrl: d.posterUrl ?? null,
        posterPathname: d.posterPathname ?? null,
        caption: d.caption || null,
      },
    });
  });
  return NextResponse.json({ media });
}
