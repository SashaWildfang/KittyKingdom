"use client";

import { Lock, Trash2 } from "lucide-react";
import { useState } from "react";

/**
 * Delete a closed ticket and its transcript (Admins). Asks to confirm first. NSFW tickets can never
 * be deleted, and open tickets are closed in Discord instead.
 */
export function DeleteTicketButton({
  ticket,
  onDeleted,
  label = false,
}: {
  ticket: { ticketId: number; type: string; status?: string };
  onDeleted: (ticketId: number) => void;
  /** Show "Delete" next to the icon */
  label?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ticket.status === "Open") return null;
  if (/nsfw/i.test(ticket.type)) {
    return (
      <span className="adm-ticket-locked" title="NSFW verification tickets can never be deleted" aria-label="NSFW tickets can't be deleted">
        <Lock size={13} aria-hidden="true" />
        {label ? " Can't be deleted" : null}
      </span>
    );
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.ticketId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Couldn't delete that ticket.");
      setConfirming(false);
      // Other open lists (Tickets tab, member profile) drop it too
      window.dispatchEvent(new CustomEvent("kk-ticket-deleted", { detail: ticket.ticketId }));
      onDeleted(ticket.ticketId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that ticket.");
    } finally {
      setBusy(false);
    }
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (!confirming) {
    return (
      <button
        type="button"
        className="adm-btn adm-btn--small adm-btn--ghost adm-ticket-delete"
        onClick={(e) => {
          stop(e);
          setConfirming(true);
        }}
        title={`Delete ticket #${ticket.ticketId}`}
        aria-label={`Delete ticket #${ticket.ticketId}`}
      >
        <Trash2 size={14} aria-hidden="true" />
        {label ? " Delete" : null}
      </button>
    );
  }

  return (
    <span className="adm-ticket-confirm" onClick={stop} role="group" aria-label={`Confirm deleting ticket #${ticket.ticketId}`}>
      <span className="adm-ticket-confirm-text">Delete #{ticket.ticketId} and its transcript forever?</span>
      <button type="button" className="adm-btn adm-btn--small adm-btn--danger" onClick={() => void remove()} disabled={busy} autoFocus>
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => setConfirming(false)} disabled={busy}>
        Cancel
      </button>
      {error ? <span className="adm-ticket-confirm-error">{error}</span> : null}
    </span>
  );
}
