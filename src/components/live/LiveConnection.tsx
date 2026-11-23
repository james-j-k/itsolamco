"use client";

import type { ConnState } from "./liveClient";

// A small dot and a word that say how this screen's connection is: so everyone can tell it is the network, not the quiz.
const COLOR: Record<ConnState, string> = { good: "#6BCB8B", slow: "#F2A93B", offline: "#E5484D" };
const WORDS: Record<ConnState, string> = { good: "Connected", slow: "Weak signal", offline: "Reconnecting..." };

export function ConnectionBadge({ state, size = 12, fontSize = 13, color = "currentColor", showGood = true }: { state: ConnState; size?: number; fontSize?: number; color?: string; showGood?: boolean }) {
  if (state === "good" && !showGood) return null;
  return (
    <span role="status" aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: size * 0.6, fontSize, fontWeight: 700, color, whiteSpace: "nowrap" }}>
      <span aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", background: COLOR[state], boxShadow: state === "offline" ? `0 0 0 ${size / 3}px ${COLOR[state]}55` : "none", animation: state === "offline" ? "olampulse 1.2s ease-in-out infinite" : "none" }} />
      {WORDS[state]}
    </span>
  );
}
