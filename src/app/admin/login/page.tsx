"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Login failed");
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F0E6] text-[#1C1712] flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm border-2 border-[#1C1712] bg-[#F5F0E6] p-10"
      >
        <div className="font-mono text-[#B8451D] mb-2 text-[11px] tracking-[0.28em] uppercase">
          IT&apos;S OLAM COMPANY
        </div>
        <h1 className="font-display uppercase text-4xl mb-8" style={{ fontFamily: "sans-serif", letterSpacing: "-0.02em" }}>
          Admin Login
        </h1>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-3 focus:outline-none focus:border-[#B8451D]"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Password</span>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-3 focus:outline-none focus:border-[#B8451D]"
            />
          </label>

          {error && <div className="font-mono text-xs text-[#B8451D]">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-[#B8451D] text-[#F5F0E6] py-3 font-mono text-xs tracking-[0.2em] uppercase disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}
