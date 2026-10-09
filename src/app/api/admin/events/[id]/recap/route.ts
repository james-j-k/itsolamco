import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const recapSchema = z.object({
  winnerTeam: z.string().trim().max(120).nullish(),
  recapStats: z.string().trim().max(160).nullish(),
  recapSummary: z.string().trim().max(1500).nullish(),
  recapPublished: z.boolean().optional(),
});

// Saves the text side of a night's recap and whether it's visible on the site.
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = recapSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  const event = await prisma.event.findUnique({ where: { id }, select: { date: true } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (d.recapPublished && event.date.getTime() > Date.now()) {
    return NextResponse.json({ error: "A recap can only be published once the night has happened." }, { status: 400 });
  }
  if (d.recapPublished) {
    const hasPhoto = (await prisma.eventMedia.count({ where: { eventId: id, kind: "image" } })) > 0;
    if (!hasPhoto) {
      return NextResponse.json({ error: "Add at least one photo before publishing." }, { status: 400 });
    }
  }

  const updated = await prisma.event.update({
    where: { id },
    data: {
      ...(d.winnerTeam !== undefined && { winnerTeam: d.winnerTeam || null }),
      ...(d.recapStats !== undefined && { recapStats: d.recapStats || null }),
      ...(d.recapSummary !== undefined && { recapSummary: d.recapSummary || null }),
      ...(d.recapPublished !== undefined && { recapPublished: d.recapPublished }),
    },
    select: { winnerTeam: true, recapStats: true, recapSummary: true, recapPublished: true },
  });
  return NextResponse.json({ recap: updated });
}
