"use client";

import { ArrowDownAZ, ArrowUpAZ, Copy, Loader2, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Pager } from "../admin-shared";
import { GROUP_LABELS, ValueView, api, dbLabel, fmtBytes, idText, summary, type CollRow, type DbName, type Json } from "./db-shared";
import { askConfirm } from "../../confirm-dialog";

type Doc = Record<string, Json>;
type Page = { docs: Doc[]; total: number; skip: number; limit: number; fields: { field: string; types: string[] }[]; locked: boolean; noDelete: boolean; protected: boolean };

const EXAMPLES: { label: string; filter: string }[] = [
  { label: "A Discord id (text)", filter: '{"discordId": "164577223162986498"}' },
  { label: "A Discord id (number)", filter: '{"discordId": {"$numberLong": "164577223162986498"}}' },
  { label: "Older than a date", filter: '{"at": {"$lt": {"$date": "2026-01-01T00:00:00Z"}}}' },
  { label: "Field is missing", filter: '{"field": {"$exists": false}}' },
  { label: "Text contains", filter: '{"name": {"$regex": "bear", "$options": "i"}}' },
  { label: "More than", filter: '{"balance": {"$gt": 100000}}' },
];

/** Browse any collection: filter, sort, open, edit and delete records (all changes backed up) */
export function DbBrowse({
  collections,
  target,
  onTarget,
  preset,
}: {
  collections: CollRow[];
  target: { db: DbName; name: string } | null;
  onTarget: (t: { db: DbName; name: string }) => void;
  preset: string | null;
}) {
  const [filter, setFilter] = useState(preset ?? "");
  const [applied, setApplied] = useState(preset ?? "");
  const [sort, setSort] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [pageNo, setPageNo] = useState(1);
  const [limit, setLimit] = useState(25);
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: Json; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ count: number; bytes: number } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // A new collection or a filter from Members starts fresh
  useEffect(() => {
    setFilter(preset ?? "");
    setApplied(preset ?? "");
    setSort("");
    setPageNo(1);
    setOpen(null);
    setPicked(new Set());
    setBulk(null);
    setEditing(null);
  }, [target?.db, target?.name, preset]);

  const info = useMemo(() => collections.find((c) => target && c.db === target.db && c.name === target.name) ?? null, [collections, target]);

  const load = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    setError(null);
    const r = await api<Page>("/api/admin/db/browse", { method: "POST", json: { db: target.db, coll: target.name, filter: applied, sort, dir, skip: (pageNo - 1) * limit, limit } });
    setLoading(false);
    if (!r.ok) return setError(r.error ?? "Couldn't load records.");
    setPage(r);
  }, [target, applied, sort, dir, pageNo, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const keyOf = (d: Doc) => JSON.stringify(d._id);
  const readOnly = !!page?.locked;
  const canDelete = !readOnly && !page?.noDelete;

  const startEdit = async (d: Doc) => {
    setNotice(null);
    // The full record (lists can be trimmed for photo data)
    const r = await api<{ doc: Doc }>(`/api/admin/db/doc?${new URLSearchParams({ db: target!.db, coll: target!.name, id: keyOf(d) })}`);
    if (!r.ok) return setError(r.error ?? "Couldn't open that record.");
    setEditing({ id: d._id, text: JSON.stringify(r.doc, null, 2) });
  };

  const save = async () => {
    if (!editing || !target) return;
    try {
      JSON.parse(editing.text);
    } catch (e) {
      return setError(`That isn't valid JSON: ${(e as Error).message}`);
    }
    setBusy(true);
    const r = await api<{ batch: string }>("/api/admin/db/doc", { method: "PUT", json: { db: target.db, coll: target.name, id: JSON.stringify(editing.id), doc: editing.text } });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Couldn't save.");
    setEditing(null);
    setNotice("Saved. The old version is in Backups for 30 days.");
    void load();
  };

  const remove = async (ids: string[]) => {
    if (!target || !ids.length) return;
    if (!(await askConfirm(`Delete ${ids.length} record${ids.length === 1 ? "" : "s"}? They're backed up for 30 days and can be restored.`, { danger: true, confirmLabel: "Delete" }))) return;
    setBusy(true);
    const r = await api<{ removed: number }>("/api/admin/db/doc", { method: "DELETE", json: { db: target.db, coll: target.name, ids } });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Couldn't delete.");
    setPicked(new Set());
    setNotice(`Deleted ${r.removed.toLocaleString()} record${r.removed === 1 ? "" : "s"}. Undo from Backups.`);
    void load();
  };

  const previewBulk = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    const r = await api<{ count: number; bytes: number }>("/api/admin/db/delete-many", { method: "POST", json: { db: target.db, coll: target.name, filter: applied } });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Couldn't count those.");
    setConfirm("");
    setBulk({ count: r.count, bytes: r.bytes });
  };

  const runBulk = async () => {
    if (!target || !bulk) return;
    setBusy(true);
    const r = await api<{ removed: number }>("/api/admin/db/delete-many", { method: "POST", json: { db: target.db, coll: target.name, filter: applied, run: true, confirm: Number(confirm.replace(/[^\d]/g, "")) } });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Couldn't delete.");
    setBulk(null);
    setNotice(`Deleted ${r.removed.toLocaleString()} records. Undo from Backups.`);
    void load();
  };

  const grouped = useMemo(() => {
    const m = new Map<string, CollRow[]>();
    for (const c of collections) m.set(c.group, [...(m.get(c.group) ?? []), c]);
    return Array.from(m).sort((a, b) => (GROUP_LABELS[a[0]] ?? a[0]).localeCompare(GROUP_LABELS[b[0]] ?? b[0]));
  }, [collections]);

  return (
    <div className="dbm-browse">
      <div className="adm-filters">
        <select
          className="adm-select dbm-coll-pick"
          value={target ? `${target.db}|${target.name}` : ""}
          onChange={(e) => {
            const [db, ...name] = e.target.value.split("|");
            if (db) onTarget({ db: db as DbName, name: name.join("|") });
          }}
          aria-label="Collection"
        >
          <option value="">Pick a collection…</option>
          {grouped.map(([g, list]) => (
            <optgroup key={g} label={GROUP_LABELS[g] ?? g}>
              {list
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((c) => (
                  <option key={`${c.db}|${c.name}`} value={`${c.db}|${c.name}`}>
                    {c.label} ({dbLabel(c.db)} · {c.count.toLocaleString()})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        {info ? (
          <span className="adm-muted dbm-coll-meta">
            <code>{info.name}</code> · {fmtBytes(info.storage + info.indexSize)} · {info.indexes} index{info.indexes === 1 ? "" : "es"}
            {info.protected ? " · protected (no bulk delete)" : ""}
            {info.locked ? " · read-only" : ""}
          </span>
        ) : null}
      </div>

      {!target ? (
        <p className="adm-empty">Pick a collection above, or click one in the Overview.</p>
      ) : (
        <>
          <form
            className="dbm-query"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(filter.trim());
              setPageNo(1);
              setBulk(null);
            }}
          >
            <label className="dbm-filter">
              <span>Filter (JSON)</span>
              <textarea value={filter} onChange={(e) => setFilter(e.target.value)} placeholder='{}  e.g. {"discordId": "123…"}' rows={filter.includes("\n") ? 4 : 2} spellCheck={false} />
            </label>
            <div className="dbm-query-side">
              <label>
                <span>Sort by</span>
                <select className="adm-select" value={sort} onChange={(e) => (setSort(e.target.value), setPageNo(1))}>
                  <option value="">Newest added (_id)</option>
                  {page?.fields
                    .filter((f) => f.field !== "_id")
                    .map((f) => (
                      <option key={f.field} value={f.field}>
                        {f.field} ({f.types.join(", ")})
                      </option>
                    ))}
                </select>
              </label>
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => (setDir(dir === "asc" ? "desc" : "asc"), setPageNo(1))} title="Flip the order">
                {dir === "asc" ? <ArrowUpAZ size={15} aria-hidden="true" /> : <ArrowDownAZ size={15} aria-hidden="true" />} {dir === "asc" ? "Oldest/lowest first" : "Newest/highest first"}
              </button>
              <select className="adm-select" value={limit} onChange={(e) => (setLimit(Number(e.target.value)), setPageNo(1))} aria-label="Per page">
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} per page
                  </option>
                ))}
              </select>
              <button type="submit" className="adm-btn">
                Search
              </button>
              {applied ? (
                <button type="button" className="adm-btn adm-btn--ghost" onClick={() => (setFilter(""), setApplied(""), setPageNo(1), setBulk(null))}>
                  <X size={14} aria-hidden="true" /> Clear
                </button>
              ) : null}
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => void load()} aria-label="Reload">
                <RefreshCw size={14} aria-hidden="true" className={loading ? "set-spin" : undefined} />
              </button>
            </div>
          </form>
          <details className="dbm-examples">
            <summary>Filter examples</summary>
            <div className="adm-chips">
              {EXAMPLES.map((x) => (
                <button key={x.label} type="button" className="adm-chip" style={{ ["--c" as string]: "var(--ember)" }} onClick={() => setFilter(x.filter)}>
                  {x.label}
                </button>
              ))}
            </div>
            <p className="adm-muted">
              Dates use <code>{'{"$date": "…"}'}</code>, 64-bit ids use <code>{'{"$numberLong": "…"}'}</code> and record ids use <code>{'{"$oid": "…"}'}</code>. Secret fields can&apos;t be searched.
            </p>
          </details>

          {error ? <p className="adm-error">{error}</p> : null}
          {notice ? <p className="dbm-notice">{notice}</p> : null}

          <div className="dbm-toolbar">
            <span>
              {page ? (page.total >= 0 ? `${page.total.toLocaleString()} record${page.total === 1 ? "" : "s"}${applied ? " match" : ""}` : "Lots of records") : "Loading…"}
              {picked.size ? ` · ${picked.size} picked` : ""}
            </span>
            {canDelete && picked.size ? (
              <button type="button" className="adm-btn adm-btn--danger adm-btn--small" disabled={busy} onClick={() => void remove(Array.from(picked))}>
                <Trash2 size={13} aria-hidden="true" /> Delete picked
              </button>
            ) : null}
            {canDelete && !info?.protected && applied && page && page.total > 0 ? (
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy} onClick={() => void previewBulk()}>
                <Trash2 size={13} aria-hidden="true" /> Delete everything that matches…
              </button>
            ) : null}
          </div>

          {bulk ? (
            <div className="dbm-confirm">
              <p>
                <b>
                  This deletes {bulk.count.toLocaleString()} record{bulk.count === 1 ? "" : "s"} (about {fmtBytes(bulk.bytes)}).
                </b>{" "}
                They&apos;re backed up for 30 days and can be restored from Backups.
              </p>
              <label>
                <span>Type {bulk.count.toLocaleString()} to confirm</span>
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} inputMode="numeric" autoComplete="off" />
              </label>
              <div className="dbm-confirm-actions">
                <button type="button" className="adm-btn adm-btn--danger" disabled={busy || Number(confirm.replace(/[^\d]/g, "")) !== bulk.count} onClick={() => void runBulk()}>
                  {busy ? "Deleting…" : "Delete them"}
                </button>
                <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setBulk(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <ul className="dbm-docs">
            {page?.docs.map((d) => {
              const k = keyOf(d);
              const isOpen = open === k;
              return (
                <li key={k} className={isOpen ? "is-open" : undefined}>
                  <div className="dbm-doc-head">
                    {canDelete ? (
                      <input
                        type="checkbox"
                        aria-label="Pick"
                        checked={picked.has(k)}
                        onChange={(e) => {
                          const next = new Set(picked);
                          if (e.target.checked) next.add(k);
                          else next.delete(k);
                          setPicked(next);
                        }}
                      />
                    ) : null}
                    <button type="button" className="dbm-doc-open" onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen}>
                      <code>{idText(d._id)}</code>
                      <span>{summary(d)}</span>
                    </button>
                    <button type="button" className="dbm-icon" title="Copy as JSON" onClick={() => void navigator.clipboard?.writeText(JSON.stringify(d, null, 2))}>
                      <Copy size={14} aria-hidden="true" />
                    </button>
                    {!readOnly ? (
                      <button type="button" className="dbm-icon" title="Edit" onClick={() => void startEdit(d)}>
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button type="button" className="dbm-icon dbm-icon--danger" title="Delete" onClick={() => void remove([k])} disabled={busy}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {isOpen ? (
                    <div className="dbm-doc-body">
                      <ValueView value={d as Json} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {page && !page.docs.length && !loading ? <p className="adm-empty">No records{applied ? " match that filter" : ""}.</p> : null}
          {page && page.total > limit ? <Pager page={pageNo} total={page.total} pageSize={limit} onPage={setPageNo} /> : null}
        </>
      )}

      {editing && typeof document !== "undefined" ? createPortal(
        <div className="dbm-modal" role="dialog" aria-modal="true" aria-label="Edit record">
          <div className="dbm-modal-box">
            <header>
              <h3>
                Edit <code>{idText(editing.id)}</code>
              </h3>
              <button type="button" className="dbm-icon" onClick={() => setEditing(null)} aria-label="Close">
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <p className="adm-muted">
              The whole record as JSON. Keep <code>$date</code>, <code>$oid</code> and <code>$numberLong</code> wrappers so types stay the same. Hidden fields are kept as they are. The old version is backed up.
            </p>
            <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} spellCheck={false} />
            {error ? <p className="adm-error">{error}</p> : null}
            <footer>
              <button type="button" className="adm-btn" disabled={busy} onClick={() => void save()}>
                {busy ? <Loader2 size={14} className="set-spin" aria-hidden="true" /> : null} Save
              </button>
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </footer>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
