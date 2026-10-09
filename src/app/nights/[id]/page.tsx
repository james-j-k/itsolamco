import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import RecapShell from "@/components/RecapShell";
import { PhotoGrid, RecapClip } from "@/components/RecapGallery";
import { getPublishedRecap } from "@/lib/recaps";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const recap = await getPublishedRecap(id);
  if (!recap) return { title: "Past Nights | It's Olam Company" };

  const description = recap.winnerTeam
    ? `${recap.winnerTeam} won ${recap.title}. See the photos and clips from the night.`
    : `Photos and clips from ${recap.title}.`;
  return {
    title: `${recap.title} | It's Olam Company`,
    description,
    openGraph: {
      title: `${recap.title} — the recap`,
      description,
      type: "article",
      ...(recap.cover && { images: [{ url: recap.cover.url }] }),
    },
  };
}

export default async function NightRecapPage({ params }: Props) {
  const { id } = await params;
  const recap = await getPublishedRecap(id);
  if (!recap) notFound();

  // The featured photo is already the big picture at the top, so the grid is the other photos.
  const gallery = recap.cover ? recap.photos.slice(1) : recap.photos;

  return (
    <RecapShell>
      <Link href="/nights" className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#B8451D] hover:underline">
        ← All past nights
      </Link>

      <div className="mt-6 font-mono text-[11px] tracking-[0.2em] uppercase text-[#B8451D]">{recap.dateText}</div>
      <h1 className="font-display text-5xl md:text-7xl mt-2 mb-2">{recap.title}</h1>
      <p className="text-[#8C8477] mb-10">{recap.venue}</p>

      {recap.cover && (
        <div className="mb-12 border-2 border-[#1C1712]">
          <div className="relative aspect-[4/3] w-full bg-[#EEE7D8] sm:aspect-[16/10]">
            <Image
              src={recap.cover.url}
              alt={recap.winnerTeam ? `${recap.winnerTeam}, winners of ${recap.title}` : recap.title}
              fill
              unoptimized
              priority
              sizes="(min-width: 1024px) 64rem, 100vw"
              className="object-cover"
            />
          </div>
          {(recap.winnerTeam || recap.stats) && (
            <div className="flex flex-col gap-2 border-t-2 border-[#1C1712] bg-[#1C1712] p-6 text-[#F5F0E6] sm:flex-row sm:items-end sm:justify-between">
              {recap.winnerTeam && (
                <div>
                  <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#B8451D]">Winners</div>
                  <div className="font-display text-4xl md:text-5xl">{recap.winnerTeam}</div>
                </div>
              )}
              {recap.stats && <div className="font-mono text-xs opacity-80">{recap.stats}</div>}
            </div>
          )}
        </div>
      )}

      {recap.summary && (
        <p className="mb-14 max-w-2xl whitespace-pre-line text-lg leading-relaxed">{recap.summary}</p>
      )}

      {recap.videos.length > 0 && (
        <section className="mb-14">
          <h2 className="font-display text-3xl md:text-4xl mb-6">THE CLIPS</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {recap.videos.map((clip) => (
              <RecapClip key={clip.id} clip={clip} />
            ))}
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="mb-14">
          <h2 className="font-display text-3xl md:text-4xl mb-6">THE PHOTOS</h2>
          <PhotoGrid photos={gallery} alt={`Photo from ${recap.title}`} />
        </section>
      )}

      <section className="border-2 border-[#1C1712] bg-[#B8451D] p-8 text-center text-[#F5F0E6] md:p-12">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase mb-3">Want in next time?</div>
        <h2 className="font-display text-4xl md:text-5xl mb-6">BRING YOUR TEAM.</h2>
        <Link
          href="/#events"
          className="inline-block border-2 border-[#F5F0E6] px-8 py-3 font-display text-lg transition-colors hover:bg-[#F5F0E6] hover:text-[#B8451D]"
        >
          SEE THE NEXT NIGHT →
        </Link>
      </section>
    </RecapShell>
  );
}
