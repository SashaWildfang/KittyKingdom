"use client";

import { useState } from "react";

/**
 * "Wrong email?" — fixes a mistyped address before it's confirmed and sends the link to the new one.
 * During sign-up the browser's sign-up is enough; from the login page it asks for the password too.
 */
export function ChangeEmailForm({ identifier, onChanged, className }: { identifier?: string; onChanged?: (email: string) => void; className?: string }) {
  const fromLogin = identifier !== undefined;
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState(identifier ?? "");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fromLogin ? { identifier: who, password, email } : { email }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; email?: string };
      setMessage({ ok: Boolean(body.ok), text: body.message ?? (body.ok ? "Updated." : "That didn't work. Please try again.") });
      if (body.ok && body.email) {
        setPassword("");
        setEmail("");
        onChanged?.(body.email);
      }
    } catch {
      setMessage({ ok: false, text: "That didn't work right now. Please try again in a moment." });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={`change-email-toggle ${className ?? ""}`} onClick={() => setOpen(true)}>
        Typed your email wrong? Fix it
      </button>
    );
  }

  return (
    <form className={`change-email-form ${className ?? ""}`} onSubmit={submit}>
      {fromLogin ? (
        <>
          <label>
            <span>Email you signed up with (or username)</span>
            <input value={who} onChange={(e) => setWho(e.target.value)} autoComplete="username" required maxLength={254} />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required maxLength={200} />
          </label>
        </>
      ) : null}
      <label>
        <span>Correct email address</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} placeholder="you@example.com" />
      </label>
      <div className="change-email-actions">
        <button type="submit" className="change-email-submit" disabled={busy}>
          {busy ? "Saving…" : "Update & resend link"}
        </button>
        <button type="button" className="change-email-cancel" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {message ? (
        <p className={`change-email-msg${message.ok ? " is-ok" : ""}`} role="status">
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
