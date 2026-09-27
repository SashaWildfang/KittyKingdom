"use client";

import { AlertTriangle, Check, Copy, Download, KeyRound, Printer, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { useState } from "react";

type Status = { enabled: boolean; enabledAt: string | null; backupRemaining: number };
type Setup = { qr: string; secret: string; otpauth: string };

async function call(action: string, extra: Record<string, string> = {}) {
  const res = await fetch("/api/account/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
  const body = await res.json().catch(() => ({ ok: false, error: "That didn't work. Try again." }));
  if (!res.ok || !body.ok) throw new Error(body.error ?? "That didn't work. Try again.");
  return body;
}

/** The backup codes, shown once: copy, download or print them before moving on. */
function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `Kitty Kingdom backup codes\nGenerated ${new Date().toLocaleString()}\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`;
  return (
    <div className="tfa-codes">
      <p className="tfa-warn">
        <AlertTriangle size={16} aria-hidden="true" /> Save these backup codes now. They&apos;re the only way in if you lose your phone, and you won&apos;t see them again.
      </p>
      <ol className="tfa-code-grid">
        {codes.map((c) => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ol>
      <div className="tfa-actions">
        <button
          type="button"
          className="acct-button acct-button--small acct-button--ghost"
          onClick={() =>
            void navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          className="acct-button acct-button--small acct-button--ghost"
          onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
            a.download = "kitty-kingdom-backup-codes.txt";
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          <Download size={15} aria-hidden="true" /> Download
        </button>
        <button
          type="button"
          className="acct-button acct-button--small acct-button--ghost"
          onClick={() => {
            const w = window.open("", "_blank", "width=480,height=640");
            if (!w) return;
            w.document.write(`<pre style="font:16px/1.8 ui-monospace,Menlo,monospace;padding:24px">${text.replace(/</g, "&lt;")}</pre>`);
            w.document.close();
            w.print();
          }}
        >
          <Printer size={15} aria-hidden="true" /> Print
        </button>
      </div>
      <label className="tfa-check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>I&apos;ve saved my backup codes somewhere safe</span>
      </label>
      <button type="button" className="acct-button acct-button--small" disabled={!saved} onClick={onDone}>
        Done
      </button>
    </div>
  );
}

/** My Account -> Security: turn on authenticator-app codes, manage backup codes, turn it off. */
export function TwoFactorSettings({ initial }: { initial: Status }) {
  const [status, setStatus] = useState<Status>(initial);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"idle" | "regenerate" | "disable">("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    setMode("idle");
    setCode("");
    setPassword("");
    setError(null);
  };

  // Just turned on (or regenerated): show the codes before anything else
  if (codes) {
    return (
      <div className="tfa">
        <h3 className="tfa-title">
          <KeyRound size={18} aria-hidden="true" /> Your backup codes
        </h3>
        <BackupCodes
          codes={codes}
          onDone={() => {
            setCodes(null);
            setMessage(status.enabled ? "Two-factor authentication is on. You'll be asked for a code when you log in." : null);
          }}
        />
      </div>
    );
  }

  if (!status.enabled) {
    return (
      <div className="tfa">
        <div className="tfa-status">
          <span className="tfa-badge tfa-badge--off">
            <ShieldOff size={14} aria-hidden="true" /> Off
          </span>
          <div>
            <h3 className="tfa-title">Two-factor authentication</h3>
            <p>Add a second step to logging in: after your password, you&apos;ll enter a 6-digit code from an authenticator app on your phone.</p>
          </div>
        </div>

        {!setup ? (
          <button type="button" className="acct-button acct-button--small" disabled={busy} onClick={() => void run(async () => setSetup(await call("start")))}>
            <ShieldCheck size={16} aria-hidden="true" /> {busy ? "Starting…" : "Set up two-factor authentication"}
          </button>
        ) : (
          <ol className="tfa-steps">
            <li>
              <strong>
                <Smartphone size={15} aria-hidden="true" /> Get an authenticator app
              </strong>
              <p>Google Authenticator, Microsoft Authenticator, Authy, 1Password or any app that supports TOTP codes.</p>
            </li>
            <li>
              <strong>Scan this QR code</strong>
              <div className="tfa-qr-row">
                <div className="tfa-qr" role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: setup.qr }} />
                <div className="tfa-manual">
                  <p>Can&apos;t scan it? Enter this key in the app instead (time-based):</p>
                  <code>{setup.secret}</code>
                  <button
                    type="button"
                    className="acct-button acct-button--small acct-button--ghost"
                    onClick={() =>
                      void navigator.clipboard?.writeText(setup.secret.replace(/\s/g, "")).then(() => {
                        setCopiedKey(true);
                        window.setTimeout(() => setCopiedKey(false), 1500);
                      })
                    }
                  >
                    {copiedKey ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} {copiedKey ? "Copied" : "Copy key"}
                  </button>
                  <a className="tfa-link" href={setup.otpauth}>
                    On this phone? Open in your authenticator app
                  </a>
                </div>
              </div>
            </li>
            <li>
              <strong>Enter the 6-digit code from the app</strong>
              <form
                className="tfa-inline"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const out = await call("confirm", { code });
                    setStatus({ enabled: true, enabledAt: new Date().toISOString(), backupRemaining: out.codes.length });
                    setSetup(null);
                    setCode("");
                    setCodes(out.codes);
                  });
                }}
              >
                <input className="tfa-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-label="6-digit code" />
                <button type="submit" className="acct-button acct-button--small" disabled={busy || code.length !== 6}>
                  {busy ? "Checking…" : "Turn on"}
                </button>
                <button type="button" className="acct-button acct-button--small acct-button--ghost" onClick={() => setSetup(null)}>
                  Cancel
                </button>
              </form>
            </li>
          </ol>
        )}
        {error ? <p className="tfa-error">{error}</p> : null}
        {message ? <p className="tfa-message">{message}</p> : null}
      </div>
    );
  }

  const low = status.backupRemaining <= 3;
  return (
    <div className="tfa">
      <div className="tfa-status">
        <span className="tfa-badge">
          <ShieldCheck size={14} aria-hidden="true" /> On
        </span>
        <div>
          <h3 className="tfa-title">Two-factor authentication</h3>
          <p>
            You&apos;ll be asked for a code from your authenticator app when you log in
            {status.enabledAt ? ` (on since ${new Date(status.enabledAt).toLocaleDateString([], { dateStyle: "medium" })})` : ""}.
          </p>
        </div>
      </div>
      <p className={`tfa-remaining${low ? " is-low" : ""}`}>
        <KeyRound size={15} aria-hidden="true" /> {status.backupRemaining} of 10 backup codes left
        {low ? " · make new ones soon" : ""}
      </p>

      {mode === "idle" ? (
        <div className="tfa-actions">
          <button type="button" className="acct-button acct-button--small acct-button--ghost" onClick={() => setMode("regenerate")}>
            <KeyRound size={15} aria-hidden="true" /> New backup codes
          </button>
          <button type="button" className="acct-button acct-button--small acct-button--ghost tfa-danger" onClick={() => setMode("disable")}>
            <ShieldOff size={15} aria-hidden="true" /> Turn off
          </button>
        </div>
      ) : (
        <form
          className="tfa-confirm"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (mode === "regenerate") {
                const out = await call("regenerate", { code });
                setStatus((s) => ({ ...s, backupRemaining: out.codes.length }));
                reset();
                setCodes(out.codes);
              } else {
                const out = await call("disable", { code, password });
                setStatus({ enabled: false, enabledAt: null, backupRemaining: 0 });
                reset();
                setMessage(out.message);
              }
            });
          }}
        >
          <p>{mode === "regenerate" ? "Enter a code from your app to make 10 new backup codes. Your old backup codes will stop working." : "Turning off two-factor makes your account easier to break into. Enter your password and a code to confirm."}</p>
          {mode === "disable" ? (
            <input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
          ) : null}
          <input className="tfa-input" autoComplete="one-time-code" maxLength={9} placeholder="Code or backup code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Authenticator or backup code" />
          <div className="tfa-actions">
            <button type="submit" className={`acct-button acct-button--small${mode === "disable" ? " acct-button--danger" : ""}`} disabled={busy || code.trim().length < 6 || (mode === "disable" && !password)}>
              {busy ? "Checking…" : mode === "regenerate" ? "Make new codes" : "Turn off two-factor"}
            </button>
            <button type="button" className="acct-button acct-button--small acct-button--ghost" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {error ? <p className="tfa-error">{error}</p> : null}
      {message ? <p className="tfa-message">{message}</p> : null}
    </div>
  );
}
