import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_TYPES, pathnameBelongsToEvent } from "@/lib/media";

// Hands the admin's browser a short-lived token so it can send a photo or clip
// straight to Vercel Blob (the files are too big to pass through this server).
// Sits under /api/admin/, so the admin-session middleware already guards it.
// No completion callback is used; the browser saves the record afterwards.
export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File storage isn't configured." }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const eventId = pathname.split("/")[1] ?? "";
        const event = eventId ? await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } }) : null;
        if (!event || !pathnameBelongsToEvent(pathname, event.id)) {
          throw new Error("That upload isn't for a known night.");
        }
        return {
          allowedContentTypes: [...IMAGE_TYPES, ...VIDEO_TYPES],
          maximumSizeInBytes: Math.max(MAX_IMAGE_BYTES, MAX_VIDEO_BYTES),
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
