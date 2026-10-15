"use client";

import { Clock, Lock, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { LineChart } from "../admin-charts";
import { GROUP_COLORS, GROUP_LABELS, dbLabel, fmtBytes, signed, type CollRow, type DbName } from "./db-shared";

export type Overview = {
  isOwner: boolean;
  totals: Record<DbName, { collections: number; documents: number; data: number; storage: number; indexes: number }>;
  collections: CollRow[];
  growthSince: string | null;
  history: { day: string; totals: Record<DbName, { storage: number; indexes: number; documents: number }> }[];
};

type SortKey = "size" | "count" | "growth" | "name";

/** Sizes, what takes the room, and how it's growing */
export function DbOverview({ data, onBrowse, onCleanup }: { data: Overview; onBrowse: (db: DbName, name: string) => void; onCleanup: () => void }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [db, setDb] = useState<"" | DbName>("");
  const [sort, setSort] = useState<SortKey>("size");

  const bytes = (c: CollRow) => c.storage + c.indexSize;
  const total = (d: DbName) => data.totals[d].storage + data.totals[d].indexes;
  const all = total("website") + total("bot");
  const growth = data.collections.reduce((n, c) => n + (c.growth?.bytes ?? 0), 0);
  const cleanable = data.collections.filter((c) => c.retention).reduce((n, c) => n + bytes(c), 0);

  const byGroup = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data.collections) m.set(c.group, (m.get(c.group) ?? 0) + bytes(c));
    return Array.from(m)
      .sort((a, b) => b[1] - a[1])
      .map(([g, n]) => ({ g, n }));
  }, [data.collections]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = data.collections.filter(
      (c) => (!group || c.group === group) && (!db || c.db === db) && (!needle || c.label.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle)),
    );
    const key: Record<SortKey, (c: CollRow) => number | string> = {
      size: (c) => -bytes(c),
      count: (c) => -c.count,
      growth: (c) => -(c.growth?.bytes ?? 0),
      name: (c) => c.label.toLowerCase(),
    };
    return [...list].sort((a, b) => (key[sort](a) < key[sort](b) ? -1 : key[sort](a) > key[sort](b) ? 1 : 0));
  }, [data.collections, q, group, db, sort]);

  const points = data.history.map((h) => ({
    bucket: h.day,
    values: {
      website: Math.round(((h.totals.website?.storage ?? 0) + (h.totals.website?.indexes ?? 0)) / 1024 / 1024),
      bot: Math.round(((h.totals.bot?.storage ?? 0) + (h.totals.bot?.indexes ?? 0)) / 1024 / 1024),
    },
  }));

  return (
    <div className="dbm-overview">
      <div className="adm-kpis dbm-kpis">
        <div className="adm-kpi">
          <small>Total on disk</small>
          <strong>{fmtBytes(all)}</strong>
          <span>{(data.totals.website.documents + data.totals.bot.documents).toLocaleString()} records</span>
        </div>
        <button type="button" className={`adm-kpi is-link adm-kpi--blue${db === "website" ? " is-on" : ""}`} onClick={() => setDb(db === "website" ? "" : "website")}>
          <small>Website database</small>
          <strong>{fmtBytes(total("website"))}</strong>
          <span>{data.totals.website.collections} collections</span>
        </button>
        <button type="button" className={`adm-kpi is-link adm-kpi--yellow${db === "bot" ? " is-on" : ""}`} onClick={() => setDb(db === "bot" ? "" : "bot")}>
          <small>Bot database</small>
          <strong>{fmtBytes(total("bot"))}</strong>
          <span>{data.totals.bot.collections} collections</span>
        </button>
        <div className={`adm-kpi ${growth > 0 ? "adm-kpi--orange" : "adm-kpi--green"}`}>
          <small>Growth</small>
          <strong>{data.growthSince ? signed(growth, fmtBytes) : "—"}</strong>
          <span>{data.growthSince ? `since ${new Date(data.growthSince).toLocaleDateString()}` : "Tracking starts today"}</span>
        </div>
        {data.isOwner ? (
          <button type="button" className="adm-kpi is-link adm-kpi--green" onClick={onCleanup}>
            <small>Logs with a cleanup</small>
            <strong>{fmtBytes(cleanable)}</strong>
            <span>Open cleanup →</span>
          </button>
        ) : null}
      </div>

      <div className="adm-grid dbm-charts">
        <div className="adm-card adm-card--span2">
          <h3>Size over time (MB)</h3>
          {points.length > 1 ? (
            <LineChart
              points={points}
              unit="day"
              height={200}
              series={[
                { key: "website", label: "Website", color: "#3e63dd" },
                { key: "bot", label: "Bots", color: "#e2b203" },
              ]}
            />
          ) : (
            <p className="adm-empty">A snapshot is saved each day. The chart fills in from tomorrow.</p>
          )}
        </div>
        <div className="adm-card">
          <h3>What takes the room</h3>
          <ul className="dbm-groups">
            {byGroup.map(({ g, n }) => (
              <li key={g}>
                <button type="button" className={group === g ? "is-on" : undefined} onClick={() => setGroup(group === g ? "" : g)} title="Show only these collections">
                  <span className="dbm-groups-top">
                    <span>
                      <span className="dbm-dot" style={{ background: GROUP_COLORS[g] }} aria-hidden="true" />
                      {GROUP_LABELS[g] ?? g}
                    </span>
                    <b>{fmtBytes(n)}</b>
                  </span>
                  <span className="dbm-share dbm-share--wide" aria-hidden="true">
                    <i style={{ width: `${Math.max((n / Math.max(all, 1)) * 100, 1)}%`, background: GROUP_COLORS[g] }} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="adm-filters">
        <label className="adm-search">
          <Search size={15} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a collection…" />
        </label>
        <select className="adm-select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">
          <option value="">All groups</option>
          {Object.entries(GROUP_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="adm-seg" role="tablist" aria-label="Sort">
          {(["size", "count", "growth", "name"] as SortKey[]).map((k) => (
            <button key={k} type="button" className={sort === k ? "is-active" : undefined} onClick={() => setSort(k)}>
              {k === "size" ? "Biggest" : k === "count" ? "Most records" : k === "growth" ? "Fastest growing" : "A–Z"}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table dbm-colls">
          <thead>
            <tr>
              <th>Collection</th>
              <th>Records</th>
              <th>Size</th>
              <th>Avg record</th>
              <th>Growth</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const share = bytes(c) / Math.max(all, 1);
              return (
                <tr key={`${c.db}.${c.name}`} className={data.isOwner ? "is-link" : undefined} onClick={data.isOwner ? () => onBrowse(c.db, c.name) : undefined}>
                  <td>
                    <span className="dbm-dot" style={{ background: GROUP_COLORS[c.group] }} aria-hidden="true" />
                    <b>{c.label}</b>
                    <small>
                      {dbLabel(c.db)} · <code>{c.name}</code>
                      {c.about ? ` · ${c.about}` : ""}
                    </small>
                  </td>
                  <td className="dbm-num">{c.count.toLocaleString()}</td>
                  <td className="dbm-num">
                    {fmtBytes(bytes(c))}
                    <span className="dbm-share" aria-hidden="true">
                      <i style={{ width: `${Math.max(share * 100, 0.5)}%`, background: GROUP_COLORS[c.group] }} />
                    </span>
                  </td>
                  <td className="dbm-num">{c.avg ? fmtBytes(Math.round(c.avg)) : "—"}</td>
                  <td className={`dbm-num${c.growth && c.growth.bytes > 0 ? " is-up" : ""}`}>
                    {c.growth ? (
                      <>
                        {signed(c.growth.bytes, fmtBytes)}
                        <small>{signed(c.growth.count)} records</small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="dbm-badges">
                    {c.locked ? (
                      <span className="dbm-badge">
                        <Lock size={11} aria-hidden="true" /> Read-only
                      </span>
                    ) : c.protected ? (
                      <span className="dbm-badge dbm-badge--safe">
                        <ShieldCheck size={11} aria-hidden="true" /> Protected
                      </span>
                    ) : null}
                    {c.ttl.map((t) => (
                      <span key={t.field} className="dbm-badge dbm-badge--ttl" title={`Records are removed automatically ${t.days ? `${t.days} days after` : "at"} ${t.field}`}>
                        <Clock size={11} aria-hidden="true" /> {t.days ? `Auto ${t.days < 1 ? `${Math.round(t.days * 24 * 60)} min` : `${t.days}d`}` : "Auto-expires"}
                      </span>
                    ))}
                    {c.retention ? (
                      <span className="dbm-badge dbm-badge--clean" title={`Old records (by ${c.retention.field}) can be cleaned`}>
                        <Sparkles size={11} aria-hidden="true" /> Cleanup
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!data.isOwner ? <p className="adm-muted">Browsing records, cleanups and backups are for the owner only.</p> : null}
    </div>
  );
}
