"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Volume2, VolumeX } from "lucide-react";
import type { RecapMedia } from "@/lib/media";
import { useModalA11y } from "@/lib/useModalA11y";

// A short clip that plays (muted, looping) only while it's on screen and pauses
// as soon as it scrolls away, so a page of clips doesn't chew through mobile
// data or battery. Tap to switch sound on or off.
export function RecapClip({ clip }: { clip: RecapMedia }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  // Upright (phone) until the clip says otherwise, so the box is the right shape before it loads.
  const [aspect, setAspect] = useState(9 / 16);
  // Stays false until the effect has checked the visitor's motion preference,
  // so nobody who asked for less motion ever sees a video start by itself.
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a browser-only media query
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video || reduceMotion) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.6 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduceMotion]);

  return (
    // Phone clips are usually upright; a wide clip gets two columns so it isn't tiny.
    <figure className={`border-2 border-[#1C1712] bg-[#1C1712] ${aspect > 1 ? "sm:col-span-2" : ""}`}>
      <div className="relative">
      <video
        ref={ref}
        onLoadedMetadata={(e) => {
          const { videoWidth, videoHeight } = e.currentTarget;
          if (videoWidth > 0 && videoHeight > 0) setAspect(videoWidth / videoHeight);
        }}
        style={{ aspectRatio: aspect }}
        src={clip.url}
        poster={clip.posterUrl ?? undefined}
        muted={muted}
        loop
        playsInline
        preload={clip.posterUrl ? "none" : "metadata"}
        controls={reduceMotion}
        className="block w-full object-contain bg-black"
        aria-label={clip.caption ?? "Clip from the night"}
      />
      {!reduceMotion && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#1C1712]/80 text-[#F5F0E6] hover:bg-[#B8451D] active:bg-[#B8451D] transition-colors"
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      )}
      </div>
      {clip.caption && (
        <figcaption className="border-t-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-2 font-mono text-[11px] text-[#1C1712]">
          {clip.caption}
        </figcaption>
      )}
    </figure>
  );
}

// Thumbnail grid that opens each photo full-screen; swipe or use the arrows /
// arrow keys to move between photos.
export function PhotoGrid({ photos, alt }: { photos: RecapMedia[]; alt: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const close = useCallback(() => setOpenIndex(null), []);
  const containerRef = useModalA11y(openIndex !== null, close);
  const touchStartX = useRef<number | null>(null);

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((i) => (i === null ? i : (i + delta + photos.length) % photos.length));
    },
    [photos.length]
  );

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openIndex, step]);

  if (photos.length === 0) return null;
  const current = openIndex !== null ? photos[openIndex] : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            aria-label={`Open photo ${i + 1} of ${photos.length}`}
            className="relative aspect-square overflow-hidden border-2 border-[#1C1712] bg-[#EEE7D8] group"
          >
            <Image
              src={photo.url}
              alt={photo.caption ?? alt}
              fill
              unoptimized
              sizes="(min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1C1712]/95"
          onClick={close}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchStartX.current;
            touchStartX.current = null;
            const end = e.changedTouches[0]?.clientX;
            if (start === null || end === undefined) return;
            if (end - start > 50) step(-1);
            else if (start - end > 50) step(1);
          }}
        >
          <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Photo ${openIndex! + 1} of ${photos.length}`}
            tabIndex={-1}
            className="relative flex h-full w-full items-center justify-center focus:outline-none"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-0 top-0 z-10 p-4 font-mono text-xs text-[#F5F0E6] hover:text-[#B8451D]"
            >
              CLOSE ✕
            </button>
            {/* The image itself isn't a click-to-close target, so tapping it won't dismiss by accident. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- full-size view of an already-optimised upload */}
            <img
              src={current.url}
              alt={current.caption ?? alt}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[95vw] object-contain"
            />
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(-1);
                  }}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[#1C1712]/70 font-display text-2xl text-[#F5F0E6] hover:bg-[#B8451D]"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(1);
                  }}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[#1C1712]/70 font-display text-2xl text-[#F5F0E6] hover:bg-[#B8451D]"
                >
                  ›
                </button>
                <div className="absolute bottom-4 left-0 right-0 text-center font-mono text-[11px] text-[#F5F0E6]/80">
                  {openIndex! + 1} / {photos.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
