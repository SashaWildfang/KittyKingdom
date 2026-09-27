"use client";

import { Check, Circle, X } from "lucide-react";
import { useState } from "react";
import { PasswordInput, STRENGTH_LABELS, passwordChecks, passwordStrength } from "../auth-card";

/** My Account -> Security -> Password: the same live checklist and strength bars as signing up. */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const checks = passwordChecks(next);
  const score = passwordStrength(next);
  const allOk = checks.every((c) => c.ok);
  const same = next.length > 0 && next === current;
  const matches = confirm.length > 0 && confirm === next;
  const ready = current.length > 0 && allOk && !same && matches;

  return (
    <form className="acct-pw" action="/api/account/password" method="post" onSubmit={() => setBusy(true)}>
      <PasswordInput name="currentAccountPassword" label="Current password" placeholder="Your current password" autoComplete="current-password" value={current} onChange={setCurrent} />
      <PasswordInput name="newAccountPassword" label="New password" placeholder="Create a new password" autoComplete="new-password" value={next} onChange={setNext} />

      <div className="kk-strength" aria-live="polite">
        <div className="kk-strength-bar" data-score={score}>
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} className={n <= score ? "is-on" : undefined} />
          ))}
        </div>
        <span>{STRENGTH_LABELS[score]}</span>
      </div>
      <ul className="kk-checks">
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? "is-ok" : undefined}>
            <span aria-hidden="true">{c.ok ? <Check size={12} strokeWidth={3} /> : <Circle size={10} />}</span> {c.label}
          </li>
        ))}
      </ul>
      {same ? <p className="acct-pw-hint is-bad">Choose a password that's different from your current one.</p> : null}

      <PasswordInput name="confirmAccountPassword" label="Confirm new password" placeholder="Type the new password again" autoComplete="new-password" value={confirm} onChange={setConfirm} />
      {confirm ? (
        <p className={`acct-pw-hint ${matches ? "is-ok" : "is-bad"}`}>
          {matches ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <X size={13} strokeWidth={3} aria-hidden="true" />} {matches ? "Passwords match" : "Passwords don't match yet"}
        </p>
      ) : null}

      <button className="acct-button acct-button--small" type="submit" disabled={!ready || busy}>
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
