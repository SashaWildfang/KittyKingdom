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
function withSlashes(next: string, deleting: boolean) {
  // Deleting (Backspace/Delete/cut, anywhere in the date): leave what they have alone, so it always does
  // something. "1/02/2000" and the like still save (the date check accepts single digits). Typing and
  // pasting (even a shorter date over a longer one) are always formatted.
  if (deleting) return next.replace(/[^\d/]/g, "").slice(0, 10);
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

/** Whether this change came from deleting (not typing or pasting). */
const isDelete = (e: React.ChangeEvent<HTMLInputElement>) => String((e.nativeEvent as InputEvent).inputType ?? "").startsWith("delete");

function ageOf(d: Date) {
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

type OnFile = { hasApp: boolean; app: string | null; appAnswer: string | null; id: string | null };
const showDay = (iso: string | null) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : null);

export function DobDialog({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: { ticketId: number; key?: string; openedBy?: string | null };
  onClose: () => void;
  onSaved: (summary: TicketSummary) => void;
}) {
  // What's on file right now (loaded when the dialog opens; a save only goes through if it's still the same)
  const [onFile, setOnFile] = useState<OnFile | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [dob, setDob] = useState("");
  const [repeat, setRepeat] = useState("");
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    fetch(`/api/admin/tickets/${ticket.ticketId}/dob${ticket.key ? `?key=${encodeURIComponent(ticket.key)}` : ""}`, { cache: "no-store" })
      .then((x) => x.json())
      .then((r) => {
        if (off) return;
        if (!r?.ok) return setError(r?.error ?? "Couldn't load the dates on file.");
        setOnFile(r as OnFile);
        // Straight to the one that's missing, if only one is
        if (r.hasApp && !r.app && r.id) setKind("app");
        else if (r.app && !r.id) setKind("id");
        else if (!r.hasApp) setKind("id");
      })
      .catch(() => !off && setError("Couldn't load the dates on file."));
    return () => {
      off = true;
    };
  }, [ticket.ticketId, ticket.key]);

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

  const current = kind && onFile ? (kind === "app" ? onFile.app : onFile.id) : null;
  const editing = Boolean(current);
  const date = parseMdy(dob);
  const same = Boolean(date && parseMdy(repeat)?.getTime() === date.getTime());
  const unchanged = Boolean(date && current && date.toISOString().slice(0, 10) === current);
  const age = date ? ageOf(date) : null;
  const ready = Boolean(kind && onFile && date && same && !unchanged && checked && (!editing || reason.trim().length >= 3) && !busy);

  async function save() {
    if (!ready || !kind) return;
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/tickets/${ticket.ticketId}/dob`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, dob, repeat, checked, reason, expect: current, openedBy: ticket.openedBy, key: ticket.key }),
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

  const option = (k: Kind, icon: React.ReactNode, title: string) => {
    const value = onFile ? (k === "app" ? onFile.app : onFile.id) : null;
    const blocked = !onFile || (k === "app" && !onFile.hasApp);
    const note = !onFile ? "Loading…" : k === "app" && !onFile.hasApp ? "They have no join application" : value ? `On file: ${showDay(value)} · change it` : k === "app" ? "Not on their form · add it" : "Not recorded · add it";
    return (
      <button
        type="button"
        className={`dobd-option${kind === k ? " is-on" : ""}`}
        disabled={blocked || busy}
        onClick={() => (setKind(k), setChecked(false), setReason(""), setDob(""), setRepeat(""), setError(null))}
        aria-pressed={kind === k}
      >
        {icon}
        <span>
          <b>{title}</b>
          <small>{note}</small>
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
        <h3 id="dobd-title">{editing ? "Correct a date of birth" : "Record a date of birth"}</h3>
        <p className="tkd-type">Ticket #{ticket.ticketId} · 18+ verification</p>

        <div className="dobd-options">
          {option("app", <ScrollText size={18} aria-hidden="true" />, "Join application")}
          {option("id", <IdCard size={18} aria-hidden="true" />, "Their ID")}
        </div>

        {kind && onFile ? (
          <>
            {editing ? (
              <p className="dobd-current">
                On file now: <b>{showDay(current)}</b> (age {ageOf(new Date(`${current}T00:00:00Z`))}). Type the correct date below.
                {kind === "app" && onFile.appAnswer ? <small>What they wrote on the form: &ldquo;{onFile.appAnswer}&rdquo;</small> : null}
              </p>
            ) : null}
            <div className="dobd-dates">
              <label>
                <span>{editing ? "Correct date of birth" : "Date of birth"}</span>
                <input value={dob} onChange={(e) => setDob(withSlashes(e.target.value, isDelete(e)))} placeholder="MM/DD/YYYY" inputMode="numeric" maxLength={10} autoComplete="off" disabled={busy} autoFocus />
              </label>
              <label>
                <span>Type it again</span>
                <input value={repeat} onChange={(e) => setRepeat(withSlashes(e.target.value, isDelete(e)))} onPaste={(e) => e.preventDefault()} placeholder="MM/DD/YYYY" inputMode="numeric" maxLength={10} autoComplete="off" disabled={busy} />
              </label>
            </div>
            {dob && !date ? <p className="dobd-note">Use month/day/year, like 10/12/2001.</p> : null}
            {date && repeat && !same ? <p className="dobd-note is-bad">The two dates don&apos;t match.</p> : null}
            {unchanged ? <p className="dobd-note is-bad">That&apos;s already the date on file.</p> : null}
            {date && age !== null ? (
              <p className={`dobd-age${age < 18 ? " is-bad" : ""}`}>
                {age < 18 ? <AlertTriangle size={14} aria-hidden="true" /> : null} Age {age}
                {age < 18 ? " — under 18. The ticket will be flagged." : ""}
              </p>
            ) : null}

            {editing ? (
              <label className="dobd-reason">
                <span>Why are you changing it?</span>
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. typo when it was recorded" disabled={busy} />
              </label>
            ) : null}

            <label className="dobd-check">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={busy} />
              <span>{kind === "id" ? "I checked this against the ID in this ticket's transcript." : "This is the date of birth the member gave (or the one on their ID)."}</span>
            </label>

          </>
        ) : (
          <p className="dobd-note">{onFile ? "Pick which date of birth to record or correct." : error ? "" : "Loading the dates on file…"}</p>
        )}

        <ul className="tkd-list dobd-rules">
          <li>Needs two-factor authentication turned on for your account.</li>
          <li>Changing a recorded date needs a reason. The old date is kept in their history.</li>
          <li>It&apos;s logged with your name in the admin log and the ticket log channel.</li>
        </ul>
        {error ? <p className="tkd-error">{error}</p> : null}
        <div className="tkd-actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="adm-btn" disabled={!ready}>
            <Lock size={14} aria-hidden="true" /> {busy ? "Saving…" : editing ? "Save correction" : "Save"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
