import type { NextConfig } from "next";

// Next.js App Router streams RSC payloads via inline <script> tags, and a few
// components use inline style attributes — so script-src/style-src need
// 'unsafe-inline' rather than a strict nonce setup. Everything else is locked
// down to same-origin — all icons are bundled via lucide-react rather than
// loaded from a third-party CDN, so no external script/connect origins are needed.
// 'unsafe-eval' is dev-only — React's dev mode uses eval() for its debugging
// overlay; it never does in production, so prod keeps the stricter policy.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Next.js's dev server only auto-allows localhost and the hostname it was
  // started with; any other origin (e.g. testing over the LAN IP on a phone)
  // gets its dev-only endpoints — including the HMR websocket — silently
  // blocked. That makes the HMR client fail to connect and fall back to
  // reload loops, which look exactly like "buttons don't work": the page
  // keeps resetting itself before a click can register. Only matters in dev.
  allowedDevOrigins: ["192.168.29.190"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
