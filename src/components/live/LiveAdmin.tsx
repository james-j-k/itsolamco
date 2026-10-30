"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Quiz = { id: string; title: string; rounds: number; questions: number };
type Session = { id: string; code: string; quizTitle: string; teams: number; status: string; createdAt: string };

const card = "border-2 border-[#1C1712] bg-white p-4 mb-3";
const btn = "bg-[#1C1712] text-[#F5F0E6] px-4 py-2 font-mono text-xs uppercase tracking-widest disabled:opacity-40";
const link = "underline underline-offset-2 text-[#B8451D] font-semibold";

export default function LiveAdmin({ quizzes, sessions }: { quizzes: Quiz[]; sessions: Session[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [json, setJson] = useState("");

  async function createSession(quizId: string) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/live/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quizId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error ?? "Couldn't start a night.");
        return;
      }
      router.refresh();
    } catch {
      setMsg("Connection lost. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function endNight(id: string) {
    if (!window.confirm("End this quiz night? The projector goes to the winners screen and no one can buzz any more.")) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/live/sessions/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "finish" }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error ?? "Couldn't end the night.");
        return;
      }
      setMsg("Night ended.");
      router.refresh();
    } catch {
      setMsg("Connection lost. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function importQuiz() {
    setBusy(true);
    setMsg("");
    try {
      let body: unknown;
      try {
        body = JSON.parse(json);
      } catch {
        setMsg("That isn't valid JSON.");
        return;
      }
      const res = await fetch("/api/admin/live/quizzes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`${data.error ?? "Import failed."} ${data.issues ? JSON.stringify(data.issues.fieldErrors ?? data.issues).slice(0, 300) : ""}`);
        return;
      }
      setJson("");
      setMsg("Quiz imported.");
      router.refresh();
    } catch {
      setMsg("Connection lost. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {msg && <div className="border-2 border-[#B8451D] bg-[#FBE9E2] p-3 mb-4 text-sm">{msg}</div>}

      <h2 className="font-mono text-xs uppercase tracking-widest text-[#8C8477] mb-2">Start a night</h2>
      {quizzes.length === 0 && <p className="text-sm mb-3">No quizzes yet. Import one below.</p>}
      {quizzes.map((q) => (
        <div key={q.id} className={`${card} flex items-center justify-between gap-3`}>
          <div>
            <div className="font-bold">{q.title}</div>
            <div className="text-sm text-[#8C8477]">
              {q.rounds} rounds · {q.questions} questions
            </div>
          </div>
          <button type="button" className={btn} disabled={busy} onClick={() => createSession(q.id)}>
            New night
          </button>
        </div>
      ))}

      <h2 className="font-mono text-xs uppercase tracking-widest text-[#8C8477] mt-8 mb-2">Nights</h2>
      {sessions.length === 0 && <p className="text-sm">None yet.</p>}
      {sessions.map((s) => (
        <div key={s.id} className={card}>
          <div className="flex justify-between gap-3">
            <div>
              <div className="font-bold">{s.quizTitle}</div>
              <div className="text-sm text-[#8C8477]">
                Code <b className="tracking-widest text-[#1C1712]">{s.code}</b> · {s.teams} teams · {s.status} · {new Date(s.createdAt).toLocaleString("en-IN")}
              </div>
            </div>
          </div>
          <div className="mt-2 flex gap-5 text-sm">
            <a className={link} href={`/admin/live/${s.id}/screen`} target="_blank" rel="noreferrer">
              Open projector screen
            </a>
            <a className={link} href={`/admin/live/${s.id}/host`} target="_blank" rel="noreferrer">
              Open host pad (phone)
            </a>
            {s.status !== "finished" && (
              <button type="button" className="ml-auto text-[#B8451D] font-semibold underline underline-offset-2 disabled:opacity-40" disabled={busy} onClick={() => endNight(s.id)}>
                End night
              </button>
            )}
          </div>
        </div>
      ))}

      <h2 className="font-mono text-xs uppercase tracking-widest text-[#8C8477] mt-8 mb-2">Import a quiz (JSON)</h2>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={8}
        placeholder='{"title": "...", "rounds": [ ... ]}'
        className="w-full border-2 border-[#1C1712] bg-white p-3 font-mono text-xs"
      />
      <button type="button" className={`${btn} mt-2`} disabled={busy || !json.trim()} onClick={importQuiz}>
        Import
      </button>
    </div>
  );
}
