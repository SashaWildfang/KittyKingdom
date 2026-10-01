"use client";

import { Eraser, Loader2, TriangleAlert } from "lucide-react";
import { useContext, useState } from "react";
import { TicketDeletePermissions } from "./delete-ticket-button";

type Preview = { rows: { label: string; count: number }[]; total: number };

/**
 * Owner only: wipe all of a member's data except safety records. Shows exactly what will go first,
 * then asks for their Discord id. The server checks owner, 2FA and the id too.
 */
export function WipeMember({ userId, onDone }: { userId: string; onDone: () => void }) {
  const isOwner = useContext(TicketDeletePermissions);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  if (!isOwner) return null;

  const load = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/wipe/${userId}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setError(r?.error ?? "Couldn't load what would be wiped.");
    setPreview({ rows: r.rows, total: r.total });
  };
  const wipe = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/wipe/${userId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return setError(r?.error ?? "That didn't work.");
    setPreview(null);
    setConfirm("");
    setResult(`Wiped ${r.total.toLocaleString()} record${r.total === 1 ? "" : "s"}. It's logged in the bot logs channel.`);
    onDone();
  };

  return (
    <section className="adm-drawer-section adm-wipe">
      <h3>
        <TriangleAlert size={16} aria-hidden="true" /> Owner only
      </h3>
      {result ? <p className="adm-wipe-done">{result}</p> : null}
      {!preview ? (
        <button type="button" className="adm-btn adm-btn--ghost adm-wipe-open" onClick={() => void load()} disabled={busy}>
          {busy ? <Loader2 size={14} className="set-spin" aria-hidden="true" /> : <Eraser size={14} aria-hidden="true" />} Wipe all their data…
        </button>
      ) : (
        <div className="adm-wipe-box">
          <p>
            <b>This deletes everything below and can&apos;t be undone.</b> Punishments, AutoMod catches, tickets, join applications, logs and who verified them are kept.
          </p>
          {preview.rows.length ? (
            <ul className="adm-wipe-list">
              {preview.rows.map((r) => (
                <li key={r.label}>
                  <span>{r.label}</span>
                  <b>{r.count.toLocaleString()}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-muted">Nothing is stored for them.</p>
          )}
          <label className="adm-wipe-confirm">
            <span>
              Type their Discord id <code>{userId}</code> to confirm
            </span>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} inputMode="numeric" autoComplete="off" placeholder={userId} />
          </label>
          <div className="adm-wipe-actions">
            <button type="button" className="adm-btn adm-btn--danger" disabled={busy || confirm.trim() !== userId || !preview.rows.length} onClick={() => void wipe()}>
              {busy ? "Wiping…" : "Wipe everything"}
            </button>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setPreview(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error ? <p className="adm-error">{error}</p> : null}
    </section>
  );
}
