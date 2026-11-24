"use client";

import { useState } from "react";

type Status = { email: string; enabled: boolean; recoveryLeft: number };
type Setup = { uri: string; qr: string; key: string };

const BOX = "border-2 border-[#1C1712] bg-[#F5F0E6] p-5 sm:p-6";
const LABEL = "font-mono text-[10px] uppercase tracking-[0.2em]";
const INPUT = "w-full border-2 border-[#1C1712] bg-[#F5F0E6] px-4 py-3 text-base focus:outline-none focus:border-[#B8451D]";
const BTN = "bg-[#B8451D] text-[#F5F0E6] px-5 py-3 font-mono text-xs tracking-[0.2em] uppercase disabled:opacity-60";
const BTN_LINE = "border-2 border-[#1C1712] px-5 py-3 font-mono text-xs tracking-[0.2em] uppercase disabled:opacity-60";

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function SecurityPanel({ initial }: { initial: Status }) {
  const [status, setStatus] = useState(initial);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null); // recovery codes, shown once
  const [saved, setSaved] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [panel, setPanel] = useState<"none" | "newcodes" | "off">("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const reset = () => { setCode(""); setPassword(""); setError(""); };

  async function startSetup() {
    setBusy(true); setError("");
    const r = await post("/api/admin/security/setup");
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "Couldn't start the setup");
    setSetup(r.data as Setup);
    reset();
  }

  async function turnOn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await post("/api/admin/security/enable", { code });
    setBusy(false);
    if (!r.ok) {
      if (r.data.restart) setSetup(null);
      return setError(r.data.error ?? "That didn't work");
    }
    setStatus({ ...status, enabled: true, recoveryLeft: r.data.recoveryCodes.length });
    setCodes(r.data.recoveryCodes);
    setSaved(false);
    setSetup(null);
    reset();
  }

  async function newCodes(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await post("/api/admin/security/recovery", { code });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "That didn't work");
    setStatus({ ...status, recoveryLeft: r.data.recoveryCodes.length });
    setCodes(r.data.recoveryCodes);
    setSaved(false);
    setPanel("none");
    reset();
  }

  async function turnOff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await post("/api/admin/security/disable", { password, code });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "That didn't work");
    setStatus({ ...status, enabled: false, recoveryLeft: 0 });
    setPanel("none");
    setNote("Two-step login is now off.");
    reset();
  }

  const codeField = (
    <label className="flex flex-col gap-2">
      <span className={LABEL}>6-digit code from your app</span>
      <input
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={12}
        placeholder="123456"
        className={`${INPUT} font-mono tracking-[0.3em] text-xl text-center`}
      />
    </label>
  );
  const errorLine = error && <div role="alert" className="font-mono text-xs text-[#B8451D]">{error}</div>;

  // The recovery codes are shown exactly once, and the page won't move on until they've been saved.
  if (codes) {
    const text = codes.join("\n");
    return (
      <div className="flex flex-col gap-5">
        <div className={BOX}>
          <div className={`${LABEL} text-[#B8451D] mb-2`}>Save these recovery codes</div>
          <p className="text-sm leading-relaxed mb-4">
            If you lose your phone, each of these gets you in <strong>once</strong>. They are shown only now. Put them somewhere safe
            (a password manager, or a photo kept private), not in an email to yourself on a shared device.
          </p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-base mb-4" data-testid="recovery-codes">
            {codes.map((c) => (
              <li key={c} className="border-2 border-dashed border-[#1C1712] px-3 py-2 text-center">{c}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={BTN_LINE} onClick={async () => setNote((await copy(text)) ? "Copied. Paste them somewhere safe." : "Couldn't copy: select the codes and copy them by hand.")}>
              Copy all
            </button>
          </div>
          {note && <div className="font-mono text-xs mt-3">{note}</div>}
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-1 h-5 w-5" />
          <span>I have saved these codes somewhere safe.</span>
        </label>
        <button type="button" disabled={!saved} className={BTN} onClick={() => { setCodes(null); setNote(""); }}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={BOX}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className={LABEL}>Two-step login</div>
          <span className={`font-mono text-[10px] tracking-[0.2em] uppercase px-3 py-1 border-2 border-[#1C1712] ${status.enabled ? "bg-[#1C1712] text-[#F5F0E6]" : "text-[#B8451D]"}`}>
            {status.enabled ? "On" : "Off"}
          </span>
        </div>
        <p className="text-sm leading-relaxed">
          {status.enabled
            ? "Signing in needs your password and a 6-digit code from your authenticator app. A stolen password alone can't get anyone into the admin."
            : "Add a 6-digit code from an authenticator app on your phone to the sign-in. Then a stolen or guessed password alone can't get anyone into the admin."}
        </p>
        {note && !status.enabled && <div className="font-mono text-xs mt-3">{note}</div>}
      </div>

      {!status.enabled && !setup && (
        <div>
          <button type="button" disabled={busy} onClick={startSetup} className={BTN}>
            {busy ? "Starting..." : "Set up two-step login"}
          </button>
          {errorLine}
        </div>
      )}

      {!status.enabled && setup && (
        <form onSubmit={turnOn} className={`${BOX} flex flex-col gap-5`}>
          <div>
            <div className={`${LABEL} text-[#B8451D] mb-1`}>Step 1</div>
            <p className="text-sm leading-relaxed">Install an authenticator app on your phone, if you don&apos;t have one: Google Authenticator, Microsoft Authenticator, Authy or 1Password all work.</p>
          </div>
          <div>
            <div className={`${LABEL} text-[#B8451D] mb-2`}>Step 2: add this account</div>
            <p className="text-sm leading-relaxed mb-3">
              <strong>On your phone:</strong> tap the button, and your authenticator app opens with the account ready to save.
            </p>
            <a href={setup.uri} className={`${BTN_LINE} inline-block text-center w-full sm:w-auto`}>Open in my authenticator app</a>
            <p className="text-sm leading-relaxed mt-4 mb-2">
              <strong>On a computer:</strong> scan this with the app.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="QR code to add It's Olam Company to your authenticator app" width={200} height={200} className="border-2 border-[#1C1712] bg-white" />
            <p className="text-sm leading-relaxed mt-4 mb-2">
              <strong>Or type the key in by hand</strong> (choose &ldquo;enter a setup key&rdquo;, time based):
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <code className="font-mono text-base break-all border-2 border-dashed border-[#1C1712] px-3 py-2" data-testid="setup-key">{setup.key}</code>
              <button type="button" className={BTN_LINE} onClick={async () => setNote((await copy(setup.key.replace(/\s/g, ""))) ? "Key copied." : "Couldn't copy: select it by hand.")}>
                Copy key
              </button>
            </div>
            {note && <div className="font-mono text-xs mt-2">{note}</div>}
          </div>
          <div>
            <div className={`${LABEL} text-[#B8451D] mb-2`}>Step 3: prove it works</div>
            {codeField}
          </div>
          {errorLine}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={BTN}>{busy ? "Checking..." : "Turn on"}</button>
            <button type="button" className={BTN_LINE} onClick={() => { setSetup(null); reset(); setNote(""); }}>Cancel</button>
          </div>
        </form>
      )}

      {status.enabled && (
        <>
          <div className={BOX}>
            <div className={`${LABEL} mb-2`}>Recovery codes</div>
            <p className="text-sm leading-relaxed">
              You have <strong data-testid="recovery-left">{status.recoveryLeft}</strong> unused recovery {status.recoveryLeft === 1 ? "code" : "codes"}.
              {status.recoveryLeft <= 2 && " That's running low: get a new set."}
            </p>
          </div>

          {panel !== "newcodes" && panel !== "off" && (
            <div className="flex flex-wrap gap-3">
              <button type="button" className={BTN_LINE} onClick={() => { setPanel("newcodes"); reset(); }}>Get new recovery codes</button>
              <button type="button" className={BTN_LINE} onClick={() => { setPanel("off"); reset(); }}>Turn off</button>
            </div>
          )}

          {panel === "newcodes" && (
            <form onSubmit={newCodes} className={`${BOX} flex flex-col gap-4`}>
              <p className="text-sm leading-relaxed">This makes a new set and cancels the old ones. Enter a code from your app to confirm.</p>
              {codeField}
              {errorLine}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={busy} className={BTN}>{busy ? "Checking..." : "Make new codes"}</button>
                <button type="button" className={BTN_LINE} onClick={() => { setPanel("none"); reset(); }}>Cancel</button>
              </div>
            </form>
          )}

          {panel === "off" && (
            <form onSubmit={turnOff} className={`${BOX} flex flex-col gap-4`}>
              <p className="text-sm leading-relaxed">To turn it off you need your password <strong>and</strong> a code from your app.</p>
              <label className="flex flex-col gap-2">
                <span className={LABEL}>Password</span>
                <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
              </label>
              {codeField}
              {errorLine}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={busy} className={BTN}>{busy ? "Checking..." : "Turn off"}</button>
                <button type="button" className={BTN_LINE} onClick={() => { setPanel("none"); reset(); }}>Cancel</button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
