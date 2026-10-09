"use client";

import { useState } from "react";

type Response = "coming" | "declined";

type Props = {
  token: string;
  defaultHeadcount: number;
  initialResponse: Response | null;
  initialTableBooked: boolean | null;
  offerNote: string | null;
  districtUrl: string | null;
  swiggyUrl: string | null;
};

const choiceBase =
  "w-full border-2 border-[#1C1712] px-4 py-4 font-display text-xl text-left transition-colors";
const choiceOn = "bg-[#1C1712] text-[#F5F0E6]";
const choiceOff = "bg-[#F5F0E6] text-[#1C1712] hover:bg-[#1C1712]/5";

export default function RsvpForm({
  token,
  defaultHeadcount,
  initialResponse,
  initialTableBooked,
  offerNote,
  districtUrl,
  swiggyUrl,
}: Props) {
  const [response, setResponse] = useState<Response | null>(initialResponse);
  const [headcount, setHeadcount] = useState(String(defaultHeadcount));
  const [tableBooked, setTableBooked] = useState<boolean | null>(initialTableBooked);
  // Already answered earlier -> start on the "thanks" view, with a way back.
  const [submitted, setSubmitted] = useState(initialResponse !== null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const headcountNumber = Number(headcount);
  const headcountValid = Number.isInteger(headcountNumber) && headcountNumber >= 1 && headcountNumber <= 15;
  // The table question is optional, so only the headcount gates "coming".
  const canSubmit = !sending && response !== null && (response === "declined" || headcountValid);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || response === null) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/rsvp/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          response === "coming"
            ? { response, headcount: headcountNumber, ...(tableBooked !== null && { tableBooked }) }
            : { response }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const hasTableInfo = Boolean(offerNote || districtUrl || swiggyUrl);

  if (submitted && response) {
    return (
      <div>
        {response === "coming" ? (
          <>
            <div className="font-mono text-[#B8451D] text-xs tracking-[0.28em] uppercase mb-2">LOCKED IN ✓</div>
            <p className="text-lg mb-5">
              Thanks! We&apos;ve got you down for <strong>{headcountNumber} {headcountNumber === 1 ? "player" : "players"}</strong>.
            </p>
            {tableBooked !== true && hasTableInfo && (
              <div className="border-2 border-[#B8451D] p-4 mb-5">
                <div className="font-mono text-[#B8451D] text-xs tracking-[0.2em] uppercase mb-2">LOCK YOUR TABLE</div>
                <p className="leading-relaxed mb-3">{offerNote || "Reserve your team's table ahead of the night:"}</p>
                <div className="flex flex-col gap-2">
                  {districtUrl && (
                    <a href={districtUrl} target="_blank" rel="noopener noreferrer" className="border-2 border-[#1C1712] px-4 py-3 font-mono text-xs uppercase tracking-wider text-center">
                      Book on District →
                    </a>
                  )}
                  {swiggyUrl && (
                    <a href={swiggyUrl} target="_blank" rel="noopener noreferrer" className="border-2 border-[#1C1712] px-4 py-3 font-mono text-xs uppercase tracking-wider text-center">
                      Book on Swiggy Dineout →
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="font-mono text-[#B8451D] text-xs tracking-[0.28em] uppercase mb-2">NOTED</div>
            <p className="text-lg mb-5">Sorry to miss you. Hope to see you at the next one.</p>
          </>
        )}
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="font-mono text-xs uppercase tracking-wider underline underline-offset-4 text-[#6A6357] hover:text-[#B8451D]"
        >
          Change my answer
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <button type="button" onClick={() => setResponse("coming")} className={`${choiceBase} ${response === "coming" ? choiceOn : choiceOff}`}>
        YES, WE&apos;RE COMING
      </button>
      <button type="button" onClick={() => setResponse("declined")} className={`${choiceBase} ${response === "declined" ? choiceOn : choiceOff}`}>
        CAN&apos;T MAKE IT
      </button>

      {response === "coming" && (
        <div className="flex flex-col gap-5 mt-3">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-xs">HOW MANY PLAYERS ARE COMING?</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={15}
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              className="border-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-3 text-base focus:outline-none focus:border-[#B8451D]"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs leading-relaxed">
              HAVE YOU BOOKED A TABLE ON SWIGGY / DISTRICT FOR 20% OFF? (OPTIONAL)
            </span>
            {/* Tapping the selected option again clears it, since the question is optional. */}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setTableBooked(tableBooked === true ? null : true)} className={`${choiceBase} text-base ${tableBooked === true ? choiceOn : choiceOff}`}>
                Yes, booked
              </button>
              <button type="button" onClick={() => setTableBooked(tableBooked === false ? null : false)} className={`${choiceBase} text-base ${tableBooked === false ? choiceOn : choiceOff}`}>
                Not yet
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="font-mono text-xs text-[#B8451D]">{error}</div>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn-rust mt-3 py-4 font-display text-xl disabled:opacity-40"
      >
        {sending ? "SENDING..." : "SEND MY ANSWER"}
      </button>
    </form>
  );
}
