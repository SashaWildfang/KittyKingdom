"use client";

import "./delete-ticket.css";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** True for admins, who can delete NSFW verification tickets too (the server checks as well). */
export const TicketDeletePermissions = createContext(false);
/** True for admins. Other staff can look at tickets but not delete them (the server checks too). */
export const TicketCanDelete = createContext(false);

/**
 * Delete a closed ticket and its transcript (admins). Opens a confirm dialog first; NSFW tickets also ask
 * for the ticket number to be typed. Open tickets are closed in Discord instead.
 */
export function DeleteTicketButton({
  ticket,
  onDeleted,
  label = false,
}: {
  ticket: { ticketId: number; type: string; status?: string; openedBy?: string | null; created?: string | null };
  onDeleted: (ticketId: number, message?: string) => void;
  /** Show "Delete" next to the icon */
  label?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mayDeleteNsfw = useContext(TicketDeletePermissions);
  const canDelete = useContext(TicketCanDelete);
  const nsfw = /nsfw/i.test(ticket.type);
  if (ticket.status === "Open" || !canDelete || (nsfw && !mayDeleteNsfw)) return null;

  return (
    <>
      <button
        type="button"
        className={`adm-btn ${label ? "" : "adm-btn--tiny "}adm-btn--ghost adm-ticket-delete`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title={`Delete ticket #${ticket.ticketId}`}
        aria-label={`Delete ticket #${ticket.ticketId}`}
      >
        <Trash2 size={14} aria-hidden="true" />
        {label ? " Delete" : null}
      </button>
      {open ? <ConfirmDelete ticket={ticket} nsfw={nsfw} onClose={() => setOpen(false)} onDeleted={onDeleted} /> : null}
    </>
  );
}

function ConfirmDelete({
  ticket,
  nsfw,
  onClose,
  onDeleted,
}: {
  ticket: { ticketId: number; type: string; openedBy?: string | null; created?: string | null };
  nsfw: boolean;
  onClose: () => void;
  onDeleted: (ticketId: number, message?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const ready = !nsfw || typed.trim().replace(/^#/, "") === String(ticket.ticketId);

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

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      // Numbers move after deletions: say which ticket this is, so a stale page can't delete a different one
      const expect = new URLSearchParams({ ...(ticket.created ? { created: ticket.created } : {}), ...(ticket.openedBy ? { openedBy: ticket.openedBy } : {}) });
      const res = await fetch(`/api/admin/tickets/${ticket.ticketId}?${expect}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Couldn't delete that ticket.");
      // Other open lists (Tickets tab, member profile) drop it too
      window.dispatchEvent(new CustomEvent("kk-ticket-deleted", { detail: ticket.ticketId }));
      onDeleted(ticket.ticketId, body.message);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that ticket.");
      setBusy(false);
    }
  }

  const type = ticket.type.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return createPortal(
    <div className="tkd-wrap" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()} onClick={(e) => e.stopPropagation()}>
      <div className="tkd" role="alertdialog" aria-modal="true" aria-labelledby="tkd-title">
        <button type="button" className="tkd-close" onClick={onClose} disabled={busy} aria-label="Close">
          <X size={18} />
        </button>
        <span className="tkd-icon" aria-hidden="true">
          <Trash2 size={22} />
        </span>
        <h3 id="tkd-title">Delete ticket #{ticket.ticketId}?</h3>
        <p className="tkd-type">{type}</p>
        <ul className="tkd-list">
          <li>The ticket and its transcript are deleted for good, from the website and the transcript channel.</li>
          <li>Every ticket after it moves down one number, so there are no gaps.</li>
          <li>It&apos;s logged in the bot logs channel.</li>
        </ul>
        {nsfw ? (
          <label className="tkd-typed">
            <span className="tkd-typed-note">
              <AlertTriangle size={14} aria-hidden="true" /> This is an 18+ verification ticket.
            </span>
            <span className="tkd-typed-ask">
              To confirm, type <b>{ticket.ticketId}</b>
            </span>
            <input autoFocus inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={String(ticket.ticketId)} disabled={busy} aria-label={`Type ${ticket.ticketId} to confirm`} />
          </label>
        ) : null}
        {error ? <p className="tkd-error">{error}</p> : null}
        <div className="tkd-actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose} disabled={busy} autoFocus={!nsfw}>
            Cancel
          </button>
          <button type="button" className="adm-btn adm-btn--danger" onClick={() => void remove()} disabled={busy || !ready}>
            <Trash2 size={15} aria-hidden="true" /> {busy ? "Deleting…" : `Delete #${ticket.ticketId}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
