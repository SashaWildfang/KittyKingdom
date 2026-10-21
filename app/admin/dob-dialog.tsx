"use client";

// Admins recording a missing date of birth on an 18+ verification ticket (the join application's, or the one on
// the member's ID). Deliberately strict: admins with 2FA turned on, the date typed twice and a "checked it"
// confirmation, and dates that are already recorded can't be changed here. The server checks all of it again.

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
/**
 * Types the slashes for you: "10" → "10/", "1016" → "10/16/", "10161999" → "10/16/1999", and "1/2/2000" →
 * "01/02/2000". While deleting, nothing is reformatted, so Backspace and Delete work normally.
 */
function withSlashes(next: string, prev: string) {
  // Deleting (anywhere in the date): leave what they have alone, so Backspace/Delete always do something.
  // "1/02/2000" and the like still save (the date check accepts single digits)
  if (next.length < prev.length) return next.replace(/[^\d/]/g, "").slice(0, 10);
  // A slash typed after a single digit pads it ("1/2/2000" → "01/02/2000"), so short dates still work
  const parts = next.replace(/[.\-]/g, "/").split("/");
  const digits = parts
    .map((p, i) => {
      const d = p.replace(/\D/g, "");
      return i < parts.length - 1 && i < 2 && d.length === 1 ? `0${d}` : d;
    })
    .join("")
    .slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length >= 2) out += "/";
  out += digits.slice(2, 4);
  if (digits.length >= 4) out += "/";
  out += digits.slice(4, 8);
  return out;
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
  const ready = Boolean(kind && date && same && checked && !busy);

  async function save() {
    if (!ready || !kind) return;
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/tickets/${ticket.ticketId}/dob`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, dob, repeat, checked, openedBy: ticket.openedBy }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      setError(r?.error ?? "Couldn't save that.");
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
                <input value={dob} onChange={(e) => setDob(withSlashes(e.target.value, dob))} placeholder="MM/DD/YYYY" inputMode="numeric" maxLength={10} autoComplete="off" disabled={busy} autoFocus />
              </label>
              <label>
                <span>Type it again</span>
                <input value={repeat} onChange={(e) => setRepeat(withSlashes(e.target.value, repeat))} onPaste={(e) => e.preventDefault()} placeholder="MM/DD/YYYY" inputMode="numeric" maxLength={10} autoComplete="off" disabled={busy} />
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

          </>
        ) : (
          <p className="dobd-note">Pick which date of birth you&apos;re recording.</p>
        )}

        <ul className="tkd-list dobd-rules">
          <li>Needs two-factor authentication turned on for your account.</li>
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
