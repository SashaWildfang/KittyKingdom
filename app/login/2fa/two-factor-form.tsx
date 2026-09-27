"use client";

import { KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Step two of logging in: a 6-digit authenticator code, or a backup code. */
export function TwoFactorForm({ account, error, startMode }: { account: string; error: string | null; startMode: "app" | "backup" }) {
  const [mode, setMode] = useState<"app" | "backup">(startMode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, [mode]);

  // Six digits typed or pasted: sign in straight away
  useEffect(() => {
    if (mode === "app" && /^\d{6}$/.test(code) && !busy) {
      setBusy(true);
      form.current?.requestSubmit();
    }
  }, [code, mode, busy]);

  return (
    <div className="tfa-card">
      <span className="tfa-icon" aria-hidden="true">
        <ShieldCheck size={30} />
      </span>
      <h1>Two-factor sign in</h1>
      <p className="tfa-lead">
        {mode === "app" ? (
          <>
            Open your authenticator app and enter the 6-digit code for <b>Kitty Kingdom</b> ({account}).
          </>
        ) : (
          <>Enter one of the backup codes you saved when you turned on two-factor authentication. Each one works once.</>
        )}
      </p>
      {error ? (
        <p className="tfa-error" role="alert">
          {error}
        </p>
      ) : null}
      <form ref={form} action="/api/account/2fa/login" method="post" onSubmit={() => setBusy(true)}>
        <input type="hidden" name="mode" value={mode} />
        {mode === "app" ? (
          <input
            ref={input}
            className="tfa-input"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            aria-label="6-digit code"
            required
          />
        ) : (
          <input
            ref={input}
            className="tfa-input tfa-input--backup"
            name="code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={9}
            placeholder="ABCD-EFGH"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            aria-label="Backup code"
            required
          />
        )}
        <button type="submit" className="tfa-submit" disabled={busy || (mode === "app" ? code.length !== 6 : code.replace(/[^A-Z0-9]/g, "").length !== 8)}>
          {busy ? "Checking…" : "Verify and sign in"}
        </button>
      </form>
      <button
        type="button"
        className="tfa-switch"
        onClick={() => {
          setMode(mode === "app" ? "backup" : "app");
          setCode("");
          setBusy(false);
        }}
      >
        {mode === "app" ? <KeyRound size={15} aria-hidden="true" /> : <Smartphone size={15} aria-hidden="true" />}
        {mode === "app" ? "Use a backup code instead" : "Use my authenticator app"}
      </button>
      <p className="tfa-foot">
        Lost your phone and your backup codes? Contact staff on Discord to get back in. <a href="/login">Back to log in</a>
      </p>
    </div>
  );
}
