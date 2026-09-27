"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveBadge, MemberSearch, PersonLink, RANGES, RichText, formatDate, timeAgo, useStored, type Mentions, type People } from "./admin-shared";

type LogEntry = {
  id: string;
  ts: string;
  type: string;
  title: string | null;
  description: string | null;
  content: string | null;
  color: string | null;
  authorName: string | null;
  authorIcon: string | null;
  fields: { name: string; value: string; inline: boolean }[];
  footer: string | null;
  subjectId: string | null;
  userIds: string[];
  attachments: { id: string; filename: string; size: number; image: boolean }[];
  postedBy: string;
};

type Result = {
  rows: LogEntry[];
  total: number;
  types: { type: string; count: number }[];
  sync: { backfillDone: boolean; oldest: string | null };
  people: People;
  mentions: Mentions;
};

type Filters = { types: string[]; member: { id: string; name: string } | null; search: string; range: string; order: "desc" | "asc" };
const DEFAULTS: Filters = { types: [], member: null, search: "", range: "all", order: "desc" };
const POLL_MS = 8_000;

function buildParams(f: Filters, extra: Record<string, string> = {}) {
  return new URLSearchParams({
    types: f.types.join(","),
    search: f.search,
    order: f.order,
    limit: "40",
    ...(f.member ? { userId: f.member.id } : {}),
    ...(f.range !== "all" ? { range: f.range } : {}),
    ...extra,
  });
}

// Footers repeat "User ID: … • date"; the card already shows both, so keep only anything else
function extraFooter(footer: string | null) {
  if (!footer) return null;
  const rest = footer.replace(/User ID:\s*\d+/i, "").replace(/\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*[AP]M/i, "").replace(/^[\s•|]+|[\s•|]+$/g, "");
  return rest || null;
}

export function LogsTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [filters, setFilters] = useStored<Filters>("logs-filters", DEFAULTS);
  const [items, setItems] = useState<LogEntry[]>([]);
  const [meta, setMeta] = useState<Omit<Result, "rows"> | null>(null);
  const [people, setPeople] = useState<People>({});
  const [mentions, setMentions] = useState<Mentions>({ channels: {}, roles: {} });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [memberText, setMemberText] = useState("");
  const [searchText, setSearchText] = useState(filters.search);
  const [typeFilter, setTypeFilter] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const request = useRef(0);
  const itemsRef = useRef<LogEntry[]>([]);
  itemsRef.current = items;

  const absorb = useCallback((body: Result) => {
    setMeta({ total: body.total, types: body.types, sync: body.sync, people: body.people, mentions: body.mentions });
    setPeople((p) => ({ ...p, ...body.people }));
    setMentions((m) => ({ channels: { ...m.channels, ...body.mentions.channels }, roles: { ...m.roles, ...body.mentions.roles } }));
  }, []);

  // First page whenever the filters change
  const loadFirst = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/logs?${buildParams(filters)}`, { cache: "no-store" });
      const body = (await res.json()) as Result & { ok: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Couldn't load the logs.");
      if (id !== request.current) return;
      setItems(body.rows);
      setHasMore(body.rows.length >= 40);
      absorb(body);
      setUpdatedAt(Date.now());
    } catch (e) {
      if (id === request.current) setError(e instanceof Error ? e.message : "Couldn't load the logs.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [filters, absorb]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  // Live: newest-first view picks up new logs and slides them in at the top
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const newest = itemsRef.current[0]?.id;
      if (filters.order !== "desc") {
        // Oldest-first: just keep the counts and sync fresh
        const res = await fetch(`/api/admin/logs?${buildParams(filters, { limit: "10" })}`, { cache: "no-store" }).catch(() => null);
        if (res?.ok) absorb((await res.json()) as Result);
        setUpdatedAt(Date.now());
        return;
      }
      const res = await fetch(`/api/admin/logs?${buildParams(filters, newest ? { after: newest } : {})}`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const body = (await res.json()) as Result;
      absorb(body);
      setUpdatedAt(Date.now());
      if (body.rows.length) {
        const known = new Set(itemsRef.current.map((i) => i.id));
        const incoming = body.rows.filter((r) => !known.has(r.id));
        if (incoming.length) {
          setItems((list) => [...incoming, ...list]);
          setFresh(new Set(incoming.map((i) => i.id)));
          window.setTimeout(() => setFresh(new Set()), 3500);
        }
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [filters, absorb]);

  async function loadMore() {
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/logs?${buildParams(filters, filters.order === "desc" ? { before: last.id } : { after: last.id })}`, { cache: "no-store" });
      const body = (await res.json()) as Result;
      absorb(body);
      const known = new Set(items.map((i) => i.id));
      setItems((list) => [...list, ...body.rows.filter((r) => !known.has(r.id))]);
      setHasMore(body.rows.length >= 40);
    } finally {
      setLoadingMore(false);
    }
  }

  // Text search waits for a pause in typing
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchText !== filters.search) setFilters((f) => ({ ...f, search: searchText }));
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchText, filters.search, setFilters]);

  const toggleType = (type: string) =>
    setFilters((f) => ({ ...f, types: f.types.includes(type) ? f.types.filter((t) => t !== type) : [...f.types, type] }));
  const types = (meta?.types ?? []).filter((t) => t.type.toLowerCase().includes(typeFilter.trim().toLowerCase()));
  const activeCount = filters.types.length + (filters.member ? 1 : 0) + (filters.search ? 1 : 0) + (filters.range !== "all" ? 1 : 0);

  return (
    <div className="adm-logs">
      <aside className="adm-logs-side">
        <div className="adm-logs-side-head">
          <h3>Log types</h3>
          {filters.types.length ? (
            <button type="button" className="adm-link" onClick={() => setFilters((f) => ({ ...f, types: [] }))}>
              Clear
            </button>
          ) : null}
        </div>
        <input className="adm-logs-typefilter" placeholder="Find a type…" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} />
        <ul>
          {types.map((t) => (
            <li key={t.type}>
              <label className={filters.types.includes(t.type) ? "is-on" : undefined}>
                <input type="checkbox" checked={filters.types.includes(t.type)} onChange={() => toggleType(t.type)} />
                <span>{t.type}</span>
                <small>{t.count.toLocaleString()}</small>
              </label>
            </li>
          ))}
          {meta && !types.length ? <li className="adm-muted">No types yet.</li> : null}
        </ul>
        <p className="adm-logs-sync">
          {meta?.sync.backfillDone
            ? "✓ Every log is loaded."
            : meta?.sync.oldest
              ? `Loaded back to ${new Date(meta.sync.oldest).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · loading older logs…`
              : "Loading logs…"}
        </p>
      </aside>

      <div className="adm-logs-main">
        <div className="adm-filters">
          <MemberSearch
            className="adm-filters-search"
            value={memberText}
            onChange={setMemberText}
            onPick={(m) => {
              setMemberText("");
              setFilters((f) => ({ ...f, member: { id: m.id, name: m.name } }));
            }}
            onSubmit={(text) => {
              const id = text.trim().replace(/[<@!>]/g, "");
              if (/^\d{15,21}$/.test(id)) {
                setMemberText("");
                setFilters((f) => ({ ...f, member: { id, name: id } }));
              }
            }}
            placeholder="Filter by member (name or ID)…"
          />
          <label className="adm-search">
            <span aria-hidden="true">🔎</span>
            <input type="search" placeholder="Search log text…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </label>
          <select className="adm-select" value={filters.range} onChange={(e) => setFilters((f) => ({ ...f, range: e.target.value }))} aria-label="Date range">
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="button" className="adm-chip-btn" onClick={() => setFilters((f) => ({ ...f, order: f.order === "desc" ? "asc" : "desc" }))}>
            {filters.order === "desc" ? "↓ Newest first" : "↑ Oldest first"}
          </button>
          {activeCount ? (
            <button
              type="button"
              className="adm-chip-btn"
              onClick={() => {
                setSearchText("");
                setFilters(DEFAULTS);
              }}
            >
              ✕ Clear ({activeCount})
            </button>
          ) : null}
          <LiveBadge updatedAt={updatedAt} loading={loading} />
        </div>

        {filters.member ? (
          <div className="adm-chips">
            <button type="button" className="adm-chip is-on adm-chip--member" style={{ "--c": "#f59b2a" } as React.CSSProperties} onClick={() => setFilters((f) => ({ ...f, member: null }))}>
              👤 {people[filters.member.id]?.name ?? filters.member.name} ✕
            </button>
          </div>
        ) : null}

        <p className="adm-logs-count">
          {meta ? `${meta.total.toLocaleString()} log${meta.total === 1 ? "" : "s"}` : "…"}
          {filters.types.length ? ` · ${filters.types.join(", ")}` : ""}
        </p>

        {error ? <p className="adm-error">{error}</p> : null}

        <ol className="adm-logfeed">
          {items.map((log) => (
            <LogCard key={log.id} log={log} people={people} mentions={mentions} fresh={fresh.has(log.id)} onOpenMember={onOpenMember} onType={(t) => setFilters((f) => ({ ...f, types: [t] }))} />
          ))}
          {loading && !items.length
            ? Array.from({ length: 5 }, (_, i) => <li key={i} className="adm-log adm-log--skeleton" aria-hidden="true" />)
            : null}
          {!loading && !items.length ? <li className="adm-empty">No logs match these filters.</li> : null}
        </ol>

        {items.length && hasMore ? (
          <button type="button" className="adm-btn adm-btn--ghost adm-logs-more" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? "Loading…" : filters.order === "desc" ? "Load older logs" : "Load newer logs"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LogCard({
  log,
  people,
  mentions,
  fresh,
  onOpenMember,
  onType,
}: {
  log: LogEntry;
  people: People;
  mentions: Mentions;
  fresh: boolean;
  onOpenMember: (id: string) => void;
  onType: (type: string) => void;
}) {
  const [showImage, setShowImage] = useState<string | null>(null);
  const extra = extraFooter(log.footer);
  const rich = (text: string) => <RichText text={text} mentions={mentions} people={people} onOpenMember={onOpenMember} />;

  return (
    <li className={`adm-log${fresh ? " is-fresh" : ""}`} style={{ "--c": log.color ?? "#8b8d98" } as React.CSSProperties}>
      <div className="adm-log-head">
        <button type="button" className="adm-log-type" onClick={() => onType(log.type)} title="Show only this type">
          {log.type}
        </button>
        {log.subjectId ? <PersonLink id={log.subjectId} people={people} onOpen={onOpenMember} compact /> : null}
        <span className="adm-log-time" title={formatDate(log.ts)}>
          {timeAgo(log.ts)}
        </span>
      </div>
      {log.title && log.title.replace(/^\W+/, "") !== log.type ? <h4 className="adm-log-title">{rich(log.title)}</h4> : null}
      {log.content ? <p className="adm-log-text">{rich(log.content)}</p> : null}
      {log.description ? <p className="adm-log-text">{rich(log.description)}</p> : null}
      {log.fields.length ? (
        <dl className="adm-log-fields">
          {log.fields.map((f, i) => (
            <div key={i} className={f.inline ? "is-inline" : undefined}>
              <dt>{rich(f.name)}</dt>
              <dd>{rich(f.value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {log.attachments.length ? (
        <div className="adm-log-files">
          {log.attachments.map((a) =>
            a.image ? (
              <button key={a.id} type="button" className="adm-log-file" onClick={() => setShowImage(showImage === a.id ? null : a.id)}>
                🖼️ {a.filename} {showImage === a.id ? "▴" : "▾"}
              </button>
            ) : (
              <a key={a.id} className="adm-log-file" href={`/api/admin/logs/${log.id}/${a.id}`} target="_blank" rel="noopener noreferrer">
                📎 {a.filename} <small>{(a.size / 1024).toFixed(0)} KB</small>
              </a>
            ),
          )}
          {showImage ? <img className="adm-log-image" src={`/api/admin/logs/${log.id}/${showImage}`} alt="Archived attachment" /> : null}
        </div>
      ) : null}
      {extra ? <p className="adm-log-footer">{extra}</p> : null}
    </li>
  );
}
