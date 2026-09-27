"use client";

import { FileText, Ticket, X } from "lucide-react";
import { useEffect } from "react";
import { BarList } from "./admin-charts";
import type { Drill } from "./drill-panel";
import { PersonTag, TICKET_COLORS, formatDate, formatMs, prettyAction, timeAgo, useLive, type People } from "./admin-shared";

type Row = {
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
type Result = {
  rows: Row[];
  total: number;
  people: People;
  summary: { byStatus: Record<string, number>; handlers: { id: string; count: number }[]; openers: { id: string; count: number }[]; escalated: number; transcripts: number; avgCloseMs: number | null } | null;
};

const statusClass = (s: string) => (s === "Open" ? "adm-status adm-status--active" : "adm-status");

/** The story behind one ticket type on the overview: statuses, who handled and opened them, every ticket. */
export function TicketTypeDrill({
  drill,
  onClose,
  onOpenMember,
  onOpenTranscript,
}: {
  drill: Drill;
  onClose: () => void;
  onOpenMember: (id: string) => void;
  onOpenTranscript?: (ticketId: number) => void;
}) {
  const type = drill.kind === "ticketType" ? drill.type : "";
  const range = drill.range ?? "all";
  const params = new URLSearchParams({ types: type, pageSize: "100", summary: "1", sort: "created", order: "desc", ...(range !== "all" ? { range } : {}) });
  const { data, error, loading } = useLive<Result>(`/api/admin/tickets?${params}`, 20_000);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const people = data?.people ?? {};
  const s = data?.summary;
  const color = TICKET_COLORS[type] ?? "#8b8d98";

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <aside className="adm-drawer adm-drill" onClick={(e) => e.stopPropagation()} aria-label="Ticket type">
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <header className="adm-drawer-head">
          <span className="adm-drill-icon" style={{ color }}>
            <Ticket size={26} />
          </span>
          <div>
            <p className="adm-drill-kicker">Ticket type</p>
            <h2>{prettyAction(type)}</h2>
            <p>
              {data ? `${data.total.toLocaleString()} ticket${data.total === 1 ? "" : "s"}` : "…"}
              {range !== "all" ? " in this range" : " all time"}
            </p>
          </div>
        </header>

        {error ? <p className="adm-error">{error}</p> : null}

        {s ? (
          <div className="adm-drill-split">
            {Object.entries(s.byStatus)
              .sort((a, b) => b[1] - a[1])
              .map(([status, n]) => (
                <span key={status}>
                  {status} <strong>{n.toLocaleString()}</strong>
                </span>
              ))}
            <span>
              Avg. time to close <strong>{formatMs(s.avgCloseMs)}</strong>
            </span>
            {s.escalated ? (
              <span>
                Escalated <strong>{s.escalated}</strong>
              </span>
            ) : null}
            <span>
              Transcripts <strong>{s.transcripts}</strong>
            </span>
          </div>
        ) : null}

        {s?.handlers.length ? (
          <section className="adm-drawer-section">
            <h3>Handled by</h3>
            <BarList
              color="rgba(18, 165, 148, 0.3)"
              items={s.handlers.map((h) => ({ key: h.id, value: h.count, label: <PersonTag id={h.id} people={people} />, hint: "Open their profile", onClick: () => onOpenMember(h.id) }))}
            />
          </section>
        ) : null}

        {s?.openers.length ? (
          <section className="adm-drawer-section">
            <h3>Opened by</h3>
            <BarList
              color="rgba(214, 64, 159, 0.28)"
              items={s.openers.map((h) => ({ key: h.id, value: h.count, label: <PersonTag id={h.id} people={people} />, hint: "Open their profile", onClick: () => onOpenMember(h.id) }))}
            />
          </section>
        ) : null}

        <section className="adm-drawer-section">
          <h3>
            Tickets <small>{data?.rows.length ?? 0}</small>
          </h3>
          {loading && !data ? <div className="adm-skeleton" /> : null}
          <ul className="adm-ticket-list">
            {(data?.rows ?? []).map((t) => (
              <li key={t.ticketId}>
                <div className="adm-ticket-head">
                  <strong>#{t.ticketId}</strong>
                  <span className={statusClass(t.status)}>{t.status === "Open" ? "● Open" : t.status}</span>
                  {t.escalated ? <span className="adm-tag">Escalated</span> : null}
                  <span className="adm-muted" title={formatDate(t.created)}>
                    {timeAgo(t.created)}
                  </span>
                  {t.transcriptId && onOpenTranscript ? (
                    <button type="button" className="adm-btn adm-btn--small" onClick={() => onOpenTranscript(t.ticketId)}>
                      <FileText size={14} aria-hidden="true" /> View
                    </button>
                  ) : null}
                </div>
                {t.topic ? <p className="adm-ticket-topic">{t.topic}</p> : null}
                <p className="adm-muted adm-ticket-people">
                  {t.openedBy ? (
                    <button type="button" className="adm-link" onClick={() => onOpenMember(t.openedBy!)}>
                      opened by {people[t.openedBy]?.name ?? t.openedBy}
                    </button>
                  ) : null}
                  {t.claimedBy || t.resolvedBy ? ` · handled by ${people[(t.claimedBy ?? t.resolvedBy)!]?.name ?? "staff"}` : ""}
                  {t.created && t.resolvedAt ? ` · closed in ${formatMs(new Date(t.resolvedAt).getTime() - new Date(t.created).getTime())}` : ""}
                </p>
              </li>
            ))}
          </ul>
          {data && data.total > data.rows.length ? <p className="adm-muted">Showing the newest {data.rows.length} of {data.total}.</p> : null}
          {data && !data.rows.length ? <p className="adm-empty">No tickets of this type in this range.</p> : null}
        </section>
      </aside>
    </div>
  );
}
