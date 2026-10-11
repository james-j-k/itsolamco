"use client";

import { useEffect, useState } from "react";
import type { AdminEvent } from "./types";
import { useModalA11y } from "@/lib/useModalA11y";

type Audience = "attended" | "all";
type Mode = "group" | "pick";
type Counts = { pastGuests: number; optedOut: number; alreadyBooked: number; alreadyInvited: number; eligible: number };
type Guest = { email: string; name: string; attended: boolean; ticketing: boolean };
type Loaded = { key: string; attended: Counts; all: Counts; guests: Guest[] };
type PendingSend = { emails?: string[]; count: number; label?: string };

type Props = { open: boolean; onClose: () => void; event: AdminEvent };

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

// Emails a "new night" invite to people who came to an earlier night. Manual,
// one night at a time, to a whole group or to people you pick one by one. It
// shows exactly who it would reach before sending and never emails anyone twice
// for the same night.
export default function InviteModal({ open, onClose, event }: Props) {
  const [mode, setMode] = useState<Mode>("group");
  const [audience, setAudience] = useState<Audience>("attended");
  const [includeTicketing, setIncludeTicketing] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState<PendingSend | null>(null);
  const [run, setRun] = useState<{ sent: number; total: number } | null>(null);
  const [result, setResult] = useState<{ text: string; isError: boolean; failed: { email: string; reason: string }[] } | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const containerRef = useModalA11y(open, () => {
    if (!run) onClose();
  });

  const key = `${event.id}|${includeTicketing ? 1 : 0}|${refreshTick}|${mode}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const base = `/api/admin/events/${event.id}/invites?ticketing=${includeTicketing ? 1 : 0}`;
        const [a, b] = await Promise.all([
          fetch(`${base}&audience=attended`, { cache: "no-store" }),
          // The full list of people comes with the "everyone" request, only when picking.
          fetch(`${base}&audience=all${mode === "pick" ? "&list=1" : ""}`, { cache: "no-store" }),
        ]);
        const [da, db] = [await a.json().catch(() => ({})), await b.json().catch(() => ({}))];
        if (!a.ok || !b.ok) throw new Error(da.error ?? db.error ?? "Couldn't work out who to invite.");
        if (!cancelled) {
          setLoadError("");
          setLoaded({ key, attended: da.counts, all: db.counts, guests: db.guests ?? [] });
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't work out who to invite.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, event.id, includeTicketing, mode, key]);

  if (!open) return null;

  const ready = loaded?.key === key;
  const counts = ready ? (mode === "pick" ? loaded!.all : loaded![audience]) : null;
  const guests = ready ? loaded!.guests : [];
  const chosen = guests.filter((g) => selected.has(g.email));
  const sending = run !== null;

  function toggle(email: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function send(emails?: string[]) {
    const total = emails?.length ?? counts?.eligible ?? 0;
    if (total === 0) return;
    setPending(null);
    setResult(null);
    const exclude: string[] = [];
    const failed: { email: string; reason: string }[] = [];
    let sent = 0;
    let stopped: string | null = null;
    let problem: string | null = null;
    setRun({ sent: 0, total });

    try {
      for (let guard = 0; guard < 200; guard++) {
        const res = await fetch(`/api/admin/events/${event.id}/invites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audience: emails ? "all" : audience, includeTicketing, exclude, ...(emails ? { emails } : {}) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          problem = data.error ?? "Something went wrong while sending.";
          break;
        }
        sent += data.sent;
        for (const f of data.failed as { email: string; reason: string }[]) {
          failed.push(f);
          exclude.push(f.email);
        }
        setRun({ sent, total });
        if (data.stopped) {
          stopped = data.stopped;
          break;
        }
        if (data.remaining <= 0) break;
      }
    } catch {
      problem = "Lost connection while sending. Nobody gets the same invite twice, so it's safe to check who is left and send again.";
    }

    setRun(null);
    setSelected(new Set());
    setRefreshTick((t) => t + 1);
    if (problem || stopped) {
      setResult({
        text: `${problem ?? `Stopped: ${stopped}`} ${sent} invite${sent === 1 ? "" : "s"} went out before that. The rest are still waiting; you can send again later.`,
        isError: true,
        failed,
      });
    } else if (failed.length > 0) {
      setResult({ text: `Sent ${sent}. ${failed.length} didn't go through.`, isError: true, failed });
    } else {
      setResult({ text: `Sent ${sent} invite${sent === 1 ? "" : "s"}.`, isError: false, failed });
    }
  }

  const radio = "flex items-start gap-3 border-2 border-[#1C1712] p-3 cursor-pointer has-[:checked]:bg-[#EEE7D8]";
  const tab = (active: boolean) =>
    `flex-1 border-2 border-[#1C1712] px-3 py-3 font-mono text-[11px] uppercase tracking-wider ${active ? "bg-[#1C1712] text-[#F5F0E6]" : "hover:bg-[#EEE7D8]"}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1C1712]/80 px-4" onClick={sending ? undefined : onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Invite past guests to ${event.title}`}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto border-2 border-[#1C1712] bg-[#F5F0E6] p-6 focus:outline-none sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={sending}
          className="absolute right-1 top-1 p-3 font-mono text-xs hover:text-[#B8451D] disabled:opacity-40"
          aria-label="Close"
        >
          CLOSE ✕
        </button>
        <h3 className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em]">Invite past guests</h3>
        <div className="font-display text-2xl">{event.title}</div>
        <div className="mb-5 font-mono text-[11px] text-[#6A6357]">{when(event.date)} IST</div>

        <p className="mb-4 text-sm leading-relaxed text-[#6A6357]">
          Emails people who came to an earlier night: this night&apos;s date, venue, a map link and a Book button, plus an unsubscribe link. Nobody gets the same
          invite twice, and anyone who opted out, or is already booked on this night, is skipped.
        </p>

        <div className="mb-4 flex gap-2" role="group" aria-label="How to choose who gets the invite">
          <button type="button" aria-pressed={mode === "group"} onClick={() => setMode("group")} disabled={sending} className={tab(mode === "group")}>
            A group
          </button>
          <button type="button" aria-pressed={mode === "pick"} onClick={() => setMode("pick")} disabled={sending} className={tab(mode === "pick")}>
            Pick people
          </button>
        </div>

        <fieldset className="mb-4 flex min-w-0 flex-col gap-2" disabled={sending}>
          <legend className="mb-2 font-mono text-[10px] uppercase tracking-wider">{mode === "group" ? "Who" : "Past guests who can be invited"}</legend>

          {mode === "group" && (
            <>
              <label className={radio}>
                <input type="radio" name="aud" checked={audience === "attended"} onChange={() => setAudience("attended")} className="mt-1 accent-[#B8451D]" />
                <span>
                  <span className="font-semibold">People who showed up</span>
                  <span className="block font-mono text-[10px] text-[#6A6357]">
                    Ticked &ldquo;showed up&rdquo; on an earlier night{ready ? ` · ${loaded!.attended.eligible} can be emailed` : ""}
                  </span>
                </span>
              </label>
              <label className={radio}>
                <input type="radio" name="aud" checked={audience === "all"} onChange={() => setAudience("all")} className="mt-1 accent-[#B8451D]" />
                <span>
                  <span className="font-semibold">Everyone who booked an earlier night</span>
                  <span className="block font-mono text-[10px] text-[#6A6357]">
                    Confirmed bookings, including no-shows{ready ? ` · ${loaded!.all.eligible} can be emailed` : ""}
                  </span>
                </span>
              </label>
            </>
          )}

          {mode === "pick" && ready && (
            <div className="border-2 border-[#1C1712]">
              <div className="flex items-center justify-between gap-2 border-b border-[#1C1712]/25 px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
                <span>
                  {chosen.length} of {guests.length} selected
                </span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => setSelected(new Set(guests.map((g) => g.email)))} className="px-1 py-2.5 hover:text-[#B8451D]">
                    All
                  </button>
                  <button type="button" onClick={() => setSelected(new Set())} className="px-1 py-2.5 hover:text-[#B8451D]">
                    None
                  </button>
                </span>
              </div>
              {guests.length === 0 ? (
                <p className="p-3 font-mono text-[11px] text-[#6A6357]">No one left to invite for this night.</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {guests.map((g) => (
                    <li key={g.email} className="flex items-center gap-3 border-b border-[#1C1712]/15 px-3 py-2 last:border-b-0">
                      <input
                        type="checkbox"
                        checked={selected.has(g.email)}
                        onChange={() => toggle(g.email)}
                        aria-label={`Select ${g.name}`}
                        className="h-6 w-6 shrink-0 accent-[#B8451D]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{g.name}</span>
                        <span className="block truncate font-mono text-[10px] normal-case text-[#6A6357]">{g.email}</span>
                        <span className="block font-mono text-[10px] text-[#6A6357]">
                          {g.attended ? "Showed up" : "Didn't show"}
                          {g.ticketing ? " · Ticketing app" : ""}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPending({ emails: [g.email], count: 1, label: g.email })}
                        disabled={sending}
                        className="shrink-0 border-2 border-[#B8451D] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[#B8451D] hover:bg-[#B8451D] hover:text-[#F5F0E6] disabled:opacity-40"
                      >
                        Send
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <label className="mt-1 flex items-center gap-3 font-mono text-[11px]">
            <input type="checkbox" checked={includeTicketing} onChange={(e) => setIncludeTicketing(e.target.checked)} className="h-4 w-4 accent-[#B8451D]" />
            Include guests from the ticketing app
          </label>
        </fieldset>

        {loadError && <p className="mb-3 font-mono text-[11px] text-[#B8451D]">{loadError}</p>}
        {!ready && !loadError && <p className="mb-3 font-mono text-[11px] text-[#6A6357]">Working out who this would reach…</p>}

        {counts && (
          <div className="mb-4 border border-[#1C1712]/25 p-3 font-mono text-[11px] leading-relaxed">
            <div className="text-sm">
              {mode === "pick" ? (
                <>
                  <strong>{counts.eligible}</strong> {counts.eligible === 1 ? "person" : "people"} can be invited
                </>
              ) : (
                <>
                  Will email <strong>{counts.eligible}</strong> {counts.eligible === 1 ? "person" : "people"}
                </>
              )}
            </div>
            <div className="text-[#6A6357]">
              Out of {counts.pastGuests} past {counts.pastGuests === 1 ? "guest" : "guests"}
              {mode === "group" ? " in this group" : ""}. Skipped: {counts.optedOut} opted out · {counts.alreadyBooked} already on this night ·{" "}
              {counts.alreadyInvited} already invited.
            </div>
          </div>
        )}

        {run && (
          <p className="mb-3 font-mono text-[11px] text-[#6A6357]" role="status">
            Sending… {run.sent} of {run.total}. Keep this window open.
          </p>
        )}
        {result && (
          <div className={`mb-4 font-mono text-[11px] leading-relaxed ${result.isError ? "text-[#B8451D]" : "text-[#4B7B4E]"}`} role="status">
            <p>{result.text}</p>
            {result.failed.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {result.failed.slice(0, 6).map((f) => (
                  <li key={f.email}>
                    {f.email}: {f.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {pending ? (
          <div className="border-2 border-[#B8451D] p-3">
            <p className="mb-3 break-words text-sm">
              This sends a real email to{" "}
              <strong>{pending.label ?? `${pending.count} ${pending.count === 1 ? "person" : "people"}`}</strong>. It can&apos;t be unsent. Go ahead?
            </p>
            <div className="flex gap-3">
              <button onClick={() => send(pending.emails)} className="bg-[#B8451D] px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-[#F5F0E6]">
                Yes, send
              </button>
              <button onClick={() => setPending(null)} className="border-2 border-[#1C1712] px-4 py-3 font-mono text-[11px] uppercase tracking-wider">
                Not yet
              </button>
            </div>
          </div>
        ) : mode === "pick" ? (
          <button
            onClick={() => setPending({ emails: chosen.map((g) => g.email), count: chosen.length })}
            disabled={chosen.length === 0 || sending}
            className="w-full bg-[#B8451D] py-3 font-mono text-xs uppercase tracking-[0.2em] text-[#F5F0E6] disabled:opacity-40"
          >
            {chosen.length === 0 ? "Pick at least one person" : `Send to ${chosen.length} selected`}
          </button>
        ) : (
          <button
            onClick={() => counts && setPending({ count: counts.eligible })}
            disabled={!counts || counts.eligible === 0 || sending}
            className="w-full bg-[#B8451D] py-3 font-mono text-xs uppercase tracking-[0.2em] text-[#F5F0E6] disabled:opacity-40"
          >
            {counts && counts.eligible === 0 ? "No one to invite" : `Send invite to ${counts?.eligible ?? "…"} ${counts?.eligible === 1 ? "person" : "people"}`}
          </button>
        )}
      </div>
    </div>
  );
}
