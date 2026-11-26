import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BUSINESS } from "@/lib/business";
import { TICKETING_SOURCE } from "@/lib/bookingSource";
import { safeHttpUrl } from "@/lib/eventLinks";
import { FEATURED_NIGHT, formatNight, nightInfoFrom, nightIsLive, registerPath, shortVenue } from "@/lib/featuredNight";
import { FLAGSHIP, flagshipInfo, isFlagship } from "@/lib/flagship";
import RegisterWizard, { type EarlierNight } from "@/components/RegisterWizard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { id } = await params;
  return { themeColor: isFlagship(id) ? "#1B1434" : "#F5F0E6", interactiveWidget: "resizes-content" };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } }).catch(() => null);
  if (!event) return { title: "Register your team | It's Olam Company" };
  const n = isFlagship(id) ? flagshipInfo(event) : nightInfoFrom(event);
  const when = formatNight(n.startsAt);
  if (isFlagship(id)) {
    const title = `${FLAGSHIP.title} by the river | ${when.short}`;
    const description = `${when.weekdayLong} ${when.dayMonth}, ${when.shortTime}, ${n.venueName}, ${n.venueArea}. Register your team in about a minute.`;
    return { title, description, openGraph: { title, description, type: "website" } };
  }
  return {
    title: `Register your team | ${n.title} at ${n.venueName}`,
    description: `${when.weekdayLong} ${when.dayMonth}, ${when.shortTime}, ${n.venueName}, ${n.venueArea}. Register your team in about a minute.`,
  };
}

// Registration for any night that is not the Falooda Nation one (that one has its own page at /falooda-nation).
export default async function BookNightPage({ params }: Props) {
  const { id } = await params;
  if (id === FEATURED_NIGHT.id) redirect(FEATURED_NIGHT.path);

  const event = await prisma.event.findUnique({
    where: { id },
    include: { _count: { select: { bookings: { where: { status: { not: "cancelled" }, source: { not: TICKETING_SOURCE } } } } } },
  });
  if (!event) notFound();

  // A night whose tickets are sold on another site is booked there
  const external = safeHttpUrl(event.externalTicketUrl);
  if (external) redirect(external);

  const flagship = isFlagship(id);
  const night = flagship ? flagshipInfo(event) : nightInfoFrom(event);
  if (!nightIsLive(night.startsAt)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F5F0E6] px-6 text-center text-[#1C1712]">
        <div className="max-w-md">
          <h1 className="font-display text-4xl">THIS NIGHT HAS PASSED.</h1>
          <p className="mt-3 text-[#6A6357]">Thanks to everyone who came. The next nights are on our home page.</p>
          <Link href="/" className="btn-rust mt-6 inline-flex min-h-12 items-center px-6 font-display text-lg">
            SEE WHAT&apos;S NEXT
          </Link>
        </div>
      </main>
    );
  }

  if (night.registrationClosed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F5F0E6] px-6 text-center text-[#1C1712]">
        <div className="max-w-md">
          <h1 className="font-display text-4xl">REGISTRATION IS CLOSED.</h1>
          <p className="mt-3 text-[#6A6357]">
            We are not taking any more teams for this night. Already registered? You are all set, see you there. Follow {BUSINESS.instagramHandle} for the next one.
          </p>
          <a
            href={BUSINESS.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-rust mt-6 inline-flex min-h-12 items-center px-6 font-display text-lg"
          >
            FOLLOW US ON INSTAGRAM
          </a>
          <div>
            <Link href="/" className="mt-3 inline-flex min-h-12 items-center px-4 font-mono text-xs underline underline-offset-4">
              See other nights
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // On the flagship page, point out the night that comes first (if there is one still to come)
  let earlier: EarlierNight | undefined;
  if (flagship) {
    const first = await prisma.event
      .findFirst({ where: { id: { not: id }, date: { gte: new Date(), lt: event.date }, registrationClosed: false }, orderBy: { date: "asc" } })
      .catch(() => null);
    if (first) {
      const tickets = safeHttpUrl(first.externalTicketUrl);
      earlier = {
        venue: shortVenue(first.venueName),
        startsAt: first.date.toISOString(),
        href: tickets ?? registerPath(first.id),
        action: tickets ? `Book on ${first.externalTicketLabel || "the ticket site"}` : "Register there",
        external: Boolean(tickets),
      };
    }
  }

  return <RegisterWizard night={night} theme={flagship ? "kadavu" : "olam"} teamsBooked={event._count.bookings} earlier={earlier} />;
}
