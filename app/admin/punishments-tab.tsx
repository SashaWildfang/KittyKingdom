"use client";

import { Bot, Download, Rows3, Rows4, Search, Shield, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ActionBadge,
  CopyId,
  LiveBadge,
  MemberSearch,
  Pager,
  RichText,
  PersonLink,
  RANGES,
  actionColor,
  downloadText,
  formatDate,
  formatDuration,
  prettyAction,
  timeAgo,
  toCsv,
  useLive,
  useStored,
  type Mentions,
  type People,
  type Punishment,
} from "./admin-shared";

type Result = { rows: Punishment[]; total: number; page: number; pageSize: number; people: People; mentions: Mentions };
type SortKey = "timestamp" | "action" | "userId" | "issuerId";

export type PunishmentFilters = {
  search: string;
  /** Picked from the member suggestions: shows only this member's record */
  member: { id: string; name: string } | null;
  actions: string[];
  source: string;
  status: string;
  range: string;
  sort: SortKey;
  order: "asc" | "desc";
  pageSize: number;
};

export const DEFAULT_PUNISHMENT_FILTERS: PunishmentFilters = {
  search: "",
  member: null,
  actions: [],
  source: "all",
  status: "all",
  range: "all",
  sort: "timestamp",
  order: "desc",
  pageSize: 25,
};

function buildParams(f: PunishmentFilters, page: number, pageSize = f.pageSize) {
  return new URLSearchParams({
    search: f.search,
    ...(f.member ? { userId: f.member.id } : {}),
    actions: f.actions.join(","),
    source: f.source,
    status: f.status,
    sort: f.sort,
    order: f.order,
    page: String(page),
    pageSize: String(pageSize),
    ...(f.range !== "all" ? { range: f.range } : {}),
  });
}

export function PunishmentsTab({
  filters,
  setFilters,
  actionsAvailable,
  onOpenMember,
}: {
  filters: PunishmentFilters;
  setFilters: (f: PunishmentFilters | ((prev: PunishmentFilters) => PunishmentFilters)) => void;
  actionsAvailable: string[];
  onOpenMember: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState(filters.search);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [compact, setCompact] = useStored("punishments-compact", false);
  const [exporting, setExporting] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  // Typing waits a moment before searching
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchText !== filters.search) {
        setFilters((f) => ({ ...f, search: searchText }));
        setPage(1);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchText, filters.search, setFilters]);

  useEffect(() => setSearchText(filters.search), [filters.search]);

  const { data, error, loading, updatedAt } = useLive<Result>(`/api/admin/punishments?${buildParams(filters, page)}`, 10_000);

  // Highlight punishments that arrive while you're watching
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.rows.map((r) => r.id));
    if (seen.current) {
      const incoming = data.rows.filter((r) => !seen.current!.has(r.id)).map((r) => r.id);
      if (incoming.length) {
        setFresh(new Set(incoming));
        window.setTimeout(() => setFresh(new Set()), 4000);
      }
    }
    seen.current = new Set([...Array.from(seen.current ?? []), ...Array.from(ids)]);
  }, [data]);

  useEffect(() => {
    seen.current = null;
  }, [filters]);

  const update = (patch: Partial<PunishmentFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const sortBy = (key: SortKey) => update({ sort: key, order: filters.sort === key && filters.order === "desc" ? "asc" : "desc" });
  const arrow = (key: SortKey) => (filters.sort === key ? (filters.order === "desc" ? " ↓" : " ↑") : "");

  async function exportCsv() {
    setExporting(true);
    try {
      const rows: Punishment[] = [];
      let people: People = {};
      for (let p = 1; p <= 20; p += 1) {
        const res = await fetch(`/api/admin/punishments?${buildParams(filters, p, 100)}`, { cache: "no-store" });
        const body = (await res.json()) as Result;
        rows.push(...body.rows);
        people = { ...people, ...body.people };
        if (rows.length >= body.total || !body.rows.length) break;
      }
      const name = (id: string | null) => (id ? people[id]?.name ?? "" : "");
      downloadText(
        `punishments-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv([
          ["Date", "Action", "User", "User ID", "Issued by", "Issuer ID", "Source", "Status", "Reason", "Duration (s)", "Expires", "Extra info"],
          ...rows.map((r) => [r.timestamp, r.action, name(r.userId), r.userId, r.source === "automod" ? "AutoMod" : name(r.issuerId), r.issuerId, r.source, r.status, r.reason, r.durationSeconds, r.expiresAt, r.extraInfo]),
        ]),
      );
    } finally {
      setExporting(false);
    }
  }

  const people = data?.people ?? {};
  const activeFilters = (filters.member ? 1 : 0) + filters.actions.length + (filters.source !== "all" ? 1 : 0) + (filters.status !== "all" ? 1 : 0) + (filters.range !== "all" ? 1 : 0) + (filters.search ? 1 : 0);

  return (
    <div className="adm-panel">
      <div className="adm-filters">
        <MemberSearch
          className="adm-filters-search"
          value={searchText}
          onChange={setSearchText}
          onPick={(m) => {
            setSearchText("");
            update({ member: { id: m.id, name: m.name }, search: "" });
          }}
          onSubmit={(text) => update({ search: text })}
          placeholder="Search a member (e.g. Seth), ID, staff, reason, message…"
        />
        <select className="adm-select" value={filters.range} onChange={(e) => update({ range: e.target.value })} aria-label="Date range">
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <select className="adm-select" value={filters.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status">
          <option value="all">Any status</option>
          <option value="active">Active (still banned / muted)</option>
          <option value="ended">Ended / lifted</option>
          <option value="none">No duration</option>
        </select>
        <select className="adm-select" value={filters.source} onChange={(e) => update({ source: e.target.value })} aria-label="Source">
          <option value="all">Staff + AutoMod</option>
          <option value="manual">Staff only</option>
          <option value="automod">AutoMod only</option>
        </select>
        <select className="adm-select" value={filters.pageSize} onChange={(e) => update({ pageSize: Number(e.target.value) })} aria-label="Rows per page">
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} rows
            </option>
          ))}
        </select>
        <button type="button" className={`adm-chip-btn${compact ? " is-active" : ""}`} onClick={() => setCompact((v) => !v)}>
          {compact ? <Rows4 size={15} aria-hidden="true" /> : <Rows3 size={15} aria-hidden="true" />} {compact ? "Compact" : "Comfortable"}
        </button>
        <button type="button" className="adm-chip-btn" onClick={exportCsv} disabled={exporting}>
          {exporting ? "Exporting…" : <><Download size={14} aria-hidden="true" /> CSV</>}
        </button>
        {activeFilters ? (
          <button type="button" className="adm-chip-btn" onClick={() => { setSearchText(""); setFilters(DEFAULT_PUNISHMENT_FILTERS); setPage(1); }}>
            <X size={14} aria-hidden="true" /> Clear ({activeFilters})
          </button>
        ) : null}
        <LiveBadge updatedAt={updatedAt} loading={loading} />
      </div>

      <div className="adm-chips" role="group" aria-label="Actions">
        {filters.member ? (
          <button type="button" className="adm-chip is-on adm-chip--member" style={{ "--c": "#f59b2a" } as React.CSSProperties} onClick={() => update({ member: null })}>
            <User size={13} aria-hidden="true" /> {filters.member.name} <X size={13} aria-hidden="true" />
          </button>
        ) : null}
        {actionsAvailable.map((action, i) => {
          const on = filters.actions.includes(action);
          return (
            <button
              key={action}
              type="button"
              className={`adm-chip${on ? " is-on" : ""}`}
              style={{ "--c": actionColor(action, i) } as React.CSSProperties}
              onClick={() => update({ actions: on ? filters.actions.filter((a) => a !== action) : [...filters.actions, action] })}
            >
              {prettyAction(action)}
            </button>
          );
        })}
      </div>

      {error ? <p className="adm-error">{error}</p> : null}

      <div className="adm-table-wrap">
        <table className={`adm-table adm-table--pun${compact ? " is-compact" : ""}`}>
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => sortBy("timestamp")}>When{arrow("timestamp")}</button>
              </th>
              <th>
                <button type="button" onClick={() => sortBy("action")}>Action{arrow("action")}</button>
              </th>
              <th>
                <button type="button" onClick={() => sortBy("userId")}>Member{arrow("userId")}</button>
              </th>
              <th>
                <button type="button" onClick={() => sortBy("issuerId")}>Issued by{arrow("issuerId")}</button>
              </th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((row) => {
              const open = expanded === row.id;
              return (
                <FragmentRow key={row.id}>
                  <tr
                    className={`${open ? "is-open" : ""}${fresh.has(row.id) ? " is-fresh" : ""}`}
                    onClick={() => setExpanded(open ? null : row.id)}
                    style={{ "--c": actionColor(row.action) } as React.CSSProperties}
                  >
                    <td title={formatDate(row.timestamp)}>
                      <strong>{timeAgo(row.timestamp)}</strong>
                      {!compact ? <small>{formatDate(row.timestamp)}</small> : null}
                    </td>
                    <td>
                      <ActionBadge action={row.action} />
                    </td>
                    <td>
                      <PersonLink id={row.userId} people={people} onOpen={onOpenMember} compact={compact} />
                    </td>
                    <td>
                      <PersonLink id={row.issuerId} people={people} onOpen={onOpenMember} automodId={row.source === "automod"} compact={compact} />
                    </td>
                    <td className="adm-reason-cell">
                      <span className="adm-clamp">
                        {row.reason ? <RichText text={row.reason} mentions={data?.mentions} people={people} onOpenMember={onOpenMember} /> : <span className="adm-muted">No reason</span>}
                      </span>
                    </td>
                    <td>
                      <StatusPill row={row} />
                    </td>
                  </tr>
                  {open ? (
                    <tr className="adm-detail-row">
                      <td colSpan={6}>
                        <div className="adm-detail">
                          <dl>
                            <div>
                              <dt>Record ID</dt>
                              <dd><CopyId id={row.id} /></dd>
                            </div>
                            <div>
                              <dt>Member ID</dt>
                              <dd>{row.userId ? <CopyId id={row.userId} /> : "—"}</dd>
                            </div>
                            <div>
                              <dt>Issuer ID</dt>
                              <dd>{row.issuerId ? <CopyId id={row.issuerId} /> : "—"}</dd>
                            </div>
                            <div>
                              <dt>Date</dt>
                              <dd>{formatDate(row.timestamp)}</dd>
                            </div>
                            <div>
                              <dt>Duration</dt>
                              <dd>{formatDuration(row.durationSeconds)}</dd>
                            </div>
                            <div>
                              <dt>Expires</dt>
                              <dd>
                                {row.action.includes("ban")
                                  ? row.status === "active" ? "Still banned (checked with Discord)" : row.status === "ended" ? "Unbanned" : "—"
                                  : row.expiresAt ? `${formatDate(row.expiresAt)} (${timeAgo(row.expiresAt)})` : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt>Source</dt>
                              <dd className="adm-inline-icon">{row.source === "automod" ? <><Bot size={14} aria-hidden="true" /> AutoMod / automatic</> : <><Shield size={14} aria-hidden="true" /> Staff</>}</dd>
                            </div>
                            <div>
                              <dt>Extra info</dt>
                              <dd>{row.extraInfo ? <RichText text={row.extraInfo} mentions={data?.mentions} people={people} /> : "—"}</dd>
                            </div>
                          </dl>
                          <div className="adm-detail-text">
                            <h4>Reason</h4>
                            <p>{row.reason ? <RichText text={row.reason} mentions={data?.mentions} people={people} onOpenMember={onOpenMember} /> : "No reason given."}</p>
                            {row.messageContent ? (
                              <>
                                <h4>Flagged message</h4>
                                <blockquote>
                                  <RichText text={row.messageContent} mentions={data?.mentions} people={people} onOpenMember={onOpenMember} />
                                </blockquote>
                              </>
                            ) : null}
                          </div>
                          <div className="adm-detail-actions">
                            {row.userId ? (
                              <button type="button" className="adm-btn" onClick={() => onOpenMember(row.userId!)}>
                                <User size={14} aria-hidden="true" /> Member profile
                              </button>
                            ) : null}
                            {row.userId ? (
                              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => update({ member: { id: row.userId!, name: people[row.userId!]?.name ?? row.userId! }, search: "" })}>
                                <Search size={14} aria-hidden="true" /> All for this member
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </FragmentRow>
              );
            })}
            {!loading && data && !data.rows.length ? (
              <tr>
                <td colSpan={6} className="adm-empty">
                  No punishments match these filters.
                </td>
              </tr>
            ) : null}
            {!data && loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="adm-row-skeleton">
                    <td colSpan={6} />
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      {data ? <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} /> : null}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function StatusPill({ row }: { row: Punishment }) {
  if (row.status === "active") {
    const label = row.action.includes("ban") ? "Banned" : row.action === "warn" ? "Counting" : "Active";
    return <span className="adm-status adm-status--active">● {label}</span>;
  }
  if (row.status === "ended") {
    const label = row.action.includes("ban") ? "Unbanned" : "Ended";
    return <span className="adm-status adm-status--ended">{label}</span>;
  }
  return <span className="adm-status">—</span>;
}
