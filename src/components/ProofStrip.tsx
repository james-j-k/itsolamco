"use client";

import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { RecapClip } from "@/components/RecapGallery";
import type { RecapDTO } from "@/lib/recaps";

// Right under the hero: real clips from the last night, so a first-time visitor
// sees the atmosphere before reading anything. On a phone the clips sit in a
// swipeable row (only the one on screen plays) that starts right under a slim
// label, so the first clip peeks in at the bottom of the first screen; the big
// heading follows the clips there. On larger screens the heading comes first
// and the clips sit side by side. Hidden until a published recap has a clip.
export default function ProofStrip({ recap, onBook }: { recap: RecapDTO; onBook: () => void }) {
  const clips = recap.videos.slice(0, 4);
  if (clips.length === 0) return null;

  return (
    <section id="proof" className="section-border bg-[#F5F0E6] px-6 pb-14 pt-4 md:px-8 md:py-24">
      <div className="flex flex-col">
        {/* Phones only: slim label so the clips can start high on the screen */}
        <div aria-hidden="true" className="order-1 mb-3 flex items-center justify-between gap-3 font-mono text-xs md:hidden">
          <span className="flex items-center gap-2 whitespace-nowrap font-bold text-[#B8451D]">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#B8451D]" />
            LAST NIGHT, LIVE
          </span>
          {clips.length > 1 && <span className="whitespace-nowrap text-[#6A6357]">SWIPE →</span>}
        </div>

        <div className="order-4 mt-8 md:order-1 md:mb-12 md:mt-0">
          <div className="mb-3 font-mono text-xs tracking-[0.2em] text-[#B8451D] md:text-sm">{"// NOT JUST TALK"}</div>
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
            <span className="flex items-center gap-1.5 text-[#6A6357]">
              <MapPin size="1.1em" className="shrink-0 text-[#B8451D]" />
              {recap.venue.toUpperCase()}
            </span>
          </div>
        </div>

        <div
          className="order-2 -mx-6 flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
          aria-label="Clips from last night"
        >
          {clips.map((clip) => (
            <div key={clip.id} className="flex w-[68vw] max-w-[18rem] shrink-0 snap-start md:w-auto md:max-w-none [&>figure]:w-full">
              <RecapClip clip={clip} />
            </div>
          ))}
        </div>

        <div className="order-5 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center md:mt-12">
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
      </div>
    </section>
  );
}
