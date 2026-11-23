"use client";

import { useEffect, useRef, useState } from "react";
import { FALSE_START_MS, FALSE_START_SLACK_MS, type LiveTeamState } from "@/lib/liveTypes";
import { connectionOf, pressTime, useClockSync, useLivePoll, useNow, useOrderFinal, useReached } from "./liveClient";
import { ConnectionBadge } from "./LiveConnection";
import { setMuted, sfx, unlockSounds } from "./liveSounds";
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
  // Faster polling while the order of the buzzes is being locked in, so every phone learns the result quickly.
  const fastRef = useRef(false);
  const { state: s, error, offset: pollOffset, confirmedAt, failures, poke } = useLivePoll<LiveTeamState>(`/api/live/${code}/state?team=${encodeURIComponent(saved.teamId)}`, () => (fastRef.current ? 250 : 700), { "x-team-token": saved.token });
  const sync = useClockSync();
  const conn = connectionOf(failures, sync.rtt);
  const offset = sync.ready ? sync.offset : pollOffset; // this phone's clock vs the server's
  const offsetRef = useRef(offset);
  const [busy, setBusy] = useState(false);
  const [guess, setGuess] = useState("");
  const [msg, setMsg] = useState("");
  // The buzz this phone has just sent: shown at once, and kept until the server has confirmed it.
  const [pressed, setPressed] = useState<{ qid: string; state: "sending" | "sent" | "failed" } | null>(null);
  const qidRef = useRef<string | null>(null);
  const rttRef = useRef<number | null>(null);
  // Pressing before the buzzer opens is a false start: this phone is locked out for a moment once it opens.
  const [lockout, setLockout] = useState<{ qid: string; until: number } | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    offsetRef.current = offset;
    rttRef.current = sync.rtt;
    qidRef.current = s?.phase === "question" ? s.questionId : null;
  });

  useEffect(() => {
    // Whether this phone had the sound switched off is kept in the phone's own storage, which only exists in the browser.
    try {
      const on = localStorage.getItem("olam-live-sound") !== "off";
      setMuted(!on);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSoundOn(on);
    } catch {
      // storage blocked: sound stays on
    }
    // A browser only plays sound after a touch, so the very first touch anywhere unlocks it.
    const unlock = () => unlockSounds();
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const now = useNow(250);
  // The buzzer opens at one moment for everyone (a beat after the quizmaster moves on). Before that the button waits.
  const opened = useReached(s?.phase === "question" ? s.openedAt : null, offset);
  const orderFinal = useOrderFinal(s?.phase === "question" ? s.lockUntil : null, confirmedAt, offset);
  const activeLock = lockout && s?.phase === "question" && lockout.qid === s.questionId ? lockout.until : null; // this question's lockout, if this phone jumped the gun
  const stillLockedOut = !useReached(activeLock, offset);
  const lockedRef = useRef(false);
  useEffect(() => {
    fastRef.current = s?.phase === "question" && s.lockUntil !== null && !orderFinal;
    lockedRef.current = activeLock !== null;
  });
  const myTurn = !!s?.myBuzz?.answering && orderFinal;
  const turnLeft = myTurn && s?.turnUntil ? Math.max(0, Math.ceil((s.turnUntil - (now + offset)) / 1000)) : null;
  useEffect(() => {
    // The phone buzzes in the hand (and chimes) when it is this team's turn to answer.
    if (myTurn) {
      navigator.vibrate?.([140, 70, 140]);
      sfx.yourTurn();
    }
  }, [myTurn]);
  const tiedNow = !!s?.tied && orderFinal;
  useEffect(() => {
    if (tiedNow) navigator.vibrate?.([60, 40, 60]);
  }, [tiedNow]);
  // The buzzer opening: a chime and a tap on the hand. Only when this phone watched it open, not when it reloads mid-question.
  const sawClosed = useRef<string | null>(null);
  const openQid = s?.phase === "question" ? s.questionId : null;
  useEffect(() => {
    if (!openQid) return;
    if (!opened) {
      sawClosed.current = openQid;
      return;
    }
    if (sawClosed.current === openQid) {
      sawClosed.current = null;
      if (!lockedRef.current) {
        sfx.go();
        navigator.vibrate?.(40);
      }
    }
  }, [opened, openQid]);

  // Keep the buzz route awake, and tell the quizmaster how this phone's connection is doing (their pre-night check).
  // A server that has been idle can take a second to start, which would slow down the very first buzz of the night.
  // This never buzzes; it only says hello.
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/live/${code}/buzz`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-team-token": saved.token },
        body: JSON.stringify({ teamId: saved.teamId, warm: true, ...(rttRef.current !== null ? { rttMs: rttRef.current } : {}), offsetMs: Math.round(offsetRef.current) }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    };
    const first = setTimeout(ping, 2500); // after the first clock check has had time to finish
    const every = setInterval(ping, 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [code, saved.teamId, saved.token]);

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

  // Sends the buzz and keeps trying until the server answers, so a dropped signal for a few seconds doesn't lose it.
  // The press time is fixed the moment of the tap and sent every time, so the retries can't make it later.
  async function sendBuzz(qid: string, pressedAtDevice: number) {
    const pressedAt = Math.round(pressedAtDevice + offsetRef.current); // the press, on the server's clock
    const started = Date.now();
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(`/api/live/${code}/buzz`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-team-token": saved.token },
          body: JSON.stringify({ teamId: saved.teamId, questionId: qid, pressedAt }),
          signal: AbortSignal.timeout(2500),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setPressed((p) => (p && p.qid === qid ? { qid, state: "sent" } : p));
          poke();
          return;
        }
        if (res.status >= 400 && res.status < 500) {
          // The server said no (not open yet, question over, not your phone): trying again won't change that.
          setPressed((p) => (p && p.qid === qid ? null : p));
          setMsg(data.error ?? "That didn't work.");
          poke();
          return;
        }
      } catch {
        // no signal for a moment: try again
      }
      if (qidRef.current !== qid) return; // the night moved on to another question
      if (Date.now() - started > 8000) break;
      await new Promise((r) => setTimeout(r, Math.min(900, 250 + attempt * 150)));
    }
    setPressed((p) => (p && p.qid === qid ? { qid, state: "failed" } : p));
    setMsg("Couldn't reach the server. Tap again.");
  }

  if (!s) {
    return (
      <Shell>
        <div style={{ color: C.muted }}>{error ? error.message : "Connecting..."}</div>
      </Shell>
    );
  }

  const my = s.myBuzz;
  const mine = pressed && pressed.qid === s.questionId ? pressed : null; // this phone's own buzz on this question
  const secondsToOpen = s.openedAt ? Math.max(1, Math.ceil((s.openedAt - (now + offset)) / 1000)) : 1;
  const lockLeft = activeLock !== null ? Math.max(1, Math.ceil((activeLock - (now + offset)) / 1000)) : 0;
  let label = "";
  let sub = "";
  let buttonColor = C.red;
  let enabled = false;
  // Before the buzzer opens the button still takes a press, but only to catch a false start.
  let pressable = false;

  // One press, from a finger or a key. `at` is when it happened on this phone's clock.
  function press(at: number) {
    if (!s || !pressable || busy || !s.questionId) return;
    const qid = s.questionId;
    unlockSounds();
    if (s.openedAt && at + offsetRef.current < s.openedAt - FALSE_START_SLACK_MS) {
      // Jumped the gun: no buzz is sent, and this phone is locked out for a moment once the buzzer opens.
      sfx.falseStart();
      navigator.vibrate?.([90, 60, 90]);
      setLockout({ qid, until: s.openedAt + FALSE_START_MS });
      return;
    }
    sfx.tap();
    navigator.vibrate?.(50);
    setMsg("");
    setPressed({ qid, state: "sending" });
    void sendBuzz(qid, at);
  }

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
    if (!opened) {
      if (activeLock !== null) {
        label = "TOO EARLY!";
        sub = "Wait for the buzzer to open";
        buttonColor = C.red;
      } else {
        label = "GET READY";
        sub = `Buzzer opens in ${secondsToOpen}`;
        buttonColor = C.panel;
        pressable = s.buzzOpen;
      }
    } else if (my) {
      if (!orderFinal) {
        label = "BUZZED!";
        sub = "Locking in the order...";
        buttonColor = C.panel;
      } else if (s.tied) {
        label = "TIE!";
        sub = "Too close to call. The quizmaster decides.";
        buttonColor = C.amber;
      } else if (my.answering) {
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
    } else if (activeLock !== null && stillLockedOut && !mine) {
      label = "TOO EARLY!";
      sub = `Locked out for ${lockLeft}s`;
      buttonColor = C.red;
    } else if (mine && mine.state !== "failed") {
      label = "BUZZED!";
      sub = mine.state === "sending" ? "Sending..." : "Got it. Locking in the order...";
      buttonColor = C.panel;
    } else if (mine?.state === "failed") {
      label = "NOT SENT";
      sub = "Tap to buzz again";
      enabled = true;
      pressable = true;
    } else if (s.buzzOpen) {
      label = "BUZZ!";
      sub = "Tap as soon as you know it";
      enabled = true;
      pressable = true;
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
      <div style={{ marginTop: 6, color: C.muted, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <ConnectionBadge state={conn} size={9} fontSize={12} />
        <button
          type="button"
          aria-pressed={soundOn}
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            setMuted(!next);
            unlockSounds();
            if (next) sfx.tap();
            try {
              localStorage.setItem("olam-live-sound", next ? "on" : "off");
            } catch {
              // not saved; it still works until the page is reloaded
            }
          }}
          style={{ background: "transparent", color: C.muted, border: `1px solid ${C.muted}`, borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}
        >
          Sound {soundOn ? "on" : "off"}
        </button>
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
            disabled={!pressable || busy}
            // Counts the moment the finger lands, not when it lifts: faster, and the time that is sent is the real one.
            onPointerDown={(e) => press(pressTime(e))}
            onClick={(e) => {
              // A keyboard (Enter or Space) clicks without a pointer.
              if (e.detail === 0) press(Date.now());
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
