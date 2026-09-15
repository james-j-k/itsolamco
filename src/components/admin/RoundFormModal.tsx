"use client";

import { useState } from "react";
import type { AdminRound } from "./types";
import { useModalA11y } from "@/lib/useModalA11y";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (round: AdminRound) => void;
  editing: AdminRound | null;
  nextOrder: number;
};

export default function RoundFormModal({ open, onClose, onSaved, editing, nextOrder }: Props) {
  const [order, setOrder] = useState(editing?.order ?? nextOrder);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const containerRef = useModalA11y(open, onClose);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = editing ? `/api/admin/rounds/${editing.id}` : "/api/admin/rounds";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order, title, description }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save round");
      }
      const data = await res.json();
      onSaved(data.round);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save round");
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
        aria-label={editing ? "Edit round" : "New round"}
        tabIndex={-1}
        className="w-full max-w-md border-2 border-[#1C1712] bg-[#F5F0E6] p-8 relative focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 font-mono text-xs hover:text-[#B8451D]" aria-label="Close">
          CLOSE ✕
        </button>
        <h3 className="font-mono text-[11px] tracking-[0.2em] uppercase mb-6">
          {editing ? "Edit Round" : "New Round"}
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px]">ORDER (POSITION IN LIST)</span>
            <input required type="number" min={1} value={order} onChange={(e) => setOrder(Number(e.target.value))} className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D]" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px]">TITLE</span>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Icebreaker" className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D]" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px]">DESCRIPTION</span>
            <textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="border-2 border-[#1C1712] bg-[#F5F0E6] px-3 py-2 focus:outline-none focus:border-[#B8451D] resize-none" />
          </label>

          {error && <div className="font-mono text-xs text-[#B8451D]">{error}</div>}

          <button type="submit" disabled={saving} className="mt-2 bg-[#B8451D] text-[#F5F0E6] py-3 font-mono text-xs tracking-[0.2em] uppercase disabled:opacity-60">
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Round"}
          </button>
        </form>
      </div>
    </div>
  );
}
