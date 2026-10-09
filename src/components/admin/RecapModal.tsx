"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { AdminEvent } from "./types";
import { useModalA11y } from "@/lib/useModalA11y";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_TYPES, type RecapMedia } from "@/lib/media";

type Props = {
  open: boolean;
  onClose: () => void;
  event: AdminEvent;
  onChange: (patch: Partial<AdminEvent>) => void;
  // Media changes are applied to the latest list, so several uploads in a row don't overwrite each other.
  onMedia: (update: (media: RecapMedia[]) => RecapMedia[]) => void;
};

const MAX_PHOTO_SIDE = 1800;

function safeName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base.slice(0, 40) || "file";
}

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that photo."))), "image/jpeg", quality);
  });
}

// Shrinks a photo in the browser before upload, so a 5 MB phone photo becomes
// a few hundred KB and loads fast for guests on mobile data.
async function shrinkPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Couldn't read ${file.name}. Use a JPG, PNG or WebP photo (iPhone HEIC isn't supported here).`);
  }
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that photo.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToBlob(canvas, 0.85);
}

// A still frame from the clip, shown before it plays. Best effort: some
// browsers can't decode some clips, in which case the clip just has no poster.
async function clipPoster(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("decode"));
      setTimeout(() => reject(new Error("timeout")), 8000);
    });
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
      setTimeout(resolve, 3000);
    });
    const scale = Math.min(1, 900 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await canvasToBlob(canvas, 0.8);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function RecapModal({ open, onClose, event, onChange, onMedia }: Props) {
  const [winnerTeam, setWinnerTeam] = useState(event.winnerTeam ?? "");
  const [recapStats, setRecapStats] = useState(event.recapStats ?? "");
  const [recapSummary, setRecapSummary] = useState(event.recapSummary ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | null>(null);
  const [busyText, setBusyText] = useState<string | null>(null);
  const [mediaBusyId, setMediaBusyId] = useState<string | null>(null);
  const winnersInput = useRef<HTMLInputElement>(null);
  const photosInput = useRef<HTMLInputElement>(null);
  const clipsInput = useRef<HTMLInputElement>(null);
  const containerRef = useModalA11y(open, onClose);

  if (!open) return null;

  const uploading = busyText !== null;
  const photos = event.media.filter((m) => m.kind === "image");
  const clips = event.media.filter((m) => m.kind === "video");
  const textDirty =
    winnerTeam.trim() !== (event.winnerTeam ?? "") ||
    recapStats.trim() !== (event.recapStats ?? "") ||
    recapSummary.trim() !== (event.recapSummary ?? "");

  function fail(text: string) {
    setNotice({ text, isError: true });
  }

  async function saveText(extra: { recapPublished?: boolean } = {}) {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/recap`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerTeam, recapStats, recapSummary, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the recap.");
      onChange(data.recap);
      setNotice({
        text:
          extra.recapPublished === true
            ? "Published. It's live on the site now."
            : extra.recapPublished === false
              ? "Hidden. Visitors can't see it."
              : "Saved.",
        isError: false,
      });
    } catch (err) {
      fail(err instanceof Error ? err.message : "Couldn't save the recap.");
    } finally {
      setSaving(false);
    }
  }

  async function addFiles(files: FileList | null, role: "winners" | "gallery", kind: "image" | "video") {
    if (!files || files.length === 0) return;
    setNotice(null);
    const list = Array.from(files).slice(0, role === "winners" ? 1 : 12);
    let added = 0;
    const problems: string[] = [];

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const label = `${i + 1} of ${list.length}`;
      try {
        if (kind === "image") {
          if (!IMAGE_TYPES.includes(file.type)) throw new Error(`${file.name}: use a JPG, PNG or WebP photo.`);
          setBusyText(`Preparing photo ${label}…`);
          const blob = await shrinkPhoto(file);
          if (blob.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} is still too large after shrinking.`);
          setBusyText(`Uploading photo ${label}…`);
          const stored = await upload(`events/${event.id}/${safeName(file.name)}.jpg`, blob, {
            access: "public",
            handleUploadUrl: "/api/admin/media/upload",
            contentType: "image/jpeg",
          });
          await saveMedia({ kind: "image", role, url: stored.url, pathname: stored.pathname });
        } else {
          if (!VIDEO_TYPES.includes(file.type)) {
            throw new Error(`${file.name}: clips must be MP4 or WebM. iPhone .mov files need converting to MP4 first.`);
          }
          if (file.size > MAX_VIDEO_BYTES) {
            throw new Error(`${file.name} is ${mb(file.size)}. Clips can be up to ${mb(MAX_VIDEO_BYTES)}; trim or compress it first.`);
          }
          setBusyText(`Making a thumbnail for clip ${label}…`);
          const poster = await clipPoster(file);
          let posterUrl: string | null = null;
          let posterPathname: string | null = null;
          if (poster) {
            const storedPoster = await upload(`events/${event.id}/${safeName(file.name)}-poster.jpg`, poster, {
              access: "public",
              handleUploadUrl: "/api/admin/media/upload",
              contentType: "image/jpeg",
            });
            posterUrl = storedPoster.url;
            posterPathname = storedPoster.pathname;
          }
          setBusyText(`Uploading clip ${label} (${mb(file.size)})…`);
          const ext = file.type === "video/webm" ? "webm" : "mp4";
          const stored = await upload(`events/${event.id}/${safeName(file.name)}.${ext}`, file, {
            access: "public",
            handleUploadUrl: "/api/admin/media/upload",
            contentType: file.type,
            multipart: file.size > 8 * 1024 * 1024,
          });
          await saveMedia({ kind: "video", role: "gallery", url: stored.url, pathname: stored.pathname, posterUrl, posterPathname });
        }
        added++;
      } catch (err) {
        problems.push(err instanceof Error ? err.message : `${file.name} didn't upload.`);
      }
    }

    setBusyText(null);
    if (problems.length > 0) {
      fail(`${added > 0 ? `${added} added. ` : ""}${problems.join(" ")}`);
    } else {
      setNotice({ text: `${added} added.`, isError: false });
    }
  }

  async function saveMedia(body: {
    kind: "image" | "video";
    role: "winners" | "gallery";
    url: string;
    pathname: string;
    posterUrl?: string | null;
    posterPathname?: string | null;
  }) {
    const res = await fetch(`/api/admin/events/${event.id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Couldn't save that file.");
    const saved: RecapMedia = {
      id: data.media.id,
      kind: data.media.kind,
      role: data.media.role,
      url: data.media.url,
      posterUrl: data.media.posterUrl,
      caption: data.media.caption,
    };
    onMedia((media) => [
      ...media.map((m) => (saved.role === "winners" && m.role === "winners" ? { ...m, role: "gallery" as const } : m)),
      saved,
    ]);
  }

  async function makeWinnersPhoto(m: RecapMedia) {
    setMediaBusyId(m.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/media/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "winners" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update that photo.");
      onMedia((media) =>
        media.map((x) => (x.id === m.id ? { ...x, role: "winners" as const } : x.role === "winners" ? { ...x, role: "gallery" as const } : x))
      );
    } catch (err) {
      fail(err instanceof Error ? err.message : "Couldn't update that photo.");
    } finally {
      setMediaBusyId(null);
    }
  }

  async function removeMedia(m: RecapMedia) {
    if (!window.confirm(`Delete this ${m.kind === "video" ? "clip" : "photo"} for good? It will also disappear from the site.`)) return;
    setMediaBusyId(m.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/media/${m.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't delete it.");
      const remaining = event.media.filter((x) => x.id !== m.id);
      onMedia((media) => media.filter((x) => x.id !== m.id));
      // The server refuses to keep a recap live with no photo; mirror that here.
      if (event.recapPublished && !remaining.some((x) => x.kind === "image")) {
        await saveText({ recapPublished: false });
        fail("That was the last photo, so the recap was hidden from the site.");
      }
    } catch (err) {
      fail(err instanceof Error ? err.message : "Couldn't delete it.");
    } finally {
      setMediaBusyId(null);
    }
  }

  const fieldClass = "border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D]";
  const smallButton =
    "border-2 border-[#1C1712] px-3 py-2 font-mono text-[10px] uppercase tracking-wider hover:bg-[#1C1712] hover:text-[#F5F0E6] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit transition-colors";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1C1712]/80 px-4" onClick={uploading ? undefined : onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Recap for ${event.title}`}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto border-2 border-[#1C1712] bg-[#F5F0E6] p-6 focus:outline-none sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={uploading}
          className="absolute right-4 top-4 font-mono text-xs hover:text-[#B8451D] disabled:opacity-40"
          aria-label="Close"
        >
          CLOSE ✕
        </button>
        <h3 className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em]">Recap</h3>
        <div className="mb-6 font-display text-2xl">{event.title}</div>

        <div className="mb-6 flex flex-wrap items-center gap-3 border border-[#1C1712]/25 p-3">
          <span
            className={`font-mono text-[10px] uppercase tracking-wider ${event.recapPublished ? "text-[#4B7B4E]" : "text-[#8C8477]"}`}
          >
            {event.recapPublished ? "● Live on the site" : "○ Hidden (draft)"}
          </span>
          {event.recapPublished ? (
            <>
              <a href={`/nights/${event.id}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] uppercase text-[#B8451D] underline underline-offset-2">
                View page ↗
              </a>
              <button onClick={() => saveText({ recapPublished: false })} disabled={saving || uploading} className={`${smallButton} ml-auto`}>
                Hide from site
              </button>
            </>
          ) : (
            <button
              onClick={() => saveText({ recapPublished: true })}
              disabled={saving || uploading}
              className="ml-auto bg-[#B8451D] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-[#F5F0E6] disabled:opacity-40"
            >
              Publish recap
            </button>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px]">WINNING TEAM</span>
            <input value={winnerTeam} onChange={(e) => setWinnerTeam(e.target.value)} maxLength={120} placeholder="e.g. BIG 30" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px]">STATS LINE (OPTIONAL)</span>
            <input value={recapStats} onChange={(e) => setRecapStats(e.target.value)} maxLength={160} placeholder="e.g. 31 teams · 73 quizzers" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px]">SHORT WRITE-UP (OPTIONAL)</span>
            <textarea value={recapSummary} onChange={(e) => setRecapSummary(e.target.value)} maxLength={1500} rows={4} className={`${fieldClass} resize-y`} />
          </label>
          <div>
            <button onClick={() => saveText()} disabled={saving || uploading || !textDirty} className={smallButton}>
              {saving ? "Saving…" : "Save text"}
            </button>
          </div>
        </div>

        <hr className="my-6 border-[#1C1712]/20" />

        <div className="mb-3 font-mono text-[10px] uppercase tracking-wider">Winners photo (the big featured one)</div>
        <div className="mb-6 flex flex-wrap items-start gap-4">
          {photos.find((m) => m.role === "winners") ? (
            <div className="relative h-28 w-28 shrink-0 border-2 border-[#B8451D]">
              {/* eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail of an uploaded file */}
              <img src={photos.find((m) => m.role === "winners")!.url} alt="Winners" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-28 w-28 shrink-0 items-center justify-center border-2 border-dashed border-[#1C1712]/40 text-center font-mono text-[10px] text-[#8C8477]">
              None yet
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={winnersInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files, "winners", "image");
                e.target.value = "";
              }}
            />
            <button onClick={() => winnersInput.current?.click()} disabled={uploading} className={smallButton}>
              {photos.some((m) => m.role === "winners") ? "Replace winners photo" : "Upload winners photo"}
            </button>
            <p className="max-w-xs font-mono text-[10px] leading-relaxed text-[#8C8477]">
              Only post people&apos;s photos once they&apos;re happy to be shown. You can also pick any photo below as the winners photo.
            </p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-wider">Photos ({photos.length})</div>
          <input
            ref={photosInput}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files, "gallery", "image");
              e.target.value = "";
            }}
          />
          <button onClick={() => photosInput.current?.click()} disabled={uploading} className={smallButton}>
            + Add photos
          </button>
        </div>
        {photos.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {photos.map((m) => (
              <div key={m.id} className={`border-2 ${m.role === "winners" ? "border-[#B8451D]" : "border-[#1C1712]"}`}>
                <div className="aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail of an uploaded file */}
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col gap-1 border-t border-[#1C1712]/25 p-1.5 font-mono text-[9px] uppercase">
                  {m.role === "winners" ? (
                    <span className="text-[#B8451D]">Winners photo</span>
                  ) : (
                    <button onClick={() => makeWinnersPhoto(m)} disabled={mediaBusyId === m.id} className="text-left hover:text-[#B8451D] disabled:opacity-40">
                      Make winners photo
                    </button>
                  )}
                  <button onClick={() => removeMedia(m)} disabled={mediaBusyId === m.id} className="text-left text-[#8C8477] hover:text-[#B8451D] disabled:opacity-40">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-wider">Clips ({clips.length})</div>
          <input
            ref={clipsInput}
            type="file"
            multiple
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files, "gallery", "video");
              e.target.value = "";
            }}
          />
          <button onClick={() => clipsInput.current?.click()} disabled={uploading} className={smallButton}>
            + Add clips
          </button>
        </div>
        <p className="mb-3 font-mono text-[10px] leading-relaxed text-[#8C8477]">
          MP4 or WebM, up to {mb(MAX_VIDEO_BYTES)} each. Short clips (10–30 seconds) load fastest on phones.
        </p>
        {clips.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {clips.map((m) => (
              <div key={m.id} className="border-2 border-[#1C1712]">
                <div className="aspect-video bg-black">
                  {m.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail of an uploaded file
                    <img src={m.posterUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={m.url} muted preload="metadata" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-[#1C1712]/25 p-1.5 font-mono text-[9px] uppercase">
                  <span className="text-[#8C8477]">Clip</span>
                  <button onClick={() => removeMedia(m)} disabled={mediaBusyId === m.id} className="text-[#8C8477] hover:text-[#B8451D] disabled:opacity-40">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {busyText && (
          <p className="mb-3 font-mono text-[11px] text-[#8C8477]" role="status">
            {busyText} Keep this window open.
          </p>
        )}
        {notice && (
          <p className={`font-mono text-[11px] leading-relaxed ${notice.isError ? "text-[#B8451D]" : "text-[#4B7B4E]"}`} role="status">
            {notice.text}
          </p>
        )}
      </div>
    </div>
  );
}
