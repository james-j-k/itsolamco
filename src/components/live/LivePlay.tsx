"use client";

import { useEffect, useState } from "react";
import type { LiveTeamState } from "@/lib/liveTypes";
import { useLivePoll, useNow } from "./liveClient";
import { sfx, unlockSounds } from "./liveSounds";
import { LiveThemeContext, liveThemeFor, useLiveTheme, type LiveThemeId } from "./liveTheme";

// A team's phone: join once, then one big buzzer. The phone remembers its team, so a refresh
// or a dropped connection puts it straight back. One phone belongs to one team.

type Saved = { teamId: string; name: string; token: string };

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function storageKey(code: string) {
  return `olam-live-${code}`;
}

function load(code: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(code));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  const T = useLiveTheme();
  const { C } = T;
  const logo = T.logo.onDark;
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.cream, padding: `${T.stripe ? 30 : 20}px 18px 32px`, display: "flex", flexDirection: "column", fontFamily: T.BODY, position: "relative" }}>
      {T.stripe && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 8, display: "flex" }} aria-hidden="true">
          {["#F06A9E", "#F9C623", "#8CC63F", "#F39237"].map((c) => (
            <span key={c} style={{ flex: 1, background: c }} />
          ))}
        </div>
      )}
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="It's Olam Company" style={{ height: 40, width: "auto", alignSelf: "flex-start", marginBottom: 12 }} />
      )}
      {children}
    </div>
  );
}

function Joined({ code, saved, onLost }: { code: string; saved: Saved; onLost: () => void }) {
  const { C, DISPLAY, DW, D } = useLiveTheme();
  const { state: s, error, offset, poke } = useLivePoll<LiveTeamState>(`/api/live/${code}/state?team=${encodeURIComponent(saved.teamId)}`, 700, { "x-team-token": saved.token });
  const [busy, setBusy] = useState(false);
  const [guess, setGuess] = useState("");
  const [msg, setMsg] = useState("");
  const [pressedOn, setPressedOn] = useState<string | null>(null); // the question this phone has just buzzed on, shown at once

  const now = useNow(250);
  const myTurn = !!s?.myBuzz?.answering;
  const turnLeft = myTurn && s?.turnUntil ? Math.max(0, Math.ceil((s.turnUntil - (now + offset)) / 1000)) : null;
  useEffect(() => {
    // The phone buzzes in the hand when it is this team's turn to answer.
    if (myTurn) navigator.vibrate?.([140, 70, 140]);
  }, [myTurn]);

  useEffect(() => {
    // The quizmaster released this phone, or the night is gone: go back to the join form.
    if (error && (error.status === 401 || error.status === 403 || error.status === 404)) onLost();
  }, [error, onLost]);

  async function post(path: string, body: object) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/live/${code}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-team-token": saved.token }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(data.error ?? "That didn't work.");
      poke();
      return res.ok;
    } catch {
      setMsg("Connection lost. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!s) {
    return (
      <Shell>
        <div style={{ color: C.muted }}>{error ? error.message : "Connecting..."}</div>
      </Shell>
    );
  }

  const my = s.myBuzz;
  let label = "";
  let sub = "";
  let buttonColor = C.red;
  let enabled = false;

  if (s.status === "finished") {
    label = "THE NIGHT IS OVER";
    sub = "Thanks for playing!";
    buttonColor = C.panel;
  } else if (s.phase === "lobby") {
    label = "YOU'RE IN";
    sub = "Waiting for the quiz to start...";
    buttonColor = C.panel;
  } else if (s.phase === "roundIntro") {
    label = `ROUND ${s.roundNo}`;
    sub = s.roundName;
    buttonColor = C.panel;
  } else if (s.phase === "question") {
    if (my) {
      if (my.answering) {
        label = "YOUR TURN";
        sub = turnLeft !== null ? `Shout your answer! ${turnLeft}s` : "Shout your answer!";
        buttonColor = C.amber;
      } else if (my.outcome === "pending") {
        label = `#${my.place + 1}`;
        sub = "You're in the queue";
        buttonColor = C.panel;
      } else {
        label = my.outcome === "wrong" ? "WRONG" : my.outcome === "skipped" ? "SKIPPED" : "CORRECT";
        sub = "Wait for the next question";
        buttonColor = C.panel;
      }
    } else if (pressedOn === `${s.roundNo}-${s.questionNo}`) {
      label = "BUZZED!";
      sub = "Checking your place...";
      buttonColor = C.panel;
    } else if (s.buzzOpen) {
      label = "BUZZ!";
      sub = "Tap as soon as you know it";
      enabled = true;
    } else {
      label = "WAIT";
      sub = "";
      buttonColor = C.panel;
    }
  } else if (s.phase === "tiebreak" && s.tiebreak) {
    label = "TIE-BREAKER";
    buttonColor = C.panel;
  } else {
    label = "LOOK AT THE SCREEN";
    sub = s.phase === "celebrate" ? "Correct!" : "";
    buttonColor = C.panel;
  }

  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 14 }}>
        <b style={{ color: C.cream }}>{s.team.name}</b>
        <span>
          {s.phase === "question" ? `Round ${s.roundNo} · Q${s.questionNo}/${s.questionCount}` : s.phase === "lobby" ? "" : `Round ${s.roundNo}`}
        </span>
      </div>

      {s.phase === "tiebreak" && s.tiebreak ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(40) }}>TIE-BREAKER</div>
          <div style={{ fontSize: 20, lineHeight: 1.35 }}>{s.tiebreak.prompt}</div>
          {s.tiebreak.mustGuess ? (
            s.tiebreak.myGuess !== null ? (
              <div style={{ background: C.panel, borderRadius: 16, padding: 18 }}>
                You answered <b style={{ color: C.amber, fontSize: 28 }}>{s.tiebreak.myGuess}</b>. Wait for the answer.
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const v = Number(guess);
                  if (!/^\d{1,6}$/.test(guess.trim()) || !Number.isInteger(v)) {
                    setMsg("Enter a whole number.");
                    return;
                  }
                  await post("guess", { teamId: saved.teamId, value: v });
                }}
                style={{ display: "grid", gap: 10, gridTemplateColumns: "minmax(0, 1fr)" }}
              >
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Your number"
                  aria-label="Your number"
                  style={{ fontSize: 32, padding: 16, borderRadius: 14, border: 0, textAlign: "center", width: "100%", boxSizing: "border-box", background: C.cream, color: C.ink }}
                />
                <button type="submit" disabled={busy || !guess} style={{ background: C.amber, color: C.ink, border: 0, borderRadius: 14, padding: 18, fontSize: 22, fontWeight: 800, opacity: busy || !guess ? 0.5 : 1 }}>
                  LOCK IT IN
                </button>
                <div style={{ color: C.muted, fontSize: 13 }}>You only get one answer.</div>
              </form>
            )
          ) : (
            <div style={{ color: C.muted }}>Your team isn&apos;t in the tie. Watch the screen.</div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={async () => {
              const key = `${s.roundNo}-${s.questionNo}`;
              unlockSounds();
              sfx.tap();
              navigator.vibrate?.(50);
              setPressedOn(key);
              if (!(await post("buzz", { teamId: saved.teamId }))) setPressedOn(null);
            }}
            aria-label="Buzzer"
            style={{
              width: "min(78vw, 360px)",
              height: "min(78vw, 360px)",
              borderRadius: "50%",
              border: 0,
              background: buttonColor,
              color: buttonColor === C.amber ? C.ink : C.cream,
              fontFamily: DISPLAY,
              fontWeight: DW,
              fontSize: D(enabled ? 64 : 40),
              lineHeight: 1.1,
              padding: 16,
              boxShadow: enabled ? `0 0 0 10px rgba(192,40,10,.35), 0 12px 40px rgba(0,0,0,.5)` : "none",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {label}
          </button>
          <div style={{ color: C.muted, fontSize: 18, textAlign: "center", minHeight: 24 }}>{sub}</div>
        </div>
      )}

      {(msg || error) && <div style={{ background: C.red, borderRadius: 10, padding: "8px 12px", fontSize: 14, marginTop: 10 }}>{msg || error?.message}</div>}
    </Shell>
  );
}

export default function LivePlay({ code, theme = "olam" }: { code: string; theme?: LiveThemeId }) {
  const T = liveThemeFor(theme);
  return (
    <LiveThemeContext.Provider value={T}>
      <LivePlayInner code={code} />
    </LiveThemeContext.Provider>
  );
}

function LivePlayInner({ code }: { code: string }) {
  const { C, DISPLAY, DW, D } = useLiveTheme();
  const [saved, setSaved] = useState<Saved | null | undefined>(undefined); // undefined = not read yet
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    // The saved team lives in this phone's storage, which only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(load(code));
  }, [code]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const token = newToken();
      const res = await fetch(`/api/live/${code}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, token }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Couldn't join.");
        return;
      }
      const next: Saved = { teamId: data.team.id, name: data.team.name, token };
      try {
        localStorage.setItem(storageKey(code), JSON.stringify(next));
      } catch {
        // storage blocked: the phone still works until it is refreshed
      }
      setSaved(next);
    } catch {
      setErr("Connection lost. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (saved === undefined) return <Shell><div /></Shell>;

  if (saved) {
    return (
      <Joined
        code={code}
        saved={saved}
        onLost={() => {
          try {
            localStorage.removeItem(storageKey(code));
          } catch {
            // nothing to clear
          }
          setSaved(null);
        }}
      />
    );
  }

  return (
    <Shell>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(44), lineHeight: 1 }}>JOIN THE NIGHT</div>
        <div style={{ color: C.muted }}>
          Code <b style={{ color: C.amber, letterSpacing: 3 }}>{code}</b>. One phone per team, so pick the phone that will do the buzzing.
        </div>
        <form onSubmit={join} style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1fr)" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="Your team name"
            aria-label="Team name"
            autoComplete="off"
            style={{ fontSize: 24, padding: 16, borderRadius: 14, border: 0, width: "100%", boxSizing: "border-box", background: C.cream, color: C.ink }}
          />
          <button type="submit" disabled={busy || name.trim().length === 0} style={{ background: C.amber, color: C.ink, border: 0, borderRadius: 14, padding: 18, fontSize: 22, fontWeight: 800, opacity: busy || name.trim().length === 0 ? 0.5 : 1 }}>
            {busy ? "JOINING..." : "JOIN"}
          </button>
        </form>
        {err && <div style={{ background: C.red, borderRadius: 10, padding: "8px 12px" }}>{err}</div>}
      </div>
    </Shell>
  );
}
