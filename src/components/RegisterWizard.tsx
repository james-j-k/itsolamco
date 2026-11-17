"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, CalendarPlus, Check, Clock, MapPin, Minus, Plus, Share2, Users } from "lucide-react";
import FaloodaGlass from "@/components/FaloodaGlass";
import { phudu } from "@/lib/faloodaFont";
import { FALOODA_LOGO, formatNight, registerPath, type NightInfo } from "@/lib/featuredNight";
import { BUSINESS } from "@/lib/business";
import { suggestEmail } from "@/lib/emailSuggest";

// The registration page for a night (the Falooda Nation night, or any other). A real page (not a pop-up) so that typing, scrolling and
// the on-screen keyboard behave exactly like any other page. Built so nothing a visitor types can be
// lost or changed by accident:
//   - no number boxes (a mouse wheel or a stray swipe cannot change a value): team size is − / + buttons
//   - the Enter key moves to the next box instead of sending the form early
//   - everything typed is kept on the device as a draft, so a refresh, a call or a closed tab loses nothing
//   - a "check your details" step shows every answer with an Edit button before anything is sent
//   - the Back button on the phone goes back a step instead of leaving the page

type Values = { teamName: string; contactName: string; email: string; phone: string; teamSize: number; message: string };
type FieldKey = keyof Values;
type Errors = Partial<Record<FieldKey, string>>;
type Step = "form" | "review" | "done";

const DRAFT_KEY = "olam-falooda-draft-v1";
const EMPTY: Values = { teamName: "", contactName: "", email: "", phone: "", teamSize: 4, message: "" };

const THEMES = {
  // Falooda Nation's colours: soft pink, magenta, teal, charcoal
  falooda: {
    "--rg-bg": "#FCE8F0", "--rg-ink": "#2C2C2C", "--rg-accent": "#CA4D8C", "--rg-deep": "#B23B79", "--rg-deep-hover": "#A23270",
    "--rg-shadow": "#7d2655", "--rg-soft": "#FCE8F0", "--rg-soft2": "#FFF5F9", "--rg-line": "#F2C2D8", "--rg-input": "#E8B6CD",
    "--rg-alt": "#139186", "--rg-alt-deep": "#0B5F58", "--rg-alt-soft": "#E4F4F1", "--rg-spark": "#FFC93C", "--rg-glow": "rgba(202,77,140,0.22)",
  },
  // The site's own look: paper, ink and rust
  olam: {
    "--rg-bg": "#F5F0E6", "--rg-ink": "#1C1712", "--rg-accent": "#B8451D", "--rg-deep": "#B8451D", "--rg-deep-hover": "#8F3517",
    "--rg-shadow": "#6E2810", "--rg-soft": "#EEE7D8", "--rg-soft2": "#FAF6EC", "--rg-line": "#D5CBB6", "--rg-input": "#BDB29B",
    "--rg-alt": "#1C1712", "--rg-alt-deep": "#1C1712", "--rg-alt-soft": "#EEE7D8", "--rg-spark": "#F2B33D", "--rg-glow": "rgba(28,23,18,0.14)",
  },
} as const;
// The order the Enter key walks through the typed boxes
const ORDER: FieldKey[] = ["teamName", "contactName", "email", "phone", "message"];
const LABELS: Record<FieldKey, string> = {
  teamName: "Team name",
  contactName: "Your name",
  email: "Email",
  phone: "Mobile number",
  teamSize: "Players",
  message: "Anything else?",
};

function validate(v: Values, night: NightInfo): Errors {
  const e: Errors = {};
  if (!v.teamName.trim()) e.teamName = "Give your team a name.";
  if (!v.contactName.trim()) e.contactName = "Tell us who we are talking to.";
  if (!v.email.trim()) e.email = "We need an email to send your confirmation.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = "That email doesn't look right. Check it once more.";
  if (!v.phone) e.phone = "We need your mobile number to WhatsApp you the details.";
  else if (!/^[6-9]\d{9}$/.test(v.phone)) e.phone = "Enter a valid 10-digit mobile number.";
  if (v.teamSize < night.minTeamSize || v.teamSize > night.maxTeamSize) {
    e.teamSize = `Teams are ${night.minTeamSize} to ${night.maxTeamSize} players.`;
  }
  if (v.message.length > 1000) e.message = "That is a bit long. Keep it under 1000 characters.";
  return e;
}

const inputBase =
  "h-14 w-full rounded-2xl border-2 bg-white px-4 text-[17px] text-[var(--rg-ink)] placeholder:text-[var(--rg-ink)]/35 focus:outline-none focus:ring-4 focus:ring-[var(--rg-alt)]/25";
const inputCls = (error?: string) => `${inputBase} ${error ? "border-[#C0264B]" : "border-[var(--rg-input)] focus:border-[var(--rg-alt)]"}`;

function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="scroll-mt-24" data-field={id}>
      <label htmlFor={`fn-${id}`} className="mb-1.5 flex items-baseline justify-between gap-3 text-[15px] font-bold">
        <span>{label}</span>
        {optional && <span className="text-xs font-semibold text-[var(--rg-ink)]/60">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`fn-${id}-err`} role="alert" className="mt-1.5 text-sm font-semibold text-[#C0264B]">
          {error}
        </p>
      ) : hint ? (
        <p id={`fn-${id}-hint`} className="mt-1.5 text-sm text-[var(--rg-ink)]/70">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const msSince = (t: number) => Date.now() - t;

// The phone box takes only the 10 digits of an Indian mobile number: +91 is already shown beside it. Anything else
// typed or pasted (spaces, dashes, a leading +91 or 0) is cleaned away, and nothing past 10 digits is accepted.
function cleanPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  else if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}
const showPhone = (d: string) => `+91 ${d.slice(0, 5)} ${d.slice(5)}`.trim();

// ---- add-to-calendar helpers ----
function compact(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function googleCalendarLink(n: NightInfo) {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${n.title} at ${n.venueName}`,
    dates: `${compact(n.startsAt)}/${compact(new Date(Date.parse(n.startsAt) + 2.5 * 3600_000).toISOString())}`,
    location: `${n.venueName}, ${n.venueArea}, ${n.city}`,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export default function RegisterWizard({ night, theme, teamsBooked }: { night: NightInfo; theme: keyof typeof THEMES; teamsBooked: number }) {
  const when = formatNight(night.startsAt);
  const [firstWord, ...restWords] = night.title.trim().split(/\s+/);
  const isFalooda = theme === "falooda";
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot: real people never see or fill this
  const [formRenderedAt] = useState(() => Date.now());
  const [done, setDone] = useState<Values | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<FieldKey | null>(null);

  // ---- the draft: kept on this device only, restored when the page opens ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<Values>;
      const restoredValues: Values = {
        teamName: typeof d.teamName === "string" ? d.teamName.slice(0, 120) : "",
        contactName: typeof d.contactName === "string" ? d.contactName.slice(0, 120) : "",
        email: typeof d.email === "string" ? d.email.slice(0, 200) : "",
        phone: typeof d.phone === "string" ? cleanPhone(d.phone) : "",
        teamSize: Math.min(night.maxTeamSize, Math.max(night.minTeamSize, Number(d.teamSize) || EMPTY.teamSize)),
        message: typeof d.message === "string" ? d.message.slice(0, 1000) : "",
      };
      if (JSON.stringify(restoredValues) !== JSON.stringify(EMPTY)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-time read of the device's saved draft on arrival
        setValues(restoredValues);
        setRestored(true);
      }
    } catch {
      /* private mode or blocked storage: the form simply starts empty */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival; the night's limits never change while the page is open
  }, []);

  useEffect(() => {
    if (step === "done") return;
    try {
      if (JSON.stringify(values) === JSON.stringify(EMPTY)) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    } catch {
      /* storage unavailable: nothing to do */
    }
  }, [values, step]);

  // ---- the phone's Back button goes back one step instead of leaving the page ----
  useEffect(() => {
    const onPop = () => setStep((s) => (s === "review" ? "form" : s));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // After a step change: bring the card into view, and put focus where a person (or screen reader) expects it
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = pendingFocus.current;
    if (step === "form" && target) {
      pendingFocus.current = null;
      const el = document.getElementById(`fn-${target}`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        (el as HTMLElement).focus({ preventScroll: true });
        return;
      }
    }
    if (step === "form" && !restored && !touched.teamName) return; // first paint: leave the page where it is
    cardRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    headingRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the step changes, not on every keystroke
  }, [step]);

  function set<K extends FieldKey>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setServerError("");
    // Once a box has shown an error, re-check it as the person fixes it, so the message goes away at once
    if (errors[key]) setErrors((e) => ({ ...e, [key]: validate({ ...values, [key]: value }, night)[key] }));
  }

  function blur(key: FieldKey) {
    setTouched((t) => ({ ...t, [key]: true }));
    const msg = validate(values, night)[key];
    setErrors((e) => ({ ...e, [key]: msg }));
    if (key === "email") setEmailSuggestion(suggestEmail(values.email));
  }

  function nextField(from: FieldKey) {
    const i = ORDER.indexOf(from);
    const next = ORDER[i + 1];
    if (next) document.getElementById(`fn-${next}`)?.focus();
    else (document.activeElement as HTMLElement | null)?.blur();
  }

  function onEnter(key: FieldKey) {
    return (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
      e.preventDefault(); // Enter never sends the form from a typed box; it moves on
      nextField(key);
    };
  }

  function goReview(e?: React.FormEvent) {
    e?.preventDefault();
    const found = validate(values, night);
    setErrors(found);
    setTouched({ teamName: true, contactName: true, email: true, phone: true, message: true });
    const first = (["teamName", "contactName", "email", "phone", "teamSize", "message"] as FieldKey[]).find((k) => found[k]);
    if (first) {
      const el = document.getElementById(`fn-${first}`);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      (el as HTMLElement | null)?.focus({ preventScroll: true });
      return;
    }
    setStep("review");
    window.history.pushState({ fnStep: "review" }, "");
  }

  function leaveReview(field?: FieldKey) {
    pendingFocus.current = field ?? null;
    if (window.history.state?.fnStep === "review") window.history.back();
    else setStep("form");
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setServerError("");
    try {
      // The server quietly ignores anything sent within about a second and a half of the page opening
      // (a bot tell). A real person who autofilled and tapped fast must never hit that, so wait it out.
      const wait = 1700 - msSince(formRenderedAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const clean: Values = {
        teamName: values.teamName.trim(),
        contactName: values.contactName.trim(),
        email: values.email.trim(),
        phone: showPhone(values.phone),
        teamSize: values.teamSize,
        message: values.message.trim(),
      };
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...clean, eventId: night.id, website, formRenderedAt }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; issues?: Record<string, string[]> };
        if (res.status === 400 && data.issues) {
          // Show the server's complaint on the box it is about, and take them back to it
          const next: Errors = {};
          for (const [k, msgs] of Object.entries(data.issues)) if (k in EMPTY && msgs?.[0]) next[k as FieldKey] = msgs[0];
          setErrors(next);
          const first = Object.keys(next)[0] as FieldKey | undefined;
          if (first) {
            leaveReview(first);
            return;
          }
        }
        throw new Error(
          res.status === 429
            ? "That was a lot of tries in a short time. Wait a few minutes and send it again. Your details are still here."
            : data.error ?? "Something went wrong on our side.",
        );
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setDone(clean);
      setStep("done");
    } catch (err) {
      const offline = err instanceof TypeError;
      setServerError(
        offline
          ? "We couldn't reach the server. Check your connection and tap confirm again. Everything you typed is still here."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Tap confirm to try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const err = (k: FieldKey) => (touched[k] || errors[k] ? errors[k] : undefined);
  const describedBy = (k: FieldKey, hint?: boolean) => (err(k) ? `fn-${k}-err` : hint ? `fn-${k}-hint` : undefined);
  const shareText = `We're in! Our team is registered for ${night.title} at ${night.venueName}, ${when.short}, ${when.shortTime}. Come play: ${BUSINESS.siteUrl}${registerPath(night.id)}`;

  return (
    <div
      className={`${isFalooda ? `${phudu.variable} ` : "rg-olam "}fn-page text-[var(--rg-ink)]`}
      style={{ backgroundColor: "var(--rg-bg)", ...THEMES[theme] } as React.CSSProperties}
    >
      {/* Top bar: our logo (it takes you home), and the venue's name beside it on the Falooda Nation night */}
      <header className="border-b-4 border-[var(--rg-alt)]" style={{ backgroundColor: isFalooda ? "#FFFFFF" : "var(--rg-bg)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-2.5">
          <Link href="/" aria-label="It's Olam Company: back to the home page" className="-ml-1 flex min-h-12 items-center gap-3 rounded-lg px-1">
            <Image src="/logo.png" alt="It's Olam Company" width={2000} height={1042} priority className="h-11 w-auto" />
            {isFalooda && (
              <>
                <span aria-hidden="true" className="text-2xl font-light leading-none text-[var(--rg-ink)]/40">
                  ×
                </span>
                {FALOODA_LOGO ? (
                  <Image src={FALOODA_LOGO.src} alt="Falooda Nation" width={FALOODA_LOGO.width} height={FALOODA_LOGO.height} priority className="h-9 w-auto sm:h-10" />
                ) : (
                  <span className="fn-display text-[1.05rem] leading-none sm:text-xl">
                    <span className="text-[var(--rg-accent)]">FALOODA</span> <span className="text-[var(--rg-alt)]">NATION</span>
                  </span>
                )}
              </>
            )}
          </Link>
          <span className="fn-display text-right text-sm leading-tight tracking-[0.04em] text-[var(--rg-deep)]">
            {`${when.weekdayShort} ${when.dayMonth} · ${when.shortTime}`.toUpperCase()}
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-5 pb-16 pt-7 md:grid-cols-[0.85fr_1.15fr] md:gap-12 md:pt-12">
        {/* The night */}
        <section aria-label="About the night" className={`md:sticky md:top-8 md:self-start ${step === "done" ? "hidden md:block" : ""}`}>
          <div className="fn-display inline-flex items-center gap-2 rounded-full bg-[var(--rg-alt)] px-4 py-1.5 text-[13px] tracking-[0.06em] text-white">
            <span className="h-2 w-2 rounded-full bg-[var(--rg-spark)]" aria-hidden="true" />
            REGISTER YOUR TEAM
          </div>
          <h1 className="fn-display mt-3 text-[clamp(2.2rem,10.5vw,4.4rem)]">
            {firstWord}
            {restWords.length > 0 && <span className="block text-[var(--rg-accent)]">{restWords.join(" ")}</span>}
          </h1>
          <p className="mt-2 text-lg font-semibold">
            at <span className="fn-display text-[var(--rg-deep)]">{night.venueName.toUpperCase()}</span>
          </p>

          <ul className="mt-4 grid grid-cols-2 gap-3 text-[15px] font-semibold md:mt-5 md:grid-cols-1">
            <li className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_3px_0_var(--rg-glow)]">
              <CalendarDays className="h-5 w-5 shrink-0 text-[var(--rg-deep)]" aria-hidden="true" />
              <span className="leading-tight">
                {when.short}
                <span className="flex items-center gap-1 text-sm font-bold text-[var(--rg-deep)]">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />{when.time}
                </span>
              </span>
            </li>
            <li>
              <a
                href={night.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_3px_0_var(--rg-glow)] hover:bg-[var(--rg-soft2)]"
              >
                <MapPin className="h-5 w-5 shrink-0 text-[var(--rg-deep)]" aria-hidden="true" />
                <span className="leading-tight">
                  {night.venueArea}, {night.city}
                  <span className="block text-sm font-bold text-[var(--rg-alt-deep)] underline underline-offset-2">Directions</span>
                </span>
              </a>
            </li>
            <li className="hidden items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_3px_0_var(--rg-glow)] md:flex">
              <Users className="h-5 w-5 shrink-0 text-[var(--rg-deep)]" aria-hidden="true" />
              Teams of {night.minTeamSize} to {night.maxTeamSize} players
            </li>
          </ul>

          {teamsBooked > 0 && (
            <p className="mt-4 flex items-center gap-2 text-sm font-bold text-[var(--rg-alt-deep)]">
              <span className="h-2 w-2 rounded-full bg-[var(--rg-alt)] fn-blink" aria-hidden="true" />
              {teamsBooked} {teamsBooked === 1 ? "TEAM" : "TEAMS"} ALREADY IN
            </p>
          )}
          {isFalooda && <FaloodaGlass className="fn-bob mx-auto mt-6 hidden h-72 w-auto md:block" />}
        </section>

        {/* The form */}
        <section aria-label="Registration" ref={cardRef} className="scroll-mt-4">
          <div className="rounded-[28px] border-2 border-[var(--rg-line)] bg-white p-5 shadow-[0_8px_0_var(--rg-glow)] sm:p-8">
            {/* Where you are */}
            <ol className="mb-5 flex items-center gap-2 text-xs font-bold" aria-label="Steps">
              {[
                ["form", "1 · Details"],
                ["review", "2 · Check"],
                ["done", "3 · Done"],
              ].map(([id, label]) => (
                <li
                  key={id}
                  aria-current={step === id ? "step" : undefined}
                  className={`rounded-full px-3 py-1.5 ${step === id ? "bg-[var(--rg-deep)] text-white" : "bg-[var(--rg-soft)] text-[var(--rg-ink)]/65"}`}
                >
                  {label}
                </li>
              ))}
            </ol>

            {step === "form" && (
              <form onSubmit={goReview} noValidate>
                <h2 ref={headingRef} tabIndex={-1} className="fn-display text-3xl focus:outline-none">
                  YOUR TEAM
                </h2>
                <p className="mt-2 text-[15px] text-[var(--rg-ink)]/75">Six quick answers. You can check everything before it is sent.</p>

                {restored && (
                  <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl bg-[var(--rg-alt-soft)] px-4 py-3 text-sm font-semibold text-[var(--rg-alt-deep)]">
                    <span>We kept what you typed last time.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setValues(EMPTY);
                        setErrors({});
                        setTouched({});
                        setRestored(false);
                      }}
                      className="-my-2 min-h-11 shrink-0 px-2 font-bold underline underline-offset-2"
                    >
                      Start over
                    </button>
                  </div>
                )}

                {/* Honeypot: invisible to people, filled in by bots */}
                <input
                  type="text"
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                />

                <div className="mt-5 flex flex-col gap-5">
                  <Field id="teamName" label="Team name" error={err("teamName")}>
                    <input
                      id="fn-teamName"
                      value={values.teamName}
                      onChange={(e) => set("teamName", e.target.value)}
                      onBlur={() => blur("teamName")}
                      onKeyDown={onEnter("teamName")}
                      maxLength={120}
                      autoComplete="off"
                      autoCapitalize="words"
                      enterKeyHint="next"
                      aria-invalid={!!err("teamName")}
                      aria-describedby={describedBy("teamName")}
                      placeholder="e.g. Lalettan Fans"
                      className={inputCls(err("teamName"))}
                    />
                  </Field>

                  <Field id="contactName" label="Your name" error={err("contactName")}>
                    <input
                      id="fn-contactName"
                      value={values.contactName}
                      onChange={(e) => set("contactName", e.target.value)}
                      onBlur={() => blur("contactName")}
                      onKeyDown={onEnter("contactName")}
                      maxLength={120}
                      autoComplete="name"
                      autoCapitalize="words"
                      enterKeyHint="next"
                      aria-invalid={!!err("contactName")}
                      aria-describedby={describedBy("contactName")}
                      className={inputCls(err("contactName"))}
                    />
                  </Field>

                  <Field id="email" label="Email" error={err("email")} hint="Your confirmation goes here.">
                    <input
                      id="fn-email"
                      type="email"
                      inputMode="email"
                      value={values.email}
                      onChange={(e) => {
                        set("email", e.target.value);
                        setEmailSuggestion(null);
                      }}
                      onBlur={() => blur("email")}
                      onKeyDown={onEnter("email")}
                      maxLength={200}
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="next"
                      aria-invalid={!!err("email")}
                      aria-describedby={describedBy("email", true)}
                      placeholder="you@gmail.com"
                      className={inputCls(err("email"))}
                    />
                    {emailSuggestion && (
                      <button
                        type="button"
                        onClick={() => {
                          set("email", emailSuggestion);
                          setEmailSuggestion(null);
                          setErrors((e) => ({ ...e, email: undefined }));
                        }}
                        className="mt-2 min-h-11 w-full rounded-2xl border-2 border-[var(--rg-alt)] bg-[var(--rg-alt-soft)] px-4 py-2 text-left text-sm font-bold text-[var(--rg-alt-deep)]"
                      >
                        Did you mean <span className="break-all underline">{emailSuggestion}</span>? Tap to fix
                      </button>
                    )}
                  </Field>

                  <Field id="phone" label="Mobile number" error={err("phone")} hint="+91 is added for you. Type just your 10 digits. We will WhatsApp you the details.">
                    <div
                      className={`flex h-14 w-full items-stretch overflow-hidden rounded-2xl border-2 bg-white focus-within:ring-4 focus-within:ring-[var(--rg-alt)]/25 ${
                        err("phone") ? "border-[#C0264B]" : "border-[var(--rg-input)] focus-within:border-[var(--rg-alt)]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="flex shrink-0 select-none items-center border-r-2 border-[var(--rg-line)] bg-[var(--rg-soft)] px-4 text-[17px] font-bold"
                      >
                        +91
                      </span>
                      <input
                        id="fn-phone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={values.phone}
                        onChange={(e) => set("phone", cleanPhone(e.target.value))}
                        onBlur={() => blur("phone")}
                        onKeyDown={onEnter("phone")}
                        maxLength={10}
                        autoComplete="tel-national"
                        enterKeyHint="next"
                        aria-invalid={!!err("phone")}
                        aria-describedby={describedBy("phone", true)}
                        placeholder="98765 43210"
                        className="min-w-0 flex-1 bg-transparent px-4 text-[17px] text-[var(--rg-ink)] placeholder:text-[var(--rg-ink)]/35 focus:outline-none"
                      />
                    </div>
                  </Field>

                  <Field id="teamSize" label="How many players?" error={err("teamSize")} hint={`Teams are ${night.minTeamSize} to ${night.maxTeamSize} players, counting you.`}>
                    <div role="group" aria-label="Number of players" className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="One fewer player"
                        disabled={values.teamSize <= night.minTeamSize}
                        onClick={() => set("teamSize", Math.max(night.minTeamSize, values.teamSize - 1))}
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 border-[var(--rg-input)] bg-white text-[var(--rg-deep)] active:bg-[var(--rg-soft)] disabled:opacity-35"
                      >
                        <Minus className="h-6 w-6" aria-hidden="true" />
                      </button>
                      <output
                        id="fn-teamSize"
                        tabIndex={-1}
                        aria-live="polite"
                        className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--rg-soft)] focus:outline-none focus:ring-4 focus:ring-[var(--rg-alt)]/25"
                      >
                        <span className="fn-display text-4xl text-[var(--rg-deep)]">{values.teamSize}</span>
                        <span className="text-base font-bold">{values.teamSize === 1 ? "player" : "players"}</span>
                      </output>
                      <button
                        type="button"
                        aria-label="One more player"
                        disabled={values.teamSize >= night.maxTeamSize}
                        onClick={() => set("teamSize", Math.min(night.maxTeamSize, values.teamSize + 1))}
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 border-[var(--rg-input)] bg-white text-[var(--rg-deep)] active:bg-[var(--rg-soft)] disabled:opacity-35"
                      >
                        <Plus className="h-6 w-6" aria-hidden="true" />
                      </button>
                    </div>
                  </Field>

                  <Field id="message" label="Anything else?" optional error={err("message")} hint="Allergies, a birthday, a late arrival. Anything we should know.">
                    <textarea
                      id="fn-message"
                      value={values.message}
                      onChange={(e) => set("message", e.target.value)}
                      onBlur={() => blur("message")}
                      rows={3}
                      maxLength={1000}
                      autoCapitalize="sentences"
                      aria-invalid={!!err("message")}
                      aria-describedby={describedBy("message", true)}
                      className={`${inputBase} h-auto resize-none overscroll-contain py-3 ${err("message") ? "border-[#C0264B]" : "border-[var(--rg-input)] focus:border-[var(--rg-alt)]"}`}
                    />
                  </Field>
                </div>

                <button
                  type="submit"
                  className="fn-cta fn-display group mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[var(--rg-deep)] px-8 text-xl text-white"
                >
                  CHECK MY DETAILS
                  <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </button>
                <p className="mt-3 text-center text-sm text-[var(--rg-ink)]/65">Nothing is sent yet. You will see everything first.</p>
              </form>
            )}

            {step === "review" && (
              <div>
                <h2 ref={headingRef} tabIndex={-1} className="fn-display text-3xl focus:outline-none">
                  CHECK &amp; CONFIRM
                </h2>
                <p className="mt-2 text-[15px] text-[var(--rg-ink)]/75">Look right? Tap Edit on anything you want to change.</p>

                <dl className="mt-5 divide-y divide-[var(--rg-line)] rounded-2xl border-2 border-[var(--rg-line)]">
                  {(
                    [
                      ["teamName", values.teamName.trim()],
                      ["contactName", values.contactName.trim()],
                      ["email", values.email.trim()],
                      ["phone", showPhone(values.phone)],
                      ["teamSize", `${values.teamSize} ${values.teamSize === 1 ? "player" : "players"}`],
                      ["message", values.message.trim() || "Nothing to add"],
                    ] as [FieldKey, string][]
                  ).map(([k, shown]) => (
                    <div key={k} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <dt className="text-xs font-bold uppercase tracking-wide text-[var(--rg-ink)]/60">{LABELS[k]}</dt>
                        <dd className="break-words text-[17px] font-semibold">{shown}</dd>
                      </div>
                      <button
                        type="button"
                        onClick={() => leaveReview(k)}
                        aria-label={`Edit ${LABELS[k].toLowerCase()}`}
                        className="min-h-11 shrink-0 rounded-full px-4 text-sm font-bold text-[var(--rg-deep)] underline underline-offset-2 hover:bg-[var(--rg-soft)]"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 rounded-2xl bg-[var(--rg-soft)] px-4 py-3 text-sm font-semibold">
                  {when.weekdayLong} {when.dayMonth}, {when.time} · {night.venueName}, {night.venueArea}. We will email your confirmation.
                </p>

                {serverError && (
                  <p role="alert" className="mt-4 rounded-2xl border-2 border-[#C0264B] bg-[#FDECEF] px-4 py-3 text-sm font-semibold text-[#8E1736]">
                    {serverError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="fn-cta fn-display mt-6 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[var(--rg-deep)] px-8 text-xl text-white disabled:opacity-70"
                >
                  {submitting ? "SENDING…" : "CONFIRM, REGISTER MY TEAM"}
                </button>
                <button
                  type="button"
                  onClick={() => leaveReview()}
                  disabled={submitting}
                  className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-base font-bold text-[var(--rg-ink)] underline decoration-[var(--rg-accent)] decoration-2 underline-offset-4"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to my answers
                </button>
              </div>
            )}

            {step === "done" && done && (
              <div className="text-center">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[var(--rg-alt)] text-white shadow-[0_6px_0_var(--rg-alt-deep)]">
                  <Check className="h-10 w-10" strokeWidth={3} aria-hidden="true" />
                </div>
                <h2 ref={headingRef} tabIndex={-1} className="fn-display mt-5 text-4xl focus:outline-none">
                  YOU&apos;RE IN!
                </h2>
                <p className="mt-2 text-lg font-semibold">
                  {done.teamName} · {done.teamSize} {done.teamSize === 1 ? "player" : "players"}
                </p>
                <p className="mt-1 text-[15px] text-[var(--rg-ink)]/75">
                  We are emailing your confirmation to <span className="font-bold break-all">{done.email}</span>. If you can&apos;t see it, check spam or promotions.
                </p>

                <div className="mt-6 rounded-2xl bg-[var(--rg-soft)] px-4 py-4 text-left">
                  <p className="fn-display text-xl text-[var(--rg-deep)]">{`${when.weekdayLong} ${when.dayMonth} · ${when.time}`.toUpperCase()}</p>
                  <p className="mt-1 text-[15px] font-semibold">{night.venueName}, {night.venueArea}, {night.city}</p>
                  <p className="mt-2 text-sm text-[var(--rg-ink)]/75">Final table details come by email or on our Instagram closer to the night.</p>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <a
                    href={`/api/calendar/${night.id}`}
                    className="fn-cta fn-display inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[var(--rg-deep)] px-6 text-lg text-white"
                  >
                    <CalendarPlus className="h-5 w-5" aria-hidden="true" />
                    ADD TO MY CALENDAR
                  </a>
                  <a
                    href={googleCalendarLink(night)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-[var(--rg-input)] px-5 text-base font-bold hover:bg-[var(--rg-soft)]"
                  >
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Open in Google Calendar
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-[var(--rg-alt)] bg-[var(--rg-alt-soft)] px-5 text-base font-bold text-[var(--rg-alt-deep)]"
                  >
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                    Tell your team on WhatsApp
                  </a>
                  <a
                    href={night.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 text-base font-bold underline decoration-[var(--rg-accent)] decoration-2 underline-offset-4"
                  >
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    Get directions
                  </a>
                </div>

                <p className="mt-6 text-sm text-[var(--rg-ink)]/70">
                  Need to change something? Message us on{" "}
                  <a href={BUSINESS.instagramUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--rg-deep)] underline">
                    Instagram {BUSINESS.instagramHandle}
                  </a>{" "}
                  and we will fix it.
                </p>
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-xs text-[var(--rg-ink)]/60">
            By registering you agree to our{" "}
            <Link href="/terms" className="inline-block py-3 underline">terms</Link> and{" "}
            <Link href="/privacy" className="inline-block py-3 underline">privacy policy</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
