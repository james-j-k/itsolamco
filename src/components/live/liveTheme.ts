import { createContext, useContext } from "react";

// How the live quiz looks. "olam" is the company's own look. "falooda" matches the slides made for the
// Falooda Nation night (teal, cream, yellow and berry, with the same fonts). A quiz picks its theme in the
// quiz file ("theme": "falooda"); anything else keeps the Olam look, so no other night changes.

export type LiveThemeId = "olam" | "falooda";

export type LiveColors = {
  bg: string; // the main dark stage
  panel: string; // cards on the dark stage
  cream: string; // text on the dark stage
  amber: string; // accent on the dark stage
  red: string; // accent on a light stage, and "wrong"
  muted: string; // quieter text on the dark stage
  green: string; // "buzzer open"
  pos: string; // points scored, on a dark stage
  ink: string; // text on a light stage
  soft: string; // quieter text on a light stage
  rule: string; // thin lines on a light stage
  good: string; // points scored, on a light stage
};

export type LiveTheme = {
  id: LiveThemeId;
  C: LiveColors;
  DISPLAY: string;
  BODY: string;
  ACCENT: string; // the script-style font used for the round name and the winner
  MALAYALAM: string;
  DW: 400 | 800; // weight of the headline font (the deck sets Phudu in bold)
  D: (n: number) => number; // sizes for the headline font, scaled because it is wider in some themes
  confetti: string[];
  stripe: boolean; // the four-colour strip along the top
  logo: { onDark: string | null; onLight: string | null }; // image logos; null = the written logo
  bgs: {
    lobby: string;
    intro: string;
    question: string;
    reveal: string;
    celebrate: string;
    results: string;
    secret: string;
    tie: string;
    tieReveal: string;
    ending: string;
    winners: string;
  };
};

const OLAM_C: LiveColors = {
  bg: "#1C1512",
  panel: "#2A201B",
  cream: "#F5F0E6",
  amber: "#F2A93B",
  red: "#C0280A",
  muted: "#D9CBB8",
  green: "#6BCB8B",
  pos: "#6BCB8B",
  ink: "#1C1512",
  soft: "#5A4A40",
  rule: "rgba(28,21,18,.15)",
  good: "#4B7B4E",
};

const OLAM: LiveTheme = {
  id: "olam",
  C: OLAM_C,
  DISPLAY: "var(--font-anton), Impact, sans-serif",
  BODY: "var(--font-archivo), 'Space Grotesk', Arial, sans-serif",
  ACCENT: "var(--font-anton), Impact, sans-serif",
  MALAYALAM: "var(--font-malayalam), sans-serif",
  DW: 400,
  D: (n) => n,
  confetti: [OLAM_C.amber, OLAM_C.red, OLAM_C.cream, OLAM_C.green, "#E2733A"],
  stripe: false,
  logo: { onDark: null, onLight: null },
  bgs: {
    lobby: OLAM_C.bg,
    intro: OLAM_C.bg,
    question: OLAM_C.bg,
    reveal: OLAM_C.cream,
    celebrate: OLAM_C.bg,
    results: OLAM_C.cream,
    secret: OLAM_C.bg,
    tie: OLAM_C.bg,
    tieReveal: OLAM_C.cream,
    ending: OLAM_C.bg,
    winners: OLAM_C.bg,
  },
};

// The deck's colours: teal 2AB3BF (titles, thank-you), deep teal 0F5961 (questions), cream FFF6E8 (answers),
// yellow F9C623 (scores), berry C93F84 (winner), ink 13282C.
const FALOODA_C: LiveColors = {
  bg: "#0F5961",
  panel: "#0B434A",
  cream: "#FFF6E8",
  amber: "#F9C623",
  red: "#C93F84",
  muted: "#CFE8EA",
  green: "#8CC63F",
  pos: "#F9C623",
  ink: "#13282C",
  soft: "#4E5D63",
  rule: "rgba(19,40,44,.18)",
  good: "#2F7D32",
};

const FALOODA: LiveTheme = {
  id: "falooda",
  C: FALOODA_C,
  DISPLAY: "var(--font-phudu), Impact, sans-serif",
  BODY: "var(--font-montserrat), Arial, sans-serif",
  ACCENT: "var(--font-shrikhand), Georgia, serif",
  MALAYALAM: "var(--font-malayalam), sans-serif",
  DW: 800,
  D: (n) => Math.round(n * 0.7),
  confetti: ["#F9C623", "#FFF6E8", "#2AB3BF", "#8CC63F", "#F39237", "#F06A9E"],
  stripe: true,
  logo: { onDark: "/live/falooda-logo-cream.png", onLight: "/live/falooda-logo-ink.png" },
  bgs: {
    lobby: FALOODA_C.bg,
    intro: "#2AB3BF",
    question: FALOODA_C.bg,
    reveal: FALOODA_C.cream,
    celebrate: FALOODA_C.red,
    results: FALOODA_C.amber,
    secret: FALOODA_C.bg,
    tie: FALOODA_C.bg,
    tieReveal: FALOODA_C.cream,
    ending: "#2AB3BF",
    winners: FALOODA_C.red,
  },
};

export const LIVE_THEMES: Record<LiveThemeId, LiveTheme> = { olam: OLAM, falooda: FALOODA };

export function liveThemeFor(id?: string | null): LiveTheme {
  return id === "falooda" ? FALOODA : OLAM;
}

export const LiveThemeContext = createContext<LiveTheme>(OLAM);
export const useLiveTheme = () => useContext(LiveThemeContext);
