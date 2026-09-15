"use client";

import { useState } from "react";
import { useModalA11y } from "@/lib/useModalA11y";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function VenueInquiryModal({ open, onClose }: Props) {
  const [venueName, setVenueName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — real users never see or fill this
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [formRenderedAt] = useState(() => Date.now());
  const containerRef = useModalA11y(open, onClose);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/venue-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueName, contactName, email, phone, message, website, formRenderedAt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }
      setStatus("done");
      setVenueName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#1C1712]/80 sm:px-4"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Host a night"
        tabIndex={-1}
        className="modal-sheet w-full sm:max-w-lg border-2 border-[#1C1712] bg-[#F5F0E6] p-8 pb-10 md:p-12 relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto focus:outline-none rounded-t-2xl sm:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 bg-[#1C1712]/20 rounded-full mx-auto mb-6" aria-hidden="true" />
        <button
          onClick={onClose}
          className="absolute top-0 right-0 p-4 font-mono text-xs hover:text-[#B8451D]"
          aria-label="Close"
        >
          CLOSE ✕
        </button>

        {status === "done" ? (
          <div className="py-12 text-center">
            <div className="font-mono text-[#B8451D] mb-4">MESSAGE SENT</div>
            <h3 className="font-display text-4xl mb-6">WE&apos;LL BE IN TOUCH.</h3>
            <p className="text-[#8C8477]">
              We usually reply within a couple of days.
            </p>
            <button
              onClick={onClose}
              className="btn-rust mt-8 px-8 py-3 font-display text-lg"
            >
              CLOSE
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="font-mono text-[#B8451D] mb-2">FOR THE BARS</div>
            <h3 className="font-display text-4xl mb-8">HOST A NIGHT</h3>

            {/* Honeypot: hidden from real users, catches basic bots that auto-fill every field */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
            />

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[10px]">VENUE NAME</span>
                <input
                  required
                  autoComplete="organization"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="border-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-3 focus:outline-none focus:border-[#B8451D]"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-mono text-[10px]">YOUR NAME</span>
                <input
                  required
                  autoComplete="name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="border-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-3 focus:outline-none focus:border-[#B8451D]"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="font-mono text-[10px]">EMAIL</span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-3 focus:outline-none focus:border-[#B8451D]"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="font-mono text-[10px]">PHONE</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="border-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-3 focus:outline-none focus:border-[#B8451D]"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="font-mono text-[10px]">TELL US ABOUT YOUR PLACE</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="border-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-3 focus:outline-none focus:border-[#B8451D] resize-none"
                />
              </label>

              {status === "error" && (
                <div className="font-mono text-xs text-[#B8451D]">{errorMsg}</div>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="border-2 border-[#1C1712] mt-2 py-4 font-display text-xl hover:bg-[#1C1712] hover:text-[#F5F0E6] transition-all disabled:opacity-60"
              >
                {status === "submitting" ? "SENDING..." : "SEND INQUIRY"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
