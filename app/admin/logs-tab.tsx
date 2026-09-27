"use client";

import { ArrowRight, Bot, Gem, MessageCircle, Mic, Package, Paperclip, ScanSearch, ScrollText, Search, Shield, Ticket, TrendingUp, User, UserRound, X } from "lucide-react";
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
  thumbnail?: string | null;
  image?: string | null;
  subjectId: string | null;
  userIds: string[];
  attachments: { id: string; filename: string; size: number; image: boolean; kind?: string }[];
  postedBy: string;
  category?: string;
  channel?: string;
};

const SOURCES = [
  { key: "all", label: "All logs", icon: ScrollText },
  { key: "bot", label: "Bot logs", icon: Bot },
  { key: "vc", label: "VC logs", icon: Mic },
];

const CATEGORIES = [
  { key: "voice", label: "Voice", icon: Mic },
  { key: "messages", label: "Messages", icon: MessageCircle },
  { key: "members", label: "Member updates", icon: UserRound },
  { key: "moderation", label: "Moderation", icon: Shield },
  { key: "tickets", label: "Tickets", icon: Ticket },
  { key: "economy", label: "Levels & economy", icon: TrendingUp },
  { key: "boosts", label: "Boosts & bumps", icon: Gem },
  { key: "system", label: "Scans & system", icon: ScanSearch },
  { key: "other", label: "Other", icon: Package },
];

function attachmentKind(a: { kind?: string; image: boolean; filename: string }) {
  if (a.kind) return a.kind;
  if (a.image) return "image";
  if (/\.(mp4|mov|webm|m4v)$/i.test(a.filename)) return "video";
  if (/\.(mp3|ogg|wav|m4a)$/i.test(a.filename)) return "audio";
  if (/\.(png|jpe?g|gif|webp)$/i.test(a.filename)) return "image";
  return "file";
}

type Result = {
  rows: LogEntry[];
  total: number;
  types: { type: string; category: string; count: number }[];
  sync: { backfillDone: boolean; oldest: string | null };
  people: People;
  mentions: Mentions;
};

type Filters = { source?: string; types: string[]; categories: string[]; member: { id: string; name: string } | null; search: string; range: string; order: "desc" | "asc" };
const DEFAULTS: Filters = { types: [], categories: [], member: null, search: "", range: "all", order: "desc" };
const POLL_MS = 8_000;

function buildParams(f: Filters, extra: Record<string, string> = {}) {
  return new URLSearchParams({
    types: f.types.join(","),
    categories: (f.categories ?? []).join(","),
    ...(f.source && f.source !== "all" ? { channels: f.source } : {}),
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
  const [openCats, setOpenCats] = useStored<string[]>("logs-open-cats", []);
  const [showRare, setShowRare] = useState<string[]>([]);
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
  const toggleCategory = (key: string) =>
    setFilters((f) => {
      const cats = f.categories ?? [];
      return { ...f, categories: cats.includes(key) ? cats.filter((c) => c !== key) : [...cats, key] };
    });
  const needle = typeFilter.trim().toLowerCase();
  const types = (meta?.types ?? []).filter((t) => t.type.toLowerCase().includes(needle));
  const grouped = CATEGORIES.map((c) => {
    const list = types.filter((t) => (t.category || "other") === c.key);
    return { ...c, list, total: list.reduce((n, t) => n + t.count, 0) };
  }).filter((c) => c.list.length);
  const activeCount = filters.types.length + (filters.categories?.length ?? 0) + (filters.member ? 1 : 0) + (filters.search ? 1 : 0) + (filters.range !== "all" ? 1 : 0);

  return (
    <div className="adm-logs">
      <aside className="adm-logs-side">
        <div className="adm-logs-side-head">
          <h3>Log types</h3>
          {filters.types.length || filters.categories?.length ? (
            <button type="button" className="adm-link" onClick={() => setFilters((f) => ({ ...f, types: [], categories: [] }))}>
              Clear
            </button>
          ) : null}
        </div>
        <input className="adm-logs-typefilter" placeholder="Find a type…" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} />
        <div className="adm-logs-cats">
          {grouped.map((c) => {
            const open = openCats.includes(c.key) || Boolean(needle);
            const catOn = (filters.categories ?? []).includes(c.key);
            // Types seen only once are tucked away so the list stays readable
            const main = c.list.filter((t) => t.count > 1 || filters.types.includes(t.type));
            const rare = c.list.filter((t) => t.count <= 1 && !filters.types.includes(t.type));
            const rareOpen = showRare.includes(c.key) || Boolean(needle);
            return (
              <div key={c.key} className={`adm-logs-cat${open ? " is-open" : ""}`}>
                <div className="adm-logs-cat-head">
                  <label className={catOn ? "is-on" : undefined} title={`Show every ${c.label.toLowerCase()} log`}>
                    <input type="checkbox" checked={catOn} onChange={() => toggleCategory(c.key)} />
                    <span className="adm-logs-cat-label">
                      <c.icon size={15} aria-hidden="true" /> {c.label}
                    </span>
                    <small>{c.total.toLocaleString()}</small>
                  </label>
                  <button
                    type="button"
                    className="adm-logs-cat-toggle"
                    aria-expanded={open}
                    aria-label={`${open ? "Hide" : "Show"} ${c.label} types`}
                    onClick={() => setOpenCats((list) => (list.includes(c.key) ? list.filter((k) => k !== c.key) : [...list, c.key]))}
                  >
                    ▾
                  </button>
                </div>
                {open ? (
                  <ul>
                    {main.map((t) => (
                      <li key={t.type}>
                        <label className={filters.types.includes(t.type) ? "is-on" : undefined}>
                          <input type="checkbox" checked={filters.types.includes(t.type)} onChange={() => toggleType(t.type)} />
                          <span title={t.type}>{t.type}</span>
                          <small>{t.count.toLocaleString()}</small>
                        </label>
                      </li>
                    ))}
                    {rare.length ? (
                      <li>
                        <button type="button" className="adm-logs-rare" onClick={() => setShowRare((l) => (l.includes(c.key) ? l.filter((k) => k !== c.key) : [...l, c.key]))}>
                          {rareOpen ? "▴ Hide" : "▾"} {rare.length} one-off type{rare.length === 1 ? "" : "s"}
                        </button>
                      </li>
                    ) : null}
                    {rareOpen
                      ? rare.map((t) => (
                          <li key={t.type} className="is-rare">
                            <label className={filters.types.includes(t.type) ? "is-on" : undefined}>
                              <input type="checkbox" checked={filters.types.includes(t.type)} onChange={() => toggleType(t.type)} />
                              <span title={t.type}>{t.type}</span>
                              <small>1</small>
                            </label>
                          </li>
                        ))
                      : null}
                  </ul>
                ) : null}
              </div>
            );
          })}
          {meta && !grouped.length ? <p className="adm-muted">No types match.</p> : null}
        </div>
        <p className="adm-logs-sync">
          {meta?.sync.backfillDone
            ? "Every log is loaded."
            : meta?.sync.oldest
              ? `Loaded back to ${new Date(meta.sync.oldest).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · loading older logs…`
              : "Loading logs…"}
        </p>
      </aside>

      <div className="adm-logs-main">
        <div className="adm-seg adm-logs-sources" role="tablist" aria-label="Which logs">
          {SOURCES.map((src) => (
            <button
              key={src.key}
              type="button"
              role="tab"
              aria-selected={(filters.source ?? "all") === src.key}
              className={(filters.source ?? "all") === src.key ? "is-active" : undefined}
              onClick={() => setFilters((f) => ({ ...f, source: src.key, types: [], categories: [] }))}
            >
              <src.icon size={15} aria-hidden="true" /> {src.label}
            </button>
          ))}
        </div>
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
            <Search size={16} aria-hidden="true" />
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
              <X size={14} aria-hidden="true" /> Clear ({activeCount})
            </button>
          ) : null}
          <LiveBadge updatedAt={updatedAt} loading={loading} />
        </div>

        {filters.member ? (
          <div className="adm-chips">
            <button type="button" className="adm-chip is-on adm-chip--member" style={{ "--c": "#f59b2a" } as React.CSSProperties} onClick={() => setFilters((f) => ({ ...f, member: null }))}>
              <User size={13} aria-hidden="true" /> {people[filters.member.id]?.name ?? filters.member.name} <X size={13} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <p className="adm-logs-count">
          {meta ? `${meta.total.toLocaleString()} log${meta.total === 1 ? "" : "s"}` : "…"}
          {filters.categories?.length ? ` · ${filters.categories.map((k) => CATEGORIES.find((c) => c.key === k)?.label ?? k).join(", ")}` : ""}
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
  const extra = extraFooter(log.footer);
  // Avatar changes: show the old and new pictures instead of a bare link
  const oldAvatar = log.type === "Avatar Changed" ? log.fields.find((f) => /old avatar/i.test(f.name))?.value.match(/\((https?:\/\/[^)\s]+)\)/)?.[1] ?? null : null;
  const avatarSwap = log.type === "Avatar Changed" && log.thumbnail ? { before: oldAvatar, after: log.thumbnail } : null;
  const fields = avatarSwap ? log.fields.filter((f) => !/old avatar/i.test(f.name)) : log.fields;
  const rich = (text: string) => <RichText text={text} mentions={mentions} people={people} onOpenMember={onOpenMember} />;

  return (
    <li className={`adm-log${fresh ? " is-fresh" : ""}`} style={{ "--c": log.color ?? "#8b8d98" } as React.CSSProperties}>
      <div className="adm-log-head">
        <button type="button" className="adm-log-type" onClick={() => onType(log.type)} title="Show only this type">
          {log.channel === "vc" ? <Mic size={12} aria-hidden="true" /> : null}
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
      {avatarSwap ? (
        <div className="adm-avatar-swap">
          {avatarSwap.before ? (
            <figure>
              <img src={avatarSwap.before} alt="Old avatar" loading="lazy" onError={(e) => ((e.currentTarget.parentElement as HTMLElement).dataset.gone = "1")} />
              <figcaption>Before</figcaption>
            </figure>
          ) : null}
          {avatarSwap.before ? <ArrowRight size={20} className="adm-avatar-swap-arrow" aria-hidden="true" /> : null}
          <figure>
            <img src={avatarSwap.after} alt="New avatar" loading="lazy" />
            <figcaption>New avatar</figcaption>
          </figure>
        </div>
      ) : log.thumbnail || log.image ? (
        <div className="adm-log-media">
          {log.thumbnail ? (
            <a className="adm-log-thumb adm-log-thumb--small" href={log.thumbnail} target="_blank" rel="noopener noreferrer">
              <img src={log.thumbnail} alt="" loading="lazy" />
            </a>
          ) : null}
          {log.image ? (
            <a className="adm-log-thumb" href={log.image} target="_blank" rel="noopener noreferrer">
              <img src={log.image} alt="" loading="lazy" />
            </a>
          ) : null}
        </div>
      ) : null}
      {fields.length ? (
        <dl className="adm-log-fields">
          {fields.map((f, i) => (
            <div key={i} className={f.inline ? "is-inline" : undefined}>
              <dt>{rich(f.name)}</dt>
              <dd>{rich(f.value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {log.attachments.length ? (
        <div className="adm-log-media">
          {log.attachments.map((a) => {
            const src = `/api/admin/logs/${log.id}/${a.id}`;
            const kind = attachmentKind(a);
            if (kind === "image") {
              return (
                <a key={a.id} className="adm-log-thumb" href={src} target="_blank" rel="noopener noreferrer" title={a.filename}>
                  <img src={src} alt={a.filename} loading="lazy" />
                </a>
              );
            }
            if (kind === "video") {
              return (
                <video key={a.id} className="adm-log-video" src={src} controls preload="metadata" playsInline>
                  <a href={src}>{a.filename}</a>
                </video>
              );
            }
            if (kind === "audio") return <audio key={a.id} src={src} controls preload="none" />;
            return (
              <a key={a.id} className="adm-log-file" href={src} target="_blank" rel="noopener noreferrer">
                <Paperclip size={13} aria-hidden="true" /> {a.filename} <small>{(a.size / 1024).toFixed(0)} KB</small>
              </a>
            );
          })}
        </div>
      ) : null}
      {extra ? <p className="adm-log-footer">{extra}</p> : null}
    </li>
  );
}
