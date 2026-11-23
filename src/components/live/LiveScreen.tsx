"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { BUSINESS } from "@/lib/business";
import type { LiveQueueItem, LiveState } from "@/lib/liveTypes";
import { clock, connectionOf, seconds, useClockSync, useLivePoll, useNow, useOrderFinal, useReached } from "./liveClient";
import { ConnectionBadge } from "./LiveConnection";
import { isMuted, setMuted, sfx, unlockSounds } from "./liveSounds";
import { LiveThemeContext, liveThemeFor, useLiveTheme, type LiveThemeId } from "./liveTheme";

// The projector page. Drawn on a fixed 1920 x 1080 stage and scaled to fit whatever screen it is shown on,
// so it looks the same on any projector. Press Space / Enter / the right arrow to move on from a round
// intro or a results screen (the same as the Continue button on the quizmaster's phone).

const css = `
@keyframes olamfall{0%{transform:translateY(-12vh) rotate(0deg);opacity:1}100%{transform:translateY(112vh) rotate(720deg);opacity:.9}}
@keyframes olampop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
@keyframes olampulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.07);opacity:1}}
@keyframes olamring{0%{transform:scale(.7);opacity:.8}100%{transform:scale(1.6);opacity:0}}
@keyframes olamrise{0%{transform:translateY(40px);opacity:0}100%{transform:translateY(0);opacity:1}}
@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;animation-iteration-count:1!important}}
`;

function rand(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function Confetti({ count = 70 }: { count?: number }) {
  const colors = useLiveTheme().confetti;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${rand(i, 1) * 100}%`,
            width: 14 + rand(i, 2) * 14,
            height: 22 + rand(i, 3) * 26,
            background: colors[i % colors.length],
            borderRadius: 3,
            animation: `olamfall ${2.6 + rand(i, 4) * 2.4}s ${rand(i, 5) * 0.9}s linear infinite`,
          }}
        />
      ))}
    </div>
  );
}

// The company's name in the top corner: the written logo, or the logo image when the theme has one.
function Brand({ onLight = false }: { onLight?: boolean }) {
  const T = useLiveTheme();
  const src = onLight ? T.logo.onLight : T.logo.onDark;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="It's Olam Company" style={{ position: "absolute", left: 104, top: 40, height: 84, width: "auto" }} />;
  }
  return (
    <div style={{ position: "absolute", left: 104, top: 52, fontFamily: T.DISPLAY, fontWeight: T.DW, fontSize: T.D(44), color: onLight ? T.C.ink : T.C.cream, letterSpacing: 1 }}>
      It&apos;s <span style={{ fontFamily: T.MALAYALAM }}>ഓളം</span> Company
    </div>
  );
}

// The four-colour strip along the top of every slide in the Falooda Nation deck.
function Stripe() {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 14, display: "flex", zIndex: 5 }} aria-hidden="true">
      {["#F06A9E", "#F9C623", "#8CC63F", "#F39237"].map((c) => (
        <span key={c} style={{ flex: 1, background: c }} />
      ))}
    </div>
  );
}

function Header({ s, labelColor }: { s: LiveState; labelColor?: string }) {
  const { C, BODY } = useLiveTheme();
  return (
    <>
      <Brand />
      <div style={{ position: "absolute", right: 104, top: 64, fontFamily: BODY, fontWeight: 700, fontSize: 26, letterSpacing: 3, textTransform: "uppercase", color: labelColor ?? C.amber }}>
        Round {s.roundNo} · {s.roundName}
      </div>
    </>
  );
}

function PointsChips({ s }: { s: LiveState }) {
  const { C, BODY } = useLiveTheme();
  const chip = { fontFamily: BODY, fontWeight: 700, fontSize: 28, padding: "8px 20px", borderRadius: 999 } as const;
  if (s.rightPoints === 0) {
    return (
      <div style={{ display: "flex", gap: 14 }}>
        <span style={{ ...chip, background: C.amber, color: C.ink }}>practice round</span>
        <span style={{ ...chip, border: `2px solid ${C.muted}`, color: C.muted }}>no points</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <span style={{ ...chip, background: C.amber, color: C.ink }}>+{s.rightPoints} right</span>
      {s.wrongPenalty > 0 ? (
        <span style={{ ...chip, background: C.red, color: C.cream }}>−{s.wrongPenalty} wrong or skip</span>
      ) : (
        <span style={{ ...chip, border: `2px solid ${C.muted}`, color: C.muted }}>no negatives</span>
      )}
      {s.placeDecay && <span style={{ ...chip, border: `2px solid ${C.muted}`, color: C.muted }}>later buzzers score a little less</span>}
    </div>
  );
}

// The beat before a question: the buzzer opens on the projector and on every phone at the same moment.
function GetReady({ s, offset }: { s: LiveState; offset: number }) {
  const { C, DISPLAY, DW, BODY, D } = useLiveTheme();
  const now = useNow(60);
  const left = s.openedAt ? Math.max(0, s.openedAt - (now + offset)) : 0;
  const n = Math.max(1, Math.ceil(left / 1000));
  return (
    <>
      <div style={{ position: "absolute", left: 104, top: 168, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(64), lineHeight: 1, color: C.amber }}>
        Q{s.questionNo}
        <span style={{ color: C.muted }}> / {s.questionCount}</span>
      </div>
      <div style={{ position: "absolute", right: 104, top: 160 }}>
        <PointsChips s={s} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 320, textAlign: "center", fontFamily: BODY, fontWeight: 800, fontSize: 44, letterSpacing: 14, color: C.muted }}>GET READY</div>
      <div key={n} style={{ position: "absolute", left: 0, right: 0, top: 400, textAlign: "center", fontFamily: DISPLAY, fontWeight: DW, fontSize: D(420), lineHeight: 1, color: C.amber, animation: "olampop .45s ease-out" }}>{n}</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 90, textAlign: "center", fontFamily: BODY, fontSize: 34, color: C.muted }}>Thumbs on your buzzers</div>
    </>
  );
}

function QueueStrip({ s, elapsed, serverNow, locking, tie }: { s: LiveState; elapsed: number; serverNow: number; locking: boolean; tie: LiveState["tie"] }) {
  const { C, DISPLAY, DW, BODY, D } = useLiveTheme();
  const turnLeft = s.phaseUntil ? Math.max(0, Math.ceil((s.phaseUntil - serverNow) / 1000)) : null; // the team that is answering
  if (tie && !locking) {
    // Two teams buzzed too close together to call (closer than the phones and networks can tell apart): the quizmaster decides.
    return (
      <div style={{ position: "absolute", left: 104, right: 104, bottom: 56, height: 220, display: "flex", alignItems: "center", gap: 48, background: C.amber, color: C.ink, borderRadius: 28, padding: "0 56px", boxShadow: `0 0 0 6px ${C.red}`, animation: "olampop .35s ease-out" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(110), lineHeight: 1 }}>TIE!</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 50, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tie.teams.join(" and ")}</div>
          <div style={{ fontFamily: BODY, fontSize: 30, marginTop: 6 }}>buzzed at the same moment. The quizmaster decides who goes first.</div>
        </div>
      </div>
    );
  }
  if (locking) {
    // Somebody has buzzed, but slower connections get a moment to be counted before the order is shown.
    return (
      <div style={{ position: "absolute", left: 104, right: 104, bottom: 56, height: 220, display: "flex", alignItems: "center", gap: 48, background: C.panel, borderRadius: 28, padding: "0 56px" }}>
        <div style={{ position: "relative", width: 110, height: 110 }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `6px solid ${C.amber}`, animation: "olamring .9s ease-out infinite" }} />
          <span style={{ position: "absolute", inset: 22, borderRadius: "50%", background: C.amber, animation: "olampulse .9s ease-in-out infinite" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(84), lineHeight: 1, color: C.cream }}>BUZZERS IN!</div>
          <div style={{ fontFamily: BODY, fontSize: 32, color: C.muted, marginTop: 8 }}>
            {s.queue.length} {s.queue.length === 1 ? "team" : "teams"} buzzed. Locking in the order...
          </div>
        </div>
      </div>
    );
  }
  if (s.queue.length === 0) {
    return (
      <div style={{ position: "absolute", left: 104, right: 104, bottom: 56, height: 220, display: "flex", alignItems: "center", gap: 48, background: C.panel, borderRadius: 28, padding: "0 56px" }}>
        <div style={{ position: "relative", width: 110, height: 110 }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `6px solid ${C.green}`, animation: "olamring 1.6s ease-out infinite" }} />
          <span style={{ position: "absolute", inset: 22, borderRadius: "50%", background: C.green, animation: "olampulse 1.6s ease-in-out infinite" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(84), lineHeight: 1, color: C.cream }}>BUZZER OPEN</div>
          <div style={{ fontFamily: BODY, fontSize: 32, color: C.muted, marginTop: 8 }}>Press your button on your phone</div>
        </div>
        <div style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(96), color: C.amber }}>{clock(elapsed)}</div>
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", left: 104, right: 104, bottom: 56, height: 240, display: "flex", gap: 24 }}>
      {s.queue.map((q: LiveQueueItem, i: number) => {
        const answering = q.answering;
        const resolved = q.outcome !== "pending";
        return (
          <div
            key={q.buzzId}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 26,
              padding: "20px 28px",
              background: answering ? C.amber : C.panel,
              color: answering ? C.ink : C.cream,
              opacity: resolved ? 0.55 : 1,
              // The order is revealed one team at a time, fastest first (the sound climbs with it).
              animation: `olampop .45s ${i * 0.18}s ease-out both`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: answering ? `0 0 0 6px ${C.red}` : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(72), lineHeight: 1 }}>{q.place + 1}</span>
              <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 24, letterSpacing: 2, textTransform: "uppercase" }}>
                {answering ? (turnLeft !== null ? `answering · ${turnLeft}s` : "answering") : q.outcome === "wrong" ? "wrong" : q.outcome === "skipped" ? "skipped" : q.outcome === "correct" ? "correct" : "next"}
              </span>
            </div>
            <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 44, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.teamName}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(q.place === 0 ? 56 : 44) }}>{q.place === 0 ? seconds(q.atMs) : `+${seconds(q.gapMs)}`}</span>
              {q.place === 0 && (
                <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 20, letterSpacing: 3, padding: "4px 14px", borderRadius: 999, background: answering ? C.ink : C.amber, color: answering ? C.amber : C.ink }}>FASTEST</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuestionBody({ s }: { s: LiveState }) {
  const { C, DISPLAY, DW, BODY, D, id: themeId } = useLiveTheme();
  const q = s.question;
  if (!q) return null;
  const box = { position: "absolute", left: 104, right: 104, top: 270, bottom: 330, display: "flex", alignItems: "center" } as const;
  if (q.kind === "emoji") {
    const n = Array.from(q.prompt).length;
    return (
      <div style={{ ...box, justifyContent: "center" }}>
        <div style={{ fontSize: n > 7 ? 170 : n > 5 ? 200 : 240, letterSpacing: 18, whiteSpace: "nowrap", textAlign: "center" }}>{q.prompt}</div>
      </div>
    );
  }
  if (q.kind === "audio") {
    return (
      <div style={{ ...box, gap: 72 }}>
        <div style={{ width: 300, height: 300, borderRadius: "50%", background: C.red, display: "flex", alignItems: "center", justifyContent: "center", animation: "olampulse 2s ease-in-out infinite" }}>
          <svg width="150" height="150" viewBox="0 0 24 24" fill={C.cream} aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        </div>
        <div>
          <div style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(150), lineHeight: 1, color: C.cream }}>{q.prompt}</div>
          <div style={{ fontFamily: BODY, fontSize: 40, color: C.muted, marginTop: 14 }}>{q.hint ?? "Listen. Which movie is this from?"}</div>
        </div>
      </div>
    );
  }
  const long = q.prompt.length > 150;
  return (
    <div style={{ ...box, flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 18 }}>
      {q.hint && <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: themeId === "falooda" ? C.amber : C.red }}>{q.hint}</div>}
      <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: long ? 56 : q.prompt.length > 90 ? 66 : 80, lineHeight: 1.22, color: C.cream, maxWidth: 1700 }}>{q.prompt}</div>
    </div>
  );
}

// Defined out here, not inside LiveScreen: a component made inside another is a new component on every render,
// which would restart every animation each time the clock ticks.
function Stage({ children, bg, color }: { children: React.ReactNode; bg?: string; color?: string }) {
  const T = useLiveTheme();
  return (
    <div style={{ position: "absolute", inset: 0, background: bg ?? T.C.bg, color: color ?? T.C.cream, fontFamily: T.BODY, overflow: "hidden" }}>
      {T.stripe && <Stripe />}
      {children}
    </div>
  );
}

export default function LiveScreen({ sessionId, theme = "olam" }: { sessionId: string; theme?: LiveThemeId }) {
  const T = liveThemeFor(theme);
  const { C, DISPLAY, DW, BODY, D } = T;
  const fastRef = useRef(false); // poll faster while the order of the buzzes is being locked in
  const { state: s, error, failures, offset: pollOffset, confirmedAt } = useLivePoll<LiveState>(`/api/admin/live/sessions/${sessionId}/state?view=screen`, () => (fastRef.current ? 250 : 600));
  const sync = useClockSync();
  const conn = connectionOf(failures, sync.rtt);
  const offset = sync.ready ? sync.offset : pollOffset; // this screen's clock vs the server's
  const now = useNow(250);
  // The question appears at one moment on the projector and on every phone, a beat after the quizmaster moves on.
  const opened = useReached(s?.phase === "question" ? s.openedAt : null, offset);
  const orderFinal = useOrderFinal(s?.phase === "question" ? s.lockUntil : null, confirmedAt, offset);
  useEffect(() => {
    fastRef.current = s?.phase === "question" && s.lockUntil !== null && !orderFinal;
  });
  const [armed, setArmed] = useState(false); // a click is needed once, so the browser will let the songs play
  const [scale, setScale] = useState(1);
  const [qr, setQr] = useState("");
  const [igQr, setIgQr] = useState("");
  const [mutedShown, setMutedShown] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const latest = useRef<LiveState | null>(null);
  const armedRef = useRef(false);

  useEffect(() => {
    latest.current = s;
    armedRef.current = armed;
  });

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    QRCode.toString(BUSINESS.instagramUrl, { type: "svg", margin: 1, color: { dark: "#1C1512", light: "#F5F0E6" } })
      .then(setIgQr)
      .catch(() => setIgQr(""));
  }, []);

  const code = s?.code;
  useEffect(() => {
    if (!code) return;
    const url = `${window.location.origin}/play/${code}`;
    // The address of this site is only known in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJoinUrl(url);
    QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#1C1512", light: "#F5F0E6" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [code]);

  const send = useCallback(async () => {
    const cur = latest.current;
    if (!cur) return;
    const type = cur.phase === "lobby" ? "start" : ["roundIntro", "roundResults", "tiebreak", "tiebreakReveal"].includes(cur.phase) ? "continue" : null;
    if (!type) return;
    // The tap says which step it was made on, so a repeat press can't skip past the next screen.
    await fetch(`/api/admin/live/sessions/${sessionId}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, expect: { step: cur.step, version: cur.version } }) }).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") {
        setMuted(!isMuted());
        setMutedShown(isMuted());
        return;
      }
      if (![" ", "Enter", "ArrowRight", "PageDown"].includes(e.key)) return;
      e.preventDefault();
      if (!armedRef.current) {
        unlockSounds();
        setArmed(true);
        return;
      }
      send();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send]);

  // The song plays by itself the moment its question appears, and stops when the question ends.
  // Once a team has buzzed the song carries on, but quietly, so the room can hear the answers.
  const wantAudio = s?.phase === "question" && opened ? (s.question?.audioUrl ?? null) : null;
  const questionId = s?.question?.id ?? null;
  const ducked = (s?.queue.length ?? 0) > 0;
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (wantAudio) {
      if (a.dataset.url !== `${questionId}|${wantAudio}`) {
        a.dataset.url = `${questionId}|${wantAudio}`;
        a.src = wantAudio;
        a.currentTime = 0;
      }
      if (armed) a.play().catch(() => {});
    } else {
      a.pause();
      delete a.dataset.url;
    }
  }, [wantAudio, questionId, armed]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = ducked ? 0.15 : 1;
  }, [ducked, questionId]);

  // Sound effects for what just changed. The first picture after loading is only a starting point.
  const seen = useRef<{ key: string; phase: string; maxBuzz: number; outcomes: Map<number, string>; teams: number } | null>(null);
  useEffect(() => {
    if (!s) return;
    const key = `${s.roundNo}-${s.questionNo}`;
    const maxBuzz = s.queue.reduce((m, q) => Math.max(m, q.buzzId), 0);
    const prev = seen.current;
    seen.current = { key, phase: s.phase, maxBuzz, outcomes: new Map(s.queue.map((q) => [q.buzzId, q.outcome])), teams: s.teams.length };
    if (!prev || !armedRef.current) return;

    if (prev.phase !== s.phase) {
      if (s.phase === "celebrate") sfx.correct();
      else if (s.phase === "reveal") sfx.nobody();
      else if (s.phase === "question") {
        sfx.whoosh(); // "get ready": the question's own sound plays when it opens (see below)
      } else if (s.phase === "roundIntro" || s.phase === "tiebreak" || s.phase === "tiebreakReveal") sfx.whoosh();
      else if (s.phase === "roundResults") sfx.results();
      else if (s.phase === "winners") sfx.winners();
      return;
    }
    if (s.phase === "question" && prev.key === key) {
      if (maxBuzz > prev.maxBuzz) {
        if (prev.maxBuzz === 0) sfx.buzzFirst();
        else sfx.buzzOther();
        return;
      }
      for (const q of s.queue) {
        const before = prev.outcomes.get(q.buzzId);
        if (before === "pending" && q.outcome === "wrong") return sfx.wrong();
        if (before === "pending" && q.outcome === "skipped") return sfx.skip();
      }
    }
    if (s.phase === "lobby" && s.teams.length > prev.teams) sfx.join();
  }, [s]);

  // The order of the buzzes is revealed with a little climbing sound, once the order is final.
  const revealedFor = useRef<string | null>(null);
  const revealQid = s?.phase === "question" ? (s.question?.id ?? null) : null;
  const queueLen = s?.queue.length ?? 0;
  useEffect(() => {
    if (!revealQid) {
      revealedFor.current = null;
      return;
    }
    if (queueLen > 0 && orderFinal && revealedFor.current !== revealQid) {
      revealedFor.current = revealQid;
      if (armedRef.current) sfx.reveal(queueLen);
    }
  }, [orderFinal, queueLen, revealQid]);

  // The question's sound, at the moment it opens.
  const openedSeen = useRef(false);
  const kindNow = s?.question?.kind;
  useEffect(() => {
    if (s?.phase !== "question") {
      openedSeen.current = false;
      return;
    }
    if (opened && !openedSeen.current) {
      openedSeen.current = true;
      if (armedRef.current && kindNow !== "audio") sfx.question();
    } else if (!opened) {
      openedSeen.current = false;
    }
  }, [opened, s?.phase, kindNow, questionId]);

  const serverNow = now + offset;
  const elapsed = s?.openedAt && opened ? serverNow - s.openedAt : 0;

  function renderPhase(st: LiveState) {
    switch (st.phase) {
      case "lobby":
        return (
          <Stage bg={T.bgs.lobby}>
            <div style={{ position: "absolute", left: 104, top: 70, fontFamily: BODY, fontWeight: 700, fontSize: 30, letterSpacing: 5, color: C.amber }}>{st.quizTitle.toUpperCase()}</div>
            <div style={{ position: "absolute", left: 104, top: 150, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(150), lineHeight: 1, color: C.cream }}>JOIN THE NIGHT</div>
            <div style={{ position: "absolute", left: 104, top: 340, fontFamily: BODY, fontSize: 44, color: C.muted }}>Scan the code, or go to <b style={{ color: C.cream }}>{joinUrl ? joinUrl.replace(/^https?:\/\//, "").replace(/\/play\/.*$/, "/play") : "itsolamco.in/play"}</b> and enter</div>
            <div style={{ position: "absolute", left: 104, top: 420, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(280), letterSpacing: 40, lineHeight: 1, color: C.amber }}>{st.code}</div>
            <div style={{ position: "absolute", right: 104, top: 120, width: 420, height: 420, background: C.cream, borderRadius: 28, padding: 18 }}>
              {qr ? <div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: qr }} /> : null}
            </div>
            <div style={{ position: "absolute", left: 104, right: 104, bottom: 70 }}>
              <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 26, letterSpacing: 4, color: C.muted, marginBottom: 18 }}>
                {st.teams.length === 0 ? "WAITING FOR THE FIRST TEAM" : `${st.teams.length} ${st.teams.length === 1 ? "TEAM" : "TEAMS"} IN`}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, maxHeight: 250, overflow: "hidden" }}>
                {st.teams.map((t) => (
                  <span key={t.id} style={{ fontFamily: BODY, fontWeight: 800, fontSize: 40, padding: "10px 28px", borderRadius: 999, background: C.panel, color: C.cream, animation: "olampop .4s ease-out" }}>
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          </Stage>
        );

      case "roundIntro":
        if (T.id === "falooda") {
          // The deck's round slide: bright teal, a huge "ROUND n", the round's name in the script font.
          return (
            <Stage bg={T.bgs.intro}>
              <Header s={st} labelColor={C.ink} />
              <div style={{ position: "absolute", left: 104, top: 168, fontFamily: BODY, fontWeight: 700, fontSize: 30, letterSpacing: 6, color: C.ink }}>
                ROUND {st.roundNo} OF {st.roundCount} · {st.questionCount} QUESTIONS
              </div>
              <div style={{ position: "absolute", left: 96, top: 210, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(300), lineHeight: 1, color: C.cream, animation: "olamrise .5s ease-out", whiteSpace: "nowrap" }}>ROUND {st.roundNo}</div>
              <div style={{ position: "absolute", left: 104, top: 500, fontFamily: T.ACCENT, fontSize: 110, lineHeight: 1.1, color: C.ink, whiteSpace: "nowrap" }}>{st.roundName}</div>
              <div style={{ position: "absolute", left: 104, top: 660, width: 1250, fontFamily: BODY, fontWeight: 600, fontSize: 36, lineHeight: 1.4, color: C.ink }}>{st.roundBlurb}</div>
              <div style={{ position: "absolute", left: 104, top: 900 }}>
                <PointsChips s={st} />
              </div>
              <div style={{ position: "absolute", right: 120, top: 560, width: 300, height: 300, borderRadius: "50%", background: C.red, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", transform: "rotate(-8deg)" }}>
                <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 24, letterSpacing: 4, color: C.cream }}>THE</div>
                <div style={{ fontFamily: T.ACCENT, fontSize: 56, lineHeight: 1.05, color: C.amber }}>Sweetest</div>
                <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 24, letterSpacing: 4, color: C.cream }}>AFFAIR</div>
              </div>
            </Stage>
          );
        }
        return (
          <Stage bg={T.bgs.intro}>
            <Header s={st} />
            <div style={{ position: "absolute", left: 104, top: 230, fontFamily: BODY, fontWeight: 700, fontSize: 32, letterSpacing: 6, color: C.amber }}>
              ROUND {st.roundNo} OF {st.roundCount} · {st.questionCount} QUESTIONS
            </div>
            <div style={{ position: "absolute", left: 104, top: 290, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(190), lineHeight: 1, color: C.cream, animation: "olamrise .5s ease-out" }}>{st.roundName}</div>
            <div style={{ position: "absolute", left: 104, top: 560, width: 1500, fontFamily: BODY, fontSize: 44, lineHeight: 1.4, color: C.muted }}>{st.roundBlurb}</div>
            <div style={{ position: "absolute", left: 104, top: 820 }}>
              <PointsChips s={st} />
            </div>
            <div style={{ position: "absolute", left: 104, bottom: 60, fontFamily: BODY, fontSize: 26, color: C.muted, opacity: 0.8 }}>Teams: buzz in first, then shout your answer.</div>
          </Stage>
        );

      case "question":
        if (!opened) {
          return (
            <Stage bg={T.bgs.question}>
              <Header s={st} />
              <GetReady s={st} offset={offset} />
            </Stage>
          );
        }
        return (
          <Stage bg={T.bgs.question}>
            <Header s={st} />
            <div style={{ position: "absolute", left: 104, top: 168, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(64), lineHeight: 1, color: C.amber }}>
              Q{st.questionNo}
              <span style={{ color: C.muted }}> / {st.questionCount}</span>
            </div>
            <div style={{ position: "absolute", right: 104, top: 160 }}>
              <PointsChips s={st} />
            </div>
            <QuestionBody s={st} />
            <QueueStrip s={st} elapsed={elapsed} serverNow={serverNow} locking={st.queue.length > 0 && !orderFinal} tie={orderFinal ? st.tie : null} />
          </Stage>
        );

      case "reveal":
        return (
          <Stage bg={T.bgs.reveal} color={C.ink}>
            <Brand onLight />
            <div style={{ position: "absolute", right: 104, top: 64, fontFamily: BODY, fontWeight: 700, fontSize: 26, letterSpacing: 3, textTransform: "uppercase", color: C.red }}>Round {st.roundNo} · {st.roundName}</div>
            <div style={{ position: "absolute", left: 104, top: 230, fontFamily: BODY, fontWeight: 700, fontSize: 36, letterSpacing: 6, color: C.red }}>NOBODY GOT IT · THE ANSWER</div>
            <div style={{ position: "absolute", left: 104, right: 104, top: 320, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(170), lineHeight: 1.05, color: C.red, animation: "olamrise .5s ease-out" }}>{st.answer?.text}</div>
            {st.answer?.note && <div style={{ position: "absolute", left: 104, top: 700, width: 1600, fontFamily: BODY, fontSize: 42, lineHeight: 1.4, color: C.soft }}>{st.answer.note}</div>}
          </Stage>
        );

      case "celebrate":
        return (
          <Stage bg={T.bgs.celebrate}>
            <Confetti />
            <Header s={st} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 210, textAlign: "center", fontFamily: BODY, fontWeight: 800, fontSize: 48, letterSpacing: 10, color: C.amber }}>CORRECT</div>
            <div style={{ position: "absolute", left: 80, right: 80, top: 290, textAlign: "center", fontFamily: DISPLAY, fontWeight: DW, fontSize: D(230), lineHeight: 1.05, color: C.cream, animation: "olampop .5s ease-out", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.celebration?.teamName}</div>
            <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", fontFamily: DISPLAY, fontWeight: DW, fontSize: D(260), lineHeight: 1, color: C.pos, animation: "olampop .7s .15s ease-out both" }}>{st.celebration?.points ? `+${st.celebration.points}` : "NICE!"}</div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, textAlign: "center", fontFamily: DISPLAY, fontWeight: DW, fontSize: D(80), color: C.amber }}>{st.celebration?.answer}</div>
            {st.celebration?.note && <div style={{ position: "absolute", left: 160, right: 160, bottom: 70, textAlign: "center", fontFamily: BODY, fontSize: 32, color: C.muted }}>{st.celebration.note}</div>}
          </Stage>
        );

      case "roundResults": {
        if (st.scoresHidden || !st.roundResult || !st.leaderboard) {
          return (
            <Stage bg={T.bgs.secret}>
              <Header s={st} />
              <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center", fontFamily: BODY, fontWeight: 700, fontSize: 32, letterSpacing: 8, color: C.amber }}>ROUND {st.roundNo} COMPLETE</div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center", fontFamily: DISPLAY, fontWeight: DW, fontSize: D(200), lineHeight: 1, color: C.cream }}>SCORES ARE SECRET</div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", fontFamily: BODY, fontSize: 44, color: C.muted }}>
                {st.roundNo < st.roundCount ? "The leaderboard comes back at the very end." : "The winners are revealed next."}
              </div>
            </Stage>
          );
        }
        const rows = st.roundResult.rows;
        const two = rows.length > 9;
        const half = Math.ceil(rows.length / 2);
        const cols = two ? [rows.slice(0, half), rows.slice(half)] : [rows];
        return (
          <Stage bg={T.bgs.results} color={C.ink}>
            <div style={{ position: "absolute", left: 104, top: 52, fontFamily: BODY, fontWeight: 700, fontSize: 26, letterSpacing: 3, textTransform: "uppercase", color: C.red }}>After round {st.roundNo} · {st.roundName}</div>
            <div style={{ position: "absolute", left: 104, top: 100, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(130), lineHeight: 1, color: C.ink }}>LEADERBOARD</div>
            <div style={{ position: "absolute", left: 104, right: 104, top: 290, display: "flex", gap: 56 }}>
              {cols.map((col, ci) => (
                <div key={ci} style={{ flex: 1, minWidth: 0 }}>
                  {col.map((r) => (
                    <div key={r.teamId} style={{ display: "flex", alignItems: "center", gap: 24, height: two ? 76 : 88, borderBottom: `2px solid ${C.rule}`, animation: "olamrise .4s ease-out" }}>
                      <span style={{ width: 70, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(56), color: r.rank === 1 ? C.red : C.ink }}>{r.rank}</span>
                      <span style={{ flex: 1, minWidth: 0, fontFamily: BODY, fontWeight: 800, fontSize: two ? 40 : 48, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 30, color: r.roundPoints < 0 ? C.red : C.good, minWidth: 90, textAlign: "right" }}>{r.roundPoints >= 0 ? `+${r.roundPoints}` : `−${Math.abs(r.roundPoints)}`}</span>
                      <span style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(60), minWidth: 130, textAlign: "right" }}>{r.total}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", right: 104, top: 150, fontFamily: BODY, fontSize: 26, color: C.soft }}>this round &nbsp;·&nbsp; total</div>
          </Stage>
        );
      }

      case "tiebreak":
      case "tiebreakReveal": {
        const t = st.tiebreak;
        if (!t) return <Stage><div /></Stage>;
        const reveal = st.phase === "tiebreakReveal";
        return (
          <Stage bg={reveal ? T.bgs.tieReveal : T.bgs.tie} color={reveal ? C.ink : C.cream}>
            <div style={{ position: "absolute", left: 104, top: 60, fontFamily: BODY, fontWeight: 700, fontSize: 30, letterSpacing: 6, color: reveal ? C.red : C.amber }}>TIE-BREAKER · CLOSEST NUMBER WINS</div>
            <div style={{ position: "absolute", left: 104, top: 130, width: 1650, fontFamily: BODY, fontWeight: 700, fontSize: 64, lineHeight: 1.22 }}>{t.prompt}</div>
            {!reveal ? (
              <>
                <div style={{ position: "absolute", left: 104, top: 560, fontFamily: BODY, fontSize: 40, color: C.muted }}>Teams in the tie: <b style={{ color: C.cream }}>{t.tied.map((x) => x.name).join(", ")}</b></div>
                <div style={{ position: "absolute", left: 104, top: 700, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(150), color: C.amber }}>
                  {t.guessedCount} OF {t.tied.length} <span style={{ color: C.muted }}>HAVE ANSWERED</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ position: "absolute", left: 104, top: 470, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(300), lineHeight: 1, color: C.red, animation: "olampop .6s ease-out" }}>{t.answer}</div>
                <div style={{ position: "absolute", left: 800, top: 480, right: 104 }}>
                  {[...t.guesses].sort((a, b) => Math.abs(a.value - Number(t.answer)) - Math.abs(b.value - Number(t.answer))).map((g) => (
                    <div key={g.teamId} style={{ display: "flex", justifyContent: "space-between", fontFamily: BODY, fontWeight: 800, fontSize: 46, padding: "6px 0", color: t.winners.includes(g.name) ? C.red : C.ink }}>
                      <span>{g.name}</span>
                      <span>{g.value} <span style={{ fontWeight: 600, fontSize: 30, opacity: 0.7 }}>({Math.abs(g.value - Number(t.answer))} off)</span></span>
                    </div>
                  ))}
                </div>
                <div style={{ position: "absolute", left: 104, bottom: 60, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(90), color: C.ink }}>{t.winners.length === 1 ? `${t.winners[0]} WINS THE TIE` : t.winners.length > 1 ? `${t.winners.join(" & ")} SHARE IT` : "NO ANSWERS"}</div>
              </>
            )}
          </Stage>
        );
      }

      case "ending": {
        const fal = T.id === "falooda";
        const eyebrow = fal ? C.ink : C.amber;
        const quiet = fal ? C.ink : C.muted;
        return (
          <Stage bg={T.bgs.ending}>
            <Confetti count={50} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontFamily: BODY, fontWeight: 700, fontSize: 34, letterSpacing: 10, color: eyebrow }}>{st.quizTitle.toUpperCase()}</div>
            <div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center", fontFamily: fal ? T.MALAYALAM : DISPLAY, fontWeight: fal ? 800 : DW, fontSize: fal ? 200 : D(230), lineHeight: 1.2, color: C.cream }}>നന്ദി!</div>
            <div style={{ position: "absolute", left: 200, right: 200, top: 400, textAlign: "center", fontFamily: BODY, fontWeight: 700, fontSize: 52, color: quiet }}>Thank you for playing. See you at the next one.</div>
            <div style={{ position: "absolute", left: 200, right: 200, top: 560, display: "flex", justifyContent: "center", alignItems: "center", gap: 120 }}>
              <div style={{ width: 300, height: 300, padding: 14, background: C.cream, borderRadius: 24 }}>
                {igQr ? <div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: igQr }} /> : null}
              </div>
              <div style={{ fontFamily: BODY }}>
                <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: 6, color: eyebrow }}>SCAN TO FOLLOW US ON INSTAGRAM</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(120), lineHeight: 1.1, color: C.cream, marginTop: 6 }}>{BUSINESS.instagramHandle}</div>
                <div style={{ fontSize: 34, color: quiet, marginTop: 6 }}>Tag us in your photos</div>
                <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: 6, color: eyebrow, marginTop: 40 }}>CATCH THE NEXT QUIZ NIGHT</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(90), lineHeight: 1.1, color: C.cream }}>itsolamco.in</div>
              </div>
            </div>
          </Stage>
        );
      }

      case "winners": {
        const lb = st.leaderboard ?? [];
        const top = lb.slice(0, 3);
        const rest = lb.slice(3, 11);
        return (
          <Stage bg={T.bgs.winners}>
            <Confetti count={90} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 60, textAlign: "center", fontFamily: BODY, fontWeight: 700, fontSize: 34, letterSpacing: 10, color: C.amber }}>{st.quizTitle.toUpperCase()}</div>
            <div style={{ position: "absolute", left: 0, right: 0, top: 110, textAlign: "center", fontFamily: DISPLAY, fontWeight: DW, fontSize: D(150), lineHeight: 1, color: C.cream }}>THE WINNERS</div>
            <div style={{ position: "absolute", left: 160, right: 160, top: 330 }}>
              {top.map((r, i) => (
                <div key={r.teamId} style={{ display: "flex", alignItems: "baseline", gap: 36, marginBottom: 18, animation: `olamrise .6s ${i * 0.2}s ease-out both` }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(i === 0 ? 150 : 100), color: i === 0 ? C.amber : C.cream, width: 130 }}>{r.rank}</span>
                  <span style={{ flex: 1, fontFamily: i === 0 && T.id === "falooda" ? T.ACCENT : BODY, fontWeight: 800, fontSize: i === 0 ? 110 : 70, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: i === 0 ? (T.id === "falooda" ? C.amber : C.cream) : C.muted }}>{r.name}</span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: DW, fontSize: D(i === 0 ? 130 : 80), color: i === 0 ? C.pos : C.cream }}>{r.score}</span>
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", left: 160, right: 160, bottom: 50, display: "flex", flexWrap: "wrap", gap: "6px 50px", fontFamily: BODY, fontSize: 30, color: C.muted }}>
              {rest.map((r) => (
                <span key={r.teamId}>{r.rank}. {r.name} <b style={{ color: C.cream }}>{r.score}</b></span>
              ))}
            </div>
          </Stage>
        );
      }
    }
  }

  return (
    <LiveThemeContext.Provider value={T}>
    <div style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden" }}>
      <style>{css}</style>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920, height: 1080, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center center" }}>
        {s ? renderPhase(s) : <div style={{ position: "absolute", inset: 0, background: C.bg, color: C.muted, fontFamily: BODY, fontSize: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>{error ? error.message : "Connecting..."}</div>}
        {!armed && (
          <button
            type="button"
            onClick={() => {
              unlockSounds();
              setArmed(true);
            }}
            style={{ position: "absolute", inset: 0, border: 0, cursor: "pointer", background: T.id === "falooda" ? C.bg : "#120E10", color: C.cream, fontFamily: DISPLAY, fontWeight: DW, fontSize: D(120), zIndex: 20 }}
          >
            CLICK TO START
            <div style={{ fontFamily: BODY, fontSize: 36, color: C.muted, marginTop: 20 }}>One click lets the songs play. Then use the quizmaster&apos;s phone.</div>
          </button>
        )}
        {/* The picture on screen never goes blank when the connection drops: it keeps the last good one and says so quietly. */}
        {s && (
          <div style={{ position: "absolute", right: 28, bottom: 20, zIndex: 15, fontFamily: BODY, opacity: conn === "good" ? 0.55 : 1, background: conn === "good" ? "transparent" : "rgba(0,0,0,.55)", padding: conn === "good" ? 0 : "6px 16px", borderRadius: 999, color: "#fff" }}>
            <ConnectionBadge state={conn} size={14} fontSize={22} showGood={false} />
            {conn === "good" && <span aria-hidden="true" style={{ display: "block", width: 14, height: 14, borderRadius: "50%", background: "#6BCB8B" }} />}
          </div>
        )}
      </div>
      {mutedShown && (
        <div style={{ position: "absolute", right: 16, bottom: 12, fontFamily: BODY, fontSize: 18, color: C.cream, background: "rgba(0,0,0,.6)", padding: "4px 12px", borderRadius: 8, zIndex: 25 }}>
          Sound effects off (press M)
        </div>
      )}
      <audio ref={audioRef} preload="auto" />
    </div>
    </LiveThemeContext.Provider>
  );
}
