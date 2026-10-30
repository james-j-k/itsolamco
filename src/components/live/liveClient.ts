"use client";

import { useEffect, useRef, useState } from "react";

// Asks the server for the night's state over and over, but only gets the full picture back when
// something changed (the server answers a repeat of the same version with a tiny "unchanged").
// `offset` is how far the server's clock is from this device's clock, so timers agree everywhere.
export function useLivePoll<T extends { version: number; now: number }>(url: string | null, intervalMs: number, headers?: Record<string, string>) {
  const [state, setState] = useState<T | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [offset, setOffset] = useState(0);
  const [nonce, setNonce] = useState(0);
  const versionRef = useRef<number | null>(null);
  const headersRef = useRef<Record<string, string> | undefined>(headers);

  useEffect(() => {
    headersRef.current = headers;
  });

  useEffect(() => {
    if (!url) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    versionRef.current = null;

    async function run() {
      try {
        const known = versionRef.current;
        const sep = url!.includes("?") ? "&" : "?";
        const res = await fetch(known === null ? url! : `${url}${sep}v=${known}`, { cache: "no-store", headers: headersRef.current });
        const data = await res.json().catch(() => ({}));
        if (stopped) return;
        if (!res.ok) {
          setError({ status: res.status, message: data.error ?? "Connection problem" });
        } else {
          setError(null);
          const serverNow: number | undefined = data.state?.now ?? data.now;
          if (typeof serverNow === "number") {
            const next = serverNow - Date.now();
            setOffset((cur) => (Math.abs(cur - next) > 150 ? next : cur));
          }
          if (data.state) {
            versionRef.current = data.state.version;
            setState(data.state as T);
          }
        }
      } catch {
        if (!stopped) setError({ status: 0, message: "Connection lost. Trying again..." });
      }
      if (!stopped) timer = setTimeout(run, intervalMs);
    }
    run();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [url, intervalMs, nonce]);

  // Ask again right now (after you press a button), instead of waiting for the next poll.
  const poke = () => setNonce((n) => n + 1);
  return { state, error, offset, poke };
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
