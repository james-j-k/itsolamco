"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INPUT = "border-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-3 text-base focus:outline-none focus:border-[#B8451D]";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null); // set once the password was right and a code is needed
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function startOver(message = "") {
    setChallenge(null);
    setCode("");
    setUseRecovery(false);
    setPassword("");
    setError(message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(challenge ? { challenge, code } : { email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.expired) return startOver(data.error);
        throw new Error(data.error ?? "Login failed");
      }
      if (data.needsCode) {
        setChallenge(data.challenge);
        setPassword("");
        return;
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
      <form onSubmit={handleSubmit} className="w-full max-w-sm border-2 border-[#1C1712] bg-[#F5F0E6] p-6 sm:p-10">
        <div className="font-mono text-[#B8451D] mb-2 text-[11px] tracking-[0.28em] uppercase">
          IT&apos;S OLAM COMPANY
        </div>
        <h1 className="font-display uppercase text-4xl mb-8" style={{ fontFamily: "sans-serif", letterSpacing: "-0.02em" }}>
          {challenge ? "Enter Code" : "Admin Login"}
        </h1>

        <div className="flex flex-col gap-4">
          {!challenge ? (
            <>
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Email</span>
                <input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Password</span>
                <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
              </label>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed">
                {useRecovery
                  ? "Type one of your recovery codes. Each one works only once."
                  : "Open your authenticator app and type the 6-digit code for It’s Olam Company."}
              </p>
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em]">{useRecovery ? "Recovery code" : "6-digit code"}</span>
                <input
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode={useRecovery ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={useRecovery ? 14 : 7}
                  placeholder={useRecovery ? "xxxxx-xxxxx" : "123456"}
                  className={`${INPUT} font-mono tracking-[0.3em] text-xl text-center`}
                />
              </label>
            </>
          )}

          {error && <div role="alert" className="font-mono text-xs text-[#B8451D]">{error}</div>}

          <button type="submit" disabled={loading} className="mt-2 bg-[#B8451D] text-[#F5F0E6] py-3 font-mono text-xs tracking-[0.2em] uppercase disabled:opacity-60">
            {loading ? "Checking..." : challenge ? "Verify" : "Sign In"}
          </button>

          {challenge && (
            <div className="flex flex-col gap-2 font-mono text-[11px] uppercase tracking-[0.15em]">
              <button type="button" onClick={() => { setUseRecovery(!useRecovery); setCode(""); setError(""); }} className="underline text-left py-1">
                {useRecovery ? "Use my authenticator app" : "Use a recovery code instead"}
              </button>
              <button type="button" onClick={() => startOver()} className="underline text-left py-1 text-[#8C8477]">
                Back
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
