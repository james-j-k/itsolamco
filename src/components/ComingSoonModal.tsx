"use client";

import { useModalA11y } from "@/lib/useModalA11y";

type Props = {
  open: boolean;
  onClose: () => void;
  label: string;
};

export default function ComingSoonModal({ open, onClose, label }: Props) {
  const containerRef = useModalA11y(open, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1C1712]/80 px-4"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="w-full max-w-sm border-2 border-[#1C1712] bg-[#F5F0E6] p-10 relative text-center focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-0 right-0 p-4 font-mono text-xs hover:text-[#B8451D]"
          aria-label="Close"
        >
          CLOSE ✕
        </button>
        <div className="font-mono text-[#B8451D] text-[11px] tracking-[0.28em] uppercase mb-4">{label}</div>
        <h3 className="font-display text-4xl mb-4">COMING SOON.</h3>
        <p className="text-[#8C8477] leading-relaxed">
          We&apos;re still setting this one up. In the meantime, find us at a quiz night —{" "}
          <a href="mailto:itsolamco@gmail.com" className="text-[#B8451D] hover:underline">
            itsolamco@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
