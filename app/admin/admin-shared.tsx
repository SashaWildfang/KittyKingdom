"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Person = { name: string; username: string | null; avatar: string | null; inServer: boolean };
export type People = Record<string, Person>;

export type Punishment = {
  id: string;
  action: string;
  userId: string | null;
  issuerId: string | null;
  reason: string;
  timestamp: string;
  durationSeconds: number | null;
  expiresAt: string | null;
  extraInfo: string | null;
  messageContent: string | null;
  source: "automod" | "manual";
  status: "active" | "ended" | "none";
};

export type Ticket = {
  ticketId: number;
  type: string;
  topic: string;
  status: string;
  openedBy: string | null;
  claimedBy: string | null;
  resolvedBy: string | null;
  created: string | null;
  resolvedAt: string | null;
  transcriptId: string | null;
  escalated: boolean;
};

export const ACTION_COLORS: Record<string, string> = {
  ban: "#e5484d",
  tempban: "#f2555a",
  kick: "#f76b15",
  kick_unverified: "#ff8b3e",
  mute: "#ffb224",
  tempmute: "#ffc53d",
  timeout: "#ffb224",
  muzzle: "#a18072",
  warn: "#e2b203",
  unban: "#46a758",
  unmute: "#30a46c",
  unmuzzle: "#3e9b4f",
};

const EXTRA_COLORS = ["#8e4ec6", "#3e63dd", "#0090ff", "#12a594", "#d6409f", "#978365"];
export function actionColor(action: string, index = 0) {
  return ACTION_COLORS[action] ?? EXTRA_COLORS[index % EXTRA_COLORS.length];
}

export const TICKET_COLORS: Record<string, string> = {
  nsfw: "#d6409f",
  support: "#3e63dd",
  "staff-application": "#12a594",
  manual: "#978365",
};

export function prettyAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function timeAgo(iso: string | null, now = Date.now()) {
  if (!iso) return "—";
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  const future = seconds < 0;
  const s = Math.abs(seconds);
  const text =
    s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : s < 86400 * 30 ? `${Math.floor(s / 86400)}d` : s < 86400 * 365 ? `${Math.floor(s / (86400 * 30))}mo` : `${Math.floor(s / (86400 * 365))}y`;
  return future ? `in ${text}` : `${text} ago`;
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d ? `${d}d` : "", h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ") || `${seconds}s`;
}

export function formatMs(ms: number | null) {
  if (!ms) return "—";
  return formatDuration(Math.round(ms / 1000));
}

/** Loads JSON from an admin API and refreshes it while the tab is visible. */
export function useLive<T>(url: string | null, intervalMs = 10_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const request = useRef(0);

  const load = useCallback(
    async (quiet: boolean) => {
      if (!url) return;
      const id = ++request.current;
      if (!quiet) setLoading(true);
      try {
        const response = await fetch(url, { cache: "no-store" });
        const body = await response.json();
        if (id !== request.current) return;
        if (!response.ok || body.ok === false) throw new Error(body.error ?? "Request failed.");
        setData(body as T);
        setError(null);
        setUpdatedAt(Date.now());
      } catch (e) {
        if (id === request.current && !quiet) setError(e instanceof Error ? e.message : "Request failed.");
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [url],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(false), 150);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!url || !intervalMs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [url, intervalMs, load]);

  return { data, error, loading, updatedAt, reload: () => load(true) };
}

/** Remembers a small piece of UI state per admin (filters, hidden widgets). */
export function useStored<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`kk-admin:${key}`);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // Private mode or blocked storage: keep defaults
    }
    loaded.current = true;
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(`kk-admin:${key}`, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);
  return [value, setValue];
}

export function Avatar({ person, id, size = 28 }: { person?: Person; id?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = person?.avatar ?? (id ? `/api/discord/avatar/${id}` : null);
  if (!src || failed) {
    return (
      <span className="adm-avatar adm-avatar--letter" style={{ width: size, height: size }} aria-hidden="true">
        {(person?.name ?? "?").charAt(0).toUpperCase()}
      </span>
    );
  }
  return <img className="adm-avatar" src={src} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />;
}

/** A member name that opens their profile drawer. */
export function PersonLink({
  id,
  people,
  onOpen,
  automodId,
  compact,
}: {
  id: string | null;
  people: People;
  onOpen: (id: string) => void;
  automodId?: boolean;
  compact?: boolean;
}) {
  if (!id) return <span className="adm-muted">—</span>;
  const person = people[id];
  return (
    <button
      type="button"
      className="adm-person"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(id);
      }}
      title={`${person?.name ?? "Unknown"} · ${id}`}
    >
      <Avatar person={person} id={id} size={compact ? 22 : 28} />
      <span className="adm-person-text">
        <strong>{automodId ? "AutoMod" : person?.name ?? "Unknown user"}</strong>
        {!compact ? <small>{person?.username ? `@${person.username}` : id}</small> : null}
      </span>
      {person && !person.inServer && !automodId ? <span className="adm-tag adm-tag--muted">left</span> : null}
    </button>
  );
}

/** A member's avatar and name, not clickable on its own (for rows that are clickable). */
export function PersonTag({ id, people, automod }: { id: string | null; people: People; automod?: boolean }) {
  if (!id) return <span className="adm-muted">—</span>;
  const person = people[id];
  return (
    <span className="adm-person adm-person--static">
      <Avatar person={person} id={id} size={22} />
      <span className="adm-person-text">
        <strong>{automod ? "AutoMod" : person?.name ?? "Unknown user"}</strong>
      </span>
      {person && !person.inServer && !automod ? <span className="adm-tag adm-tag--muted">left</span> : null}
    </span>
  );
}

export function ActionBadge({ action }: { action: string }) {
  return (
    <span className="adm-action" style={{ "--c": actionColor(action) } as React.CSSProperties}>
      {prettyAction(action)}
    </span>
  );
}

export function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="adm-copy"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(id).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
      title="Copy ID"
    >
      {copied ? "Copied ✓" : id}
    </button>
  );
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="adm-pager">
      <span>
        {total.toLocaleString()} result{total === 1 ? "" : "s"}
      </span>
      <div>
        <button type="button" onClick={() => onPage(1)} disabled={page <= 1} aria-label="First page">
          «
        </button>
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          ← Prev
        </button>
        <span>
          {page} / {pages}
        </span>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages}>
          Next →
        </button>
        <button type="button" onClick={() => onPage(pages)} disabled={page >= pages} aria-label="Last page">
          »
        </button>
      </div>
    </div>
  );
}

export function LiveBadge({ updatedAt, loading }: { updatedAt: number | null; loading: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="adm-live" title="Updates automatically every few seconds">
      <i className={loading ? "is-loading" : undefined} aria-hidden="true" />
      Live{updatedAt ? ` · ${Math.max(0, Math.round((now - updatedAt) / 1000))}s ago` : ""}
    </span>
  );
}

export const RANGES = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "1y", label: "1 year" },
  { key: "all", label: "All time" },
];

export function toCsv(rows: (string | number | null)[][]) {
  return rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==========================================
// Discord-flavoured text: <#channel>, <@user>, <@&role>, <:emoji:id>
// ==========================================
export type Mentions = {
  channels: Record<string, string>;
  roles: Record<string, { name: string; color: string | null }>;
};

const TOKEN = /<(a?):(\w{2,32}):(\d{15,21})>|<#(\d{15,21})>|<@&(\d{15,21})>|<@!?(\d{15,21})>/g;

/** Shows a reason the way Discord would: channel and role names, member names, custom emojis. */
export function RichText({ text, mentions, people, onOpenMember }: { text: string; mentions?: Mentions; people?: People; onOpenMember?: (id: string) => void }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  const plain = (chunk: string) => parts.push(<Markdown key={key++} text={chunk} />);
  for (const match of Array.from(text.matchAll(TOKEN))) {
    const index = match.index ?? 0;
    if (index > last) plain(text.slice(last, index));
    const [, animated, emojiName, emojiId, channelId, roleId, userId] = match;
    if (emojiId) {
      parts.push(
        <img
          key={key++}
          className="adm-emoji"
          src={`https://cdn.discordapp.com/emojis/${emojiId}.${animated ? "gif" : "webp"}?size=48&quality=lossless`}
          alt={`:${emojiName}:`}
          title={`:${emojiName}:`}
          loading="lazy"
        />,
      );
    } else if (channelId) {
      const name = mentions?.channels[channelId];
      parts.push(
        <span key={key++} className="adm-mention" title={channelId}>
          #{name ?? "unknown-channel"}
        </span>,
      );
    } else if (roleId) {
      const role = mentions?.roles[roleId];
      parts.push(
        <span key={key++} className="adm-mention" style={role?.color ? ({ "--m": role.color } as React.CSSProperties) : undefined}>
          @{role?.name ?? "unknown-role"}
        </span>,
      );
    } else if (userId) {
      const person = people?.[userId];
      parts.push(
        <button
          key={key++}
          type="button"
          className="adm-mention"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMember?.(userId);
          }}
        >
          @{person?.name ?? userId}
        </button>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) plain(text.slice(last));
  return <>{parts}</>;
}

// Discord-style markdown: **bold**, *italic*, __underline__, ~~strike~~, `code`, [text](https://link)
const MD = /\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*([^*\n]+)\*/g;

function Markdown({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of Array.from(text.matchAll(MD))) {
    const index = m.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const [, bold, underline, strike, code, linkText, linkUrl, italic] = m;
    if (bold) out.push(<strong key={key++}>{bold}</strong>);
    else if (underline) out.push(<u key={key++}>{underline}</u>);
    else if (strike) out.push(<s key={key++}>{strike}</s>);
    else if (code) out.push(<code key={key++} className="adm-md-code">{code}</code>);
    else if (linkText && linkUrl)
      out.push(
        <a key={key++} className="adm-md-link" href={linkUrl} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()}>
          {linkText}
        </a>,
      );
    else if (italic) out.push(<em key={key++}>{italic}</em>);
    last = index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

// ==========================================
// Member search with suggestions
// ==========================================
export type MemberSuggestion = { id: string; name: string; username: string | null; avatar: string | null; inServer: boolean; punishments: number };

/**
 * A search box that suggests Discord members as you type. Picking one calls onPick;
 * pressing Enter without picking calls onSubmit with the text.
 */
export function MemberSearch({
  value,
  onChange,
  onPick,
  onSubmit,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (member: MemberSuggestion) => void;
  onSubmit?: (text: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<MemberSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetch(`/api/admin/members?q=${encodeURIComponent(q)}`, { signal: controller.signal, cache: "no-store" })
        .then((r) => r.json())
        .then((body) => {
          setSuggestions(body.members ?? []);
          setHighlight(0);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(member: MemberSuggestion) {
    setOpen(false);
    onPick(member);
  }

  const showList = open && value.trim().length >= 2;
  return (
    <div className={`adm-msearch${className ? ` ${className}` : ""}`} ref={boxRef}>
      <span className="adm-msearch-icon" aria-hidden="true">
        🔍
      </span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, Math.max(0, suggestions.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (showList && suggestions[highlight]) pick(suggestions[highlight]);
            else {
              setOpen(false);
              onSubmit?.(value);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
      />
      {showList ? (
        <ul className="adm-msearch-list" role="listbox">
          {suggestions.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={i === highlight ? "is-hl" : undefined}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
              >
                <Avatar person={{ name: m.name, username: m.username, avatar: m.avatar, inServer: m.inServer }} id={m.id} size={30} />
                <span className="adm-msearch-text">
                  <strong>{m.name}</strong>
                  <small>
                    {m.username ? `@${m.username} · ` : ""}
                    {m.id}
                  </small>
                </span>
                {!m.inServer ? <span className="adm-tag adm-tag--muted">left</span> : null}
                {m.punishments ? <span className="adm-msearch-count">{m.punishments} on record</span> : null}
              </button>
            </li>
          ))}
          {!suggestions.length ? <li className="adm-msearch-empty">{loading ? "Searching…" : "No members match. Press Enter to search text."}</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
