"use client";

import { useModalA11y } from "@/lib/useModalA11y";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onCancel }: Props) {
  const containerRef = useModalA11y(open, onCancel);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1C1712]/80 px-4" onClick={onCancel}>
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-sm border-2 border-[#1C1712] bg-[#F5F0E6] p-8 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-mono text-[11px] tracking-[0.2em] uppercase mb-3 text-[#B8451D]">{title}</h3>
        <p className="text-sm leading-relaxed mb-8">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border-2 border-[#1C1712] py-3 font-mono text-[10px] tracking-[0.2em] uppercase hover:bg-[#1C1712] hover:text-[#F5F0E6] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-[#B8451D] text-[#F5F0E6] py-3 font-mono text-[10px] tracking-[0.2em] uppercase"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
