"use client";

import { AlertTriangle, BrushCleaning, Lock, Eye, FileText, RefreshCw, Search, Sparkles, Ticket as TicketIcon, Trash2, UserX, X } from "lucide-react";
import "./ticket-summary.css";
import "./delete-ticket.css";
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TicketSummary } from "../../lib/ticket-summary";
import {
  LiveBadge,
  Pager,
  PersonLink,
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
import { DobDialog } from "./dob-dialog";
import { DeleteTicketButton, TicketCanDelete, TicketDeletePermissions } from "./delete-ticket-button";
import { OpenTickets } from "./ticket-live";

type Result = { rows: Ticket[]; total: number; page: number; pageSize: number; people: People; statusCounts: Record<string, number>; tagCounts: Record<string, number> | null };
type SortKey = "ticketId" | "created" | "resolvedAt" | "type";
type Opener = "any" | "in" | "left" | "deleted";

type Filters = {
  search: string;
  types: string[];
  statuses: string[];
  tags: string[];
  range: string;
  opener: Opener;
  transcriptsOnly: boolean;
  sort: SortKey;
  order: "asc" | "desc";
  pageSize: number;
};

const DEFAULTS: Filters = { search: "", types: [], statuses: [], tags: [], range: "all", opener: "any", transcriptsOnly: false, sort: "ticketId", order: "desc", pageSize: 25 };
const STATUSES = ["Open", "Closed", "Finalized"];
const RANGES: [string, string][] = [
  ["all", "Any time"],
  ["7d", "Last 7 days"],
  ["30d", "Last month"],
  ["90d", "Last 3 months"],
  ["6m", "Last 6 months"],
  ["1y", "Last 12 months"],
  ["2y", "Last 2 years"],
];
const OPENERS: [Opener, string][] = [
  ["any", "Opened by anyone"],
  ["in", "Still in the server"],
  ["left", "Left the server"],
  ["deleted", "Deleted Discord account"],
];
/** Tags on descriptions (lib/ticket-summary TICKET_TAGS): label and whether it's a problem */
const TAGS: Record<string, { label: string; bad: boolean }> = {
  "dob-mismatch": { label: "DOB mismatch", bad: true },
  "under-18": { label: "Under 18", bad: true },
  "no-photo": { label: "No photo submitted", bad: true },
  "no-join-app": { label: "No join application", bad: true },
  "no-app-dob": { label: "No DOB on join app", bad: true },
  "app-age-mismatch": { label: "Join app age ≠ its DOB", bad: true },
  "no-role": { label: "Verified, no 18+ role", bad: true },
  "id-not-recorded": { label: "ID DOB not recorded", bad: false },
  left: { label: "Left the server", bad: false },
  deleted: { label: "Deleted account", bad: false },
};

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
      // Missing or outdated ones (only tickets there's something to read for), two at a time. Without an
      // API key only 18+ verification tickets are done (they're built from our records, no AI).
      for (const t of rows) {
        if (!r.enabled && !/nsfw/i.test(t.type)) continue;
        if ((t.transcriptId || t.status === "Open" || /nsfw/i.test(t.type)) && (!saved[t.ticketId] || saved[t.ticketId].stale) && !queued.current.has(t.ticketId)) {
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

  return { enabled, state, refresh: (id: number) => write(id, true), set: (sum: TicketSummary) => setState((s) => ({ ...s, [sum.ticketId]: { summary: sum } })) };
}

function SummaryLine({ s, onRefresh, ticket, canEdit, onSummary }: { s: SummaryState | undefined; onRefresh: () => void; ticket?: Ticket; canEdit?: boolean; onSummary?: (sum: TicketSummary) => void }) {
  const sum = s?.summary;
  // Admins can record a missing date of birth (the join application's or the ID's) in a locked-down dialog
  const [dobOpen, setDobOpen] = useState(false);
  const missing = {
    app: Boolean(sum?.tags?.includes("no-app-dob")),
    // The description says "ID Age: not recorded" whenever there's no ID date on file (verified or not)
    id: Boolean(sum?.tags?.includes("id-not-recorded") || /ID Age: not recorded/.test(sum?.headline ?? "")),
    noApp: Boolean(sum?.tags?.includes("no-join-app")),
  };
  const canRecordDob = Boolean(canEdit && ticket && (missing.app || missing.id));
  // Nothing to show yet (or ever: AI off, or no transcript left to read)
  if (!sum && !s?.busy && !s?.error) return null;
  return (
    <div className="tks-line" onClick={(e) => e.stopPropagation()}>
      <Sparkles size={14} className="tks-icon" aria-hidden="true" />
      {sum ? (
        <span className="tks-text">
          {sum.headline}
          {sum.flags?.map((f) => {
            const tag = Object.values(TAGS).find((t) => t.label === f);
            return (
              <span key={f} className={`tks-flag${tag && !tag.bad ? " is-info" : ""}`}>
                {tag && !tag.bad ? null : <AlertTriangle size={11} aria-hidden="true" />} {f}
              </span>
            );
          })}
        </span>
      ) : (
        <span className="tks-text is-muted">{s?.busy ? "Reading the ticket…" : s?.error}</span>
      )}
      {s?.busy && sum ? <span className="tks-busy">Updating…</span> : null}
      {canRecordDob ? (
        <button type="button" className="tks-adddob" onClick={() => setDobOpen(true)} title="Record a missing date of birth (2FA code needed)">
          <Lock size={11} aria-hidden="true" /> Record DOB
        </button>
      ) : null}
      {dobOpen && ticket ? <DobDialog ticket={ticket} missing={missing} onClose={() => setDobOpen(false)} onSaved={(summary) => onSummary?.(summary)} /> : null}
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
  const [stored, setFilters] = useStored<Filters>("tickets-filters-v2", DEFAULTS);
  const filters = { ...DEFAULTS, ...stored };
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState(filters.search);
  const canDelete = useContext(TicketCanDelete);

  useEffect(() => {
    if (initialSearch) setSearchText(initialSearch);
  }, [initialSearch]);
  // ?search=123 (e.g. from a notification) opens straight onto that ticket
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("search");
    if (!q) return;
    // Clear the other filters too, so a saved type/status/tag filter can't hide the ticket
    setFilters({ ...DEFAULTS, search: q });
    setSearchText(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchText !== filters.search) {
        setFilters((f) => ({ ...DEFAULTS, ...f, search: searchText }));
        setPage(1);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchText, filters.search, setFilters]);

  const params = new URLSearchParams({
    search: filters.search,
    types: filters.types.join(","),
    statuses: filters.statuses.join(","),
    tags: filters.tags.join(","),
    hasTranscript: filters.transcriptsOnly ? "1" : "0",
    sort: filters.sort,
    order: filters.order,
    page: String(page),
    pageSize: String(filters.pageSize),
    tagCounts: "1",
    ...(filters.range !== "all" ? { range: filters.range } : {}),
    ...(filters.opener !== "any" ? { opener: filters.opener } : {}),
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
  // Numbers shift after a deletion, so the hidden ones are only hidden until the list reloads
  useEffect(() => setDeleted([]), [data]);
  const onDeleted = (id: number, message?: string) => {
    setDeleted((d) => [...d, id]);
    setNotice(message ?? `Ticket #${id} and its transcript were deleted.`);
    reload();
  };

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...DEFAULTS, ...f, ...patch }));
    setPage(1);
  };
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const sortBy = (key: SortKey) => update({ sort: key, order: filters.sort === key && filters.order === "desc" ? "asc" : "desc" });
  const arrow = (key: SortKey) => (filters.sort === key ? (filters.order === "desc" ? " ↓" : " ↑") : "");
  const people = data?.people ?? {};
  const counts = data?.statusCounts ?? {};
  const tagCounts = data?.tagCounts ?? {};
  const flagged = Object.entries(tagCounts).reduce((n, [k, v]) => n + (TAGS[k]?.bad ? v : 0), 0);
  const statuses = STATUSES.filter((st) => (counts[st] ?? 0) > 0 || filters.statuses.includes(st));
  const tagKeys = Object.keys(TAGS).filter((k) => (tagCounts[k] ?? 0) > 0 || filters.tags.includes(k));
  const active = filters.types.length + filters.statuses.length + filters.tags.length + (filters.range !== "all" ? 1 : 0) + (filters.opener !== "any" ? 1 : 0) + (filters.transcriptsOnly ? 1 : 0);
  const rows = (data?.rows ?? []).filter((t) => !deleted.includes(t.ticketId));

  return (
    <div className="adm-panel tk">
      {readOnly ? (
        <p className="adm-notice adm-tickets-readonly" role="note">
          <Eye size={15} aria-hidden="true" /> <b>View only.</b> You can read every ticket and transcript. NSFW verification tickets are only visible to admins.
        </p>
      ) : null}

      <header className="tk-head">
        <div className="tk-kpis">
          <div className="tk-kpi">
            <TicketIcon size={16} aria-hidden="true" />
            <b>{data ? (Object.values(counts).reduce((a, b) => a + b, 0)).toLocaleString() : "…"}</b>
            <span>{active ? "matching" : "tickets"}</span>
          </div>
          <div className="tk-kpi is-open">
            <i aria-hidden="true" />
            <b>{data ? (counts.Open ?? 0) : "…"}</b>
            <span>open</span>
          </div>
          <button type="button" className={`tk-kpi is-flag${filters.tags.length && filters.tags.every((t) => TAGS[t]?.bad) ? " is-on" : ""}`} onClick={() => update({ tags: filters.tags.length ? [] : Object.keys(TAGS).filter((k) => TAGS[k].bad && (tagCounts[k] ?? 0) > 0) })} disabled={!flagged && !filters.tags.length}>
            <AlertTriangle size={15} aria-hidden="true" />
            <b>{flagged}</b>
            <span>flagged</span>
          </button>
        </div>
        <div className="tk-head-actions">
          <LiveBadge updatedAt={updatedAt} loading={loading} />
          {canDelete && !readOnly ? <AutoCleanBadge /> : null}
        </div>
      </header>

      <OpenTickets onOpenMember={onOpenMember} />

      <section className="tk-filters" aria-label="Filters">
        <div className="tk-filter-row">
          <label className="adm-search tk-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" placeholder="Ticket #, member name or ID, staff, topic…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </label>
          <select className="adm-select" value={filters.range} onChange={(e) => update({ range: e.target.value })} aria-label="Opened when">
            {RANGES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <select className="adm-select" value={filters.opener} onChange={(e) => update({ opener: e.target.value as Opener })} aria-label="Who opened it">
            {OPENERS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button type="button" className={`adm-chip-btn${filters.transcriptsOnly ? " is-active" : ""}`} onClick={() => update({ transcriptsOnly: !filters.transcriptsOnly })}>
            <FileText size={15} aria-hidden="true" /> With transcript
          </button>
          {active ? (
            <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => (update({ ...DEFAULTS, pageSize: filters.pageSize }), setSearchText(""))}>
              <X size={14} aria-hidden="true" /> Clear {active} filter{active === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>
        <div className="tk-filter-row tk-chip-row">
          <span className="tk-chip-label">Type</span>
          {typesAvailable.map((type, i) => (
            <button key={type} type="button" className={`adm-chip${filters.types.includes(type) ? " is-on" : ""}`} style={{ "--c": TICKET_COLORS[type] ?? actionColor(type, i + 3) } as React.CSSProperties} onClick={() => update({ types: toggle(filters.types, type) })}>
              {prettyAction(type)}
            </button>
          ))}
          {statuses.length > 1 || filters.statuses.length ? (
            <>
              <span className="tk-chip-label">Status</span>
              {statuses.map((status) => (
                <button key={status} type="button" className={`adm-chip${filters.statuses.includes(status) ? " is-on" : ""}`} style={{ "--c": status === "Open" ? "#46a758" : "#8b8d98" } as React.CSSProperties} onClick={() => update({ statuses: toggle(filters.statuses, status) })}>
                  {status} <small>{counts[status] ?? 0}</small>
                </button>
              ))}
            </>
          ) : null}
        </div>
        {tagKeys.length ? (
          <div className="tk-filter-row tk-chip-row">
            <span className="tk-chip-label">Tags</span>
            {tagKeys.map((k) => (
              <button key={k} type="button" className={`adm-chip tk-tag${TAGS[k].bad ? " is-bad" : ""}${filters.tags.includes(k) ? " is-on" : ""}`} style={{ "--c": TAGS[k].bad ? "#e5484d" : "#8b8d98" } as React.CSSProperties} onClick={() => update({ tags: toggle(filters.tags, k) })}>
                {TAGS[k].bad ? <AlertTriangle size={12} aria-hidden="true" /> : k === "left" || k === "deleted" ? <UserX size={12} aria-hidden="true" /> : null} {TAGS[k].label} <small>{tagCounts[k] ?? 0}</small>
              </button>
            ))}
          </div>
        ) : null}
      </section>

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
              <th>
                <span className="adm-sr">Actions</span>
              </th>
            </tr>
          </thead>
          {/* One <tbody> per ticket: its row and the description under it read (and highlight) as one */}
          {rows.map((t) => (
            <tbody key={t.ticketId} className="tks-group">
              <tr onClick={() => t.transcriptId && onOpenTranscript(t.ticketId)} className={t.transcriptId ? "is-clickable" : undefined}>
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
                <td className="tk-actions">
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
                    <span className="adm-muted tk-none">No transcript</span>
                  )}
                  <DeleteTicketButton ticket={t} onDeleted={onDeleted} />
                </td>
              </tr>
              <tr className="tks-row" onClick={() => t.transcriptId && onOpenTranscript(t.ticketId)}>
                <td />
                <td colSpan={7}>
                  <SummaryLine s={summaries.state[t.ticketId]} onRefresh={() => void summaries.refresh(t.ticketId)} ticket={t} canEdit={canDelete && !readOnly} onSummary={summaries.set} />
                </td>
              </tr>
            </tbody>
          ))}
          <tbody>
            {!loading && data && !rows.length ? (
              <tr>
                <td colSpan={8} className="adm-empty">
                  No tickets match these filters.
                </td>
              </tr>
            ) : null}
            {!data && loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="adm-row-skeleton">
                    <td colSpan={8} />
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      {data ? (
        <div className="tk-foot">
          <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
          <select className="adm-select" value={filters.pageSize} onChange={(e) => update({ pageSize: Number(e.target.value) })} aria-label="Rows per page">
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
        </div>
      ) : null}

    </div>
  );
}

/** Admins: tickets from members who left are deleted automatically (see lib/ticket-autoclean.ts). */
type AutoClean = { enabled: boolean; graceDays: number; lastRunAt: string | null; totalDeleted: number; working: boolean; lastSweep: { at: string | null; tickets: number; nsfw: number; members: number } | null };
function AutoCleanBadge() {
  const { data } = useLive<{ ok: boolean; status?: AutoClean }>("/api/admin/tickets/autoclean", 60_000);
  const s = data?.status;
  if (!s) return null;
  const grace = s.graceDays === 0 ? "as soon as they leave" : `${s.graceDays} day${s.graceDays === 1 ? "" : "s"} after they leave`;
  const last = s.lastSweep?.at ? `Last clean-up ${new Date(s.lastSweep.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${s.lastSweep.tickets} ticket${s.lastSweep.tickets === 1 ? "" : "s"} from ${s.lastSweep.members} member${s.lastSweep.members === 1 ? "" : "s"}.` : "Nothing deleted yet.";
  return (
    <a
      className={`tk-autoclean${s.enabled ? "" : " is-off"}`}
      href="/admin?tab=bot-ticketing#leaverCleanup"
      title={s.enabled ? `Closed tickets and transcripts from members who left are deleted ${grace}. ${last} ${s.totalDeleted} deleted in total. Change it in Bots → Ticket Bot → Leaver clean-up.` : "Automatic leaver clean-up is off. Turn it on in Bots → Ticket Bot → Leaver clean-up."}
    >
      <BrushCleaning size={14} aria-hidden="true" />
      {s.enabled ? (s.working ? "Cleaning up leavers' tickets…" : `Leavers' tickets auto-delete · ${s.graceDays}d`) : "Leaver clean-up off"}
    </a>
  );
}
