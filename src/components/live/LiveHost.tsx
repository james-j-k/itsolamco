"use client";

import { useEffect, useRef, useState } from "react";
import { photoUrls, type HostAction, type LiveState } from "@/lib/liveTypes";
import { clock, connectionOf, seconds, useClockSync, useLivePoll, useNow, useOrderFinal, useReached, useWakeLock } from "./liveClient";
import { ConnectionBadge } from "./LiveConnection";

// The quizmaster's phone. Everything here is a big thumb-sized button.
const C = { bg: "#1C1512", panel: "#2A201B", cream: "#F5F0E6", amber: "#F2A93B", red: "#C0280A", muted: "#D9CBB8", green: "#3F9D5F" };
const DISPLAY = "var(--font-anton), Impact, sans-serif";

function Btn({ children, onClick, color = C.panel, text = C.cream, disabled, big }: { children: React.ReactNode; onClick: () => void; color?: string; text?: string; disabled?: boolean; big?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ background: color, color: text, border: 0, borderRadius: 16, padding: big ? "22px 12px" : "14px 12px", fontSize: big ? 22 : 16, fontWeight: 800, width: "100%", opacity: disabled ? 0.4 : 1, touchAction: "manipulation" }}
    >
      {children}
    </button>
  );
}

// A list of teams with a number box each. Before the first question it is for what each team already scored in rounds
// played off the system; at the end it is for fixing a team's final total. It saves when you tap away from a box.
function StartScores({
  teams,
  scores,
  busy,
  onSet,
  title = "Starting scores",
  help = "Played earlier rounds on paper? Type each team's score so far. It saves when you tap away, and counts toward the final total.",
  noun = "starting score",
  adjusted,
  bare = false,
  onPage = false,
}: {
  teams: { id: string; name: string }[];
  scores: Map<string, number>;
  busy: boolean;
  onSet: (teamId: string, points: number) => Promise<boolean>;
  title?: string;
  help?: string;
  noun?: string;
  adjusted?: Map<string, number>; // how much each team's score has already been corrected by
  bare?: boolean; // no panel around it (it sits inside something else)
  onPage?: boolean; // it sits straight on the page, so the number boxes need a visible edge
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const dropDraft = (id: string) => setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== id)));
  // A typed value stays on screen until the server's score catches up, so it never flickers back to the old number.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drops the typed value once the saved score matches it
    setDraft((d) => {
      const keep = Object.entries(d).filter(([id, v]) => Number(v) !== (scores.get(id) ?? 0));
      return keep.length === Object.keys(d).length ? d : Object.fromEntries(keep);
    });
  }, [scores]);
  function commit(id: string) {
    const raw = (draft[id] ?? "").trim();
    const n = Number(raw);
    if (raw === "" || raw === "-" || !Number.isInteger(n) || n === (scores.get(id) ?? 0)) {
      dropDraft(id);
      return;
    }
    void onSet(id, n).then((saved) => {
      if (!saved) dropDraft(id);
    });
  }
  return (
    <div style={bare ? { marginTop: 8 } : { background: C.panel, borderRadius: 16, padding: 14, marginBottom: 16 }}>
      {title && <div style={{ fontWeight: 800, marginBottom: 2 }}>{title}</div>}
      {help && <div style={{ color: C.muted, fontSize: 13, marginBottom: 10 }}>{help}</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {teams.map((t) => (
          <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
              {adjusted?.get(t.id) ? <span style={{ display: "block", color: C.amber, fontSize: 12 }}>fixed by {adjusted.get(t.id)! > 0 ? "+" : ""}{adjusted.get(t.id)} so far</span> : null}
            </span>
            <input
              type="text"
              inputMode="numeric"
              aria-label={`${t.name} ${noun}`}
              disabled={busy}
              value={draft[t.id] ?? String(scores.get(t.id) ?? 0)}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setDraft((d) => ({ ...d, [t.id]: e.target.value.replace(/[^0-9-]/g, "") }))}
              onBlur={() => commit(t.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              style={{ width: 90, background: onPage ? C.panel : C.bg, color: C.amber, border: onPage ? `1px solid ${C.muted}` : 0, borderRadius: 10, padding: "10px 12px", fontSize: 20, fontWeight: 800, textAlign: "right" }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

type Health = { now: number; teams: { teamId: string; name: string; seenAt: number | null; rttMs: number | null; offsetMs: number | null }[] };

// How each team's phone is connected, checked before the night starts (and any time after). The phones check in every
// few seconds with how long their round trips take; "clock" is how far off the phone's clock could be once corrected.
function TeamHealth({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const res = await fetch(`/api/admin/live/sessions/${sessionId}/health`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error("bad answer");
        const d = (await res.json()) as Health;
        if (!stopped) {
          setData(d);
          setFailed(false);
        }
      } catch {
        if (!stopped) setFailed(true);
      }
    }
    void load();
    const every = setInterval(load, 4000);
    return () => {
      stopped = true;
      clearInterval(every);
    };
  }, [sessionId]);

  if (!data) return <div style={{ color: C.muted, fontSize: 13 }}>{failed ? "Couldn't load the connections. Trying again..." : "Checking the phones..."}</div>;

  const rows = data.teams.map((t) => {
    const age = t.seenAt === null ? null : data.now - t.seenAt;
    const state: "good" | "slow" | "offline" = age === null || age > 35_000 ? "offline" : age > 20_000 || (t.rttMs ?? 0) > 900 ? "slow" : "good";
    return { ...t, age, state };
  });
  const dot = { good: "#6BCB8B", slow: C.amber, offline: "#E5484D" } as const;
  const ready = rows.filter((r) => r.state === "good").length;
  return (
    <div>
      <div style={{ fontWeight: 800, marginBottom: 8, color: ready === rows.length && rows.length > 0 ? "#6BCB8B" : C.cream }}>
        {rows.length === 0 ? "No teams yet" : `${ready} of ${rows.length} ${rows.length === 1 ? "team" : "teams"} ready`}
        {failed && <span style={{ color: C.amber, fontWeight: 400, fontSize: 12 }}> · connection to the server is shaky</span>}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {rows.map((r) => (
          <div key={r.teamId} style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel, borderRadius: 12, padding: "8px 12px" }}>
            <span aria-hidden="true" style={{ flex: "none", width: 12, height: 12, borderRadius: "50%", background: dot[r.state] }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
              <div style={{ color: C.muted, fontSize: 12 }}>
                {r.age === null
                  ? "Not seen yet. Is the phone on the page?"
                  : `${r.rttMs !== null ? `ping ${r.rttMs} ms · clock ±${Math.round(r.rttMs / 2)} ms · ` : ""}${r.age < 2000 ? "just now" : `${Math.round(r.age / 1000)}s ago`}${r.state === "offline" ? " · no signal" : r.state === "slow" ? " · weak" : ""}`}
              </div>
            </div>
          </div>
        ))}
      </div>
      {rows.some((r) => r.state !== "good") && <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Ask teams with an amber or red dot to move near a window, or switch to mobile data.</div>}
    </div>
  );
}

function HostPad({ sessionId }: { sessionId: string }) {
  const fastRef = useRef(false); // poll faster while the order of the buzzes is being locked in
  const { state: s, error, offset: pollOffset, confirmedAt, failures, poke } = useLivePoll<LiveState>(`/api/admin/live/sessions/${sessionId}/state?view=host`, () => (fastRef.current ? 250 : 700));
  useWakeLock(); // the quizmaster's phone must not lock itself mid-quiz
  const sync = useClockSync();
  const conn = connectionOf(failures, sync.rtt);
  const offset = sync.ready ? sync.offset : pollOffset;
  const now = useNow(250);
  const opened = useReached(s?.phase === "question" ? s.openedAt : null, offset);
  const orderFinal = useOrderFinal(s?.phase === "question" ? s.lockUntil : null, confirmedAt, offset);
  useEffect(() => {
    fastRef.current = s?.phase === "question" && s.lockUntil !== null && !orderFinal;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [notice, setNotice] = useState(""); // a tap that was ignored because the night had already moved on: not an error
  const [sending, setSending] = useState<"idle" | "sending" | "done" | "failed">("idle");
  const [showBoard, setShowBoard] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [reviewWinners, setReviewWinners] = useState(false); // "Show winners" first asks you to check the final scores

  if (!s) {
    return <div style={{ minHeight: "100dvh", background: C.bg, color: C.muted, padding: 24 }}>{error ? error.message : "Connecting..."}</div>;
  }

  // Every tap says which step of the night it was made on. If the night has moved on by the time it arrives
  // (slow signal, a double tap, a retry) the server ignores it, so a repeat can never skip a question.
  async function act(a: HostAction): Promise<boolean> {
    if (busy || !s) return false;
    setBusy(true);
    setMsg("");
    setNotice("");
    setSending("sending");
    try {
      const res = await fetch(`/api/admin/live/sessions/${sessionId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...a, expect: { step: s.step, version: s.version } }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSending("done");
        setTimeout(() => setSending((x) => (x === "done" ? "idle" : x)), 1500);
      } else if (data.stale) {
        setNotice(data.error ?? "The screen had already moved on.");
        setSending("idle");
      } else {
        setMsg(data.error ?? "That didn't work.");
        setSending("failed");
      }
      poke();
      return res.ok;
    } catch {
      setMsg("No answer from the server. Look at the screen to see if it went through, then tap again if not. Tapping twice is safe.");
      setSending("failed");
      poke();
      return false;
    } finally {
      setBusy(false);
    }
  }

  const serverNow = now + offset;
  const elapsed = s.openedAt && opened ? serverNow - s.openedAt : 0;
  const opensIn = s.openedAt && !opened ? Math.max(1, Math.ceil((s.openedAt - serverNow) / 1000)) : 0;
  // The team that is answering only counts once the order of the buzzes is final (a moment after the first buzz).
  const lockingIn = s.queue.length > 0 && !orderFinal;
  const answering = orderFinal ? s.queue.find((q) => q.answering) : undefined;
  // Seconds the team that is answering has left before the next team is up.
  const turnLeft = answering && s.phaseUntil ? Math.max(0, Math.ceil((s.phaseUntil - serverNow) / 1000)) : null;
  const penalty = s.wrongPenalty > 0;
  // Before the first question nothing else has scored, so a team's total is its starting score.
  const scoreOf = new Map((s.leaderboard ?? []).map((r) => [r.teamId, r.score]));
  const adjustedOf = new Map(s.adjusted.map((a) => [a.teamId, a.points]));
  // The boxes for fixing a team's total score. A fix is saved as an adjustment, so it can always be seen afterwards.
  const fixScores = (opts: { bare?: boolean; onPage?: boolean; title?: string; help?: string } = {}) => (
    <StartScores
      teams={s.teams}
      scores={scoreOf}
      adjusted={adjustedOf}
      busy={busy}
      noun="total score"
      bare={opts.bare}
      onPage={opts.onPage}
      title={opts.title ?? ""}
      help={opts.help ?? ""}
      onSet={(teamId, total) => act({ type: "setTotal", teamId, total })}
    />
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.cream, padding: "16px 16px 40px", maxWidth: 560, margin: "0 auto", fontFamily: "var(--font-archivo), Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 28 }}>HOST</span>
        <span style={{ color: C.muted, fontSize: 13 }}>
          Code <b style={{ color: C.amber, letterSpacing: 3, fontSize: 18 }}>{s.code}</b> · {s.teams.length} teams
        </span>
      </div>
      <div style={{ marginBottom: 8, color: C.muted, display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 30 }}>
        <ConnectionBadge state={conn} size={10} fontSize={13} />
        {/* What the last tap did. It sits here, in line, so it never covers the code or a button. */}
        {sending !== "idle" && (
          <span role="status" style={{ borderRadius: 999, padding: "4px 14px", fontSize: 13, fontWeight: 800, background: sending === "done" ? C.green : sending === "failed" ? C.red : C.amber, color: sending === "sending" ? C.bg : C.cream }}>
            {sending === "sending" ? "Sending..." : sending === "done" ? "Done ✓" : "Not confirmed"}
          </span>
        )}
      </div>
      {error && <div style={{ background: C.red, borderRadius: 10, padding: "6px 12px", fontSize: 13, marginBottom: 8 }}>{error.message}</div>}
      {msg && <div style={{ background: C.red, borderRadius: 10, padding: "8px 12px", fontSize: 14, marginBottom: 8 }}>{msg}</div>}
      {notice && <div style={{ background: C.panel, color: C.amber, borderRadius: 10, padding: "8px 12px", fontSize: 14, marginBottom: 8 }}>{notice}</div>}

      {reviewWinners && s.phase !== "lobby" && (
        <section style={{ background: C.panel, borderRadius: 16, padding: 14, marginBottom: 12, border: `2px solid ${C.amber}` }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 26, color: C.amber }}>BEFORE THE WINNERS</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>Check each team&apos;s total. Fix any that is wrong (it saves when you tap away), then show the winners.</div>
          {fixScores({ bare: true })}
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <Btn
              big
              color={C.amber}
              text={C.bg}
              disabled={busy}
              onClick={async () => {
                if (await act({ type: "showWinners" })) setReviewWinners(false);
              }}
            >
              Show winners now
            </Btn>
            <Btn disabled={busy} onClick={() => setReviewWinners(false)}>
              Cancel
            </Btn>
          </div>
        </section>
      )}

      {s.phase !== "lobby" && (
        <section style={{ marginBottom: 12 }}>
          {s.slide && s.status !== "finished" && (
            <div style={{ background: C.panel, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <div style={{ color: C.amber, fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>{s.slide === "ending" ? "THANK-YOU SLIDE ON SCREEN" : "WINNERS SLIDE ON SCREEN"}</div>
              <div style={{ color: C.muted, fontSize: 13, margin: "4px 0 10px" }}>The quiz is paused and buzzers are closed. Nothing is lost.</div>
              <Btn big color={C.amber} text={C.bg} disabled={busy} onClick={() => act({ type: "reopen" })}>
                Back to the quiz
              </Btn>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Btn disabled={busy || s.slide === "winners"} onClick={() => setReviewWinners(true)}>
              Show winners
            </Btn>
            <Btn disabled={busy || s.slide === "ending"} onClick={() => act({ type: "showEnding" })}>
              Show thank-you
            </Btn>
          </div>
        </section>
      )}

      {s.phase !== "lobby" && s.phase !== "winners" && s.phase !== "ending" && (
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 10 }}>
          Round {s.roundNo}/{s.roundCount} · {s.roundName}
          {s.phase === "question" || s.phase === "reveal" || s.phase === "celebrate" ? ` · Q${s.questionNo}/${s.questionCount}` : ""} · {s.rightPoints === 0 ? "practice, no points" : `+${s.rightPoints}`}
          {penalty ? ` / −${s.wrongPenalty}` : ""}
        </div>
      )}

      {s.phase === "lobby" && (
        <section>
          <p style={{ color: C.muted, marginBottom: 12 }}>
            {s.teams.length === 0 ? "No teams yet. Show the projector and let them scan." : `${s.teams.length} teams are in.`}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {s.teams.map((t) => (
              <span key={t.id} style={{ background: C.panel, borderRadius: 999, padding: "6px 14px", fontWeight: 700 }}>
                {t.name}
              </span>
            ))}
          </div>
          {s.teams.length > 0 && (
            <div style={{ background: C.panel, borderRadius: 16, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 2 }}>Team connections</div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 10 }}>Check every phone before you start. Each one should be green.</div>
              <TeamHealth sessionId={sessionId} />
            </div>
          )}
          {s.teams.length > 0 && <StartScores teams={s.teams} scores={scoreOf} busy={busy} onSet={(teamId, points) => act({ type: "setCarry", teamId, points })} />}
          <Btn big color={C.amber} text={C.bg} disabled={busy || s.teams.length === 0} onClick={() => act({ type: "start" })}>
            START THE QUIZ
          </Btn>
        </section>
      )}

      {s.phase === "roundIntro" && (
        <section>
          <div style={{ fontFamily: DISPLAY, fontSize: 40, lineHeight: 1.05 }}>{s.roundName}</div>
          <p style={{ color: C.muted, margin: "8px 0 16px" }}>{s.roundBlurb}</p>
          {s.roundNo === 1 && s.teams.length > 0 && <StartScores teams={s.teams} scores={scoreOf} busy={busy} onSet={(teamId, points) => act({ type: "setCarry", teamId, points })} />}
          <Btn big color={C.amber} text={C.bg} disabled={busy} onClick={() => act({ type: "continue" })}>
            OPEN THE FIRST QUESTION
          </Btn>
        </section>
      )}

      {s.phase === "question" && (
        <section>
          <div style={{ background: C.panel, borderRadius: 16, padding: 14, marginBottom: 12 }}>
            <div style={{ color: C.muted, fontSize: 12, letterSpacing: 2 }}>QUESTION</div>
            <div style={{ fontWeight: 700, margin: "4px 0 10px" }}>{s.question?.prompt}</div>
            {s.question?.kind === "image" && (
              // which photo is up, so the quizmaster can check the projector matches
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrls(s.question.audioUrl)[0]} alt="Photo on the screen" style={{ display: "block", height: 110, maxWidth: "100%", objectFit: "contain", borderRadius: 10, marginBottom: 10 }} />
            )}
            <div style={{ color: C.muted, fontSize: 12, letterSpacing: 2 }}>ANSWER</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 30, color: C.amber, lineHeight: 1.1 }}>{s.answer?.text}</div>
            {s.answer?.note && <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{s.answer.note}</div>}
            <div style={{ color: opened ? C.muted : C.amber, fontSize: 13, marginTop: 8, fontWeight: opened ? 400 : 800 }}>{opened ? `Open for ${clock(elapsed)}` : `Buzzer opens in ${opensIn}...`}</div>
          </div>

          {s.tie && orderFinal ? (
            <div style={{ background: C.amber, color: C.bg, borderRadius: 16, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 800 }}>TIE · TOO CLOSE TO CALL</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 32, lineHeight: 1.1, margin: "4px 0 12px" }}>Who goes first?</div>
              <div style={{ display: "grid", gap: 8 }}>
                {s.tie.buzzIds.map((id, i) => (
                  <Btn key={id} big color={C.bg} text={C.cream} disabled={busy} onClick={() => act({ type: "settleTie", buzzId: id })}>
                    {s.tie?.teams[i]} first
                  </Btn>
                ))}
              </div>
              <div style={{ fontSize: 12, marginTop: 8, opacity: 0.8 }}>They buzzed within 0.1 s of each other. The other team goes next.</div>
            </div>
          ) : answering ? (
            <div style={{ background: C.amber, color: C.bg, borderRadius: 16, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 800 }}>ANSWERING NOW · #{answering.place + 1} · {answering.place === 0 ? seconds(answering.atMs) : `+${seconds(answering.gapMs)}`}</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 38, lineHeight: 1.05, margin: "4px 0 12px" }}>{answering.teamName}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Btn big color={C.green} onClick={() => act({ type: "correct", buzzId: answering.buzzId })} disabled={busy}>
                  Correct
                </Btn>
                <Btn big color={C.red} onClick={() => act({ type: "wrong", buzzId: answering.buzzId })} disabled={busy}>
                  Wrong
                </Btn>
                <Btn big color={C.bg} onClick={() => act({ type: "skip", buzzId: answering.buzzId })} disabled={busy}>
                  Skip
                </Btn>
              </div>
              <div style={{ fontSize: 12, marginTop: 8, opacity: 0.8 }}>
                {penalty ? `Wrong or Skip: −${s.wrongPenalty}` : "Wrong or Skip: no points lost"}
                {turnLeft !== null && ` · No answer in ${turnLeft}s passes to the next team${penalty ? ` (−${s.wrongPenalty})` : ""}`}
              </div>
            </div>
          ) : (
            <div style={{ background: C.panel, borderRadius: 16, padding: 14, marginBottom: 12, color: lockingIn ? C.amber : C.muted, fontWeight: lockingIn ? 800 : 400 }}>
              {!opened
                ? "Get ready. The buzzer opens on every phone and the projector at the same moment."
                : lockingIn
                  ? `${s.queue.length} ${s.queue.length === 1 ? "team has" : "teams have"} buzzed. Locking in the order...`
                  : s.queue.length === 0
                    ? "Buzzer is open. Waiting for a team to buzz..."
                    : "Everyone who buzzed has had a go. The buzzer is still open for the others."}
            </div>
          )}

          {s.queue.length > 0 && orderFinal && (
            <ol style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
              {s.queue.map((q) => (
                <li key={q.buzzId} style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px", borderBottom: `1px solid ${C.panel}`, opacity: q.outcome === "pending" ? 1 : 0.55 }}>
                  <span>
                    <b>{q.place + 1}.</b> {q.teamName} <span style={{ color: C.muted, fontSize: 13 }}>{q.outcome !== "pending" ? q.outcome : ""}</span>
                  </span>
                  <span style={{ color: C.muted }}>{q.place === 0 ? seconds(q.atMs) : `+${seconds(q.gapMs)}`}</span>
                </li>
              ))}
            </ol>
          )}

          <details style={{ marginBottom: 12 }}>
            <summary style={{ color: C.muted, fontSize: 14 }}>A team&apos;s buzz didn&apos;t get through?</summary>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {s.teams.map((t) => {
                const q = s.queue.find((x) => x.teamId === t.id);
                const hadGo = !!q && q.outcome !== "pending";
                const small = { background: C.panel, color: C.cream, border: 0, borderRadius: 10, padding: "10px 12px", fontWeight: 800, fontSize: 14, touchAction: "manipulation" } as const;
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, opacity: hadGo ? 0.45 : 1 }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>
                      {t.name}
                      {q ? <span style={{ color: C.muted, fontWeight: 400 }}> · {hadGo ? q.outcome : `#${q.place + 1}`}</span> : null}
                    </span>
                    <button
                      type="button"
                      disabled={busy || hadGo || !opened}
                      style={small}
                      onClick={() => {
                        if (window.confirm(`Put ${t.name} first in the queue?`)) act({ type: "buzzFor", teamId: t.id, position: "first" });
                      }}
                    >
                      Put first
                    </button>
                    <button
                      type="button"
                      disabled={busy || !!q || !opened}
                      style={small}
                      onClick={() => {
                        if (window.confirm(`Add ${t.name} to the end of the queue?`)) act({ type: "buzzFor", teamId: t.id, position: "last" });
                      }}
                    >
                      Put last
                    </button>
                  </div>
                );
              })}
            </div>
          </details>

          <div style={{ display: "grid", gap: 8 }}>
            <Btn color={answering ? C.panel : C.amber} text={answering ? C.cream : C.bg} disabled={busy || !s.canSkipQuestion} onClick={() => act({ type: "reveal" })}>
              {answering ? "Skip question (show the answer now)" : s.queue.length === 0 ? "Nobody buzzed: show the answer" : "Skip question (show the answer)"}
            </Btn>
            <Btn disabled={busy} onClick={() => act({ type: "undo" })}>
              Undo last action
            </Btn>
          </div>
        </section>
      )}

      {(s.phase === "celebrate" || s.phase === "reveal") && (
        <section style={{ background: C.panel, borderRadius: 16, padding: 16, marginBottom: 12 }}>
          {s.phase === "celebrate" ? (
            <>
              <div style={{ color: C.amber, letterSpacing: 2, fontSize: 12, fontWeight: 800 }}>CORRECT</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 34 }}>
                {s.celebration?.teamName}{s.celebration?.points ? ` +${s.celebration.points}` : ""}
              </div>
              <div style={{ color: C.muted }}>Next question coming up...</div>
            </>
          ) : (
            <>
              <div style={{ color: C.amber, letterSpacing: 2, fontSize: 12, fontWeight: 800 }}>ANSWER ON SCREEN</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 34 }}>{s.answer?.text}</div>
              <div style={{ color: C.muted }}>Next question coming up...</div>
            </>
          )}
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <Btn color={C.amber} text={C.bg} disabled={busy} onClick={() => act({ type: "continue" })}>
              {s.questionNo < s.questionCount ? "Next question now" : "Show the round results"}
            </Btn>
            <Btn disabled={busy} onClick={() => act({ type: "undo" })}>
              Undo
            </Btn>
          </div>
        </section>
      )}

      {s.phase === "roundResults" && (
        <section>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, marginBottom: 6 }}>ROUND {s.roundNo} DONE</div>
          <p style={{ color: C.muted, marginBottom: 12 }}>{s.scoresHidden ? "The room sees a SECRET screen. The scores below are for you only." : "The leaderboard is on the projector."}</p>
          {s.roundNo === s.roundCount ? (
            // The last round: this is the moment to check the final scores, before the winners are shown.
            <div style={{ background: C.panel, borderRadius: 16, padding: 14, marginBottom: 14, border: `2px solid ${C.amber}` }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 24, color: C.amber }}>CHECK THE FINAL SCORES</div>
              <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>Fix any total that is wrong (it saves when you tap away). Next comes the tie-breaker if two teams are level, otherwise the winners.</div>
              {fixScores({ bare: true })}
            </div>
          ) : (
            <details style={{ marginBottom: 12 }}>
              <summary style={{ color: C.amber, fontWeight: 800 }}>Edit scores</summary>
              {fixScores({ bare: true, onPage: true, help: "Fix any total that is wrong. It saves when you tap away." })}
            </details>
          )}
          <Btn big color={C.amber} text={C.bg} disabled={busy} onClick={() => act({ type: "continue" })}>
            {s.roundNo < s.roundCount ? "NEXT ROUND" : "CONTINUE"}
          </Btn>
          <div style={{ marginTop: 8 }}>
            <Btn disabled={busy} onClick={() => act({ type: "undo" })}>
              Undo last action
            </Btn>
          </div>
        </section>
      )}

      {(s.phase === "tiebreak" || s.phase === "tiebreakReveal") && s.tiebreak && (
        <section>
          <div style={{ fontFamily: DISPLAY, fontSize: 30, marginBottom: 6 }}>TIE-BREAKER</div>
          <p style={{ marginBottom: 8 }}>{s.tiebreak.prompt}</p>
          <p style={{ color: C.muted, marginBottom: 12 }}>
            Tied: {s.tiebreak.tied.map((t) => t.name).join(", ")} · {s.tiebreak.guessedCount}/{s.tiebreak.tied.length} answered
          </p>
          {s.tiebreak.guesses.map((g) => (
            <div key={g.teamId} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>{g.name}</span>
              <b>{g.value}</b>
            </div>
          ))}
          {s.phase === "tiebreak" ? (
            <div style={{ marginTop: 12 }}>
              <Btn big color={C.amber} text={C.bg} disabled={busy} onClick={() => act({ type: "continue" })}>
                REVEAL THE ANSWER{s.tiebreak.guessedCount < s.tiebreak.tied.length ? ` (${s.tiebreak.tied.length - s.tiebreak.guessedCount} still to answer)` : ""}
              </Btn>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: C.amber, fontFamily: DISPLAY, fontSize: 28, marginBottom: 10 }}>Answer {s.tiebreak.answer}</div>
              <details style={{ marginBottom: 12 }}>
                <summary style={{ color: C.amber, fontWeight: 800 }}>Edit scores before the winners</summary>
                {fixScores({ bare: true, onPage: true, help: "Fix any total that is wrong. It saves when you tap away." })}
              </details>
              <Btn big color={C.amber} text={C.bg} disabled={busy} onClick={() => act({ type: "continue" })}>
                SHOW THE WINNERS
              </Btn>
            </div>
          )}
        </section>
      )}

      {(s.phase === "winners" || s.phase === "ending") && (
        <section>
          <div style={{ fontFamily: DISPLAY, fontSize: 36, marginBottom: 8 }}>{s.phase === "ending" ? "THANK-YOU SLIDE ON SCREEN" : "WINNERS ON SCREEN"}</div>
          {s.phase === "winners" && (
            <details style={{ marginBottom: 12 }}>
              <summary style={{ color: C.amber, fontWeight: 800 }}>Spotted a wrong score? Fix it</summary>
              {fixScores({ bare: true, onPage: true, help: "The winners screen updates as soon as you tap away from a box." })}
            </details>
          )}
          {!confirmFinish ? (
            <Btn disabled={busy || s.status === "finished"} onClick={() => setConfirmFinish(true)}>
              {s.status === "finished" ? "Night finished" : "End the night"}
            </Btn>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <Btn color={C.red} disabled={busy} onClick={async () => { if (await act({ type: "finish" })) setConfirmFinish(false); }}>
                Yes, end the night
              </Btn>
              <Btn onClick={() => setConfirmFinish(false)}>Cancel</Btn>
            </div>
          )}
        </section>
      )}

      {/* A way back from every step that has no Undo of its own above. */}
      {s.slide === null && s.status !== "finished" && (s.phase === "roundIntro" || s.phase === "tiebreak" || s.phase === "tiebreakReveal" || s.phase === "winners") && (
        <div style={{ marginTop: 12 }}>
          <Btn disabled={busy} onClick={() => act({ type: "undo" })}>
            Undo: go back one step
          </Btn>
        </div>
      )}
      {s.status === "finished" && (
        <section style={{ marginTop: 12 }}>
          <div style={{ color: C.muted, fontSize: 14, marginBottom: 8 }}>The night is ended. Ended it by mistake? Carry on from exactly where it stopped.</div>
          <Btn color={C.amber} text={C.bg} disabled={busy} onClick={() => act({ type: "reopen" })}>
            Reopen the night
          </Btn>
        </section>
      )}

      {/* The quizmaster always sees the real scores, even when the room does not. */}
      {s.leaderboard && s.phase !== "lobby" && (
        <section style={{ marginTop: 20 }}>
          <button type="button" onClick={() => setShowBoard((v) => !v)} style={{ background: "none", border: 0, color: C.amber, fontWeight: 800, fontSize: 15, padding: 0 }}>
            {showBoard ? "Hide" : "Show"} private leaderboard
          </button>
          {showBoard && (
            <ol style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
              {s.leaderboard.map((r) => (
                <li key={r.teamId} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.panel}` }}>
                  <span>
                    {r.rank}. {r.name}
                  </span>
                  <b>{r.score}</b>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {s.phase !== "lobby" && s.phase !== "winners" && s.phase !== "ending" && (
        <section style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${C.panel}` }}>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 6 }}>Scoreboard hidden from the room from round</div>
          <select
            value={s.hideFromRound}
            onChange={(e) => act({ type: "setHide", hideFromRound: Number(e.target.value) })}
            style={{ background: C.panel, color: C.cream, border: 0, borderRadius: 10, padding: "10px 12px", fontSize: 16, width: "100%" }}
          >
            {Array.from({ length: s.roundCount + 1 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n <= s.roundCount ? `Round ${n}` : "Never hide"}
              </option>
            ))}
          </select>
          {s.teams.length > 0 && (
            <details style={{ marginTop: 14 }} onToggle={(e) => setHealthOpen(e.currentTarget.open)}>
              <summary style={{ color: C.muted, fontSize: 14 }}>Team connections</summary>
              <div style={{ marginTop: 8 }}>{healthOpen && <TeamHealth sessionId={sessionId} />}</div>
            </details>
          )}
          {s.teams.length > 0 && (
            <details style={{ marginTop: 14 }}>
              <summary style={{ color: C.muted, fontSize: 14 }}>Release a team&apos;s buzzer (lost phone)</summary>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {s.teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Let ${t.name} join again from a new phone?`)) act({ type: "release", teamId: t.id });
                    }}
                    style={{ background: C.panel, color: C.cream, border: 0, borderRadius: 10, padding: "10px 12px", textAlign: "left", fontWeight: 700 }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {/* Always within reach: stop the night at any point (it goes to the winners screen with the scores so far). */}
      {s.phase !== "winners" && s.phase !== "ending" && s.status !== "finished" && (
        <section style={{ marginTop: 24, paddingTop: 14, borderTop: `1px solid ${C.panel}` }}>
          {!confirmFinish ? (
            <Btn disabled={busy} onClick={() => setConfirmFinish(true)}>
              End the quiz night
            </Btn>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: C.muted, fontSize: 14 }}>This stops the quiz and shows the winners screen with the scores so far.</div>
              <Btn color={C.red} disabled={busy} onClick={async () => { if (await act({ type: "finish" })) setConfirmFinish(false); }}>
                Yes, end it now
              </Btn>
              <Btn onClick={() => setConfirmFinish(false)}>Cancel</Btn>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// Full-bleed, so the admin page header and padding around it don't get in the way on a phone.
export default function LiveHost({ sessionId }: { sessionId: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, overflowY: "auto", background: C.bg, zIndex: 30 }}>
      <HostPad sessionId={sessionId} />
    </div>
  );
}
