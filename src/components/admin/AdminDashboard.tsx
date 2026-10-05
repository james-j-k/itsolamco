"use client";

import { useRef, useState } from "react";
import type { AdminEvent, AdminBooking, AdminInquiry, AdminRound, AdminVenue } from "./types";
import EventFormModal from "./EventFormModal";
import RoundFormModal from "./RoundFormModal";
import VenueFormModal from "./VenueFormModal";
import ConfirmDialog from "./ConfirmDialog";
import Toast, { type ToastItem } from "./Toast";

type Tab = "events" | "bookings" | "inquiries" | "rounds" | "venues";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NewBadge() {
  return (
    <span className="inline-block bg-[#B8451D] text-[#F5F0E6] font-mono text-[9px] tracking-[0.15em] uppercase px-1.5 py-0.5 ml-2 align-middle">
      New
    </span>
  );
}

function EmailStatusCell({
  sent,
  sending,
  onResend,
}: {
  sent: boolean;
  sending: boolean;
  onResend: () => void;
}) {
  if (sent) {
    return <span className="font-mono text-[10px] uppercase text-[#4B7B4E]">Sent ✓</span>;
  }
  return (
    <button
      onClick={onResend}
      disabled={sending}
      className="font-mono text-[10px] uppercase text-[#B8451D] hover:underline disabled:opacity-50 disabled:hover:no-underline"
    >
      {sending ? "Sending…" : "Not sent — Resend"}
    </button>
  );
}

function notifyUpdateStatus(
  status: string,
  teamSize: number,
  statusEmailSentFor: string | null,
  teamSizeEmailSentFor: number | null
) {
  const statusChanged = status !== "pending" && status !== statusEmailSentFor;
  const sizeChanged = teamSize !== teamSizeEmailSentFor;
  const label =
    status === "cancelled" && statusChanged
      ? "Send cancelled email"
      : statusChanged && sizeChanged
        ? "Send confirmed + size update"
        : statusChanged
          ? "Send confirmed email"
          : "Send size update email";
  return { statusChanged, sizeChanged, label };
}

function NotifyUpdateCell({
  status,
  teamSize,
  statusEmailSentFor,
  teamSizeEmailSentFor,
  sending,
  onSend,
}: {
  status: string;
  teamSize: number;
  statusEmailSentFor: string | null;
  teamSizeEmailSentFor: number | null;
  sending: boolean;
  onSend: () => void;
}) {
  const { statusChanged, sizeChanged, label } = notifyUpdateStatus(
    status,
    teamSize,
    statusEmailSentFor,
    teamSizeEmailSentFor
  );

  if (!statusChanged && !sizeChanged) {
    return statusEmailSentFor !== null ? (
      <span className="font-mono text-[10px] uppercase text-[#4B7B4E]">Sent ✓</span>
    ) : (
      <span className="font-mono text-[10px] text-[#8C8477]/50">—</span>
    );
  }

  return (
    <button
      onClick={onSend}
      disabled={sending}
      className="font-mono text-[10px] uppercase text-[#B8451D] hover:underline disabled:opacity-50 disabled:hover:no-underline"
    >
      {sending ? "Sending…" : label}
    </button>
  );
}

function EmailEditCell({
  email,
  editing,
  draft,
  onStartEdit,
  onDraftChange,
  onSave,
  onCancel,
}: {
  email: string;
  editing: boolean;
  draft: string;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-[#8C8477] text-xs">
        <span>{email}</span>
        <button onClick={onStartEdit} aria-label="Edit email" className="hover:text-[#B8451D]">
          ✎
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="email"
        autoFocus
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        className="w-48 border border-[#1C1712] bg-[#F5F0E6] px-1 py-0.5 font-mono text-xs"
      />
      <button onClick={onSave} aria-label="Save" className="font-mono text-[10px] hover:text-[#B8451D]">
        ✓
      </button>
      <button onClick={onCancel} aria-label="Cancel" className="font-mono text-[10px] hover:text-[#B8451D]">
        ✕
      </button>
    </div>
  );
}

function TeamSizeCell({
  size,
  editing,
  draft,
  onStartEdit,
  onDraftChange,
  onSave,
  onCancel,
}: {
  size: number;
  editing: boolean;
  draft: string;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>{size}</span>
        <button onClick={onStartEdit} aria-label="Edit team size" className="text-[#8C8477] hover:text-[#B8451D]">
          ✎
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        max={15}
        autoFocus
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        className="w-14 border border-[#1C1712] bg-[#F5F0E6] px-1 py-0.5 font-mono text-xs"
      />
      <button onClick={onSave} aria-label="Save" className="font-mono text-[10px] hover:text-[#B8451D]">
        ✓
      </button>
      <button onClick={onCancel} aria-label="Cancel" className="font-mono text-[10px] hover:text-[#B8451D]">
        ✕
      </button>
    </div>
  );
}

type ReminderMode = "reminder" | "nudge";

type ReminderStats = {
  confirmed: number;
  reminded: number;
  coming: number;
  players: number;
  tableBooked: number;
  declined: number;
  noReply: number;
  pending: number;
  attended: number;
  toRemind: number;
  toNudge: number;
};

function RsvpCell({ b }: { b: AdminBooking }) {
  if (b.rsvpStatus === "declined") {
    return <span className="font-mono text-[10px] uppercase text-[#B8451D]">Can&apos;t make it</span>;
  }
  if (b.rsvpStatus === "coming") {
    return (
      <div className="font-mono text-[10px] uppercase leading-relaxed">
        <div className="text-[#4B7B4E]">Coming · {b.rsvpHeadcount ?? b.teamSize}</div>
        <div className="text-[#8C8477]">
          {b.rsvpTableBooked === true ? "Table booked ✓" : b.rsvpTableBooked === false ? "No table yet" : "Table: not said"}
        </div>
      </div>
    );
  }
  if (b.reminderSentAt) {
    return (
      <span className="font-mono text-[10px] uppercase text-[#8C8477]">
        No reply{b.nudgeSentAt ? " (nudged)" : ""}
      </span>
    );
  }
  return <span className="font-mono text-[10px] text-[#8C8477]/50">—</span>;
}

function RemindersPanel({
  events,
  selectedId,
  onSelect,
  stats,
  run,
  result,
  onSend,
}: {
  events: AdminEvent[];
  selectedId: string;
  onSelect: (id: string) => void;
  stats: ReminderStats;
  run: { mode: ReminderMode; done: number; total: number } | null;
  result: { text: string; isError: boolean } | null;
  onSend: (mode: ReminderMode) => void;
}) {
  const busy = run !== null;
  const buttonClass =
    "border-2 border-[#1C1712] px-3 py-2 font-mono text-[10px] uppercase tracking-wider hover:bg-[#1C1712] hover:text-[#F5F0E6] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit transition-colors";

  return (
    <div className="border-2 border-[#1C1712] p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="font-mono text-[11px] tracking-[0.2em] uppercase">Day-before reminders</div>
        {events.length > 0 && (
          <div className="flex items-center gap-3">
            <select
              value={selectedId}
              onChange={(e) => onSelect(e.target.value)}
              disabled={busy}
              aria-label="Night to remind"
              className="border border-[#1C1712] bg-[#F5F0E6] px-2 py-1 font-mono text-[10px] uppercase max-w-[16rem]"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} — {fmtDate(ev.date)}
                </option>
              ))}
            </select>
            <button
              onClick={() => window.location.reload()}
              disabled={busy}
              title="Reload to pick up new RSVP replies"
              className="font-mono text-[10px] uppercase hover:text-[#B8451D] disabled:opacity-40"
            >
              ↻ Reload replies
            </button>
          </div>
        )}
      </div>

      {events.length === 0 ? (
        <p className="font-mono text-xs text-[#8C8477]">No upcoming nights to remind.</p>
      ) : (
        <>
          <div className="font-mono text-[11px] leading-relaxed text-[#1C1712] flex flex-wrap gap-x-5 gap-y-1 mb-3">
            <span>Confirmed <strong>{stats.confirmed}</strong></span>
            <span>Reminded <strong>{stats.reminded}</strong></span>
            <span className="text-[#4B7B4E]">
              Coming <strong>{stats.coming}</strong> {stats.coming === 1 ? "team" : "teams"} / <strong>{stats.players}</strong>{" "}
              {stats.players === 1 ? "player" : "players"}
            </span>
            <span>Table booked <strong>{stats.tableBooked}</strong></span>
            <span className="text-[#B8451D]">Can&apos;t make it <strong>{stats.declined}</strong></span>
            <span className="text-[#8C8477]">No reply <strong>{stats.noReply}</strong></span>
            <span>Showed up <strong>{stats.attended}</strong></span>
          </div>
          {stats.pending > 0 && (
            <p className="font-mono text-[10px] text-[#B8451D] mb-3">
              {stats.pending} pending {stats.pending === 1 ? "booking isn't" : "bookings aren't"} confirmed yet, so{" "}
              {stats.pending === 1 ? "it won't" : "they won't"} get a reminder.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => onSend("reminder")} disabled={busy || stats.toRemind === 0} className={buttonClass}>
              {stats.toRemind === 0 && stats.confirmed > 0 ? "Reminders sent ✓" : `Send reminders (${stats.toRemind})`}
            </button>
            <button onClick={() => onSend("nudge")} disabled={busy || stats.toNudge === 0} className={buttonClass}>
              Nudge non-responders ({stats.toNudge})
            </button>
            {run && (
              <span className="font-mono text-[10px] uppercase text-[#8C8477]">
                Sending… {run.done} / {run.total}
              </span>
            )}
          </div>
          {result && (
            <p className={`font-mono text-[11px] mt-3 leading-relaxed ${result.isError ? "text-[#B8451D]" : "text-[#4B7B4E]"}`}>
              {result.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function DragHandle() {
  return (
    <span className="cursor-grab active:cursor-grabbing text-[#8C8477] select-none mr-2" title="Drag to reorder">
      ⠿
    </span>
  );
}

function reorderById<T extends { id: string }>(list: T[], draggedId: string, targetId: string): T[] {
  const fromIndex = list.findIndex((x) => x.id === draggedId);
  const toIndex = list.findIndex((x) => x.id === targetId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function AdminDashboard({
  initialEvents,
  initialBookings,
  initialInquiries,
  initialRounds,
  initialVenues,
}: {
  initialEvents: AdminEvent[];
  initialBookings: AdminBooking[];
  initialInquiries: AdminInquiry[];
  initialRounds: AdminRound[];
  initialVenues: AdminVenue[];
}) {
  const [tab, setTab] = useState<Tab>("events");
  const [events, setEvents] = useState(initialEvents);
  const [bookings, setBookings] = useState(initialBookings);
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [rounds, setRounds] = useState(initialRounds);
  const [venues, setVenues] = useState(initialVenues);

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [eventModalKey, setEventModalKey] = useState(0);

  const [roundModalOpen, setRoundModalOpen] = useState(false);
  const [editingRound, setEditingRound] = useState<AdminRound | null>(null);
  const [roundModalKey, setRoundModalKey] = useState(0);

  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<AdminVenue | null>(null);
  const [venueModalKey, setVenueModalKey] = useState(0);

  // Snapshot of what was unread when the page loaded, so "New" badges stay
  // visible for the rest of this session even after we mark them read on the server.
  const [bookingSessionNew] = useState(() => new Set(initialBookings.filter((b) => !b.isRead).map((b) => b.id)));
  const [inquirySessionNew] = useState(() => new Set(initialInquiries.filter((i) => !i.isRead).map((i) => i.id)));
  const markedBookingsRead = useRef(false);
  const markedInquiriesRead = useRef(false);

  const [draggedRoundId, setDraggedRoundId] = useState<string | null>(null);
  const [draggedVenueId, setDraggedVenueId] = useState<string | null>(null);
  const [resendingBookingIds, setResendingBookingIds] = useState<Set<string>>(new Set());
  const [resendingInquiryIds, setResendingInquiryIds] = useState<Set<string>>(new Set());
  const [sendingUpdateEmailIds, setSendingUpdateEmailIds] = useState<Set<string>>(new Set());
  const [editingSizeId, setEditingSizeId] = useState<string | null>(null);
  const [sizeDraft, setSizeDraft] = useState("");
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");

  // Day-before reminders. `now` is fixed at page load so the list of upcoming
  // nights doesn't shift under the admin mid-session.
  const [now] = useState(() => Date.now());
  const [reminderEventId, setReminderEventId] = useState("");
  const [reminderRun, setReminderRun] = useState<{ mode: ReminderMode; done: number; total: number } | null>(null);
  const [reminderResult, setReminderResult] = useState<{ text: string; isError: boolean } | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  function pushError(message: string) {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }

  function askConfirm(opts: { title: string; message: string; confirmLabel?: string; onConfirm: () => void }) {
    setConfirmState(opts);
  }

  function switchTab(next: Tab) {
    setTab(next);
    if (next === "bookings" && !markedBookingsRead.current) {
      markedBookingsRead.current = true;
      fetch("/api/admin/bookings/mark-read", { method: "POST" }).catch(() => {});
    }
    if (next === "inquiries" && !markedInquiriesRead.current) {
      markedInquiriesRead.current = true;
      fetch("/api/admin/venue-inquiries/mark-read", { method: "POST" }).catch(() => {});
    }
  }

  async function deleteEvent(id: string, title: string) {
    askConfirm({
      title: "Delete event?",
      message: `Delete "${title}"? Bookings tied to it will be kept but unlinked. This can't be undone.`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
          if (!res.ok) throw new Error();
          setEvents((prev) => prev.filter((e) => e.id !== id));
        } catch {
          pushError("Couldn't delete that event — try again.");
        }
      },
    });
  }

  async function updateBookingStatus(id: string, status: string) {
    const prev = bookings;
    setBookings((cur) => cur.map((b) => (b.id === id ? { ...b, status } : b)));
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setBookings(prev);
      pushError("Couldn't update that booking's status — try again.");
    }
  }

  async function resendBookingEmail(id: string) {
    setResendingBookingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/bookings/${id}/resend-email`, { method: "POST" });
      if (!res.ok) throw new Error();
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, emailSent: true } : b)));
    } catch {
      pushError("Couldn't send that email — try again.");
    } finally {
      setResendingBookingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function confirmSendUpdateEmail(b: AdminBooking) {
    const { label } = notifyUpdateStatus(b.status, b.teamSize, b.statusEmailSentFor, b.teamSizeEmailSentFor);
    askConfirm({
      title: "Send this email?",
      message: `${label} to ${b.contactName} (${b.email}) for "${b.teamName}"?`,
      confirmLabel: "Send",
      onConfirm: () => {
        setConfirmState(null);
        sendUpdateEmail(b.id);
      },
    });
  }

  async function sendUpdateEmail(id: string) {
    setSendingUpdateEmailIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/bookings/${id}/send-update-email`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data: { statusEmailSentFor: string | null; teamSizeEmailSentFor: number | null } = await res.json();
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, statusEmailSentFor: data.statusEmailSentFor, teamSizeEmailSentFor: data.teamSizeEmailSentFor }
            : b
        )
      );
    } catch {
      pushError("Couldn't send that update email — try again.");
    } finally {
      setSendingUpdateEmailIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function startEditSize(id: string, currentSize: number) {
    setEditingSizeId(id);
    setSizeDraft(String(currentSize));
  }

  async function toggleAttended(id: string, attended: boolean) {
    const prev = bookings;
    setBookings((cur) => cur.map((b) => (b.id === id ? { ...b, attended } : b)));
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attended }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setBookings(prev);
      pushError("Couldn't update attendance — try again.");
    }
  }

  function confirmSendReminders(mode: ReminderMode) {
    if (!selectedReminderEvent) return;
    const count = mode === "reminder" ? reminderStats.toRemind : reminderStats.toNudge;
    if (count === 0) return;
    const teams = `${count} ${count === 1 ? "team" : "teams"}`;
    const daysAway = Math.ceil((new Date(selectedReminderEvent.date).getTime() - now) / 86400000);
    const early =
      mode === "reminder" && daysAway > 2
        ? ` Heads up: this night is ${daysAway} days away, and reminders are meant for the day before.`
        : "";
    const eventId = selectedReminderEvent.id;
    askConfirm({
      title: mode === "reminder" ? "Send reminders?" : "Send nudges?",
      message:
        mode === "reminder"
          ? `Email the reminder to ${teams} confirmed for "${selectedReminderEvent.title}" (${fmtDate(selectedReminderEvent.date)})?${early}`
          : `Email an "are you still coming?" nudge to ${teams} ${count === 1 ? "that hasn't" : "that haven't"} replied for "${selectedReminderEvent.title}"?`,
      confirmLabel: "Send",
      onConfirm: () => {
        setConfirmState(null);
        runReminders(mode, eventId, count);
      },
    });
  }

  // The server sends a few emails per call (to stay well inside time limits
  // and Resend's rate limit) and hands back a cursor; keep going until done.
  async function runReminders(mode: ReminderMode, eventId: string, total: number) {
    setReminderRun({ mode, done: 0, total });
    setReminderResult(null);

    let cursor: string | null = null;
    let sentCount = 0;
    let stopped: string | null = null;
    let fatal: string | null = null;
    const failures: { teamName: string; reason: string }[] = [];

    try {
      do {
        const res: Response = await fetch(`/api/admin/events/${eventId}/reminders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, cursor }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          fatal = data.error ?? "Couldn't send.";
          break;
        }
        const ids: string[] = data.sentIds ?? [];
        sentCount += ids.length;
        failures.push(...(data.failed ?? []));
        stopped = data.stopped ?? null;
        cursor = data.nextCursor ?? null;

        const stamp = new Date().toISOString();
        setBookings((prev) =>
          prev.map((b) =>
            ids.includes(b.id) ? (mode === "reminder" ? { ...b, reminderSentAt: stamp } : { ...b, nudgeSentAt: stamp }) : b
          )
        );
        setReminderRun({ mode, done: sentCount + failures.length, total });
      } while (cursor && !stopped);
    } catch {
      fatal = "Network problem while sending. Reload and check the numbers before trying again.";
    }

    setReminderRun(null);
    const noun = mode === "reminder" ? "reminder" : "nudge";
    let text = `Sent ${sentCount} ${noun}${sentCount === 1 ? "" : "s"}.`;
    if (failures.length > 0) {
      const names = failures.map((f) => `${f.teamName} (${f.reason})`).join("; ");
      text += ` ${failures.length} failed: ${names}. Click the button again to retry those.`;
    }
    if (stopped) text += ` Sending stopped early: ${stopped}`;
    if (fatal) text = `Stopped: ${fatal} ${sentCount} sent before it stopped.`;
    setReminderResult({ text, isError: failures.length > 0 || Boolean(stopped) || Boolean(fatal) });
  }

  function startEditEmail(id: string, currentEmail: string) {
    setEditingEmailId(id);
    setEmailDraft(currentEmail);
  }

  async function saveEmail(id: string) {
    const next = emailDraft.trim();
    const current = bookings.find((b) => b.id === id);
    if (!current) return;
    if (next === current.email) {
      setEditingEmailId(null);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      pushError("That doesn't look like a valid email address.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: next }),
      });
      if (!res.ok) throw new Error();
      const { booking }: { booking: AdminBooking } = await res.json();
      // The server wipes the "sent" tracking when the address changes, so take
      // its values rather than guessing — that's what re-enables Resend.
      setBookings((cur) =>
        cur.map((b) =>
          b.id === id
            ? {
                ...b,
                email: booking.email,
                emailSent: booking.emailSent,
                statusEmailSentFor: booking.statusEmailSentFor,
                teamSizeEmailSentFor: booking.teamSizeEmailSentFor,
                rsvpStatus: booking.rsvpStatus,
                rsvpHeadcount: booking.rsvpHeadcount,
                rsvpTableBooked: booking.rsvpTableBooked,
                reminderSentAt: booking.reminderSentAt,
                nudgeSentAt: booking.nudgeSentAt,
              }
            : b
        )
      );
      setEditingEmailId(null);
    } catch {
      pushError("Couldn't update that email — try again.");
    }
  }

  async function saveTeamSize(id: string) {
    const n = Number(sizeDraft);
    if (!Number.isInteger(n) || n < 1 || n > 15) {
      pushError("Team size must be a whole number between 1 and 15.");
      return;
    }
    const prev = bookings;
    setBookings((cur) => cur.map((b) => (b.id === id ? { ...b, teamSize: n } : b)));
    setEditingSizeId(null);
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSize: n }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setBookings(prev);
      pushError("Couldn't update team size — try again.");
    }
  }

  async function deleteBooking(id: string, teamName: string) {
    askConfirm({
      title: "Delete booking?",
      message: `Delete the booking for "${teamName}"? This can't be undone.`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
          if (!res.ok) throw new Error();
          setBookings((prev) => prev.filter((b) => b.id !== id));
        } catch {
          pushError("Couldn't delete that booking — try again.");
        }
      },
    });
  }

  async function updateInquiryStatus(id: string, status: string) {
    const prev = inquiries;
    setInquiries((cur) => cur.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      const res = await fetch(`/api/admin/venue-inquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setInquiries(prev);
      pushError("Couldn't update that inquiry's status — try again.");
    }
  }

  async function resendInquiryEmail(id: string) {
    setResendingInquiryIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/venue-inquiries/${id}/resend-email`, { method: "POST" });
      if (!res.ok) throw new Error();
      setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, emailSent: true } : i)));
    } catch {
      pushError("Couldn't send that email — try again.");
    } finally {
      setResendingInquiryIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function deleteInquiry(id: string, venueName: string) {
    askConfirm({
      title: "Delete inquiry?",
      message: `Delete the inquiry from "${venueName}"? This can't be undone.`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/admin/venue-inquiries/${id}`, { method: "DELETE" });
          if (!res.ok) throw new Error();
          setInquiries((prev) => prev.filter((i) => i.id !== id));
        } catch {
          pushError("Couldn't delete that inquiry — try again.");
        }
      },
    });
  }

  async function deleteRound(id: string, title: string) {
    askConfirm({
      title: "Delete round?",
      message: `Delete the "${title}" round? It'll disappear from the homepage immediately. This can't be undone.`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/admin/rounds/${id}`, { method: "DELETE" });
          if (!res.ok) throw new Error();
          setRounds((prev) => prev.filter((r) => r.id !== id));
        } catch {
          pushError("Couldn't delete that round — try again.");
        }
      },
    });
  }

  async function deleteVenue(id: string, name: string) {
    askConfirm({
      title: "Delete venue?",
      message: `Delete "${name}"? It'll disappear from the homepage immediately. This can't be undone.`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/admin/venues/${id}`, { method: "DELETE" });
          if (!res.ok) throw new Error();
          setVenues((prev) => prev.filter((v) => v.id !== id));
        } catch {
          pushError("Couldn't delete that venue — try again.");
        }
      },
    });
  }

  function handleRoundDragOver(targetId: string) {
    if (!draggedRoundId || draggedRoundId === targetId) return;
    setRounds((prev) => reorderById(prev, draggedRoundId, targetId));
  }

  async function handleRoundDragEnd() {
    setDraggedRoundId(null);
    const renumbered = rounds.map((r, i) => ({ ...r, order: i + 1 }));
    const ids = renumbered.map((r) => r.id);
    setRounds(renumbered);
    try {
      const res = await fetch("/api/admin/rounds/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
    } catch {
      pushError("Couldn't save the new round order — refresh and try again.");
    }
  }

  function handleVenueDragOver(targetId: string) {
    if (!draggedVenueId || draggedVenueId === targetId) return;
    setVenues((prev) => reorderById(prev, draggedVenueId, targetId));
  }

  async function handleVenueDragEnd() {
    setDraggedVenueId(null);
    const renumbered = venues.map((v, i) => ({ ...v, order: i + 1 }));
    const ids = renumbered.map((v) => v.id);
    setVenues(renumbered);
    try {
      const res = await fetch("/api/admin/venues/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
    } catch {
      pushError("Couldn't save the new venue order — refresh and try again.");
    }
  }

  const bookingUnreadCount = [...bookingSessionNew].filter((id) => bookings.some((b) => b.id === id)).length;
  const inquiryUnreadCount = [...inquirySessionNew].filter((id) => inquiries.some((i) => i.id === id)).length;

  const upcomingEvents = events.filter((e) => new Date(e.date).getTime() >= now);
  const selectedReminderEvent =
    upcomingEvents.find((e) => e.id === reminderEventId) ?? upcomingEvents[0] ?? null;
  const forReminderEvent = selectedReminderEvent
    ? bookings.filter((b) => b.eventId === selectedReminderEvent.id)
    : [];
  const confirmedForEvent = forReminderEvent.filter((b) => b.status === "confirmed");
  const comingForEvent = confirmedForEvent.filter((b) => b.rsvpStatus === "coming");
  const reminderStats: ReminderStats = {
    confirmed: confirmedForEvent.length,
    reminded: confirmedForEvent.filter((b) => b.reminderSentAt).length,
    coming: comingForEvent.length,
    players: comingForEvent.reduce((sum, b) => sum + (b.rsvpHeadcount ?? b.teamSize), 0),
    tableBooked: comingForEvent.filter((b) => b.rsvpTableBooked === true).length,
    declined: confirmedForEvent.filter((b) => b.rsvpStatus === "declined").length,
    noReply: confirmedForEvent.filter((b) => !b.rsvpStatus).length,
    pending: forReminderEvent.filter((b) => b.status === "pending").length,
    attended: forReminderEvent.filter((b) => b.attended).length,
    toRemind: confirmedForEvent.filter((b) => !b.reminderSentAt).length,
    toNudge: confirmedForEvent.filter((b) => b.reminderSentAt && !b.rsvpStatus && !b.nudgeSentAt).length,
  };

  const tabs: { key: Tab; label: string; count: number; unread?: number }[] = [
    { key: "events", label: "Events", count: events.length },
    { key: "bookings", label: "Bookings", count: bookings.length, unread: bookingUnreadCount },
    { key: "inquiries", label: "Venue Inquiries", count: inquiries.length, unread: inquiryUnreadCount },
    { key: "rounds", label: "How We Roll", count: rounds.length },
    { key: "venues", label: "Venues", count: venues.length },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex gap-2 mb-8 border-b-2 border-[#1C1712] flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`font-mono text-[11px] tracking-[0.15em] uppercase px-4 py-3 border-b-2 -mb-[2px] transition-colors flex items-center ${
              tab === t.key ? "border-[#B8451D] text-[#B8451D]" : "border-transparent text-[#8C8477] hover:text-[#1C1712]"
            }`}
          >
            {t.label} ({t.count})
            {!!t.unread && (
              <span className="ml-2 bg-[#B8451D] text-[#F5F0E6] text-[9px] px-1.5 py-0.5 rounded-full">{t.unread}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "events" && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#8C8477]">Upcoming &amp; past nights</h2>
            <button
              onClick={() => {
                setEditingEvent(null);
                setEventModalKey((k) => k + 1);
                setEventModalOpen(true);
              }}
              className="bg-[#B8451D] text-[#F5F0E6] px-4 py-2 font-mono text-[10px] tracking-[0.2em] uppercase"
            >
              + New Event
            </button>
          </div>
          <div className="border-2 border-[#1C1712] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#1C1712] font-mono text-[10px] uppercase text-left">
                  <th className="p-3">Title</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Venue</th>
                  <th className="p-3">Bookings</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b border-[#1C1712]/15">
                    <td className="p-3">
                      <div className="font-semibold">{ev.title}</div>
                      {ev.theme && <div className="text-[#8C8477] text-xs">{ev.theme}</div>}
                    </td>
                    <td className="p-3 whitespace-nowrap">{fmtDate(ev.date)}</td>
                    <td className="p-3">{ev.venueName}, {ev.venueArea}</td>
                    <td className="p-3">{ev.bookingCount}</td>
                    <td className="p-3 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditingEvent(ev);
                          setEventModalKey((k) => k + 1);
                          setEventModalOpen(true);
                        }}
                        className="font-mono text-[10px] uppercase mr-3 hover:text-[#B8451D]"
                      >
                        Edit
                      </button>
                      <button onClick={() => deleteEvent(ev.id, ev.title)} className="font-mono text-[10px] uppercase hover:text-[#B8451D]">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-[#8C8477] font-mono text-xs">
                      No events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "bookings" && (
        <>
        <RemindersPanel
          events={upcomingEvents}
          selectedId={selectedReminderEvent?.id ?? ""}
          onSelect={(id) => {
            setReminderEventId(id);
            // A result message belongs to the night it was about.
            setReminderResult(null);
          }}
          stats={reminderStats}
          run={reminderRun}
          result={reminderResult}
          onSend={confirmSendReminders}
        />
        <div className="border-2 border-[#1C1712] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#1C1712] font-mono text-[10px] uppercase text-left">
                <th className="p-3">Team</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Event</th>
                <th className="p-3">Size</th>
                <th className="p-3">Status</th>
                <th className="p-3">Email</th>
                <th className="p-3">Notify Update</th>
                <th className="p-3">RSVP</th>
                <th className="p-3">Showed up</th>
                <th className="p-3">Submitted</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-[#1C1712]/15 align-top">
                  <td className="p-3 font-semibold">
                    {b.teamName}
                    {bookingSessionNew.has(b.id) && <NewBadge />}
                  </td>
                  <td className="p-3">
                    <div>{b.contactName}</div>
                    <EmailEditCell
                      email={b.email}
                      editing={editingEmailId === b.id}
                      draft={emailDraft}
                      onStartEdit={() => startEditEmail(b.id, b.email)}
                      onDraftChange={setEmailDraft}
                      onSave={() => saveEmail(b.id)}
                      onCancel={() => setEditingEmailId(null)}
                    />
                    {b.phone && <div className="text-[#8C8477] text-xs">{b.phone}</div>}
                  </td>
                  <td className="p-3">{b.eventTitle ?? "—"}</td>
                  <td className="p-3">
                    <TeamSizeCell
                      size={b.teamSize}
                      editing={editingSizeId === b.id}
                      draft={sizeDraft}
                      onStartEdit={() => startEditSize(b.id, b.teamSize)}
                      onDraftChange={setSizeDraft}
                      onSave={() => saveTeamSize(b.id)}
                      onCancel={() => setEditingSizeId(null)}
                    />
                  </td>
                  <td className="p-3">
                    <select
                      value={b.status}
                      onChange={(e) => updateBookingStatus(b.id, e.target.value)}
                      className="border border-[#1C1712] bg-[#F5F0E6] px-2 py-1 font-mono text-[10px] uppercase"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <EmailStatusCell
                      sent={b.emailSent}
                      sending={resendingBookingIds.has(b.id)}
                      onResend={() => resendBookingEmail(b.id)}
                    />
                  </td>
                  <td className="p-3">
                    <NotifyUpdateCell
                      status={b.status}
                      teamSize={b.teamSize}
                      statusEmailSentFor={b.statusEmailSentFor}
                      teamSizeEmailSentFor={b.teamSizeEmailSentFor}
                      sending={sendingUpdateEmailIds.has(b.id)}
                      onSend={() => confirmSendUpdateEmail(b)}
                    />
                  </td>
                  <td className="p-3">
                    <RsvpCell b={b} />
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={b.attended}
                      onChange={(e) => toggleAttended(b.id, e.target.checked)}
                      aria-label={`Mark ${b.teamName} as showed up`}
                      className="h-4 w-4 accent-[#B8451D]"
                    />
                  </td>
                  <td className="p-3 whitespace-nowrap text-xs text-[#8C8477]">{fmtDate(b.createdAt)}</td>
                  <td className="p-3">
                    <button onClick={() => deleteBooking(b.id, b.teamName)} className="font-mono text-[10px] uppercase hover:text-[#B8451D]">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-[#8C8477] font-mono text-xs">
                    No bookings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      {tab === "inquiries" && (
        <div className="border-2 border-[#1C1712] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#1C1712] font-mono text-[10px] uppercase text-left">
                <th className="p-3">Venue</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Message</th>
                <th className="p-3">Status</th>
                <th className="p-3">Email</th>
                <th className="p-3">Submitted</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((i) => (
                <tr key={i.id} className="border-b border-[#1C1712]/15 align-top">
                  <td className="p-3 font-semibold">
                    {i.venueName}
                    {inquirySessionNew.has(i.id) && <NewBadge />}
                  </td>
                  <td className="p-3">
                    <div>{i.contactName}</div>
                    <div className="text-[#8C8477] text-xs">{i.email}</div>
                    {i.phone && <div className="text-[#8C8477] text-xs">{i.phone}</div>}
                  </td>
                  <td className="p-3 max-w-xs text-xs">{i.message ?? "—"}</td>
                  <td className="p-3">
                    <select
                      value={i.status}
                      onChange={(e) => updateInquiryStatus(i.id, e.target.value)}
                      className="border border-[#1C1712] bg-[#F5F0E6] px-2 py-1 font-mono text-[10px] uppercase"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <EmailStatusCell
                      sent={i.emailSent}
                      sending={resendingInquiryIds.has(i.id)}
                      onResend={() => resendInquiryEmail(i.id)}
                    />
                  </td>
                  <td className="p-3 whitespace-nowrap text-xs text-[#8C8477]">{fmtDate(i.createdAt)}</td>
                  <td className="p-3">
                    <button onClick={() => deleteInquiry(i.id, i.venueName)} className="font-mono text-[10px] uppercase hover:text-[#B8451D]">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {inquiries.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#8C8477] font-mono text-xs">
                    No inquiries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "rounds" && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#8C8477]">
              &quot;How We Roll&quot; round-by-round format, shown on the homepage
              <span className="block normal-case tracking-normal text-[#8C8477]/70 mt-1">Drag ⠿ to reorder</span>
            </h2>
            <button
              onClick={() => {
                setEditingRound(null);
                setRoundModalKey((k) => k + 1);
                setRoundModalOpen(true);
              }}
              className="bg-[#B8451D] text-[#F5F0E6] px-4 py-2 font-mono text-[10px] tracking-[0.2em] uppercase"
            >
              + New Round
            </button>
          </div>
          <div className="border-2 border-[#1C1712] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#1C1712] font-mono text-[10px] uppercase text-left">
                  <th className="p-3 w-16">#</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Description</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => (
                  <tr
                    key={r.id}
                    draggable
                    onDragStart={() => setDraggedRoundId(r.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      handleRoundDragOver(r.id);
                    }}
                    onDragEnd={handleRoundDragEnd}
                    className={`border-b border-[#1C1712]/15 align-top ${draggedRoundId === r.id ? "opacity-40" : ""}`}
                  >
                    <td className="p-3 font-mono whitespace-nowrap">
                      <DragHandle />
                      {r.order}
                    </td>
                    <td className="p-3 font-semibold whitespace-nowrap">{r.title}</td>
                    <td className="p-3 text-[#8C8477] max-w-md">{r.description}</td>
                    <td className="p-3 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditingRound(r);
                          setRoundModalKey((k) => k + 1);
                          setRoundModalOpen(true);
                        }}
                        className="font-mono text-[10px] uppercase mr-3 hover:text-[#B8451D]"
                      >
                        Edit
                      </button>
                      <button onClick={() => deleteRound(r.id, r.title)} className="font-mono text-[10px] uppercase hover:text-[#B8451D]">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {rounds.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-[#8C8477] font-mono text-xs">
                      No rounds yet — the homepage will show a placeholder until you add some.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "venues" && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#8C8477]">
              &quot;Where the Magic Happens&quot; venue list, shown on the homepage
              <span className="block normal-case tracking-normal text-[#8C8477]/70 mt-1">Drag ⠿ to reorder</span>
            </h2>
            <button
              onClick={() => {
                setEditingVenue(null);
                setVenueModalKey((k) => k + 1);
                setVenueModalOpen(true);
              }}
              className="bg-[#B8451D] text-[#F5F0E6] px-4 py-2 font-mono text-[10px] tracking-[0.2em] uppercase"
            >
              + New Venue
            </button>
          </div>
          <div className="border-2 border-[#1C1712] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#1C1712] font-mono text-[10px] uppercase text-left">
                  <th className="p-3 w-16">#</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Area</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {venues.map((v) => (
                  <tr
                    key={v.id}
                    draggable
                    onDragStart={() => setDraggedVenueId(v.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      handleVenueDragOver(v.id);
                    }}
                    onDragEnd={handleVenueDragEnd}
                    className={`border-b border-[#1C1712]/15 ${draggedVenueId === v.id ? "opacity-40" : ""}`}
                  >
                    <td className="p-3 font-mono whitespace-nowrap">
                      <DragHandle />
                      {v.order}
                    </td>
                    <td className="p-3 font-semibold">{v.name}</td>
                    <td className="p-3 text-[#8C8477]">{v.area ?? "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditingVenue(v);
                          setVenueModalKey((k) => k + 1);
                          setVenueModalOpen(true);
                        }}
                        className="font-mono text-[10px] uppercase mr-3 hover:text-[#B8451D]"
                      >
                        Edit
                      </button>
                      <button onClick={() => deleteVenue(v.id, v.name)} className="font-mono text-[10px] uppercase hover:text-[#B8451D]">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {venues.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-[#8C8477] font-mono text-xs">
                      No venues yet — the homepage will show a placeholder until you add some.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EventFormModal
        key={`event-${eventModalKey}`}
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        editing={editingEvent}
        onSaved={(saved) => {
          setEvents((prev) => {
            const exists = prev.some((e) => e.id === saved.id);
            if (exists) return prev.map((e) => (e.id === saved.id ? saved : e));
            return [...prev, saved].sort((a, b) => a.date.localeCompare(b.date));
          });
        }}
      />

      <RoundFormModal
        key={`round-${roundModalKey}`}
        open={roundModalOpen}
        onClose={() => setRoundModalOpen(false)}
        editing={editingRound}
        nextOrder={rounds.length + 1}
        onSaved={(saved) => {
          setRounds((prev) => {
            const exists = prev.some((r) => r.id === saved.id);
            const next = exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved];
            return next.sort((a, b) => a.order - b.order);
          });
        }}
      />

      <VenueFormModal
        key={`venue-${venueModalKey}`}
        open={venueModalOpen}
        onClose={() => setVenueModalOpen(false)}
        editing={editingVenue}
        nextOrder={venues.length + 1}
        onSaved={(saved) => {
          setVenues((prev) => {
            const exists = prev.some((v) => v.id === saved.id);
            const next = exists ? prev.map((v) => (v.id === saved.id ? saved : v)) : [...prev, saved];
            return next.sort((a, b) => a.order - b.order);
          });
        }}
      />

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />

      <Toast toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
