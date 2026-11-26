"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import KadavuScene from "@/components/KadavuScene";
import { kadavuFonts } from "@/lib/kadavuFonts";
import { FLAGSHIP } from "@/lib/flagship";
import { formatNight, registerPath, shortVenue, timeLeft, type NightInfo, type TimeLeft } from "@/lib/featuredNight";
import type { EventDTO } from "@/types/event";

// The flagship night at the top of the home page, drawn like its poster: sunset on the river, then the date,
// the venue and one big button to the same /book/… address the ads use. Underneath, the other nights, so
// nothing else gets hidden.
export default function KadavuBanner({
  night,
  qrSvg,
  teamsBooked,
  others,
}: {
  night: NightInfo;
  qrSvg: string;
  teamsBooked: number;
  others: EventDTO[];
}) {
  // Starts empty so the server and the browser draw the same thing; the real numbers appear on mount.
  const [left, setLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const tick = () => setLeft(timeLeft(night.startsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [night.startsAt]);

  const when = formatNight(night.startsAt);
  const href = registerPath(night.id);
  const open = !night.registrationClosed;
  // Nights that come before this one. On a phone they go above the poster, so nobody registers for the wrong night.
  const earlier = others.filter((e) => Date.parse(e.date) < Date.parse(night.startsAt)).slice(0, 2);
  const later = others.filter((e) => !earlier.includes(e));
  const cells: [string, string][] = left
    ? [[left.d, "DAYS"], [left.h, "HRS"], [left.m, "MIN"], [left.s, "SEC"]]
    : [["--", "DAYS"], ["--", "HRS"], ["--", "MIN"], ["--", "SEC"]];

  return (
    <section
      id="featured-night"
      aria-label={`${night.title} at ${night.venueName}, ${when.weekdayLong} ${when.dayMonth}, ${when.time}`}
      className={`${kadavuFonts} kd relative overflow-hidden border-b-4 border-[#F2B544] bg-[#2B2146] text-[#F5E9DD]`}
    >
      {/* phone: when another night comes first, the choice is the very first thing */}
      {earlier.length > 0 && (
        <nav aria-label="Pick your night" className="border-b-4 border-[#F2B544] bg-[#F5F0E6] px-4 pb-4 pt-3 text-[#1C1712] md:hidden">
          <p className="kd-title text-lg leading-tight">PICK YOUR NIGHT</p>
          <ul className="mt-2 flex flex-col gap-2.5">
            {earlier.map((ev, i) => {
              const w = formatNight(ev.date);
              const external = ev.externalUrl;
              const action = external ? `Book on ${ev.externalLabel || "the ticket site"}` : ev.registrationClosed ? "Registration closed" : `Register for ${shortVenue(ev.venueName)}`;
              const inner = (
                <>
                  <span className="grid w-16 shrink-0 place-items-center rounded-xl bg-[#F5F0E6] py-1.5 text-[#B8451D]">
                    <span className="kd-title text-3xl leading-none">{w.dayMonth.split(" ")[0]}</span>
                    <span className="kd-title text-sm">{w.dayMonth.split(" ")[1]?.toUpperCase()}</span>
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="kd-mono block text-[11px] uppercase tracking-[0.16em] text-[#FFE3B8]">
                      {i === 0 ? "Next up · " : ""}{w.weekdayShort} {w.shortTime}
                    </span>
                    <span className="kd-title block text-[1.35rem] uppercase leading-tight">{shortVenue(ev.venueName)}</span>
                    <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold underline underline-offset-4">{action}</span>
                  </span>
                  <ArrowRight className="h-6 w-6 shrink-0" aria-hidden="true" />
                </>
              );
              const cls = "flex min-h-[5.5rem] items-center gap-3 rounded-2xl bg-[#B8451D] px-3 py-3 text-[#F5F0E6] shadow-[0_4px_0_#6E2810]";
              return (
                <li key={ev.id}>
                  {external ? (
                    <a href={external} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                  ) : (
                    <Link href={registerPath(ev.id)} className={cls}>{inner}</Link>
                  )}
                </li>
              );
            })}
            <li>
              <Link href={href} className="flex min-h-[5.5rem] items-center gap-3 rounded-2xl bg-[#221B41] px-3 py-3 text-[#F5E9DD] shadow-[0_4px_0_#7D2A5D]">
                <span className="grid w-16 shrink-0 place-items-center rounded-xl bg-[#F2B544] py-1.5 text-[#1B1434]">
                  <span className="kd-title text-3xl leading-none">{when.dayMonth.split(" ")[0]}</span>
                  <span className="kd-title text-sm">{when.dayMonth.split(" ")[1]?.toUpperCase()}</span>
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="kd-mono block text-[11px] uppercase tracking-[0.16em] text-[#F2B544]">Flagship · {when.weekdayShort} {when.shortTime}</span>
                  <span className="kd-title block text-[1.35rem] uppercase leading-tight">{FLAGSHIP.shortName}</span>
                  <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold underline underline-offset-4">
                    {open ? `Register for ${FLAGSHIP.shortName}` : "Registration closed"}
                  </span>
                </span>
                <ArrowRight className="h-6 w-6 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </nav>
      )}

      {/* night sky and the headline */}
      <div className="kd-sky relative">
        <div className="relative mx-auto max-w-7xl px-5 pt-4 md:px-8 md:pt-7">
          <div className="flex items-center justify-between gap-3">
            <p className="kd-mono text-[11px] uppercase tracking-[0.22em] text-[#D9CDF2] md:text-sm">
              <span className="mr-2 rounded-full bg-[#F2B544] px-2 py-0.5 text-[#1B1434]">Flagship night</span>× Kadavu
            </p>
            <p lang="ml" className="kd-hand text-xl text-[#F2B544] md:text-4xl">ക്വിസ് നൈറ്റ്</p>
          </div>
          <h2 className="mt-2">
            <span className="kd-title kd-headline block text-[clamp(2.2rem,12.1vw,8.2rem)] md:text-[clamp(4rem,9.4vw,7rem)] leading-[0.95] text-[#F2B544]">MOLLYWOOD</span>
            <span className="kd-spaced mt-1 flex justify-between text-[clamp(0.78rem,3.7vw,2.2rem)] font-medium uppercase md:mt-2 md:max-w-[56rem]">
              <span>Quiz</span>
              <span>Night</span>
              <span aria-hidden="true">·</span>
              <span>By</span>
              <span>The</span>
              <span>River</span>
            </span>
          </h2>
        </div>
      </div>

      {/* the river at sunset */}
      <div className="relative -mt-px">
        <KadavuScene id="kd-m" width={560} deck className="block aspect-[560/400] w-full md:hidden" />
        <KadavuScene id="kd-d" width={1440} className="hidden aspect-[1440/360] max-h-[24rem] w-full md:block" />
        <div className="kd-bubble absolute left-[7%] top-[13%] max-w-[78%] md:left-[17%]">
          <p lang="ml" className="font-malayalam text-[clamp(1rem,4.6vw,1.9rem)] leading-snug">സാധനം കയ്യിൽ ഉണ്ടോ?</p>
          <p className="kd-mono text-[9px] uppercase tracking-[0.18em] text-[#7D2A5D] md:text-xs">Answers ready? Climb aboard.</p>
        </div>
        <p className="absolute bottom-2 left-1/2 flex -translate-x-1/2 -rotate-2 items-center gap-2 whitespace-nowrap rounded-full bg-[#D8272F] py-1 pl-1 pr-4 text-[13px] text-white shadow-[3px_3px_0_#150F24] md:bottom-4 md:text-lg">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#F5E9DD] md:h-9 md:w-9" aria-hidden="true">🍺</span>
          <span>
            <strong className="uppercase tracking-wide">{FLAGSHIP.offer}</strong> · {FLAGSHIP.offerAt}
          </span>
        </p>
      </div>

      <div className="relative mx-auto flex max-w-5xl items-center justify-center gap-10 px-4 pb-6 pt-1 md:px-8 md:pb-10">
        <div className="flex w-full flex-col items-center gap-3 sm:w-auto">
          <div className="flex flex-col items-center text-center md:flex-row md:gap-6">
            <p className="kd-mono text-sm uppercase tracking-[0.16em] md:text-lg">{`${when.weekdayShort} ${when.dayMonth} · ${when.time}`}</p>
            <a href={night.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-[#D9CDF2] underline decoration-[#F2B544] decoration-2 underline-offset-4">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              {night.venueName}
              <span className="sr-only">: get directions</span>
            </a>
          </div>
          {open ? (
            <Link
              href={href}
              className="kd-cta kd-title group inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#F2B544] px-4 text-center text-[1.05rem] text-[#1B1434] sm:w-auto sm:px-8 sm:text-lg md:text-2xl"
            >
              REGISTER FOR {FLAGSHIP.shortName.toUpperCase()}
              <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          ) : (
            <p role="status" className="kd-title inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#F5E9DD] px-8 text-center text-lg text-[#1B1434] sm:w-auto md:text-2xl">
              REGISTRATION CLOSED
            </p>
          )}
          {teamsBooked > 0 && (
            <p className="kd-mono flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#F2B544]">
              <span className="fn-blink h-2 w-2 rounded-full bg-[#F2B544]" aria-hidden="true" />
              {teamsBooked} {teamsBooked === 1 ? "team" : "teams"} already aboard
            </p>
          )}
          <div className="grid w-full max-w-sm grid-cols-4 gap-2" role="timer" aria-label={left?.started ? "The night has started" : "Countdown to the night"}>
            {left?.started ? (
              <p className="kd-title col-span-4 rounded-xl bg-[#1B1434] py-2 text-center text-xl text-[#F2B544]">HAPPENING NOW</p>
            ) : (
              cells.map(([n, label]) => (
                <div key={label} className="rounded-xl bg-[#1B1434] py-1.5 text-center">
                  <div className="kd-title text-2xl text-[#F5E9DD] md:text-3xl">{n}</div>
                  <div className="kd-mono text-[9px] tracking-[0.18em] text-[#B9A9DC]">{label}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* on a laptop: scan it with a phone */}
        {open && (
          <div className="hidden w-48 shrink-0 -rotate-2 flex-col items-center rounded-2xl bg-[#F2B544] p-3 text-center text-[#1B1434] md:flex">
            <div className="aspect-square w-full rounded-xl bg-white p-2" role="img" aria-label="QR code that opens the registration page" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <p className="kd-title mt-2 text-lg leading-tight">SCAN TO BOARD</p>
          </div>
        )}
      </div>

      {/* the other nights stay in view */}
      {others.length > 0 && (
        <div className={`relative border-t border-white/15 bg-[#1B1434] ${later.length === 0 ? "hidden md:block" : ""}`}>
          <div className="mx-auto max-w-5xl px-4 py-4 md:px-8 md:py-5">
            <div className="flex items-center justify-between gap-3">
              <p className="kd-title text-base text-[#F2B544] md:text-xl">ALSO COMING UP</p>
              <span className="flex items-center gap-4 text-sm font-bold">
                {later.length > 1 && <span className="text-[#F5E9DD]/60 md:hidden" aria-hidden="true">SWIPE →</span>}
                <a href="#events" className="inline-flex min-h-11 items-center underline decoration-[#F2B544] decoration-2 underline-offset-4">
                  See all
                </a>
              </span>
            </div>
            <ul
              className="-mx-4 mt-1 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
              aria-label="Other upcoming nights"
            >
              {others.map((ev) => {
                const w = formatNight(ev.date);
                const external = ev.externalUrl;
                const inner = (
                  <>
                    <span className="kd-title w-12 shrink-0 text-center text-[#C93D4F]">
                      <span className="block text-2xl leading-none">{w.dayMonth.split(" ")[0]}</span>
                      <span className="block text-xs">{w.dayMonth.split(" ")[1]?.toUpperCase()}</span>
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate font-bold">{ev.venueName}</span>
                      <span className="block truncate text-sm text-[#221B41]/75">
                        {w.weekdayShort} · {w.shortTime} · {external ? `On ${ev.externalLabel || "the ticket site"}` : ev.registrationClosed ? "Registration closed" : "Register"}
                      </span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[#C93D4F]" aria-hidden="true" />
                  </>
                );
                // One other night fills the row on a phone; several are swiped through
                const cls = `flex min-h-16 items-center gap-3 rounded-2xl bg-[#F5E9DD] px-4 py-2.5 text-[#221B41] hover:bg-white md:w-[19rem] ${later.length > 1 ? "w-[18rem]" : "w-full"}`;
                return (
                  <li key={ev.id} className={`shrink-0 snap-start ${earlier.includes(ev) ? "hidden md:block" : later.length > 1 ? "" : "w-full md:w-auto"}`}>
                    {external ? (
                      <a href={external} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                    ) : (
                      <Link href={registerPath(ev.id)} className={cls}>{inner}</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
