"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Flame,
  Mic2,
  Music,
  Zap,
  Trophy,
  Sparkles,
  CalendarDays,
  ArrowUpRight,
  MessageCircle,
  Users,
  Mail,
  Menu,
  X,
} from "lucide-react";
import type { EventDTO } from "@/types/event";
import type { QuizRoundDTO, VenueDTO } from "@/types/content";
import BookingModal from "@/components/BookingModal";
import VenueInquiryModal from "@/components/VenueInquiryModal";
import ComingSoonModal from "@/components/ComingSoonModal";
import { useModalA11y } from "@/lib/useModalA11y";

const NAV_LINKS = [
  { href: "#statement-wipe", label: "Manifesto" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#events", label: "Upcoming" },
  { href: "#venues", label: "Venues" },
  { href: "#partner", label: "Partner" },
];

function XLogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={{ width: "1em", height: "1em" }} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// lucide-react doesn't ship brand logos, so this mirrors its exact stroke style (2px round-linecap/linejoin) to blend in seamlessly.
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ width: "1em", height: "1em" }}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

// Presentational only (not admin-editable) — cycles by round position so any round count still looks intentional.
const ROUND_ICONS = [
  { Icon: Flame, rot: "group-hover:rotate-12 group-active:rotate-12" },
  { Icon: Mic2, rot: "group-hover:scale-125 group-active:scale-125" },
  { Icon: Music, rot: "group-hover:rotate-[-12deg] group-active:rotate-[-12deg]" },
  { Icon: Zap, rot: "group-hover:-translate-y-2 group-active:-translate-y-2" },
  { Icon: Trophy, rot: "group-hover:rotate-[360deg] group-active:rotate-[360deg] duration-1000" },
  { Icon: Sparkles, rot: "group-hover:scale-110 group-active:scale-110" },
];

function formatShortDate(d: Date) {
  return `${d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()} ${d.getDate()}`;
}
function formatDayDate(d: Date) {
  return `${d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()} / ${formatShortDate(d)}`;
}
function formatTime(d: Date) {
  return d
    .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    .toUpperCase();
}

// Whether the device has a real mouse (vs. touch-only) — read via useSyncExternalStore
// rather than useState+useEffect so there's no setState-in-effect and no SSR/hydration
// mismatch (React reconciles the server/client snapshot difference for this hook by design).
const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
function subscribeToHoverCapability(callback: () => void) {
  const mql = window.matchMedia(HOVER_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getHoverCapabilitySnapshot() {
  return window.matchMedia(HOVER_QUERY).matches;
}
function getHoverCapabilityServerSnapshot() {
  return true;
}

type Props = { events: EventDTO[]; rounds: QuizRoundDTO[]; venues: VenueDTO[] };

export default function HomePage({ events, rounds, venues }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingPreselect, setBookingPreselect] = useState<string | null>(null);
  const [bookingKey, setBookingKey] = useState(0);
  const [venueOpen, setVenueOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [countdown, setCountdown] = useState({ d: "00", h: "00", m: "00", s: "00" });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const canHover = useSyncExternalStore(
    subscribeToHoverCapability,
    getHoverCapabilitySnapshot,
    getHoverCapabilityServerSnapshot
  );

  const nextEvent = events[0] ?? null;
  const upcomingCards = events.slice(0, 3);

  const heroDescRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useModalA11y(mobileNavOpen, () => setMobileNavOpen(false));

  function openBooking(eventId?: string) {
    setBookingPreselect(eventId ?? null);
    setBookingKey((k) => k + 1);
    setBookingOpen(true);
  }

  // Hero copy reveal on mount
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll(".reveal-char").forEach((el) => {
      (el as HTMLElement).style.transform = "translateY(0)";
    });
    const timer = setTimeout(() => {
      if (heroDescRef.current) {
        heroDescRef.current.style.opacity = "1";
        heroDescRef.current.style.transform = "translateY(0)";
      }
    }, reduceMotion ? 0 : 800);
    return () => clearTimeout(timer);
  }, []);

  // Live countdown to the next real event
  useEffect(() => {
    const target = nextEvent
      ? new Date(nextEvent.date)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + 12);
          d.setHours(20, 0, 0, 0);
          return d;
        })();

    function tick() {
      const diff = Math.max(0, target.getTime() - Date.now());
      const pad = (n: number) => String(n).padStart(2, "0");
      setCountdown({
        d: pad(Math.floor(diff / 86400000)),
        h: pad(Math.floor(diff / 3600000) % 24),
        m: pad(Math.floor(diff / 60000) % 60),
        s: pad(Math.floor(diff / 1000) % 60),
      });
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextEvent]);

  // The full scroll-choreography system: nav hide/show, statement wipe,
  // round-by-round timeline, venue canvas map, magnetic buttons, reveal-on-scroll.
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const numRounds = rounds.length;

    // Magnetic buttons
    const magneticEls = Array.from(document.querySelectorAll<HTMLElement>(".magnetic"));
    const magneticCleanups: Array<() => void> = [];
    if (!reduceMotion) {
      magneticEls.forEach((btn) => {
        const onMove = (e: MouseEvent) => {
          const r = btn.getBoundingClientRect();
          const relX = e.clientX - (r.left + r.width / 2);
          const relY = e.clientY - (r.top + r.height / 2);
          const max = 10;
          btn.style.transform = `translate(${Math.max(-max, Math.min(max, relX * 0.25))}px, ${Math.max(-max, Math.min(max, relY * 0.35))}px)`;
        };
        const onLeave = () => {
          btn.style.transform = "";
        };
        btn.addEventListener("mousemove", onMove);
        btn.addEventListener("mouseleave", onLeave);
        magneticCleanups.push(() => {
          btn.removeEventListener("mousemove", onMove);
          btn.removeEventListener("mouseleave", onLeave);
        });
      });
    }

    // Reveal-on-scroll
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    let io: IntersectionObserver | null = null;
    if (reduceMotion) {
      revealEls.forEach((el) => el.classList.add("revealed"));
    } else {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("revealed");
              io?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );
      revealEls.forEach((el) => io?.observe(el));
    }

    // Venue map canvas — hover-only interaction (tooltip needs mousemove), so
    // skip wiring it up entirely on touch devices: it'd just be dead weight
    // redrawing every 90ms with nothing to show for it. The venue names are
    // already available in the card grid regardless.
    const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const venueCanvas = supportsHover
      ? (document.getElementById("venue-map-canvas") as HTMLCanvasElement | null)
      : null;
    const venueSection = document.getElementById("venues");
    const tooltip = document.getElementById("venue-tooltip");
    let venueNodes: { x: number; y: number }[] = [];
    let venueRouteIdx: number[] = [];
    // Spread venue labels evenly along the traced route so any venue count still reads cleanly.
    const fixedRoute = [2, 5, 8, 3, 11, 14, 9, 18, 22, 15, 25, 19, 21];
    const venueLabels: Record<number, string> = {};
    if (venues.length > 0) {
      venues.forEach((v, i) => {
        const routePos = Math.round((i / venues.length) * fixedRoute.length);
        const nodeIdx = fixedRoute[Math.min(routePos, fixedRoute.length - 1)];
        venueLabels[nodeIdx] = v.name.toUpperCase();
      });
    }

    function buildLattice(w: number, h: number) {
      const nodes: { x: number; y: number }[] = [];
      const count = 26;
      for (let i = 0; i < count; i++) {
        const angle = i * 2.399;
        const radius = Math.sqrt(i / count);
        const x = w / 2 + Math.cos(angle) * radius * (w * 0.42);
        const y = h / 2 + Math.sin(angle) * radius * (h * 0.42);
        nodes.push({ x, y });
      }
      return nodes;
    }

    function resizeVenueCanvas() {
      if (!venueCanvas || !venueSection) return;
      const rect = venueSection.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      venueCanvas.width = rect.width * dpr;
      venueCanvas.height = rect.height * dpr;
      venueCanvas.style.width = rect.width + "px";
      venueCanvas.style.height = rect.height + "px";
      const ctx = venueCanvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      venueNodes = buildLattice(rect.width, rect.height);
      venueRouteIdx = fixedRoute;
    }

    function drawVenueMap(progress: number) {
      if (!venueCanvas || !venueSection) return;
      const ctx = venueCanvas.getContext("2d");
      if (!ctx) return;
      const rect = venueSection.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      ctx.strokeStyle = "rgba(28,23,18,.35)";
      ctx.lineWidth = 1;
      const threshold = Math.min(rect.width, rect.height) * 0.16;
      for (let i = 0; i < venueNodes.length; i++) {
        for (let j = i + 1; j < venueNodes.length; j++) {
          const a = venueNodes[i],
            b = venueNodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < threshold) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      venueNodes.forEach((n, i) => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, venueLabels[i] ? 5 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = venueLabels[i] ? "#B8451D" : "rgba(28,23,18,.45)";
        ctx.fill();
      });

      const routePts = venueRouteIdx.map((i) => venueNodes[i]).filter(Boolean);
      if (routePts.length > 1) {
        const totalSegs = routePts.length - 1;
        const grown = progress * totalSegs;
        const fullSegs = Math.floor(grown);
        const segFrac = grown - fullSegs;

        ctx.strokeStyle = "#B8451D";
        ctx.lineWidth = 2.6;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(routePts[0].x, routePts[0].y);
        for (let i = 1; i <= fullSegs && i < routePts.length; i++) {
          ctx.lineTo(routePts[i].x, routePts[i].y);
        }
        let headX = routePts[Math.min(fullSegs, routePts.length - 1)].x;
        let headY = routePts[Math.min(fullSegs, routePts.length - 1)].y;
        if (fullSegs < totalSegs) {
          const a = routePts[fullSegs],
            b = routePts[fullSegs + 1];
          headX = a.x + (b.x - a.x) * segFrac;
          headY = a.y + (b.y - a.y) * segFrac;
          ctx.lineTo(headX, headY);
        }
        ctx.stroke();

        const pulse = reduceMotion ? 5 : 5 + Math.sin(Date.now() / 220) * 2.5;
        ctx.beginPath();
        ctx.arc(headX, headY, pulse, 0, Math.PI * 2);
        ctx.fillStyle = "#B8451D";
        ctx.fill();
      }
    }

    let onCanvasMove: ((e: MouseEvent) => void) | null = null;
    let onCanvasLeave: (() => void) | null = null;

    if (venueCanvas) {
      resizeVenueCanvas();
      window.addEventListener("resize", resizeVenueCanvas);

      onCanvasMove = (e: MouseEvent) => {
        const rect = venueCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left,
          my = e.clientY - rect.top;
        let hit: string | null = null;
        for (const idx in venueLabels) {
          const n = venueNodes[Number(idx)];
          if (n && Math.hypot(n.x - mx, n.y - my) < 14) {
            hit = venueLabels[Number(idx)];
            break;
          }
        }
        if (hit && tooltip) {
          tooltip.textContent = hit;
          tooltip.style.left = e.clientX + "px";
          tooltip.style.top = e.clientY + "px";
          tooltip.classList.add("visible");
        } else {
          tooltip?.classList.remove("visible");
        }
      };
      onCanvasLeave = () => tooltip?.classList.remove("visible");

      venueCanvas.addEventListener("mousemove", onCanvasMove);
      venueCanvas.addEventListener("mouseleave", onCanvasLeave);
    }

    // Single rAF-throttled scroll driver
    const nav = document.getElementById("main-nav");
    const wipeSection = document.getElementById("statement-wipe");
    const wipeFill = document.getElementById("wipe-fill");
    const howItWorks = document.getElementById("how-it-works");
    const roundRows = Array.from(document.querySelectorAll<HTMLElement>(".round-row"));
    const progressBars = Array.from(document.querySelectorAll<HTMLElement>("[data-round-progress-bar]"));
    const roundIndicators = Array.from(document.querySelectorAll<HTMLElement>("[data-round-indicator]"));

    let lastScroll = 0;
    let ticking = false;

    function clamp01(v: number) {
      return Math.max(0, Math.min(1, v));
    }

    function sectionProgress(section: HTMLElement | null) {
      if (!section) return 0;
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return rect.top <= 0 ? 1 : 0;
      return clamp01(-rect.top / total);
    }

    function frame() {
      ticking = false;
      const scrolled = window.scrollY;

      if (nav) {
        if (scrolled > 100) {
          nav.style.transform = scrolled > lastScroll ? "translateY(-100%)" : "translateY(0)";
          nav.classList.add("shadow-xl");
        } else {
          nav.classList.remove("shadow-xl");
        }
      }
      lastScroll = scrolled;

      if (wipeSection && wipeFill) {
        const p = sectionProgress(wipeSection);
        wipeFill.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`;
      }

      if (howItWorks && numRounds > 0) {
        const p = sectionProgress(howItWorks);
        const activeRound = Math.min(numRounds, Math.max(1, Math.ceil(p * numRounds) || 1));
        roundRows.forEach((row) => {
          row.setAttribute("data-active", String(Number(row.getAttribute("data-round")) === activeRound));
        });
        const pad = (n: number) => String(n).padStart(2, "0");
        progressBars.forEach((bar) => {
          bar.style.width = `${(activeRound / numRounds) * 100}%`;
        });
        roundIndicators.forEach((el) => {
          el.textContent = `${pad(activeRound)}/${pad(numRounds)}`;
        });
      }

      if (venueSection) {
        drawVenueMap(sectionProgress(venueSection));
      }
    }

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(frame);
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    let pulseInterval: ReturnType<typeof setInterval> | null = null;
    if (!reduceMotion) {
      pulseInterval = setInterval(() => {
        if (venueSection) drawVenueMap(sectionProgress(venueSection));
      }, 90);
    }

    frame();

    return () => {
      magneticCleanups.forEach((fn) => fn());
      io?.disconnect();
      window.removeEventListener("resize", resizeVenueCanvas);
      if (venueCanvas && onCanvasMove) venueCanvas.removeEventListener("mousemove", onCanvasMove);
      if (venueCanvas && onCanvasLeave) venueCanvas.removeEventListener("mouseleave", onCanvasLeave);
      window.removeEventListener("scroll", onScroll);
      if (pulseInterval) clearInterval(pulseInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rounds/venues are fetched once server-side and don't change during this component's lifetime; re-running this DOM-wiring effect on every render would be wrong.
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F0E6] selection:bg-[#B8451D] selection:text-white">
      {/* Navigation */}
      <nav
        id="main-nav"
        className="sticky top-0 z-50 bg-[#F5F0E6] border-b-2 border-[#1C1712] px-8 py-4 flex justify-between items-center transition-transform duration-500"
      >
        <div className="flex items-center gap-12">
          <a href="#">
            <Image src="/logo.png" alt="It's Olam Company" width={2000} height={1042} priority className="h-12 w-auto" />
          </a>
          <div className="hidden lg:flex gap-8 font-mono">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="nav-link">{link.label}</a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="font-mono hidden sm:block text-[9px] opacity-60">KOCHI, KL / 10.00° N, 76.26° E</div>
          <a href="#partner" className="hidden sm:inline-block btn-rust magnetic px-6 py-2 font-mono text-[10px] tracking-[0.3em]">
            BOOK SLOTS
          </a>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="lg:hidden p-1"
          >
            <Menu size="1.5em" />
          </button>
        </div>
      </nav>

      {mobileNavOpen && (
        <div
          ref={mobileNavRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          tabIndex={-1}
          className="fixed inset-0 z-[200] bg-[#1C1712] text-[#F5F0E6] flex flex-col focus:outline-none lg:hidden"
        >
          <div className="flex justify-between items-center px-8 py-4 border-b-2 border-[#F5F0E6]/20">
            <Image src="/logo.png" alt="It's Olam Company" width={2000} height={1042} className="h-12 w-auto brightness-0 invert" />
            <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" className="p-1">
              <X size="1.5em" />
            </button>
          </div>
          <div className="flex flex-col gap-2 px-8 py-12 overflow-y-auto">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileNavOpen(false)}
                className="font-display text-4xl py-3 border-b border-[#F5F0E6]/10 hover:text-[#B8451D] transition-colors"
              >
                {link.label.toUpperCase()}
              </a>
            ))}
            <a
              href="#partner"
              onClick={() => setMobileNavOpen(false)}
              className="btn-rust mt-8 py-4 font-display text-xl text-center"
            >
              BOOK SLOTS
            </a>
          </div>
        </div>
      )}

      <main>
        {/* Hero */}
        <section className="pt-12 pb-12 md:pt-20 md:pb-20 px-6 md:px-8 grid-bg min-h-screen flex flex-col justify-between overflow-hidden">
          <div className="relative">
            <div className="font-mono mb-6 text-[#B8451D] animate-pulse">{"// CURRENTLY SPINNING TRIVIA NIGHTS IN KOCHI"}</div>
            <h1 className="font-display text-[14vw] leading-[0.85] mb-8 relative">
              <div className="overflow-hidden">
                <span className="reveal-char inline-block" style={{ transitionDelay: "0.1s" }}>MALAYALAM</span>
              </div>
              <div className="overflow-hidden">
                <span className="reveal-char inline-block text-[#B8451D]" style={{ transitionDelay: "0.2s" }}>POP-CULTURE</span>
              </div>
              <div className="overflow-hidden">
                <span className="reveal-char inline-block" style={{ transitionDelay: "0.3s" }}>TRIVIA GANG.</span>
              </div>
            </h1>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-end gap-12 mt-12">
            <div
              ref={heroDescRef}
              className="max-w-xl text-2xl leading-relaxed opacity-0 translate-y-8 transition-all duration-1000 delay-500"
            >
              Not an enterprise agency. Not a corporate mixer. Just the gang that shows up with a mic, a scoreboard, and unreasonably specific questions about 1998 Mohanlal films.
            </div>
            <div className="border-2 border-[#1C1712] p-8 w-full md:w-96 bg-[#F5F0E6] flex flex-col gap-6 transform hover:-rotate-1 transition-transform cursor-default z-10">
              <div className="flex justify-between items-center">
                <div className="font-mono">NEXT EVENT</div>
                <div className="w-2 h-2 bg-[#B8451D] rounded-full animate-ping" />
              </div>
              {nextEvent ? (
                <div>
                  <h3 className="font-display text-4xl mb-2">{nextEvent.theme ?? nextEvent.title}</h3>
                  <p className="font-mono text-[#8C8477] mb-6">
                    {formatShortDate(new Date(nextEvent.date))} / {nextEvent.venueName.toUpperCase()}, KOCHI / {formatTime(new Date(nextEvent.date))}
                  </p>
                  <div className="grid grid-cols-4 gap-2 border-t-2 border-[#1C1712] pt-4" aria-label="Countdown to next event">
                    <div className="text-center"><div className="font-display text-3xl text-[#B8451D]">{countdown.d}</div><div className="font-mono text-[8px] opacity-60">DAYS</div></div>
                    <div className="text-center"><div className="font-display text-3xl text-[#B8451D]">{countdown.h}</div><div className="font-mono text-[8px] opacity-60">HRS</div></div>
                    <div className="text-center"><div className="font-display text-3xl text-[#B8451D]">{countdown.m}</div><div className="font-mono text-[8px] opacity-60">MIN</div></div>
                    <div className="text-center"><div className="font-display text-3xl text-[#B8451D]">{countdown.s}</div><div className="font-mono text-[8px] opacity-60">SEC</div></div>
                  </div>
                </div>
              ) : (
                <p className="text-[#8C8477]">New nights dropping soon — check back shortly.</p>
              )}
              <button onClick={() => openBooking(nextEvent?.id)} className="btn-rust magnetic w-full py-4 font-display text-xl text-center">
                RSVP YOUR TEAM
              </button>
            </div>
          </div>
          <div className="ambient-hairline absolute bottom-0 left-0 w-full h-[3px]" />
        </section>

        {/* Statement Wipe */}
        <section id="statement-wipe" className="bg-[#1C1712] relative h-[115vh] md:h-[150vh]">
          <div className="absolute inset-0 grid-bg opacity-5 pointer-events-none" />
          <div className="sticky top-1/2 -translate-y-1/2 px-8 py-12">
            <div className="relative font-display text-center text-[6.5vw] leading-[0.95] max-w-6xl mx-auto">
              <div className="wipe-text">MALAYALAM TRIVIA. REAL STAKES. REAL BRAGGING RIGHTS.</div>
              <div id="wipe-fill" className="wipe-text-fill">MALAYALAM TRIVIA. REAL STAKES. REAL BRAGGING RIGHTS.</div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="section-border px-6 md:px-8 py-16 md:py-32 bg-[#EEE7D8] relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-4 lg:sticky lg:top-40 h-fit z-20">
              <div className="font-mono mb-6 text-[#8C8477]">ROUND-BY-ROUND</div>
              <h2 className="font-display text-5xl sm:text-6xl md:text-7xl mb-8 md:mb-12">HOW WE<br />ROLL.</h2>
              <div className="hidden lg:block border-2 border-[#1C1712] p-8 bg-[#F5F0E6] shadow-[8px_8px_0px_0px_rgba(28,23,18,1)]">
                <div className="flex justify-between items-center mb-8">
                  <div className="font-mono">CURRENT ROUND</div>
                  <div data-round-indicator className="font-mono text-2xl text-[#B8451D]">
                    {rounds.length > 0 ? `01/${String(rounds.length).padStart(2, "0")}` : "00/00"}
                  </div>
                </div>
                <div className="w-full h-3 bg-[#1C1712]/10 relative">
                  <div
                    data-round-progress-bar
                    className="h-full bg-[#B8451D] transition-all duration-300"
                    style={{ width: rounds.length > 0 ? `${(1 / rounds.length) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 flex flex-col space-y-0">
              {rounds.length > 0 && (
                <div className="lg:hidden sticky top-20 z-20 mb-8 border-2 border-[#1C1712] bg-[#F5F0E6] px-5 py-3 shadow-[6px_6px_0px_0px_rgba(28,23,18,1)]">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-mono text-[10px] text-[#8C8477]">CURRENT ROUND</div>
                    <div data-round-indicator className="font-mono text-lg text-[#B8451D]">
                      {`01/${String(rounds.length).padStart(2, "0")}`}
                    </div>
                  </div>
                  <div className="w-full h-2 bg-[#1C1712]/10 relative">
                    <div
                      data-round-progress-bar
                      className="h-full bg-[#B8451D] transition-all duration-300"
                      style={{ width: `${(1 / rounds.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {rounds.length === 0 && (
                <p className="text-xl text-[#8C8477] py-16">Round format coming soon.</p>
              )}
              {rounds.map((r, i) => {
                const { Icon: RoundIcon, rot } = ROUND_ICONS[i % ROUND_ICONS.length];
                const isLast = i === rounds.length - 1;
                return (
                  <div
                    key={r.id}
                    onTouchStart={() => {}}
                    className={`round-row py-10 md:py-16 flex justify-between items-start group cursor-default ${isLast ? "border-b-2 border-[#1C1712]" : "row-divider"}`}
                    data-round={String(i + 1)}
                  >
                    <div className="flex gap-12 items-start">
                      <span className="font-mono text-[#B8451D] text-lg mt-2">{String(i + 1).padStart(2, "0")}</span>
                      <div className="max-w-xl transition-transform duration-500 group-hover:translate-x-4 group-active:translate-x-4">
                        <h4 className="font-display text-6xl mb-6 group-hover:text-[#B8451D] group-active:text-[#B8451D] transition-colors">{r.title.toUpperCase()}</h4>
                        <p className="text-xl text-[#8C8477] leading-relaxed">{r.description}</p>
                      </div>
                    </div>
                    <RoundIcon
                      size="1em"
                      className={`text-4xl text-[#B8451D] opacity-40 group-hover:opacity-100 group-active:opacity-100 transition-all duration-300 transform ${rot}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Interactive Teaser */}
        <section className="section-border py-20 md:py-40 flex flex-col justify-center items-center grid-bg relative overflow-hidden">
          <div className="absolute w-64 h-64 bg-[#B8451D] opacity-[0.03] rounded-full -top-32 -left-32 blur-3xl" />
          <div className="max-w-4xl w-full px-8 relative z-10">
            <div className="font-mono text-center mb-16 tracking-[0.4em] opacity-60">ARE YOU ACTUALLY A FAN? // TRY ONE</div>
            <div
              className={`trivia-card h-[30rem] sm:h-[26rem] md:h-96 w-full cursor-pointer transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] ${flipped ? "flipped" : ""}`}
              onClick={() => setFlipped((f) => !f)}
            >
              <div className="trivia-card-inner relative w-full h-full border-2 border-[#1C1712] bg-[#F5F0E6] shadow-[12px_12px_0px_0px_rgba(28,23,18,1)]">
                <div className="trivia-card-front absolute inset-0 p-6 sm:p-10 md:p-16 flex flex-col justify-center items-center text-center">
                  <div className="font-display text-2xl sm:text-3xl md:text-5xl mb-8 leading-tight">
                    In the 1993 cult classic &apos;Manichitrathazhu&apos;, what was the original name of Nakulan&apos;s grandfather&apos;s house?
                  </div>
                  <div className="flex items-center gap-4 text-[#B8451D] font-mono text-[10px] sm:text-xs">
                    <span className="animate-bounce">↓</span> {canHover ? "CLICK TO REVEAL" : "TAP TO REVEAL"} <span className="animate-bounce">↓</span>
                  </div>
                </div>
                <div className="trivia-card-back absolute inset-0 p-6 sm:p-10 md:p-16 flex flex-col justify-center items-center text-center bg-[#B8451D] text-[#F5F0E6]">
                  <div className="font-display text-4xl sm:text-6xl md:text-8xl mb-6 tracking-tighter">MADAMPALLI</div>
                  <div className="w-32 h-1 bg-[#F5F0E6] mb-6" />
                  <p className="mt-6 font-malayalam text-2xl sm:text-3xl md:text-4xl opacity-90">മാടമ്പള്ളി</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Upcoming Events */}
        <section id="events" className="section-border px-6 md:px-8 py-16 md:py-32 bg-[#F5F0E6]">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <h2 className="font-display text-[15vw] sm:text-6xl md:text-[10vw] flex items-center gap-3 sm:gap-4">
              CALENDAR <CalendarDays size="1em" className="text-[#B8451D] text-[8vw] sm:text-4xl md:text-6xl" />
            </h2>
            <div className="font-mono w-72 text-right text-[#8C8477] border-r-4 border-[#B8451D] pr-4">
              TIMES VARY BY NIGHT — EXACT START TIME LISTED ON EACH CARD.
            </div>
          </div>

          {upcomingCards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-2 border-[#1C1712]">
              {upcomingCards.map((ev, i) => {
                const d = new Date(ev.date);
                const borderClass = i < 2 ? "border-r-2 border-b-2" : "border-b-2";
                const titleParts = (ev.theme ?? ev.title).split(" ");
                const mid = Math.ceil(titleParts.length / 2);
                return (
                  <div
                    key={ev.id}
                    data-reveal
                    style={{ "--d": i * 90 } as React.CSSProperties}
                    onClick={() => openBooking(ev.id)}
                    onTouchStart={() => {}}
                    className={`${borderClass} border-[#1C1712] p-10 hover:bg-[#B8451D] hover:text-[#F5F0E6] active:bg-[#B8451D] active:text-[#F5F0E6] transition-all duration-300 cursor-pointer group`}
                  >
                    <div className="flex justify-between items-center mb-10">
                      <div className="font-mono">{formatDayDate(d)} / {formatTime(d)}</div>
                      <div className="w-2 h-2 rounded-full bg-current" />
                    </div>
                    <h3 className="font-display text-5xl md:text-6xl mb-16 transform group-hover:-translate-y-2 group-active:-translate-y-2 transition-transform">
                      {titleParts.slice(0, mid).join(" ")}<br />{titleParts.slice(mid).join(" ")}
                    </h3>
                    <div className="flex justify-between items-center">
                      <span className="font-mono opacity-70">{ev.venueName.toUpperCase()}, {ev.venueArea.toUpperCase()}</span>
                      <ArrowUpRight size="1em" className="text-3xl group-hover:translate-x-1 group-hover:-translate-y-1 group-active:translate-x-1 group-active:-translate-y-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border-2 border-[#1C1712] p-16 text-center font-mono text-[#8C8477]">
              NO NIGHTS ON THE CALENDAR YET — CHECK BACK SOON.
            </div>
          )}
        </section>

        {/* Venues */}
        <section id="venues" className="section-border bg-[#EEE7D8] relative overflow-hidden py-20 md:py-32 flex items-center min-h-[125vh] md:min-h-[160vh]">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <canvas id="venue-map-canvas" />
          <div className="container mx-auto px-8 relative z-10">
            <div className="font-display text-[22vw] text-[#1C1712] opacity-[0.03] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none">KOCHI</div>
            <div className="max-w-5xl mx-auto">
              <div className="font-mono text-[#B8451D] mb-4">OUR BATTLEGROUNDS</div>
              <h2 className="font-display text-5xl sm:text-6xl md:text-8xl mb-8 md:mb-12 leading-none">WHERE THE<br />MAGIC HAPPENS.</h2>
              <p className="text-2xl mb-16 max-w-2xl text-[#1C1712]/80 leading-relaxed">Across Kochi&apos;s best restobars, we turn quiet weeknights into Mollywood battlegrounds. Trace the route as you scroll — find us at the front lines.</p>
              <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                {/* Mobile-only decorative route line — the interactive canvas map takes over this job on hover-capable devices */}
                {venues.length > 0 && (
                  <div className="sm:hidden absolute left-[15px] top-2 bottom-2 w-px bg-[#B8451D]/25 pointer-events-none" />
                )}
                {venues.length === 0 && (
                  <p className="text-xl text-[#1C1712]/60 col-span-full">Venue list coming soon.</p>
                )}
                {venues.map((v, i) => (
                  <div
                    key={v.id}
                    data-reveal
                    onTouchStart={() => {}}
                    style={{ "--d": i * 80 } as React.CSSProperties}
                    className="venue-item relative p-6 sm:p-8 border-2 border-[#1C1712] bg-[#F5F0E6] flex flex-row sm:flex-col items-center sm:items-stretch justify-between sm:aspect-square gap-4 sm:gap-0 group"
                  >
                    <span className="sm:hidden absolute left-[11px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#B8451D]" />
                    <span className="text-3xl sm:text-4xl font-display">{String(i + 1).padStart(2, "0")}</span>
                    <div className="font-display text-2xl sm:text-3xl text-right sm:text-left">{v.name.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <div id="venue-tooltip" />

        {/* Partner */}
        <section id="partner" className="section-border py-20 md:py-40 px-6 md:px-8 bg-[#F5F0E6]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="border-2 border-[#1C1712] p-8 md:p-16 flex flex-col justify-between hover:shadow-[12px_12px_0px_0px_rgba(28,23,18,1)] transition-shadow duration-300 group">
              <div>
                <div className="font-mono text-[#B8451D] mb-6">FOR THE BARS</div>
                <h3 className="font-display text-5xl md:text-7xl mb-8 group-hover:text-[#B8451D] group-active:text-[#B8451D] transition-colors">HOST A NIGHT</h3>
                <p className="text-[#8C8477] text-xl mb-12 leading-relaxed">Are you a pub owner looking to pack your house on a Tuesday? We bring the crowd, the kit, and the vibe. You just serve the drinks.</p>
              </div>
              <button onClick={() => setVenueOpen(true)} className="magnetic border-2 border-[#1C1712] py-8 px-12 font-display text-2xl hover:bg-[#1C1712] hover:text-[#F5F0E6] active:bg-[#1C1712] active:text-[#F5F0E6] transition-all flex items-center justify-between">
                CONTACT AS A VENUE <MessageCircle size="1em" />
              </button>
            </div>

            <div className="border-2 border-[#1C1712] bg-[#B8451D] p-8 md:p-16 text-[#F5F0E6] flex flex-col justify-between hover:shadow-[12px_12px_0px_0px_rgba(184,69,29,0.3)] transition-shadow duration-300 group">
              <div>
                <div className="font-mono text-[#F5F0E6]/60 mb-6">FOR THE FANS</div>
                <h3 className="font-display text-5xl md:text-7xl mb-8 group-hover:translate-x-2 group-active:translate-x-2 transition-transform">BOOK A TEAM</h3>
                <p className="text-[#F5F0E6]/80 text-xl mb-12 leading-relaxed">Got a gang of friends who think they know everything about Malayali memes? Let us know you&apos;re in — final RSVP happens at the venue or via our Instagram. Slots are limited to 15 teams per night.</p>
              </div>
              <button onClick={() => openBooking()} className="magnetic bg-[#F5F0E6] text-[#B8451D] py-8 px-12 font-display text-2xl hover:bg-[#1C1712] hover:text-[#F5F0E6] active:bg-[#1C1712] active:text-[#F5F0E6] transition-all flex items-center justify-between">
                I&apos;M INTERESTED <Users size="1em" />
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-[#1C1712] text-[#F5F0E6] p-8 md:p-16 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#B8451D]" />
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-16 md:gap-24 md:mb-32 relative z-10">
            <div className="max-w-sm">
              <Image src="/logo.png" alt="It's Olam Company" width={2000} height={1042} className="h-24 w-auto brightness-0 invert opacity-90 mb-10" />
              <p className="text-[#8C8477] text-lg leading-relaxed mb-10">
                Kochi&apos;s hyper-local trivia outfit. Born in the pubs, lived in the screens, thriving in the collective memory of 90s cinema.
              </p>
              <div className="flex gap-6">
                <button
                  type="button"
                  onClick={() => setComingSoon("Instagram")}
                  className="w-12 h-12 border border-[#8C8477]/40 flex items-center justify-center hover:bg-[#B8451D] hover:border-[#B8451D] active:bg-[#B8451D] active:border-[#B8451D] transition-all"
                >
                  <InstagramIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setComingSoon("X")}
                  className="w-12 h-12 border border-[#8C8477]/40 flex items-center justify-center hover:bg-[#B8451D] hover:border-[#B8451D] active:bg-[#B8451D] active:border-[#B8451D] transition-all"
                >
                  <XLogoIcon />
                </button>
                <a href="mailto:itsolamco@gmail.com" className="w-12 h-12 border border-[#8C8477]/40 flex items-center justify-center hover:bg-[#B8451D] hover:border-[#B8451D] active:bg-[#B8451D] active:border-[#B8451D] transition-all">
                  <Mail size="1em" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 md:gap-32 font-mono">
              <div data-reveal style={{ "--d": 0 } as React.CSSProperties}>
                <div className="text-[#B8451D] mb-8 tracking-widest">LINKS</div>
                <div className="flex flex-col gap-5 text-sm">
                  <a href="#statement-wipe" className="hover:text-[#B8451D] transition-colors">MANIFESTO</a>
                  <a href="#events" className="hover:text-[#B8451D] transition-colors">EVENTS</a>
                  <a href="#venues" className="hover:text-[#B8451D] transition-colors">VENUES</a>
                </div>
              </div>
              <div data-reveal style={{ "--d": 100 } as React.CSSProperties}>
                <div className="text-[#B8451D] mb-8 tracking-widest">LEGAL</div>
                <div className="flex flex-col gap-5 text-sm">
                  <Link href="/privacy" className="hover:text-[#B8451D] transition-colors">PRIVACY</Link>
                  <Link href="/terms" className="hover:text-[#B8451D] transition-colors">TERMS</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center pt-16 border-t border-[#8C8477]/20 font-mono text-[10px] text-[#8C8477] tracking-[0.2em]">
            <div>© {new Date().getFullYear()} IT&apos;S OLAM COMPANY / CRAFTED IN KOCHI</div>
            <div className="mt-4 md:mt-0 flex items-center gap-2">
              <div className="w-1 h-1 bg-[#B8451D] rounded-full" />
              REAL CINEMA LIVES HERE
            </div>
          </div>
        </footer>
        <div className="lg:hidden h-[calc(4rem+env(safe-area-inset-bottom))]" aria-hidden="true" />
      </main>

      {/* Mobile-only persistent CTA bar — venue owners deciding whether to reach out shouldn't have to scroll back up or dig through a menu to do it.
          pb includes the safe-area inset so the buttons clear the home-indicator gesture zone on notched iPhones. */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F5F0E6] border-t-2 border-[#1C1712] flex pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => setVenueOpen(true)}
          onTouchStart={() => {}}
          className="flex-1 py-4 font-mono text-[10px] tracking-[0.2em] uppercase border-r-2 border-[#1C1712] active:bg-[#1C1712] active:text-[#F5F0E6] transition-colors"
        >
          Contact as Venue
        </button>
        <button
          type="button"
          onClick={() => openBooking()}
          onTouchStart={() => {}}
          className="flex-1 py-4 font-mono text-[10px] tracking-[0.2em] uppercase bg-[#B8451D] text-[#F5F0E6] active:bg-[#8F3517] transition-colors"
        >
          Book a Team
        </button>
      </div>

      <BookingModal
        key={bookingKey}
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        events={events}
        preselectedEventId={bookingPreselect}
      />
      <VenueInquiryModal open={venueOpen} onClose={() => setVenueOpen(false)} />
      <ComingSoonModal open={comingSoon !== null} onClose={() => setComingSoon(null)} label={comingSoon ?? ""} />
    </div>
  );
}
