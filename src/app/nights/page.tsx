import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import RecapShell from "@/components/RecapShell";
import { getPublishedRecaps } from "@/lib/recaps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Past Nights | It's Olam Company",
  description: "Winners, photos and clips from our Mollywood quiz nights in Kochi.",
};

export default async function NightsPage() {
  const recaps = await getPublishedRecaps();

  return (
    <RecapShell>
      <Link href="/" className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#B8451D] hover:underline">
        ← Back home
      </Link>
      <h1 className="font-display text-5xl md:text-7xl mt-6 mb-3">PAST NIGHTS</h1>
      <p className="text-[#8C8477] mb-12 max-w-xl">The winners, the noise and the proof. Come be in the next one.</p>

      {recaps.length === 0 ? (
        <div className="border-2 border-[#1C1712] p-12 text-center font-mono text-[#8C8477]">
          THE FIRST RECAP IS COMING SOON.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {recaps.map((r) => (
            <Link
              key={r.id}
              href={`/nights/${r.id}`}
              className="group block border-2 border-[#1C1712] transition-colors hover:bg-[#1C1712] hover:text-[#F5F0E6]"
            >
              <div className="relative aspect-[4/3] overflow-hidden border-b-2 border-[#1C1712] bg-[#EEE7D8]">
                {r.cover && (
                  <Image
                    src={r.cover.url}
                    alt={r.winnerTeam ? `${r.winnerTeam}, winners of ${r.title}` : r.title}
                    fill
                    unoptimized
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="p-6">
                <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#B8451D]">{r.dateText}</div>
                <h2 className="font-display text-3xl mt-2">{r.title}</h2>
                {r.winnerTeam && (
                  <div className="mt-3 font-mono text-xs">
                    WINNERS: <span className="font-bold">{r.winnerTeam.toUpperCase()}</span>
                  </div>
                )}
                {r.stats && <div className="mt-1 font-mono text-xs opacity-70">{r.stats}</div>}
                <div className="mt-4 font-mono text-[11px] tracking-[0.2em] uppercase">See the night →</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </RecapShell>
  );
}
