"use client";

import { useEffect, useRef, useState } from "react";

// Asks the server for the night's state over and over, but only gets the full picture back when
// something changed (the server answers a repeat of the same version with a tiny "unchanged").
// `offset` is how far the server's clock is from this device's clock, so timers agree everywhere.
// `confirmedAt` is the server time of the latest answer of any kind, including "nothing changed": proof that the
// picture we hold was still the current one at that moment.
export function useLivePoll<T extends { version: number; now: number }>(url: string | null, intervalMs: number | (() => number), headers?: Record<string, string>) {
  const [state, setState] = useState<T | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [offset, setOffset] = useState(0);
  const [confirmedAt, setConfirmedAt] = useState(0);
  const [failures, setFailures] = useState(0); // answers in a row that didn't come (or came back as a server error)
  const [nonce, setNonce] = useState(0);
  const versionRef = useRef<number | null>(null);
  const headersRef = useRef<Record<string, string> | undefined>(headers);
  const intervalRef = useRef(intervalMs); // read on every round (a number, or a function that says the pace right now), so the pace can change without starting over

  useEffect(() => {
    headersRef.current = headers;
    intervalRef.current = intervalMs;
  });

  useEffect(() => {
    if (!url) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    versionRef.current = null;

    async function run() {
      inFlight = true;
      try {
        const known = versionRef.current;
        const sep = url!.includes("?") ? "&" : "?";
        // A request that never answers (weak signal, a phone that slept) must not freeze the screen: give up and ask again.
        const res = await fetch(known === null ? url! : `${url}${sep}v=${known}`, { cache: "no-store", headers: headersRef.current, signal: AbortSignal.timeout(6000) });
        const data = await res.json().catch(() => ({}));
        if (stopped) return;
        if (!res.ok) {
          setError({ status: res.status, message: data.error ?? "Connection problem" });
          setFailures((f) => (res.status >= 500 ? f + 1 : 0)); // a "no" from the server means we reached it
        } else {
          setError(null);
          setFailures(0);
          const serverNow: number | undefined = data.state?.now ?? data.now;
          if (typeof serverNow === "number") {
            const next = serverNow - Date.now();
            setOffset((cur) => (Math.abs(cur - next) > 150 ? next : cur));
            setConfirmedAt(serverNow);
          }
          if (data.state) {
            versionRef.current = data.state.version;
            setState(data.state as T);
          }
        }
      } catch {
        if (!stopped) {
          setError({ status: 0, message: "Connection lost. Trying again..." });
          setFailures((f) => f + 1);
        }
      }
      inFlight = false;
      if (!stopped) timer = setTimeout(run, typeof intervalRef.current === "function" ? intervalRef.current() : intervalRef.current);
    }
    run();
    // Phones throttle timers when the screen is off or the tab is in the background. Catch up the moment it is back.
    const wake = () => {
      if (document.visibilityState === "visible" && !stopped && !inFlight) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(run, 0);
      }
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [url, nonce]);

  // Ask again right now (after you press a button), instead of waiting for the next poll.
  const poke = () => setNonce((n) => n + 1);
  return { state, error, offset, confirmedAt, failures, poke };
}

// How good this device's connection is right now: "offline" after two missed answers in a row, "slow" after one missed
// answer or when the quickest ping to the server took close to a second.
export type ConnState = "good" | "slow" | "offline";
export function connectionOf(failures: number, rtt: number | null): ConnState {
  if (failures >= 2) return "offline";
  if (failures === 1 || (rtt !== null && rtt > 900)) return "slow";
  return "good";
}

// Once a team has buzzed the order stays open for a moment (the server's `lockUntil`). It is final when that moment has
// passed AND the picture we hold was confirmed current after it. Until then nobody is shown as "answering".
export function useOrderFinal(lockUntil: number | null, confirmedAt: number, offset: number): boolean {
  const reached = useReached(lockUntil, offset);
  return lockUntil === null || (reached && confirmedAt >= lockUntil);
}

// How far this device's clock is from the server's (server minus device, in ms). It asks the server for its time a few
// times and trusts the answer that came back fastest: a quick round trip leaves the least room for the two directions
// to have taken different times. It checks again every 20 seconds, and the moment the phone wakes or comes back online.
// Until the first answer comes in, `ready` is false and callers should use the poll's rougher offset.
export function useClockSync(): { offset: number; ready: boolean; rtt: number | null } {
  const [sync, setSync] = useState<{ offset: number; ready: boolean; rtt: number | null }>({ offset: 0, ready: false, rtt: null });
  useEffect(() => {
    let stopped = false;
    let running = false;
    const samples: { rtt: number; offset: number; at: number }[] = [];
    const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function sample() {
      const t0 = Date.now();
      try {
        const res = await fetch("/api/live/time", { cache: "no-store", signal: AbortSignal.timeout(4000) });
        const data = (await res.json()) as { now?: number };
        const t1 = Date.now();
        if (typeof data.now !== "number") return;
        const rtt = t1 - t0;
        samples.push({ rtt, offset: data.now - (t0 + rtt / 2), at: t1 });
      } catch {
        // a lost ping is fine, the next one will do
      }
    }

    async function burst(count: number, gap: number) {
      if (running) return;
      running = true;
      for (let i = 0; i < count && !stopped; i++) {
        await sample();
        if (i < count - 1) await pause(gap);
      }
      running = false;
      if (stopped) return;
      const cutoff = Date.now() - 90_000;
      while (samples.length > 0 && samples[0].at < cutoff) samples.shift();
      if (samples.length > 12) samples.splice(0, samples.length - 12);
      if (samples.length === 0) return;
      const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
      // Small differences are noise: keep the old offset so timers don't restart for nothing.
      setSync((cur) => {
        const sameOffset = cur.ready && Math.abs(cur.offset - best.offset) < 8;
        if (sameOffset && Math.abs((cur.rtt ?? 0) - best.rtt) < 100) return cur;
        return { offset: sameOffset ? cur.offset : best.offset, ready: true, rtt: best.rtt };
      });
    }

    void burst(6, 180);
    const every = setInterval(() => void burst(3, 250), 20_000);
    const wake = () => {
      if (document.visibilityState === "visible") void burst(4, 200);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      stopped = true;
      clearInterval(every);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, []);
  return sync;
}

// True once the server's clock has reached `target` (always true for null). It flips at that exact moment, not at the next
// tick of a clock, so a question opens on every screen and phone at the same instant.
export function useReached(target: number | null, offset: number): boolean {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (target === null) return;
    const wait = target - (Date.now() + offset);
    if (wait <= 0) return;
    const t = setTimeout(() => setTick((n) => n + 1), wait + 3);
    return () => clearTimeout(t);
  }, [target, offset]);
  // Reading the clock while drawing is the point here: the timer above forces a redraw at the moment it matters.
  // eslint-disable-next-line react-hooks/purity
  return target === null || Date.now() + offset >= target;
}

// When a press really happened, as a time on this device's clock. A phone can be busy for a moment before it runs the
// tap handler, so the event's own timestamp is used to look back to the real moment of the touch.
export function pressTime(e: { timeStamp: number }): number {
  const age = performance.now() - e.timeStamp;
  return Date.now() - (age >= 0 && age < 1000 ? age : 0);
}

// A clock that re-renders its component every `ms` milliseconds.
export function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function seconds(ms: number, digits = 2): string {
  return `${(ms / 1000).toFixed(digits)} s`;
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
