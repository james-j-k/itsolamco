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
        <div className="border-2 border-[#1C1712] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#1C1712] font-mono text-[10px] uppercase text-left">
                <th className="p-3">Team</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Event</th>
                <th className="p-3">Size</th>
                <th className="p-3">Status</th>
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
                    <div className="text-[#8C8477] text-xs">{b.email}</div>
                    {b.phone && <div className="text-[#8C8477] text-xs">{b.phone}</div>}
                  </td>
                  <td className="p-3">{b.eventTitle ?? "—"}</td>
                  <td className="p-3">{b.teamSize}</td>
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
                  <td colSpan={7} className="p-6 text-center text-[#8C8477] font-mono text-xs">
                    No bookings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                  <td colSpan={6} className="p-6 text-center text-[#8C8477] font-mono text-xs">
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
