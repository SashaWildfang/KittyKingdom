"use client";

import { Bot, FileText, PieChart, Shield, User, X } from "lucide-react";
import { BarList } from "./admin-charts";
import { useEffect } from "react";
import {
  ActionBadge,
  Avatar,
  PersonLink,
  PersonTag,
  RichText,
  formatDate,
  prettyAction,
  timeAgo,
  useLive,
  type Mentions,
  type People,
  type Punishment,
} from "./admin-shared";

export type Drill = (
  | { kind: "reason"; reason: string }
  | { kind: "staff"; id: string; automod?: boolean }
  | { kind: "member"; id: string }
  | { kind: "action"; action: string }
) & { range?: string; source?: string };

type Summary = {
  reasons: { reason: string; count: number }[];
  issuers: { id: string; count: number; automod: boolean }[];
  sources: Record<string, number>;
};
type Result = { rows: Punishment[]; total: number; people: People; mentions: Mentions; summary: Summary | null };

/**
 * The story behind an overview number: everyone who got a reason, everything a staff member
 * handed out, or a member's whole record. Respects the overview's date range and source.
 */
export function DrillPanel({
  drill,
  onClose,
  onOpenMember,
  onDrill,
}: {
  drill: Drill;
  onClose: () => void;
  onOpenMember: (id: string) => void;
  onDrill?: (drill: Drill) => void;
}) {
  const range = drill.range ?? "all";
  const source = drill.source ?? "all";
  const params = new URLSearchParams({ pageSize: "100", source, ...(range !== "all" ? { range } : {}) });
  if (drill.kind === "reason") params.set("reason", drill.reason);
  if (drill.kind === "staff") params.set("issuerId", drill.id);
  if (drill.kind === "member") params.set("userId", drill.id);
  if (drill.kind === "action") {
    params.set("actions", drill.action);
    params.set("summary", "1");
  }
  const { data, error, loading } = useLive<Result>(`/api/admin/punishments?${params}`, 15_000);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const people = data?.people ?? {};
  const rows = data?.rows ?? [];
  const byAction = new Map<string, number>();
  for (const r of rows) byAction.set(r.action, (byAction.get(r.action) ?? 0) + 1);

  // Who was involved: the members punished (reason / staff views)
  const byMember = new Map<string, number>();
  if (drill.kind !== "member") for (const r of rows) if (r.userId) byMember.set(r.userId, (byMember.get(r.userId) ?? 0) + 1);
  const members = Array.from(byMember).sort((a, b) => b[1] - a[1]);

  const person = drill.kind === "staff" || drill.kind === "member" ? people[drill.id] : undefined;
  const summary = data?.summary ?? null;
  const drillTo = (d: Drill) => onDrill?.({ ...d, range: drill.range, source: drill.source } as Drill);
  const title =
    drill.kind === "action" ? (
      prettyAction(drill.action)
    ) : drill.kind === "reason" ? (
      <RichText text={drill.reason} mentions={data?.mentions} people={people} onOpenMember={onOpenMember} />
    ) : drill.kind === "staff" && drill.automod ? (
      "AutoMod"
    ) : (
      person?.name ?? "Loading…"
    );
  const kicker = drill.kind === "action" ? "Breakdown" : drill.kind === "reason" ? "Reason" : drill.kind === "staff" ? "Staff activity" : "Member record";

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <aside className="adm-drawer adm-drill" onClick={(e) => e.stopPropagation()} aria-label={kicker}>
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <header className="adm-drawer-head">
          {drill.kind === "staff" || drill.kind === "member" ? (
            <Avatar person={person} id={drill.id} size={56} />
          ) : (
            <span className="adm-drill-icon">{drill.kind === "action" ? <PieChart size={26} /> : <FileText size={26} />}</span>
          )}
          <div>
            <p className="adm-drill-kicker">{kicker}</p>
            <h2>{title}</h2>
            <p>
              {data ? `${data.total.toLocaleString()} punishment${data.total === 1 ? "" : "s"}` : "…"}
              {range !== "all" ? " in this range" : " all time"}
              {drill.kind === "reason" && members.length ? ` · ${members.length} member${members.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </header>

        {(drill.kind === "member" || drill.kind === "staff") && !(drill.kind === "staff" && drill.automod) ? (
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small adm-drill-profile" onClick={() => onOpenMember(drill.id)}>
            <User size={14} aria-hidden="true" /> Open full profile
          </button>
        ) : null}

        {error ? <p className="adm-error">{error}</p> : null}

        {drill.kind === "action" && summary ? (
          <>
            <div className="adm-drill-split">
              <span>
                <Shield size={14} aria-hidden="true" /> Staff <strong>{(summary.sources.manual ?? 0).toLocaleString()}</strong>
              </span>
              <span>
                <Bot size={14} aria-hidden="true" /> AutoMod <strong>{(summary.sources.automod ?? 0).toLocaleString()}</strong>
              </span>
            </div>
            <section className="adm-drawer-section">
              <h3>
                Causes <small>{summary.reasons.length}</small>
              </h3>
              <BarList
                color="rgba(245, 155, 42, 0.3)"
                items={summary.reasons.map((r) => ({
                  key: r.reason || "(none)",
                  value: r.count,
                  label: r.reason ? (
                    <span className="adm-reason">
                      <RichText text={r.reason} mentions={data?.mentions} people={people} />
                    </span>
                  ) : (
                    <span className="adm-muted">No reason given</span>
                  ),
                  hint: r.reason ? "See everyone who got this" : undefined,
                  onClick: r.reason && onDrill ? () => drillTo({ kind: "reason", reason: r.reason }) : undefined,
                }))}
              />
            </section>
            {summary.issuers.length ? (
              <section className="adm-drawer-section">
                <h3>Given out by</h3>
                <BarList
                  color="rgba(62, 99, 221, 0.3)"
                  items={summary.issuers.map((i) => ({
                    key: i.id,
                    value: i.count,
                    label: <PersonTag id={i.id} people={people} automod={i.automod} />,
                    hint: "See what they worked on",
                    onClick: onDrill ? () => drillTo({ kind: "staff", id: i.id, automod: i.automod }) : undefined,
                  }))}
                />
              </section>
            ) : null}
          </>
        ) : null}

        {byAction.size && drill.kind !== "action" ? (
          <div className="adm-drawer-counts">
            {Array.from(byAction)
              .sort((a, b) => b[1] - a[1])
              .map(([action, n]) => (
                <span key={action}>
                  <ActionBadge action={action} /> ×{n}
                </span>
              ))}
          </div>
        ) : null}

        {members.length ? (
          <section className="adm-drawer-section">
            <h3>
              {drill.kind === "reason" ? "Members with this reason" : drill.kind === "action" ? "Members who got this" : "Members they punished"} <small>{members.length}</small>
            </h3>
            <ul className="adm-drill-people">
              {members.map(([id, n]) => (
                <li key={id}>
                  <PersonLink id={id} people={people} onOpen={onOpenMember} />
                  <span className="adm-drill-count">×{n}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="adm-drawer-section">
          <h3>
            {drill.kind === "staff" ? "What they worked on" : "Punishments"} <small>{rows.length}</small>
          </h3>
          {loading && !data ? <div className="adm-skeleton" /> : null}
          <ol className="adm-timeline">
            {rows.map((p) => (
              <li key={p.id}>
                <div className="adm-timeline-head">
                  <ActionBadge action={p.action} />
                  <span className="adm-muted" title={formatDate(p.timestamp)}>
                    {timeAgo(p.timestamp)}
                  </span>
                  <span className="adm-timeline-by">
                    {drill.kind === "member" ? (
                      <>
                        by <PersonLink id={p.issuerId} people={people} onOpen={onOpenMember} automodId={p.source === "automod"} compact />
                      </>
                    ) : (
                      <PersonLink id={p.userId} people={people} onOpen={onOpenMember} compact />
                    )}
                  </span>
                </div>
                {drill.kind !== "reason" ? (
                  <p>{p.reason ? <RichText text={p.reason} mentions={data?.mentions} people={people} onOpenMember={onOpenMember} /> : "No reason given."}</p>
                ) : drill.kind === "reason" && p.issuerId ? (
                  <p className="adm-muted">
                    {prettyAction(p.action)} by {p.source === "automod" ? "AutoMod" : people[p.issuerId]?.name ?? "staff"}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
          {data && data.total > rows.length ? <p className="adm-muted">Showing the latest {rows.length} of {data.total}.</p> : null}
          {data && !rows.length ? <p className="adm-empty">Nothing in this range.</p> : null}
        </section>
      </aside>
    </div>
  );
}
