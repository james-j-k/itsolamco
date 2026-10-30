"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Type the four-letter code from the projector if you can't scan the QR.
export default function PlayEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <main style={{ minHeight: "100dvh", background: "#1C1512", color: "#F5F0E6", padding: "20px 18px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, fontFamily: "var(--font-archivo), Arial, sans-serif" }}>
      <div style={{ fontFamily: "var(--font-anton), Impact, sans-serif", fontSize: 44, lineHeight: 1 }}>JOIN THE NIGHT</div>
      <p style={{ color: "#D9CBB8" }}>Enter the code on the big screen.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code) router.push(`/play/${code}`);
        }}
        style={{ display: "grid", gap: 12 }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
          placeholder="CODE"
          aria-label="Quiz code"
          autoCapitalize="characters"
          autoComplete="off"
          style={{ fontSize: 40, letterSpacing: 10, textAlign: "center", padding: 16, borderRadius: 14, border: 0 }}
        />
        <button type="submit" disabled={!code} style={{ background: "#F2A93B", color: "#1C1512", border: 0, borderRadius: 14, padding: 18, fontSize: 22, fontWeight: 800, opacity: code ? 1 : 0.5 }}>
          GO
        </button>
      </form>
    </main>
  );
}
