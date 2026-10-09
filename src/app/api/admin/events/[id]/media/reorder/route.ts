import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const reorderSchema = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(60) });

// Saves the order of a night's photos or clips after the admin drags them.
// `ids` is the complete list of one kind (all photos, or all clips) in the new order.
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { ids } = parsed.data;
  if (new Set(ids).size !== ids.length) return NextResponse.json({ error: "Duplicate files in the list." }, { status: 400 });

  const rows = await prisma.eventMedia.findMany({ where: { id: { in: ids }, eventId: id }, select: { id: true, kind: true } });
  if (rows.length !== ids.length) return NextResponse.json({ error: "Some of those files aren't part of this night." }, { status: 400 });
  const kind = rows[0].kind;
  if (rows.some((r) => r.kind !== kind)) return NextResponse.json({ error: "Photos and clips are ordered separately." }, { status: 400 });

  // The list must be every file of that kind, otherwise the saved order would be partial.
  const total = await prisma.eventMedia.count({ where: { eventId: id, kind } });
  if (total !== ids.length) return NextResponse.json({ error: "The list is out of date. Reload and try again." }, { status: 409 });

  await prisma.$transaction(ids.map((mediaId, index) => prisma.eventMedia.update({ where: { id: mediaId }, data: { sortOrder: index + 1 } })));
  return NextResponse.json({ ok: true });
}
