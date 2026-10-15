"use client";

import { Archive, Brush, Loader2, UserMinus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LEAVER_KINDS } from "../../../lib/db-manager/catalog";
import { agoText, api, dateText, dbLabel, fmtBytes, type DbName } from "./db-shared";

type Mode = "leavers" | "old" | "orphans";

/** Cleanups: members who left long ago, old log records, and leftovers nothing uses */
export function DbCleanup({ onDone, onBrowse }: { onDone: () => void; onBrowse: (db: DbName, name: string, filter: string) => void }) {
  const [mode, setMode] = useState<Mode>("leavers");
  return (
    <div className="dbm-cleanup">
      <div className="adm-seg" role="tablist" aria-label="Cleanup">
        <button type="button" className={mode === "leavers" ? "is-active" : undefined} onClick={() => setMode("leavers")}>
          <UserMinus size={14} aria-hidden="true" /> Members who left
        </button>
        <button type="button" className={mode === "old" ? "is-active" : undefined} onClick={() => setMode("old")}>
          <Archive size={14} aria-hidden="true" /> Old records
        </button>
        <button type="button" className={mode === "orphans" ? "is-active" : undefined} onClick={() => setMode("orphans")}>
          <Brush size={14} aria-hidden="true" /> Leftovers
        </button>
      </div>
      <p className="adm-muted dbm-note">
        Everything is previewed first, backed up for 30 days (restore from Backups) and logged. Punishments, AutoMod catches, tickets, join applications, logs and website accounts are never touched.
      </p>
      {mode === "leavers" ? <Leavers onDone={onDone} /> : null}
      {mode === "old" ? <OldRecords onDone={onDone} /> : null}
      {mode === "orphans" ? <Orphans onDone={onDone} onBrowse={onBrowse} /> : null}
    </div>
  );
}

function Result({ text }: { text: string | null }) {
  return text ? <p className="dbm-notice">{text}</p> : null;
}

// ---------- Members who left ----------

type Kind = { kind: string; label: string; about: string; default: boolean };
type Member = {
  id: string;
  name: string;
  username: string | null;
  avatar: string | null;
  leftAt: string | null;
  leftKnown: boolean;
  lastSeen: string | null;
  lastSeenFrom: string | null;
  hasAccount: boolean;
  qualifies: boolean;
  skipped: string | null;
};
type LeaverPreview = { kinds: Kind[]; members: Member[]; totalLeft: number; qualifying: number; rows: { db: DbName; coll: string; label: string; kind: string; count: number; bytes: number }[]; records: number; bytes: number; tracking: string | null };

const KINDS: Kind[] = LEAVER_KINDS;

function Leavers({ onDone }: { onDone: () => void }) {
  const [days, setDays] = useState(365);
  const [kinds, setKinds] = useState<string[]>(KINDS.filter((k) => k.default).map((k) => k.kind));
  const [includeNoActivity, setIncludeNoActivity] = useState(true);
  const [includeAccounts, setIncludeAccounts] = useState(false);
  const [preview, setPreview] = useState<LeaverPreview | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showSkipped, setShowSkipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  const options = { kind: "leavers", days, kinds, includeNoActivity, includeAccounts };

  const load = async () => {
    setBusy(true);
    setError(null);
    const r = await api<LeaverPreview>("/api/admin/db/cleanup", { method: "POST", json: options });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Couldn't preview.");
    setPreview(r);
    setPicked(new Set(r.members.filter((m) => m.qualifies).map((m) => m.id)));
    setConfirm("");
  };

  // Options changed: the old preview no longer applies
  useEffect(() => setPreview(null), [days, kinds, includeNoActivity, includeAccounts]);

  const run = async () => {
    setBusy(true);
    setError(null);
    const ids = Array.from(picked);
    const r = await api<{ members: number; total: number; removed: { label: string; count: number }[]; more: number }>("/api/admin/db/cleanup", {
      method: "POST",
      json: { ...options, run: true, ids },
    });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "The cleanup didn't finish.");
    setDone(`Cleaned ${r.members.toLocaleString()} members: ${r.total.toLocaleString()} records removed.${r.more > 0 ? ` ${r.more.toLocaleString()} more qualify: run it again for the next batch.` : ""}`);
    setPreview(null);
    onDone();
  };

  const members = useMemo(() => (preview?.members ?? []).filter((m) => showSkipped || m.qualifies), [preview, showSkipped]);
  const capped = picked.size > 500;

  return (
    <div className="adm-card dbm-clean-card">
      <h3>Members who left and haven&apos;t been back</h3>
      <div className="dbm-clean-opts">
        <label>
          <span>Not seen for at least</span>
          <select className="adm-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[90, 180, 365, 540, 730, 1095].map((d) => (
              <option key={d} value={d}>
                {d < 365 ? `${Math.round(d / 30)} months` : d === 540 ? "18 months" : `${d / 365} year${d === 365 ? "" : "s"}`}
              </option>
            ))}
          </select>
        </label>
        <label className="dbm-check">
          <input type="checkbox" checked={includeNoActivity} onChange={(e) => setIncludeNoActivity(e.target.checked)} />
          <span>
            Include members with no activity on record
            <small>People who left before leave dates were tracked{preview?.tracking ? ` (${dateText(preview.tracking)})` : ""} and never talked, joined voice or applied</small>
          </span>
        </label>
        <label className="dbm-check">
          <input type="checkbox" checked={includeAccounts} onChange={(e) => setIncludeAccounts(e.target.checked)} />
          <span>
            Include members with a website account
            <small>Their account stays either way; only the data picked below goes</small>
          </span>
        </label>
      </div>
      <fieldset className="dbm-kinds">
        <legend>What to remove</legend>
        {KINDS.map((k) => (
          <label key={k.kind} className="dbm-check">
            <input type="checkbox" checked={kinds.includes(k.kind)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k.kind] : kinds.filter((x) => x !== k.kind))} />
            <span>
              {k.label}
              <small>{k.about}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="dbm-clean-actions">
        <button type="button" className="adm-btn" onClick={() => void load()} disabled={busy || !kinds.length}>
          {busy && !preview ? <Loader2 size={14} className="set-spin" aria-hidden="true" /> : null} Preview
        </button>
      </div>
      {error ? <p className="adm-error">{error}</p> : null}
      <Result text={done} />

      {preview ? (
        <>
          <div className="adm-kpis dbm-kpis">
            <div className="adm-kpi">
              <small>Have left</small>
              <strong>{preview.totalLeft.toLocaleString()}</strong>
            </div>
            <div className="adm-kpi adm-kpi--orange">
              <small>Qualify</small>
              <strong>{preview.qualifying.toLocaleString()}</strong>
              <span>{picked.size.toLocaleString()} picked</span>
            </div>
            <div className="adm-kpi adm-kpi--blue">
              <small>Records to remove</small>
              <strong>{preview.records.toLocaleString()}</strong>
            </div>
            <div className="adm-kpi adm-kpi--green">
              <small>Space freed (about)</small>
              <strong>{fmtBytes(preview.bytes)}</strong>
            </div>
          </div>
          {preview.rows.length ? (
            <ul className="dbm-mrows dbm-mrows--static">
              {preview.rows.map((r) => (
                <li key={`${r.db}.${r.coll}.${r.label}`}>
                  <div>
                    <span>
                      <b>{r.label}</b>
                      <small>
                        {dbLabel(r.db)} · <code>{r.coll}</code>
                      </small>
                    </span>
                    <strong>{r.count.toLocaleString()}</strong>
                    <small>{fmtBytes(r.bytes)}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-empty">Nothing of the picked kinds is stored for them.</p>
          )}

          <div className="dbm-toolbar">
            <span>Members</span>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setPicked(new Set(preview.members.filter((m) => m.qualifies).map((m) => m.id)))}>
              Pick all
            </button>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setPicked(new Set())}>
              Pick none
            </button>
            <label className="dbm-check dbm-check--inline">
              <input type="checkbox" checked={showSkipped} onChange={(e) => setShowSkipped(e.target.checked)} />
              <span>Show who&apos;s skipped and why</span>
            </label>
          </div>
          <div className="adm-table-wrap dbm-members-table">
            <table className="adm-table">
              <thead>
                <tr>
                  <th aria-label="Pick" />
                  <th>Member</th>
                  <th>Left</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {members.slice(0, 1000).map((m) => (
                  <tr key={m.id} className={m.qualifies ? undefined : "is-muted"}>
                    <td>
                      {m.qualifies ? (
                        <input
                          type="checkbox"
                          aria-label={`Pick ${m.name}`}
                          checked={picked.has(m.id)}
                          onChange={(e) => {
                            const next = new Set(picked);
                            if (e.target.checked) next.add(m.id);
                            else next.delete(m.id);
                            setPicked(next);
                          }}
                        />
                      ) : null}
                    </td>
                    <td>
                      <b>{m.name}</b>
                      <small>
                        {m.username ? `@${m.username} · ` : ""}
                        {m.id}
                        {m.hasAccount ? " · website account" : ""}
                        {m.skipped ? ` · skipped: ${m.skipped}` : ""}
                      </small>
                    </td>
                    <td>{m.leftKnown ? dateText(m.leftAt) : <span className="adm-muted">before tracking</span>}</td>
                    <td>
                      {m.lastSeen ? agoText(m.lastSeen) : <span className="adm-muted">no activity on record</span>}
                      {m.lastSeenFrom ? <small>{m.lastSeenFrom}</small> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {members.length > 1000 ? <p className="adm-muted dbm-note">Showing the first 1,000.</p> : null}

          {preview.qualifying > 0 ? (
            <div className="dbm-confirm">
              <p>
                <b>Remove the picked data for {Math.min(picked.size, 500).toLocaleString()} member{picked.size === 1 ? "" : "s"}.</b>
                {capped ? " Up to 500 run at a time; run it again for the rest." : ""} A summary is posted in the staff log channel.
              </p>
              <label>
                <span>Type CLEAN to confirm</span>
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
              </label>
              <div className="dbm-confirm-actions">
                <button type="button" className="adm-btn adm-btn--danger" disabled={busy || confirm.trim().toUpperCase() !== "CLEAN" || !picked.size} onClick={() => void run()}>
                  {busy ? "Cleaning…" : "Clean up"}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------- Old records ----------

type Target = { key: string; db: DbName; coll: string; label: string; group: string; field: string; days: number; defaultDays: number; total: number; old: number; oldest: string | null; bytes: number };

function OldRecords({ onDone }: { onDone: () => void }) {
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [days, setDays] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = async (overrides: Record<string, number>) => {
    setBusy(true);
    setError(null);
    const r = await api<{ targets: Target[] }>("/api/admin/db/cleanup", { method: "POST", json: { kind: "old", overrides } });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Couldn't count old records.");
    setTargets(r.targets);
  };

  useEffect(() => {
    void load({});
  }, []);

  // Recount after the day boxes settle
  useEffect(() => {
    if (!Object.keys(days).length) return;
    const t = window.setTimeout(() => void load(days), 600);
    return () => window.clearTimeout(t);
  }, [days]);

  const chosen = (targets ?? []).filter((t) => picked.has(t.key) && t.old > 0);
  const total = chosen.reduce((n, t) => n + t.old, 0);
  const bytes = chosen.reduce((n, t) => n + t.bytes, 0);

  const run = async () => {
    if (!window.confirm(`Remove ${total.toLocaleString()} old records? They're backed up for 30 days.`)) return;
    setBusy(true);
    setError(null);
    const r = await api<{ total: number }>("/api/admin/db/cleanup", { method: "POST", json: { kind: "old", run: true, targets: chosen.map((t) => ({ key: t.key, days: t.days })) } });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "The cleanup didn't finish.");
    setDone(`Removed ${r.total.toLocaleString()} old records.`);
    setPicked(new Set());
    onDone();
    void load(days);
  };

  return (
    <div className="adm-card dbm-clean-card">
      <h3>Old records</h3>
      <p className="adm-muted dbm-note">Logs and histories that only grow. Pick how long to keep each; anything older can go.</p>
      {error ? <p className="adm-error">{error}</p> : null}
      <Result text={done} />
      {!targets ? (
        <div className="adm-skeleton" />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th aria-label="Pick" />
                <th>Records</th>
                <th>Keep</th>
                <th>Older</th>
                <th>Oldest</th>
                <th>Frees</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.key} className={t.old ? undefined : "is-muted"}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Pick ${t.label}`}
                      disabled={!t.old}
                      checked={picked.has(t.key)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        if (e.target.checked) next.add(t.key);
                        else next.delete(t.key);
                        setPicked(next);
                      }}
                    />
                  </td>
                  <td>
                    <b>{t.label}</b>
                    <small>
                      {dbLabel(t.db)} · {t.total.toLocaleString()} in total · by <code>{t.field}</code>
                    </small>
                  </td>
                  <td>
                    <span className="dbm-days">
                      <input
                        type="number"
                        min={7}
                        max={3650}
                        value={days[t.key] ?? t.days}
                        onChange={(e) => setDays({ ...days, [t.key]: Math.max(7, Number(e.target.value) || t.defaultDays) })}
                        aria-label={`Days of ${t.label} to keep`}
                      />{" "}
                      days
                    </span>
                  </td>
                  <td className="dbm-num">{t.old.toLocaleString()}</td>
                  <td>{t.oldest ? agoText(t.oldest) : "—"}</td>
                  <td className="dbm-num">{t.old ? fmtBytes(t.bytes) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="dbm-clean-actions">
        <button type="button" className="adm-btn adm-btn--danger" disabled={busy || !chosen.length} onClick={() => void run()}>
          {busy ? <Loader2 size={14} className="set-spin" aria-hidden="true" /> : null} Remove {total.toLocaleString()} old record{total === 1 ? "" : "s"}
          {bytes ? ` (${fmtBytes(bytes)})` : ""}
        </button>
      </div>
    </div>
  );
}

// ---------- Leftovers ----------

type OrphanSet = { key: string; label: string; about: string; db: DbName; coll: string; count: number; bytes: number; filter: string };

function Orphans({ onDone, onBrowse }: { onDone: () => void; onBrowse: (db: DbName, name: string, filter: string) => void }) {
  const [sets, setSets] = useState<OrphanSet[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    const r = await api<{ sets: OrphanSet[] }>("/api/admin/db/cleanup", { method: "POST", json: { kind: "orphans" } });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Couldn't look for leftovers.");
    setSets(r.sets);
    setPicked(new Set(r.sets.filter((s) => s.count > 0).map((s) => s.key)));
  };
  useEffect(() => {
    void load();
  }, []);

  const chosen = (sets ?? []).filter((s) => picked.has(s.key) && s.count > 0);
  const run = async () => {
    if (!window.confirm(`Remove ${chosen.reduce((n, s) => n + s.count, 0).toLocaleString()} leftover records? They're backed up for 30 days.`)) return;
    setBusy(true);
    setError(null);
    const r = await api<{ total: number }>("/api/admin/db/cleanup", { method: "POST", json: { kind: "orphans", run: true, keys: chosen.map((s) => s.key) } });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "The cleanup didn't finish.");
    setDone(`Removed ${r.total.toLocaleString()} leftover records.`);
    onDone();
    void load();
  };

  return (
    <div className="adm-card dbm-clean-card">
      <h3>Leftovers</h3>
      <p className="adm-muted dbm-note">Records nothing points to any more, like photos from deleted profiles.</p>
      {error ? <p className="adm-error">{error}</p> : null}
      <Result text={done} />
      {!sets ? (
        <div className="adm-skeleton" />
      ) : (
        <ul className="dbm-orphans">
          {sets.map((s) => (
            <li key={s.key} className={s.count ? undefined : "is-muted"}>
              <label className="dbm-check">
                <input
                  type="checkbox"
                  disabled={!s.count}
                  checked={picked.has(s.key)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(s.key);
                    else next.delete(s.key);
                    setPicked(next);
                  }}
                />
                <span>
                  {s.label}
                  <small>{s.about}</small>
                </span>
              </label>
              <strong>{s.count.toLocaleString()}</strong>
              <small>{s.count ? fmtBytes(s.bytes) : "none"}</small>
              {s.count ? (
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => onBrowse(s.db, s.coll, s.filter)}>
                  View
                </button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="dbm-clean-actions">
        <button type="button" className="adm-btn adm-btn--danger" disabled={busy || !chosen.length} onClick={() => void run()}>
          {busy ? <Loader2 size={14} className="set-spin" aria-hidden="true" /> : null} Remove picked leftovers
        </button>
      </div>
    </div>
  );
}
