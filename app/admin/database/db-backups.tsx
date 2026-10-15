"use client";

import { History, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { agoText, api, dateText, fmtBytes } from "./db-shared";

type Backup = {
  id: string;
  kind: string;
  label: string;
  at: string;
  expireAt: string;
  by: { discordId: string; name: string };
  restoredAt: string | null;
  counts: { db: string; coll: string; count: number }[];
  docs: number;
  bytes: number;
};

const KIND_LABELS: Record<string, string> = {
  edit: "Edit",
  delete: "Delete",
  "bulk-delete": "Delete by filter",
  leavers: "Members who left",
  retention: "Old records",
  orphans: "Leftovers",
};

/** Everything the Database page changed or deleted, kept 30 days and restorable */
export function DbBackups({ refresh, onDone }: { refresh: number; onDone: () => void }) {
  const [list, setList] = useState<Backup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    void api<{ backups: Backup[] }>("/api/admin/db/backups").then((r) => {
      if (stop) return;
      if (!r.ok) return setError(r.error ?? "Couldn't load backups.");
      setList(r.backups);
    });
    return () => {
      stop = true;
    };
  }, [refresh, tick]);

  const restore = async (b: Backup) => {
    if (!window.confirm(`Put back ${b.docs.toLocaleString()} record${b.docs === 1 ? "" : "s"} from "${b.label}"? Records changed since then go back to how they were.`)) return;
    setBusy(b.id);
    setError(null);
    const r = await api<{ restored: number }>("/api/admin/db/backups", { method: "POST", json: { id: b.id } });
    setBusy(null);
    if (!r.ok) return setError(r.error ?? "Couldn't restore.");
    setNotice(`Restored ${r.restored.toLocaleString()} records.`);
    setTick((t) => t + 1);
    onDone();
  };

  const remove = async (b: Backup) => {
    if (!window.confirm(`Delete the backup "${b.label}" now? It can't be restored after this.`)) return;
    setBusy(b.id);
    const r = await api("/api/admin/db/backups", { method: "DELETE", json: { id: b.id } });
    setBusy(null);
    if (!r.ok) return setError(r.error ?? "Couldn't delete that backup.");
    setTick((t) => t + 1);
  };

  return (
    <div className="dbm-backups">
      <p className="adm-muted dbm-note">Every edit, delete and cleanup made on this page is copied here first and kept for 30 days.</p>
      {error ? <p className="adm-error">{error}</p> : null}
      {notice ? <p className="dbm-notice">{notice}</p> : null}
      {!list ? <div className="adm-skeleton" /> : null}
      {list && !list.length ? (
        <p className="adm-empty">
          <History size={16} aria-hidden="true" /> No backups yet.
        </p>
      ) : null}
      <ul className="dbm-backup-list">
        {list?.map((b) => (
          <li key={b.id} className={b.restoredAt ? "is-restored" : undefined}>
            <div>
              <b>{b.label}</b>
              <small>
                {KIND_LABELS[b.kind] ?? b.kind} · {dateText(b.at)} ({agoText(b.at)}) · by {b.by?.name ?? "someone"} · {b.docs.toLocaleString()} record{b.docs === 1 ? "" : "s"} · {fmtBytes(b.bytes)}
              </small>
              <small>
                {b.counts
                  .map((c) => `${c.coll} (${c.count.toLocaleString()})`)
                  .join(", ")
                  .slice(0, 300)}
              </small>
              <small>{b.restoredAt ? `Restored ${agoText(b.restoredAt)}` : `Kept until ${dateText(b.expireAt)}`}</small>
            </div>
            <div className="dbm-backup-actions">
              {!b.restoredAt ? (
                <button type="button" className="adm-btn adm-btn--small" disabled={!!busy || !b.docs} onClick={() => void restore(b)}>
                  <RotateCcw size={13} aria-hidden="true" /> {busy === b.id ? "Restoring…" : "Restore"}
                </button>
              ) : null}
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={!!busy} onClick={() => void remove(b)} aria-label="Delete backup">
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
