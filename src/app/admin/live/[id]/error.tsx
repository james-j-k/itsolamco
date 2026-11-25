"use client";

import { useEffect } from "react";

// Safety net for the projector screen and the quizmaster's pad. If either one ever hits an error while drawing
// (say, one odd answer from the server), it must not sit on a "something broke" page that nobody is going to tap.
// All of the night's state lives on the server, so simply drawing the screen again fixes it. This waits a moment and does that
// by itself, a little longer each time it fails again, and after a few tries reloads the whole page.
// A leftover copy of the page from before a new release (its files no longer exist) can only be fixed by a reload, so that goes straight to one.

let tries = 0;
let lastTryAt = 0;

export default function LiveScreenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    const staleCopy = /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i.test(`${error?.name} ${error?.message}`);
    const now = Date.now();
    if (now - lastTryAt > 60_000) tries = 0; // a quiet minute: start counting again
    lastTryAt = now;
    tries += 1;

    const wait = staleCopy ? 300 : Math.min(800 * 2 ** (tries - 1), 8000);
    const timer = setTimeout(() => {
      if (staleCopy || tries >= 4) window.location.reload();
      else reset();
    }, wait);
    return () => clearTimeout(timer);
  }, [error, reset]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ minHeight: "100vh", background: "#120E10", color: "#F3E9D7", display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}
    >
      <div>
        <div style={{ fontSize: 14, letterSpacing: "0.28em", textTransform: "uppercase", color: "#F2B33D", marginBottom: 12 }}>One moment</div>
        <div style={{ fontSize: 28, marginBottom: 20 }}>Reconnecting&hellip;</div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ background: "transparent", color: "#F3E9D7", border: "2px solid #F3E9D7", padding: "10px 22px", fontSize: 14, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer" }}
        >
          Reload now
        </button>
      </div>
    </div>
  );
}
