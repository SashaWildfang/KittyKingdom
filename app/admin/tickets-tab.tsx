"use client";

import { AlertTriangle, Eye, FileText, RefreshCw, Search, Sparkles } from "lucide-react";
import "./ticket-summary.css";
import { useEffect, useRef, useState } from "react";
import type { TicketSummary } from "../../lib/ticket-summary";
import {
  LiveBadge,
  Pager,
  PersonLink,
  RANGES,
  TICKET_COLORS,
  actionColor,
  formatDate,
  formatMs,
  prettyAction,
  timeAgo,
  useLive,
  useStored,
  type People,
  type Ticket,
} from "./admin-shared";
import { DeleteTicketButton } from "./delete-ticket-button";
import { OpenTickets } from "./ticket-live";

type Result = { rows: Ticket[]; total: number; page: number; pageSize: number; people: People };
type SortKey = "ticketId" | "created" | "resolvedAt" | "type";

type Filters = {
  search: string;
  types: string[];
  statuses: string[];
  range: string;
  transcriptsOnly: boolean;
  sort: SortKey;
  order: "asc" | "desc";
  pageSize: number;
};

const DEFAULTS: Filters = { search: "", types: [], statuses: [], range: "all", transcriptsOnly: false, sort: "ticketId", order: "desc", pageSize: 25 };
const STATUSES = ["Open", "Closed", "Finalized"];

type SummaryState = { summary?: TicketSummary; busy?: boolean; error?: string };

/**
 * AI descriptions for the tickets on screen: loads the saved ones, then writes the missing (or outdated)
 * ones a couple at a time.
 */
function useTicketSummaries(rows: Ticket[]) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [state, setState] = useState<Record<number, SummaryState>>({});
  const queued = useRef(new Set<number>());
  const key = rows.map((r) => `${r.ticketId}:${r.status}:${r.transcriptId ?? ""}`).join(",");

  const write = async (id: number, force = false) => {
    setState((s) => ({ ...s, [id]: { ...s[id], busy: true, error: undefined } }));
    try {
      const r = await fetch(`/api/admin/tickets/${id}/summary`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) });
      const j = await r.json().catch(() => ({ ok: false, error: "Request failed." }));
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Couldn't describe this ticket.");
      setState((s) => ({ ...s, [id]: { summary: j.summary } }));
    } catch (e) {
      setState((s) => ({ ...s, [id]: { ...s[id], busy: false, error: e instanceof Error ? e.message : "Couldn't describe this ticket." } }));
    }
  };

  // Loads the saved ones and writes what's missing or outdated. Runs when the rows change, and every few
  // minutes while open tickets are on screen (they may have new messages).
  const [tick, setTick] = useState(0);
  const hasOpen = rows.some((r) => r.status === "Open");
  useEffect(() => {
    if (!hasOpen) return;
    const t = window.setInterval(() => document.visibilityState === "visible" && setTick((n) => n + 1), 5 * 60_000);
    return () => window.clearInterval(t);
  }, [hasOpen]);

  useEffect(() => {
    if (!rows.length) return;
    let cancelled = false;
    const todo: number[] = [];
    (async () => {
      const r = await fetch(`/api/admin/tickets/summaries?ids=${rows.map((t) => t.ticketId).join(",")}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (cancelled || !r?.ok) return;
      setEnabled(r.enabled);
      const saved = r.summaries as Record<number, TicketSummary>;
      setState((s) => {
        const next = { ...s };
        for (const [id, sum] of Object.entries(saved)) next[Number(id)] = { ...next[Number(id)], summary: sum };
        return next;
      });
      if (!r.enabled) return;
      // Missing or outdated ones (only tickets there's something to read for), two at a time
      for (const t of rows) {
        if ((t.transcriptId || t.status === "Open") && (!saved[t.ticketId] || saved[t.ticketId].stale) && !queued.current.has(t.ticketId)) {
          todo.push(t.ticketId);
          queued.current.add(t.ticketId);
        }
      }
      const worker = async () => {
        while (todo.length && !cancelled) {
          const id = todo.shift()!;
          await write(id);
          queued.current.delete(id);
        }
      };
      await Promise.all([worker(), worker()]);
    })();
    return () => {
      cancelled = true;
      // Not written yet: free them so the next run (another page, a later check) can pick them up
      todo.forEach((id) => queued.current.delete(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  return { enabled, state, refresh: (id: number) => write(id, true) };
}

function SummaryLine({ s, onRefresh }: { s: SummaryState | undefined; onRefresh: () => void }) {
  const sum = s?.summary;
  // Nothing to show yet (or ever: AI off, or no transcript left to read)
  if (!sum && !s?.busy && !s?.error) return null;
  return (
    <div className="tks-line" onClick={(e) => e.stopPropagation()}>
      <Sparkles size={14} className="tks-icon" aria-hidden="true" />
      {sum ? (
        <span className="tks-text">
          {sum.headline}
          {sum.flags?.map((f) => (
            <span key={f} className="tks-flag">
              <AlertTriangle size={11} aria-hidden="true" /> {f}
            </span>
          ))}
        </span>
      ) : (
        <span className="tks-text is-muted">{s?.busy ? "Reading the ticket…" : s?.error}</span>
      )}
      {s?.busy && sum ? <span className="tks-busy">Updating…</span> : null}
      {!s?.busy ? (
        <button type="button" className="tks-refresh" onClick={onRefresh} title={sum ? "Read it again" : "Try again"} aria-label="Describe again">
          <RefreshCw size={12} />
        </button>
      ) : null}
    </div>
  );
}

export function TicketsTab({
  typesAvailable,
  onOpenMember,
  onOpenTranscript,
  initialSearch,
  readOnly = false,
}: {
  typesAvailable: string[];
  /** Staff who aren't admins: view only, and NSFW verification tickets are left out (by the server) */
  readOnly?: boolean;
  onOpenMember: (id: string) => void;
  onOpenTranscript: (ticketId: number) => void;
  initialSearch?: string;
}) {
  const [filters, setFilters] = useStored<Filters>("tickets-filters", DEFAULTS);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState(filters.search);

  useEffect(() => {
    if (initialSearch) setSearchText(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchText !== filters.search) {
        setFilters((f) => ({ ...f, search: searchText }));
        setPage(1);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchText, filters.search, setFilters]);

  const params = new URLSearchParams({
    search: filters.search,
    types: filters.types.join(","),
    statuses: filters.statuses.join(","),
    hasTranscript: filters.transcriptsOnly ? "1" : "0",
    sort: filters.sort,
    order: filters.order,
    page: String(page),
    pageSize: String(filters.pageSize),
    ...(filters.range !== "all" ? { range: filters.range } : {}),
  });
  const { data, error, loading, updatedAt, reload } = useLive<Result>(`/api/admin/tickets?${params}`, 15_000);
  const summaries = useTicketSummaries(data?.rows ?? []);
  // Tickets deleted here disappear straight away (the live refresh confirms it)
  const [deleted, setDeleted] = useState<number[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const onAnyDelete = (e: Event) => setDeleted((d) => [...d, Number((e as CustomEvent).detail)]);
    window.addEventListener("kk-ticket-deleted", onAnyDelete);
    return () => window.removeEventListener("kk-ticket-deleted", onAnyDelete);
  }, []);
  const onDeleted = (id: number) => {
    setDeleted((d) => [...d, id]);
    setNotice(`Ticket #${id} and its transcript were deleted. It's logged in the bot logs channel.`);
    reload();
  };

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const sortBy = (key: SortKey) => update({ sort: key, order: filters.sort === key && filters.order === "desc" ? "asc" : "desc" });
  const arrow = (key: SortKey) => (filters.sort === key ? (filters.order === "desc" ? " ↓" : " ↑") : "");
  const people = data?.people ?? {};

  return (
    <div className="adm-panel">
      {readOnly ? (
        <p className="adm-notice adm-tickets-readonly" role="note">
          <Eye size={15} aria-hidden="true" /> <b>View only.</b> You can read every ticket and transcript. NSFW verification tickets are only visible to admins.
        </p>
      ) : null}
      <OpenTickets onOpenMember={onOpenMember} />
      <div className="adm-filters">
        <label className="adm-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Ticket #, member name or ID, staff, topic…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </label>
        <select className="adm-select" value={filters.range} onChange={(e) => update({ range: e.target.value })} aria-label="Date range">
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <select className="adm-select" value={filters.pageSize} onChange={(e) => update({ pageSize: Number(e.target.value) })} aria-label="Rows per page">
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} rows
            </option>
          ))}
        </select>
        <button type="button" className={`adm-chip-btn${filters.transcriptsOnly ? " is-active" : ""}`} onClick={() => update({ transcriptsOnly: !filters.transcriptsOnly })}>
          <FileText size={15} aria-hidden="true" /> With transcript
        </button>
        <LiveBadge updatedAt={updatedAt} loading={loading} />
      </div>

      <div className="adm-chips">
        {typesAvailable.map((type, i) => (
          <button
            key={type}
            type="button"
            className={`adm-chip${filters.types.includes(type) ? " is-on" : ""}`}
            style={{ "--c": TICKET_COLORS[type] ?? actionColor(type, i + 3) } as React.CSSProperties}
            onClick={() => update({ types: toggle(filters.types, type) })}
          >
            {prettyAction(type)}
          </button>
        ))}
        <span className="adm-chips-sep" />
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={`adm-chip${filters.statuses.includes(status) ? " is-on" : ""}`}
            style={{ "--c": status === "Open" ? "#46a758" : "#8b8d98" } as React.CSSProperties}
            onClick={() => update({ statuses: toggle(filters.statuses, status) })}
          >
            {status}
          </button>
        ))}
      </div>

      {error ? <p className="adm-error">{error}</p> : null}
      {notice ? (
        <p className="adm-notice" role="status">
          {notice}
        </p>
      ) : null}

      {summaries.enabled === false ? (
        <p className="tks-off">
          <Sparkles size={14} aria-hidden="true" /> AI ticket descriptions are switched off. Add an <code>ANTHROPIC_API_KEY</code> in Vercel (Settings → Environment Variables) and redeploy to turn them on.
        </p>
      ) : null}
      <div className="adm-table-wrap">
        <table className="adm-table tks-table">
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => sortBy("ticketId")}>#{arrow("ticketId")}</button>
              </th>
              <th>
                <button type="button" onClick={() => sortBy("type")}>Type{arrow("type")}</button>
              </th>
              <th>Opened by</th>
              <th>Handled by</th>
              <th>
                <button type="button" onClick={() => sortBy("created")}>Opened{arrow("created")}</button>
              </th>
              <th>
                <button type="button" onClick={() => sortBy("resolvedAt")}>Took{arrow("resolvedAt")}</button>
              </th>
              <th>Status</th>
              <th>Transcript</th>
              <th>
                <span className="adm-sr">Delete</span>
              </th>
            </tr>
          </thead>
          {/* One <tbody> per ticket: its row and the description under it read (and highlight) as one */}
            {(data?.rows ?? []).filter((t) => !deleted.includes(t.ticketId)).map((t) => (
            <tbody key={t.ticketId} className="tks-group">
              <tr key={t.ticketId} onClick={() => t.transcriptId && onOpenTranscript(t.ticketId)} className={t.transcriptId ? "is-clickable" : undefined}>
                <td>
                  <strong>#{t.ticketId}</strong>
                </td>
                <td>
                  <span className="adm-action" style={{ "--c": TICKET_COLORS[t.type] ?? "#8b8d98" } as React.CSSProperties}>
                    {prettyAction(t.type)}
                  </span>
                  {t.escalated ? <span className="adm-tag">escalated</span> : null}
                </td>
                <td>
                  <PersonLink id={t.openedBy} people={people} onOpen={onOpenMember} />
                </td>
                <td>
                  <PersonLink id={t.claimedBy ?? t.resolvedBy} people={people} onOpen={onOpenMember} compact />
                </td>
                <td title={formatDate(t.created)}>
                  <strong>{timeAgo(t.created)}</strong>
                  <small>{formatDate(t.created)}</small>
                </td>
                <td>{t.created && t.resolvedAt ? formatMs(new Date(t.resolvedAt).getTime() - new Date(t.created).getTime()) : "—"}</td>
                <td>
                  <span className={`adm-status${t.status === "Open" ? " adm-status--active" : ""}`}>{t.status === "Open" ? "● Open" : t.status}</span>
                </td>
                <td>
                  {t.transcriptId ? (
                    <button
                      type="button"
                      className="adm-btn adm-btn--tiny"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTranscript(t.ticketId);
                      }}
                    >
                      <FileText size={13} aria-hidden="true" /> View
                    </button>
                  ) : (
                    <span className="adm-muted">None</span>
                  )}
                </td>
                <td className="adm-ticket-actions">
                  <DeleteTicketButton ticket={t} onDeleted={onDeleted} />
                </td>
              </tr>
              <tr className="tks-row" onClick={() => t.transcriptId && onOpenTranscript(t.ticketId)}>
                <td />
                <td colSpan={8}>
                  <SummaryLine s={summaries.state[t.ticketId]} onRefresh={() => void summaries.refresh(t.ticketId)} />
                </td>
              </tr>
            </tbody>
            ))}
          <tbody>
            {!loading && data && !data.rows.length ? (
              <tr>
                <td colSpan={9} className="adm-empty">
                  No tickets match these filters.
                </td>
              </tr>
            ) : null}
            {!data && loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="adm-row-skeleton">
                    <td colSpan={9} />
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
