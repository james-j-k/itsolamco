import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    caption: z.string().trim().max(200).nullable().optional(),
    role: z.enum(["winners", "gallery"]).optional(),
  })
  .refine((d) => d.caption !== undefined || d.role !== undefined, { message: "Nothing to update" });

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const existing = await prisma.eventMedia.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (parsed.data.role === "winners" && existing.kind !== "image") {
    return NextResponse.json({ error: "The winners photo has to be a photo." }, { status: 400 });
  }

  const media = await prisma.$transaction(async (tx) => {
    if (parsed.data.role === "winners") {
      await tx.eventMedia.updateMany({ where: { eventId: existing.eventId, role: "winners" }, data: { role: "gallery" } });
    }
    return tx.eventMedia.update({
      where: { id },
      data: {
        ...(parsed.data.role !== undefined && { role: parsed.data.role }),
        ...(parsed.data.caption !== undefined && { caption: parsed.data.caption || null }),
      },
    });
  });
  return NextResponse.json({ media });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await prisma.eventMedia.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Remove the record first so the site stops showing it, then clear the stored files.
  await prisma.eventMedia.delete({ where: { id } });
  const files = [existing.url, existing.posterUrl].filter((u): u is string => !!u);
  try {
    await del(files);
  } catch (err) {
    console.error(`Couldn't delete stored files for media ${id}:`, err);
  }
  return NextResponse.json({ ok: true });
}
