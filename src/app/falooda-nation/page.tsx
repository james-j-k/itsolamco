import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BUSINESS } from "@/lib/business";
import { TICKETING_SOURCE } from "@/lib/bookingSource";
import { FEATURED_NIGHT, defaultFeaturedInfo, formatNight, nightIsLive } from "@/lib/featuredNight";
import { loadFeaturedNight } from "@/lib/featuredNightServer";
import RegisterWizard from "@/components/RegisterWizard";

export const dynamic = "force-dynamic";

// The share preview and tab title use the night as first set up; the page itself always shows what is in the admin.
const start = defaultFeaturedInfo();
const when = formatNight(start.startsAt);

export const metadata: Metadata = {
  title: `Register your team | ${start.title} at ${start.venueName}`,
  description: `${when.weekdayLong} ${when.dayMonth}, ${when.shortTime}, ${start.venueName}, ${start.venueArea}, Kochi. Register your team for ${start.title} in about a minute.`,
  openGraph: {
    title: `${start.title} at ${start.venueName}`,
    description: `${when.weekdayLong} ${when.dayMonth}, ${when.shortTime}, ${start.venueArea}, Kochi. Register your team.`,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#139186",
  // On Android the on-screen keyboard shrinks the page instead of covering it, so the box being typed in is never hidden
  interactiveWidget: "resizes-content",
};

export default async function FaloodaPage() {
  let night = defaultFeaturedInfo();
  let teamsBooked = 0;
  try {
    night = await loadFeaturedNight();
    teamsBooked = await prisma.booking.count({
      where: { eventId: FEATURED_NIGHT.id, status: { not: "cancelled" }, source: { not: TICKETING_SOURCE } },
    });
  } catch (err) {
    // The page and the form must still open if the database can't be read for a moment
    console.error("Couldn't prepare the featured night:", err);
  }

  if (!nightIsLive(night.startsAt)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#FCE8F0] px-6 text-center text-[#2C2C2C]">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold">This night has passed.</h1>
          <p className="mt-3">Thanks to everyone who came. The next nights are on our home page.</p>
          <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#B23B79] px-6 font-bold text-white">
            See what&apos;s next
          </Link>
        </div>
      </main>
    );
  }

  // The admin has stopped registrations for this night
  if (night.registrationClosed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#FCE8F0] px-6 text-center text-[#2C2C2C]">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold">Registration is closed.</h1>
          <p className="mt-3">
            We are not taking any more teams for {night.title} at {night.venueName}. Already registered? You are all set, see you there. Follow{" "}
            {BUSINESS.instagramHandle} for the next night.
          </p>
          <a
            href={BUSINESS.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#B23B79] px-6 font-bold text-white"
          >
            Follow us on Instagram
          </a>
          <div>
            <Link href="/" className="mt-3 inline-flex min-h-12 items-center px-4 font-bold underline underline-offset-4">
              See other nights
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <RegisterWizard night={night} theme="falooda" teamsBooked={teamsBooked} />;
}
