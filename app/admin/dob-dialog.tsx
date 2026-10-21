"use client";

// Admins recording a missing date of birth on an 18+ verification ticket (the join application's, or the one on
// the member's ID). Deliberately strict: the date typed twice, a "checked it" confirmation and a fresh 2FA code,
// and dates that are already recorded can't be changed here. The server checks all of it again.

import "./delete-ticket.css";
import { AlertTriangle, IdCard, Lock, ScrollText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { TicketSummary } from "../../lib/ticket-summary";

type Kind = "app" | "id";

/** MM/DD/YYYY (or M/D/YYYY, dashes or dots) → a date, or null. */
function parseMdy(text: string) {
  const m = /^\s*(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\s*$/.exec(text);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
  return d.getUTCMonth() === Number(m[1]) - 1 && d.getUTCDate() === Number(m[2]) && d.getUTCFullYear() >= 1900 && d.getTime() <= Date.now() ? d : null;
}
function ageOf(d: Date) {
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

export function DobDialog({
  ticket,
  missing,
  onClose,
  onSaved,
}: {
  ticket: { ticketId: number; openedBy?: string | null };
  /** Which dates are missing (only those can be recorded) */
  missing: { app: boolean; id: boolean; noApp?: boolean };
  onClose: () => void;
  onSaved: (summary: TicketSummary) => void;
}) {
  const [kind, setKind] = useState<Kind | null>(missing.id && !missing.app ? "id" : missing.app && !missing.id ? "app" : null);
  const [dob, setDob] = useState("");
  const [repeat, setRepeat] = useState("");
  const [checked, setChecked] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [busy, onClose]);

  const date = parseMdy(dob);
  const same = Boolean(date && parseMdy(repeat)?.getTime() === date.getTime());
  const age = date ? ageOf(date) : null;
  const codeOk = /^\d{6}$/.test(code.replace(/\s+/g, "")) || /^[a-z0-9]{4,5}-?[a-z0-9]{4,5}$/i.test(code.trim());
  const ready = Boolean(kind && date && same && checked && codeOk && !busy);

  async function save() {
    if (!ready || !kind) return;
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/tickets/${ticket.ticketId}/dob`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, dob, repeat, checked, code, openedBy: ticket.openedBy }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      setError(r?.error ?? "Couldn't save that.");
      // A used or wrong code can't be tried again
      setCode("");
      return;
    }
    onSaved(r.summary);
    onClose();
  }

  const option = (k: Kind, icon: React.ReactNode, title: string, note: string) => {
    const open = k === "app" ? missing.app : missing.id;
    return (
      <button type="button" className={`dobd-option${kind === k ? " is-on" : ""}`} disabled={!open || busy} onClick={() => (setKind(k), setChecked(false))} aria-pressed={kind === k}>
        {icon}
        <span>
          <b>{title}</b>
          <small>{open ? note : k === "app" && missing.noApp ? "They have no join application" : "Already recorded (can't be changed here)"}</small>
        </span>
      </button>
    );
  };

  return createPortal(
    <div className="tkd-wrap" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()} onClick={(e) => e.stopPropagation()}>
      <form
        className="tkd dobd"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dobd-title"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <button type="button" className="tkd-close" onClick={onClose} disabled={busy} aria-label="Close">
          <X size={18} />
        </button>
        <span className="tkd-icon dobd-icon" aria-hidden="true">
          <Lock size={22} />
        </span>
        <h3 id="dobd-title">Record a date of birth</h3>
        <p className="tkd-type">Ticket #{ticket.ticketId} · 18+ verification</p>

        <div className="dobd-options">
          {option("app", <ScrollText size={18} aria-hidden="true" />, "Join application", "Their form has no date of birth")}
          {option("id", <IdCard size={18} aria-hidden="true" />, "Their ID", "Read it off the ID in the transcript")}
        </div>

        {kind ? (
          <>
            <div className="dobd-dates">
              <label>
                <span>Date of birth</span>
                <input value={dob} onChange={(e) => setDob(e.target.value)} placeholder="MM/DD/YYYY" inputMode="numeric" autoComplete="off" disabled={busy} autoFocus />
              </label>
              <label>
                <span>Type it again</span>
                <input value={repeat} onChange={(e) => setRepeat(e.target.value)} onPaste={(e) => e.preventDefault()} placeholder="MM/DD/YYYY" inputMode="numeric" autoComplete="off" disabled={busy} />
              </label>
            </div>
            {dob && !date ? <p className="dobd-note">Use month/day/year, like 10/12/2001.</p> : null}
            {date && repeat && !same ? <p className="dobd-note is-bad">The two dates don&apos;t match.</p> : null}
            {date && age !== null ? (
              <p className={`dobd-age${age < 18 ? " is-bad" : ""}`}>
                {age < 18 ? <AlertTriangle size={14} aria-hidden="true" /> : null} Age {age}
                {age < 18 ? " — under 18. The ticket will be flagged." : ""}
              </p>
            ) : null}

            <label className="dobd-check">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={busy} />
              <span>{kind === "id" ? "I checked this against the ID in this ticket's transcript." : "This is the date of birth the member gave (or the one on their ID)."}</span>
            </label>

            <label className="dobd-code">
              <span>
                <Lock size={13} aria-hidden="true" /> 2FA code
              </span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" disabled={busy} maxLength={12} />
              <small>From your authenticator app (or a backup code). Needed for every save.</small>
            </label>
          </>
        ) : (
          <p className="dobd-note">Pick which date of birth you&apos;re recording.</p>
        )}

        <ul className="tkd-list dobd-rules">
          <li>Once saved it can&apos;t be changed from here.</li>
          <li>It&apos;s logged with your name in the admin log and the ticket log channel.</li>
        </ul>
        {error ? <p className="tkd-error">{error}</p> : null}
        <div className="tkd-actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="adm-btn" disabled={!ready}>
            <Lock size={14} aria-hidden="true" /> {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
