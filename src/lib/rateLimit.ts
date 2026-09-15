import { NextRequest } from "next/server";

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 5;

// Best-effort, single-process in-memory limiter. Fine for a single Node
// server; if this ever runs across multiple serverless instances, swap
// this Map for a shared store (e.g. Upstash Redis) — the call sites won't change.
export function isRateLimited(request: NextRequest, routeKey: string): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const key = `${routeKey}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }

  bucket.count += 1;
  return bucket.count > MAX_REQUESTS;
}
