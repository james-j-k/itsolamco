import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPassed, mapsLinkFor, safeHttpUrl } from "@/lib/eventLinks";
import RsvpForm from "@/components/RsvpForm";

export const dynamic = "force-dynamic";

// Private, per-booking link: keep it out of search results.
export const metadata: Metadata = {
  title: "Are you coming? | It's Olam Company",
  robots: { index: false, follow: false },
};

const TZ = "Asia/Kolkata";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F0E6] text-[#1C1712] flex flex-col items-center px-5 py-10">
      <Link href="/" className="mb-8">
        <Image src="/logo.png" alt="It's Olam Company" width={2000} height={1042} className="h-12 w-auto" />
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function Notice({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <Shell>
      <div className="border-2 border-[#1C1712] p-8 text-center">
        <div className="font-mono text-[#B8451D] text-xs tracking-[0.28em] uppercase mb-4">{label}</div>
        <h1 className="font-display text-4xl mb-4">{title}</h1>
        <p className="text-[#6A6357] leading-relaxed">{body}</p>
      </div>
    </Shell>
  );
}

export default async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const booking = await prisma.booking.findUnique({
    where: { rsvpToken: token },
    include: { event: true },
  });
  if (!booking) notFound();

  if (booking.status === "cancelled") {
    return (
      <Notice
        label="BOOKING CANCELLED"
        title="THIS BOOKING WAS CANCELLED."
        body="If that's a mistake, message us on Instagram (@itsolamco) and we'll sort it out."
      />
    );
  }

  const event = booking.event;
  if (event && hasPassed(event.date)) {
    return (
      <Notice label="ALL DONE" title="THIS NIGHT HAS PASSED." body="Keep an eye on our Instagram for the next one." />
    );
  }

  return (
    <Shell>
      <div className="border-2 border-[#1C1712] p-6 sm:p-8">
        <div className="font-mono text-[#B8451D] text-xs tracking-[0.28em] uppercase mb-3">FOR {booking.teamName.toUpperCase()}</div>
        <h1 className="font-display text-4xl mb-5">ARE YOU COMING?</h1>

        {event ? (
          <div className="border border-[#1C1712]/25 p-4 mb-6">
            <div className="font-display text-xl mb-1">{event.title}</div>
            <div className="font-semibold">
              {event.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: TZ })}
              {" · "}
              {event.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ })}
            </div>
            <div className="text-[#6A6357] text-sm mt-1">
              {event.venueName}, {event.venueArea}
            </div>
            <a
              href={mapsLinkFor(event)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm text-[#B8451D] underline underline-offset-2"
            >
              Open in Google Maps →
            </a>
          </div>
        ) : (
          <p className="text-[#6A6357] mb-6">We&apos;ll confirm the exact night and venue with you shortly.</p>
        )}

        <RsvpForm
          token={token}
          defaultHeadcount={booking.rsvpHeadcount ?? booking.teamSize}
          initialResponse={booking.rsvpStatus === "coming" || booking.rsvpStatus === "declined" ? booking.rsvpStatus : null}
          initialTableBooked={booking.rsvpTableBooked}
          offerNote={event?.reminderOfferNote ?? null}
          districtUrl={safeHttpUrl(event?.districtUrl)}
          swiggyUrl={safeHttpUrl(event?.swiggyUrl)}
        />
      </div>
    </Shell>
  );
}
