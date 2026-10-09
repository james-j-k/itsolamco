"use client";

import { useState } from "react";
import type { AdminEvent } from "./types";
import { useModalA11y } from "@/lib/useModalA11y";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (event: AdminEvent) => void;
  editing: AdminEvent | null;
};

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventFormModal({ open, onClose, onSaved, editing }: Props) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [theme, setTheme] = useState(editing?.theme ?? "");
  const [date, setDate] = useState(editing ? toLocalInputValue(editing.date) : "");
  const [venueName, setVenueName] = useState(editing?.venueName ?? "");
  const [venueArea, setVenueArea] = useState(editing?.venueArea ?? "");
  const [mapsUrl, setMapsUrl] = useState(editing?.mapsUrl ?? "");
  const [districtUrl, setDistrictUrl] = useState(editing?.districtUrl ?? "");
  const [swiggyUrl, setSwiggyUrl] = useState(editing?.swiggyUrl ?? "");
  const [reminderOfferNote, setReminderOfferNote] = useState(editing?.reminderOfferNote ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const containerRef = useModalA11y(open, onClose);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = editing ? `/api/admin/events/${editing.id}` : "/api/admin/events";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          theme,
          date: new Date(date).toISOString(),
          venueName,
          venueArea,
          mapsUrl,
          districtUrl,
          swiggyUrl,
          reminderOfferNote,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Prefer the specific reason (e.g. "Must be a full link starting with
        // http://...") over the generic "Invalid input".
        const reason = data.issues ? (Object.values(data.issues) as string[][]).flat()[0] : undefined;
        throw new Error(reason ?? data.error ?? "Failed to save event");
      }
      const data = await res.json();
      onSaved({ ...data.event, bookingCount: editing?.bookingCount ?? 0, media: editing?.media ?? [] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1C1712]/80 px-4" onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit event" : "New event"}
        tabIndex={-1}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto border-2 border-[#1C1712] bg-[#F5F0E6] p-8 relative focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 font-mono text-xs hover:text-[#B8451D]" aria-label="Close">
          CLOSE ✕
        </button>
        <h3 className="font-mono text-[11px] tracking-[0.2em] uppercase mb-6">
          {editing ? "Edit Event" : "New Event"}
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px]">TITLE</span>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D]" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px]">THEME (SHOWN ON HERO)</span>
            <input value={theme} onChange={(e) => setTheme(e.target.value)} className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D]" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px]">DATE &amp; TIME</span>
            <input required type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D]" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px]">VENUE NAME</span>
              <input required value={venueName} onChange={(e) => setVenueName(e.target.value)} className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D]" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px]">AREA</span>
              <input required value={venueArea} onChange={(e) => setVenueArea(e.target.value)} className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D]" />
            </label>
          </div>

          <div className="border-t-2 border-[#1C1712]/15 pt-4 flex flex-col gap-4">
            <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#8C8477]">
              Reminder email (optional)
            </div>
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px]">GOOGLE MAPS LINK (SHARE LINK FROM MAPS)</span>
              <input type="url" placeholder="https://maps.app.goo.gl/..." value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D]" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px]">TABLE OFFER LINE</span>
              <textarea rows={2} maxLength={300} placeholder="Both District and Swiggy Dineout show 20% off when you pre-book your table." value={reminderOfferNote} onChange={(e) => setReminderOfferNote(e.target.value)} className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D] resize-none" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px]">DISTRICT LINK FOR THIS VENUE</span>
              <input type="url" value={districtUrl} onChange={(e) => setDistrictUrl(e.target.value)} className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D]" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px]">SWIGGY DINEOUT LINK FOR THIS VENUE</span>
              <input type="url" value={swiggyUrl} onChange={(e) => setSwiggyUrl(e.target.value)} className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D]" />
            </label>
          </div>

          {error && <div className="font-mono text-xs text-[#B8451D]">{error}</div>}

          <button type="submit" disabled={saving} className="mt-2 bg-[#B8451D] text-[#F5F0E6] py-3 font-mono text-xs tracking-[0.2em] uppercase disabled:opacity-60">
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Event"}
          </button>
        </form>
      </div>
    </div>
  );
}
