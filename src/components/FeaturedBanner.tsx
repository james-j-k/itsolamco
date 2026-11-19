"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import FaloodaGlass from "@/components/FaloodaGlass";
import { phudu } from "@/lib/faloodaFont";
import { formatNight, registerPath, type NightInfo } from "@/lib/featuredNight";
import type { EventDTO } from "@/types/event";

type Left = { d: string; h: string; m: string; s: string; started: boolean };

function timeLeft(startsAt: string): Left {
  const diff = Date.parse(startsAt) - Date.now();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ms = Math.max(0, diff);
  return {
    d: pad(Math.floor(ms / 86400000)),
    h: pad(Math.floor(ms / 3600000) % 24),
    m: pad(Math.floor(ms / 60000) % 60),
    s: pad(Math.floor(ms / 1000) % 60),
    started: diff <= 0,
  };
}

const SHADOW = "shadow-[0_4px_0_rgba(202,77,140,0.25)]";

// The first thing on the home page: the next big night, in the venue's own colours (soft pink, magenta
// and teal, with chunky headlines). One big button, a QR code for anyone looking at it on a laptop, and
// a swipeable strip of the other nights underneath. Everything shown comes from the event saved in the admin.
export default function FeaturedBanner({
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
  // Starts empty so the server and the browser render the same thing; the real numbers appear on mount.
  const [left, setLeft] = useState<Left | null>(null);

  useEffect(() => {
    const tick = () => setLeft(timeLeft(night.startsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [night.startsAt]);

  const when = formatNight(night.startsAt);
  const [firstWord, ...restWords] = night.title.trim().split(/\s+/);
  const ticker = `${when.weekdayShort} ${when.dayMonth}  ·  ${when.shortTime}  ·  ${night.venueName}, ${night.venueArea}  ·  ${night.title}  ·  `.toUpperCase();
  const cells: [string, string][] = left
    ? [[left.d, "DAYS"], [left.h, "HRS"], [left.m, "MIN"], [left.s, "SEC"]]
    : [["--", "DAYS"], ["--", "HRS"], ["--", "MIN"], ["--", "SEC"]];

  return (
    <section
      id="featured-night"
      aria-label={`${night.title} at ${night.venueName}, ${when.weekdayLong} ${when.dayMonth}, ${when.time}`}
      className={`${phudu.variable} fn-banner relative overflow-hidden border-b-4 border-[#139186] bg-[#FCE8F0] bg-[radial-gradient(circle_at_88%_12%,#ffffff_0%,transparent_42%),radial-gradient(circle_at_6%_96%,#F9C4DA_0%,transparent_38%)] text-[#2C2C2C]`}
      style={{ "--rg-deep": "#B23B79", "--rg-accent": "#CA4D8C", "--rg-shadow": "#7d2655", "--rg-deep-hover": "#A23270", "--rg-alt": "#139186" } as React.CSSProperties}
    >
      {/* Teal ticker, like the venue's own teal sections */}
      <div className="relative overflow-hidden bg-[#139186] py-2 text-white" aria-hidden="true">
        <div className="fn-marquee fn-display flex w-max whitespace-nowrap text-sm tracking-[0.08em] md:text-base">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="pr-2">{ticker}</span>
          ))}
        </div>
      </div>

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-x-10 px-5 pb-6 pt-7 md:grid-cols-[1.1fr_0.9fr] md:px-8 md:pb-10 md:pt-12">
        <div>
          <div className="fn-display inline-flex items-center gap-2 rounded-full bg-[#139186] px-4 py-1.5 text-[13px] tracking-[0.06em] text-white md:text-sm">
            <span className="fn-blink h-2 w-2 rounded-full bg-[#FFC93C]" aria-hidden="true" />
            {`${when.weekdayLong} · ${when.dayMonth} · ${when.time}`.toUpperCase()}
          </div>

          <h2 className="fn-display mt-4 text-[clamp(2.6rem,13vw,6.4rem)]">
            {firstWord.toUpperCase()}
            {restWords.length > 0 && <span className="block text-[#CA4D8C]">{restWords.join(" ").toUpperCase()}</span>}
          </h2>

          <p className="mt-3 flex items-start gap-2 text-lg font-semibold md:text-2xl">
            <MapPin className="mt-1 h-5 w-5 shrink-0 text-[#B23B79] md:h-6 md:w-6" aria-hidden="true" />
            <span>
              at <span className="fn-display text-[#B23B79]">{night.venueName.toUpperCase()}</span>
              <span className="block text-base font-medium text-[#2C2C2C]/75 md:text-lg">{night.venueArea}, {night.city}</span>
            </span>
          </p>

          {/* On a phone the countdown and the glass share a row, so the poster fits on one screen */}
          <div className="mt-5 grid grid-cols-[1fr_8.5rem] items-center gap-3 md:block">
            <div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3" role="timer" aria-label={left?.started ? "The night has started" : "Countdown to the night"}>
                {left?.started ? (
                  <div className={`fn-display col-span-2 rounded-2xl bg-white px-4 py-3 text-center text-2xl text-[#B23B79] md:col-span-4 ${SHADOW}`}>
                    HAPPENING NOW
                  </div>
                ) : (
                  cells.map(([n, label]) => (
                    <div key={label} className={`rounded-2xl bg-white px-2 py-2 text-center md:px-3 md:py-3 ${SHADOW}`}>
                      <div className="fn-display text-3xl text-[#B23B79] md:text-5xl">{n}</div>
                      <div className="font-mono !text-[10px] !tracking-[0.18em] text-[#2C2C2C]/70">{label}</div>
                    </div>
                  ))
                )}
              </div>
              {teamsBooked > 0 && (
                <p className="mt-3 flex items-center gap-2 text-sm font-bold text-[#0E7C73]">
                  <span className="fn-blink h-2 w-2 rounded-full bg-[#139186]" aria-hidden="true" />
                  {teamsBooked} {teamsBooked === 1 ? "TEAM" : "TEAMS"} ALREADY IN
                </p>
              )}
            </div>
            <FaloodaGlass className="fn-bob h-auto w-full md:hidden" />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {night.registrationClosed ? (
              <p
                className="fn-display inline-flex min-h-14 w-full items-center justify-center rounded-full bg-white px-8 text-center text-xl text-[#B23B79] sm:w-auto md:text-2xl"
                role="status"
              >
                REGISTRATION CLOSED
              </p>
            ) : (
              <Link
                href={registerPath(night.id)}
                className="fn-cta fn-display group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#B23B79] px-8 text-xl text-white sm:w-auto md:text-2xl"
              >
                REGISTER YOUR TEAM
                <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            )}
            <a
              href={night.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-base font-bold text-[#2C2C2C] underline decoration-[#CA4D8C] decoration-2 underline-offset-4 hover:text-[#B23B79]"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Get directions
            </a>
          </div>
        </div>

        {/* Laptop and bigger: the glass, with the QR code beside it to scan and register from a phone */}
        <div className="relative mt-2 hidden items-end justify-center gap-6 md:flex lg:gap-10">
          <FaloodaGlass className="fn-bob h-[24rem] w-auto lg:h-[29rem]" />
          {!night.registrationClosed && (
          <figure className={`fn-tilt mb-6 w-44 shrink-0 rounded-3xl bg-white p-4 text-center shadow-[0_10px_0_rgba(202,77,140,0.3)] lg:w-52`}>
            <div
              className="mx-auto aspect-square w-full"
              role="img"
              aria-label="QR code that opens the registration page"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <figcaption className="fn-display mt-2 text-lg text-[#B23B79]">
              SCAN TO REGISTER
              <span className="block font-sans text-xs font-semibold normal-case tracking-normal text-[#2C2C2C]/70">Opens on your phone, takes a minute</span>
            </figcaption>
          </figure>
          )}
        </div>
      </div>

      {/* The other nights: swipe along, tap one to register for it */}
      {others.length > 0 && (
        <div className="relative border-t-2 border-white/80 bg-white/50">
          <div className="mx-auto max-w-7xl px-5 py-4 md:px-8 md:py-5">
            <div className="flex items-center justify-between gap-3">
              <p className="fn-display text-lg text-[#B23B79] md:text-xl">MORE NIGHTS</p>
              <span className="flex items-center gap-4 text-sm font-bold">
                {others.length > 1 && <span className="text-[#2C2C2C]/60 md:hidden" aria-hidden="true">SWIPE →</span>}
                <a href="#events" className="inline-flex min-h-11 items-center underline decoration-[#CA4D8C] decoration-2 underline-offset-4 hover:text-[#B23B79]">
                  See all
                </a>
              </span>
            </div>
            <ul
              className="-mx-5 mt-1 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-3 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
              aria-label="Other upcoming nights"
            >
              {others.map((ev) => {
                const w = formatNight(ev.date);
                const external = ev.externalUrl;
                const inner = (
                  <>
                    <span className="fn-display w-12 shrink-0 text-center text-[#B23B79]">
                      <span className="block text-3xl">{w.dayMonth.split(" ")[0]}</span>
                      <span className="block text-sm">{w.dayMonth.split(" ")[1]?.toUpperCase()}</span>
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate font-bold">{ev.venueName}</span>
                      <span className="block truncate text-sm text-[#2C2C2C]/70">
                        {w.weekdayShort} · {w.shortTime} · {external ? `Tickets on ${ev.externalLabel || "the ticket site"}` : ev.registrationClosed ? "Registration closed" : "Register"}
                      </span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[#B23B79]" aria-hidden="true" />
                  </>
                );
                const cls = `flex min-h-16 w-[17rem] items-center gap-3 rounded-2xl bg-white px-4 py-2.5 hover:bg-[#FFF5F9] ${SHADOW}`;
                return (
                  <li key={ev.id} className="shrink-0 snap-start">
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
