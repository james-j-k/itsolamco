"use client";

import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { RecapClip } from "@/components/RecapGallery";
import type { RecapDTO } from "@/lib/recaps";

// Right under the hero: real clips from the last night, so a first-time visitor
// sees the atmosphere before reading anything. On a phone the clips sit in a
// swipeable row (only the one on screen plays); on larger screens they sit
// side by side. Hidden until a published recap has at least one clip.
export default function ProofStrip({ recap, onBook }: { recap: RecapDTO; onBook: () => void }) {
  const clips = recap.videos.slice(0, 4);
  if (clips.length === 0) return null;

  return (
    <section id="proof" className="section-border bg-[#F5F0E6] px-6 md:px-8 py-14 md:py-24">
      <div className="mb-8 md:mb-12">
        <div className="mb-3 font-mono text-[11px] tracking-[0.2em] text-[#B8451D] md:text-sm">{"// NOT JUST TALK"}</div>
        <h2 className="font-display text-[13vw] leading-[0.9] sm:text-6xl md:text-7xl">
          LAST NIGHT, <span className="text-[#B8451D]">LIVE.</span>
        </h2>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs md:text-sm">
          {recap.stats && <span className="font-bold">{recap.stats.toUpperCase()}</span>}
          {recap.winnerTeam && (
            <span>
              WINNERS <span className="text-[#B8451D]">{recap.winnerTeam.toUpperCase()}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[#8C8477]">
            <MapPin size="1.1em" className="shrink-0 text-[#B8451D]" />
            {recap.venue.toUpperCase()}
          </span>
        </div>
      </div>

      <div
        className="-mx-6 flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
        aria-label="Clips from last night"
      >
        {clips.map((clip) => (
          <div key={clip.id} className="w-[68vw] max-w-[18rem] flex shrink-0 snap-start md:w-auto md:max-w-none [&>figure]:w-full">
            <RecapClip clip={clip} />
          </div>
        ))}
      </div>
      {clips.length > 1 && (
        <p className="mt-1 font-mono text-[10px] tracking-[0.2em] text-[#8C8477] md:hidden">SWIPE FOR MORE →</p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center md:mt-12">
        <Link
          href={`/nights/${recap.id}`}
          className="flex items-center justify-center gap-2 border-2 border-[#1C1712] px-6 py-4 font-display text-lg transition-colors hover:bg-[#EEE7D8] active:bg-[#EEE7D8]"
        >
          SEE THE WHOLE NIGHT <ArrowUpRight size="1.1em" />
        </Link>
        <button onClick={onBook} className="btn-rust px-6 py-4 font-display text-lg">
          BE IN THE NEXT ONE
        </button>
      </div>
    </section>
  );
}
