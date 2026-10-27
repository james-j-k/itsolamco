"use client";

import { useEffect, useState } from "react";
import { useModalA11y } from "@/lib/useModalA11y";

type Counts = { toAsk: number; alreadyAsked: number; label: string; url: string };

// Emails everyone who registered on our site for this night, and was never
// confirmed, asking them to book on the other ticketing site. Each person is
// emailed once.
export default function ExternalNudgeModal({
  eventId,
  eventTitle,
  onClose,
  onSent,
}: {
  eventId: string | null;
  eventTitle: string;
  onClose: () => void;
  onSent: (ids: string[]) => void;
}) {
  const containerRef = useModalA11y(eventId !== null, onClose);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loadError, setLoadError] = useState("");
  const [running, setRunning] = useState(false);
  const [sent, setSent] = useState(0);
  const [failures, setFailures] = useState<{ teamName: string; reason: string }[]>([]);
  const [stopped, setStopped] = useState("");
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    fetch(`/api/admin/events/${eventId}/external-nudge`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setLoadError(data.error ?? "Couldn't load the list");
        else setCounts(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Network error");
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!eventId) return null;

  async function sendAll() {
    setRunning(true);
    setFailures([]);
    setStopped("");
    let cursor: string | null = null;
    let total = 0;
    const allIds: string[] = [];
    try {
      do {
        const res: Response = await fetch(`/api/admin/events/${eventId}/external-nudge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStopped(data.error ?? "Something went wrong");
          break;
        }
        total += data.sentIds.length;
        allIds.push(...data.sentIds);
        setSent(total);
        if (data.failed.length > 0) setFailures((cur) => [...cur, ...data.failed]);
        if (data.stopped) {
          setStopped(data.stopped);
          break;
        }
        cursor = data.nextCursor ?? null;
      } while (cursor);
      setFinished(true);
    } catch {
      setStopped("Network error. Nothing more was sent. Open this again to continue.");
    } finally {
      setRunning(false);
      if (allIds.length > 0) onSent(allIds);
    }
  }

  const label = counts?.label ?? "the ticket site";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1C1712]/80 px-4" onClick={running ? undefined : onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask pending guests to book elsewhere"
        tabIndex={-1}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto border-2 border-[#1C1712] bg-[#F5F0E6] p-6 sm:p-8 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-mono text-[11px] tracking-[0.2em] uppercase text-[#B8451D]">Ask pending guests to book on {label}</h3>
        <p className="mb-4 text-sm text-[#6A6357]">{eventTitle}</p>

        {loadError && (
          <p className="font-mono text-xs text-[#B8451D]" role="alert">
            {loadError}
          </p>
        )}
        {!counts && !loadError && <p className="font-mono text-xs">Loading...</p>}

        {counts && (
          <>
            <p className="mb-3 text-sm leading-relaxed">
              <strong>{counts.toAsk}</strong> {counts.toAsk === 1 ? "person registered" : "people registered"} on our site for this night and{" "}
              {counts.toAsk === 1 ? "was" : "were"} never confirmed.
              {counts.alreadyAsked > 0 ? ` ${counts.alreadyAsked} already got this email, and won't get it again.` : ""} Each person is emailed once.
            </p>
            <div className="mb-4 border border-[#1C1712]/25 p-3 text-sm leading-relaxed">
              <div className="mb-2 font-mono text-[10px] uppercase text-[#6A6357]">What they&apos;ll get</div>
              <div className="mb-1 font-semibold">Book your spot for {eventTitle} on {label}</div>
              <p className="mb-2">
                Thanks for registering your team for {eventTitle}. For this night we&apos;re taking bookings on {label}, so your spot is confirmed together with
                your ticket. A button takes them to <span className="break-all">{counts.url}</span>. Your registration on our site doesn&apos;t confirm a place
                by itself.
              </p>
            </div>
          </>
        )}

        {running && (
          <p className="mb-3 font-mono text-xs" role="status">
            Sending... {sent} sent. Keep this window open.
          </p>
        )}
        {finished && !stopped && (
          <p className="mb-3 font-mono text-xs text-[#4B7B4E]" role="status">
            Done. {sent} {sent === 1 ? "email" : "emails"} sent.
          </p>
        )}
        {stopped && (
          <p className="mb-3 font-mono text-xs text-[#B8451D]" role="alert">
            Stopped: {stopped}
          </p>
        )}
        {failures.length > 0 && (
          <div className="mb-3 font-mono text-xs text-[#B8451D]" role="alert">
            Couldn&apos;t send to {failures.length}: {failures.map((f) => f.teamName).join(", ")}. They stay on the list, so you can try again.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {counts && counts.toAsk > 0 && !finished && (
            <button
              type="button"
              disabled={running}
              onClick={sendAll}
              className="min-h-11 bg-[#B8451D] font-mono text-[11px] uppercase tracking-[0.15em] text-[#F5F0E6] disabled:opacity-60"
            >
              {running ? "Sending..." : `Send ${counts.toAsk} ${counts.toAsk === 1 ? "email" : "emails"}`}
            </button>
          )}
          <button
            type="button"
            disabled={running}
            onClick={onClose}
            className="min-h-11 border-2 border-[#1C1712] font-mono text-[11px] uppercase tracking-[0.15em] hover:bg-[#EEE7D8] disabled:opacity-60"
          >
            {finished ? "Close" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
