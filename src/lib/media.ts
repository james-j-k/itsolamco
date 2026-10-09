// Shared rules for event recap photos and clips (stored in Vercel Blob).

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
// .mov (iPhone HEVC) won't play in Chrome / on Android, so only web formats.
export const VIDEO_TYPES = ["video/mp4", "video/webm"];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // photos are shrunk in the browser first
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024; // keep clips light for guests on mobile data

export const MEDIA_FOLDER = "events";

// The only place recap files may live: this site's own public Blob store.
export function isBlobUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function pathnameBelongsToEvent(pathname: string, eventId: string): boolean {
  return pathname.startsWith(`${MEDIA_FOLDER}/${eventId}/`) && !pathname.includes("..");
}

export type RecapMedia = {
  id: string;
  kind: "image" | "video";
  role: "winners" | "gallery";
  url: string;
  posterUrl: string | null;
  caption: string | null;
};
