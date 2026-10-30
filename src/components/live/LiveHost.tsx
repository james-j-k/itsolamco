"use client";

import { useState } from "react";
import type { HostAction, LiveState } from "@/lib/liveTypes";
import { clock, seconds, useLivePoll, useNow } from "./liveClient";

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

function HostPad({ sessionId }: { sessionId: string }) {
  const { state: s, error, offset, poke } = useLivePoll<LiveState>(`/api/admin/live/sessions/${sessionId}/state?view=host`, 700);
  const now = useNow(250);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showBoard, setShowBoard] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);

  async function act(a: HostAction) {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/live/sessions/${sessionId}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(data.error ?? "That didn't work.");
      poke();
    } catch {
      setMsg("Connection lost. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!s) {
    return <div style={{ minHeight: "100dvh", background: C.bg, color: C.muted, padding: 24 }}>{error ? error.message : "Connecting..."}</div>;
  }

  const serverNow = now + offset;
  const elapsed = s.openedAt ? serverNow - s.openedAt : 0;
  const answering = s.queue.find((q) => q.answering);
  const canSkipQ = s.canSkipQuestion;
  const waitSkip = Math.max(0, Math.ceil((s.skipAfterMs - elapsed) / 1000));
  const penalty = s.wrongPenalty > 0;

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.cream, padding: "16px 16px 40px", maxWidth: 560, margin: "0 auto", fontFamily: "var(--font-archivo), Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 28 }}>HOST</span>
        <span style={{ color: C.muted, fontSize: 13 }}>
          Code <b style={{ color: C.amber, letterSpacing: 3, fontSize: 18 }}>{s.code}</b> · {s.teams.length} teams
        </span>
      </div>
      {error && <div style={{ background: C.red, borderRadius: 10, padding: "6px 12px", fontSize: 13, marginBottom: 8 }}>{error.message}</div>}
      {msg && <div style={{ background: C.red, borderRadius: 10, padding: "8px 12px", fontSize: 14, marginBottom: 8 }}>{msg}</div>}

      {s.phase !== "lobby" && s.phase !== "winners" && (
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 10 }}>
          Round {s.roundNo}/{s.roundCount} · {s.roundName}
          {s.phase === "question" || s.phase === "reveal" || s.phase === "celebrate" ? ` · Q${s.questionNo}/${s.questionCount}` : ""} · +{s.rightPoints}
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
          <Btn big color={C.amber} text={C.bg} disabled={busy || s.teams.length === 0} onClick={() => act({ type: "start" })}>
            START THE QUIZ
          </Btn>
        </section>
      )}

      {s.phase === "roundIntro" && (
        <section>
          <div style={{ fontFamily: DISPLAY, fontSize: 40, lineHeight: 1.05 }}>{s.roundName}</div>
          <p style={{ color: C.muted, margin: "8px 0 16px" }}>{s.roundBlurb}</p>
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
            <div style={{ color: C.muted, fontSize: 12, letterSpacing: 2 }}>ANSWER</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 30, color: C.amber, lineHeight: 1.1 }}>{s.answer?.text}</div>
            {s.answer?.note && <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{s.answer.note}</div>}
            <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>Open for {clock(elapsed)}</div>
          </div>

          {answering ? (
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
              <div style={{ fontSize: 12, marginTop: 8, opacity: 0.8 }}>{penalty ? `Wrong or Skip: −${s.wrongPenalty}` : "Wrong or Skip: no points lost"}</div>
            </div>
          ) : (
            <div style={{ background: C.panel, borderRadius: 16, padding: 14, marginBottom: 12, color: C.muted }}>
              {s.queue.length === 0 ? "Buzzer is open. Waiting for a team to buzz..." : "Everyone who buzzed has had a go. The buzzer is still open for the others."}
            </div>
          )}

          {s.queue.length > 0 && (
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

          <div style={{ display: "grid", gap: 8 }}>
            <Btn disabled={busy || !canSkipQ} onClick={() => act({ type: "reveal" })}>
              {canSkipQ ? "Skip question (show the answer)" : s.queue.some((q) => q.outcome === "pending") ? "Skip question (finish the queue first)" : `Skip question (in ${waitSkip}s)`}
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
                {s.celebration?.teamName} +{s.celebration?.points}
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
          <div style={{ marginTop: 12 }}>
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
              <Btn big color={C.amber} text={C.bg} disabled={busy} onClick={() => act({ type: "continue" })}>
                SHOW THE WINNERS
              </Btn>
            </div>
          )}
        </section>
      )}

      {s.phase === "winners" && (
        <section>
          <div style={{ fontFamily: DISPLAY, fontSize: 36, marginBottom: 8 }}>WINNERS ON SCREEN</div>
          {!confirmFinish ? (
            <Btn disabled={busy || s.status === "finished"} onClick={() => setConfirmFinish(true)}>
              {s.status === "finished" ? "Night finished" : "End the night"}
            </Btn>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <Btn color={C.red} disabled={busy} onClick={() => act({ type: "finish" })}>
                Yes, end the night
              </Btn>
              <Btn onClick={() => setConfirmFinish(false)}>Cancel</Btn>
            </div>
          )}
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

      {s.phase !== "lobby" && s.phase !== "winners" && (
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
