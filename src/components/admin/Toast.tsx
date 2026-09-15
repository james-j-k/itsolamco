"use client";

export type ToastItem = { id: number; message: string };

export default function Toast({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="border-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-3 shadow-[4px_4px_0_#1C1712] flex items-start gap-3"
        >
          <p className="font-mono text-[11px] leading-relaxed text-[#B8451D] flex-1">{t.message}</p>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            className="font-mono text-xs text-[#8C8477] hover:text-[#1C1712]"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
