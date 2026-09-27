"use client";

import { Settings2 } from "lucide-react";
import { useState } from "react";
import type { Drill } from "./drill-panel";
import { BarList, Donut, HourStrip, StackedBars } from "./admin-charts";
import {
  ActionBadge,
  LiveBadge,
  PersonLink,
  PersonTag,
  RichText,
  RANGES,
  TICKET_COLORS,
  actionColor,
  formatMs,
  prettyAction,
  useLive,
  timeAgo,
  formatDate,
  useStored,
  type Mentions,
  type People,
  type Punishment,
} from "./admin-shared";

type Stats = {
  punishments: {
    total: number;
    byAction: { action: string; count: number }[];
    bySource: Record<string, number>;
    timeline: { bucket: string; action: string; count: number }[];
    topUsers: { id: string; count: number; last: string | null }[];
    topIssuers: { id: string; count: number; automod: boolean }[];
    topReasons: { reason: string; count: number }[];
    hours: number[];
    currentlyBanned: number | null;
  };
  tickets: null | {
    total: number;
    open: number;
    byType: { type: string; count: number }[];
    byStatus: Record<string, number>;
    timeline: { bucket: string; action: string; count: number }[];
    topStaff: { id: string; count: number }[];
    topOpeners: { id: string; count: number }[];
    avgResolveMs: number | null;
  };
  people: People;
  mentions: Mentions;
};

const WIDGETS = [
  { key: "kpis", label: "Headline numbers" },
  { key: "recent", label: "Latest punishments" },
  { key: "timeline", label: "Punishments over time" },
  { key: "breakdown", label: "Punishment breakdown" },
  { key: "offenders", label: "Most punished members" },
  { key: "issuers", label: "Most active staff" },
  { key: "reasons", label: "Top reasons" },
  { key: "hours", label: "Busiest hours" },
  { key: "ticketTimeline", label: "Tickets over time", admin: true },
  { key: "ticketTypes", label: "Ticket types", admin: true },
  { key: "ticketStaff", label: "Top ticket handlers", admin: true },
  { key: "ticketOpeners", label: "Most tickets opened", admin: true },
  { key: "ticketStatus", label: "Ticket status", admin: true },
];

export function OverviewTab({
  level,
  onOpenMember,
  onDrill,
  onFilterPunishments,
}: {
  level: "admin" | "staff";
  onDrill: (drill: Drill) => void;
  onOpenMember: (id: string) => void;
  onFilterPunishments: (action: string) => void;
}) {
  const [range, setRange] = useStored("overview-range", "30d");
  const [unit, setUnit] = useStored<"day" | "week" | "month">("overview-unit", "day");
  const [source, setSource] = useStored("overview-source", "all");
  const [hiddenActions, setHiddenActions] = useStored<string[]>("overview-hidden-actions", []);
  const [hiddenWidgets, setHiddenWidgets] = useStored<string[]>("overview-hidden-widgets", []);
  const [customizing, setCustomizing] = useState(false);
  // Drill-downs open with the overview's current range and source
  const setDrill = (d: Drill) => onDrill({ ...d, range, source } as Drill);

  const params = new URLSearchParams({ unit, source, ...(range !== "all" ? { range } : {}) });
  const { data, error, loading, updatedAt } = useLive<Stats>(`/api/admin/stats?${params}`, 15_000);
  // The five newest punishments, always live and not tied to the range
  const recent = useLive<{ rows: Punishment[]; people: People; mentions: Mentions }>(`/api/admin/punishments?pageSize=10&source=${source}`, 8_000);
  const isAdmin = level === "admin";
  const widgets = WIDGETS.filter((w) => isAdmin || !w.admin);
  const show = (key: string) => !hiddenWidgets.includes(key) && widgets.some((w) => w.key === key);

  const p = data?.punishments;
  const t = data?.tickets;
  const people = data?.people ?? {};
  const actions = p?.byAction ?? [];
  const series = actions
    .filter((a) => !hiddenActions.includes(a.action))
    .map((a, i) => ({ key: a.action, label: prettyAction(a.action), color: actionColor(a.action, i) }));
  const count = (action: string) => actions.find((a) => a.action === action)?.count ?? 0;

  return (
    <div className="adm-overview">
      <div className="adm-toolbar">
        <div className="adm-seg">
          {RANGES.map((r) => (
            <button key={r.key} type="button" className={range === r.key ? "is-active" : undefined} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="adm-seg">
          {(["day", "week", "month"] as const).map((u) => (
            <button key={u} type="button" className={unit === u ? "is-active" : undefined} onClick={() => setUnit(u)}>
              By {u}
            </button>
          ))}
        </div>
        <select className="adm-select" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="all">Staff + AutoMod</option>
          <option value="manual">Staff only</option>
          <option value="automod">AutoMod only</option>
        </select>
        <button type="button" className={`adm-chip-btn${customizing ? " is-active" : ""}`} onClick={() => setCustomizing((v) => !v)}>
          <Settings2 size={15} aria-hidden="true" /> Customize
        </button>
        <LiveBadge updatedAt={updatedAt} loading={loading} />
      </div>

      {customizing ? (
        <div className="adm-customize">
          <div>
            <strong>Widgets</strong>
            {widgets.map((w) => (
              <label key={w.key}>
                <input
                  type="checkbox"
                  checked={show(w.key)}
                  onChange={() => setHiddenWidgets((h) => (h.includes(w.key) ? h.filter((k) => k !== w.key) : [...h, w.key]))}
                />
                {w.label}
              </label>
            ))}
          </div>
          <div>
            <strong>Actions in charts</strong>
            {actions.map((a, i) => (
              <label key={a.action}>
                <input
                  type="checkbox"
                  checked={!hiddenActions.includes(a.action)}
                  onChange={() => setHiddenActions((h) => (h.includes(a.action) ? h.filter((k) => k !== a.action) : [...h, a.action]))}
                />
                <i className="adm-dot" style={{ background: actionColor(a.action, i) }} /> {prettyAction(a.action)}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="adm-error">{error}</p> : null}

      {show("kpis") ? (
        <div className="adm-kpis">
          <Kpi label="Punishments" value={p?.total} hint={range === "all" ? "all time" : `last ${RANGES.find((r) => r.key === range)?.label}`} />
          <Kpi label="Currently banned" value={p?.currentlyBanned ?? undefined} tone="red" hint="live from Discord" />
          <Kpi label="Bans" value={p ? count("ban") + count("tempban") : undefined} tone="red" onClick={() => onFilterPunishments("ban")} />
          <Kpi label="Warnings" value={p ? count("warn") : undefined} tone="yellow" onClick={() => onFilterPunishments("warn")} />
          <Kpi label="Mutes" value={p ? count("mute") + count("tempmute") + count("timeout") : undefined} tone="orange" onClick={() => onFilterPunishments("mute")} />
          <Kpi label="Kicks" value={p ? count("kick") + count("kick_unverified") : undefined} tone="orange" onClick={() => onFilterPunishments("kick")} />
          <Kpi
            label="By AutoMod"
            value={p?.bySource.automod ?? (p ? 0 : undefined)}
            hint={p?.total ? `${Math.round(((p.bySource.automod ?? 0) / p.total) * 100)}% of all` : undefined}
          />
          {isAdmin ? (
            <Kpi label="Tickets" value={t?.total} tone="blue" hint={t ? `${t.open} open · avg ${formatMs(t.avgResolveMs)}` : undefined} />
          ) : (
            <Kpi label="Unbans" value={p ? count("unban") : undefined} tone="green" onClick={() => onFilterPunishments("unban")} />
          )}
        </div>
      ) : null}

      <div className="adm-grid">
        {show("recent") ? (
          <Card title="Latest punishments" span={3}>
            {recent.data ? (
              recent.data.rows.length ? (
                <ol className="adm-recent">
                  {recent.data.rows.slice(0, 5).map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => r.userId && setDrill({ kind: "member", id: r.userId })}>
                        <span className="adm-recent-time" title={formatDate(r.timestamp)}>
                          {timeAgo(r.timestamp)}
                        </span>
                        <ActionBadge action={r.action} />
                        <PersonTag id={r.userId} people={recent.data!.people} />
                        <span className="adm-recent-reason">
                          {r.reason ? <RichText text={r.reason} mentions={recent.data!.mentions} people={recent.data!.people} /> : <span className="adm-muted">No reason</span>}
                        </span>
                        <span className="adm-recent-by">
                          by <PersonTag id={r.issuerId} people={recent.data!.people} automod={r.source === "automod"} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="adm-empty">No punishments yet.</p>
              )
            ) : (
              <Skeleton short />
            )}
          </Card>
        ) : null}
        {show("timeline") ? (
          <Card title="Punishments over time" span={2}>
            {p ? <StackedBars points={p.timeline} series={series} unit={unit} /> : <Skeleton />}
          </Card>
        ) : null}
        {show("breakdown") ? (
          <Card title="Breakdown">
            {p ? (
              <Donut
                label="total"
                parts={actions
                  .filter((a) => !hiddenActions.includes(a.action))
                  .map((a, i) => ({ key: a.action, label: prettyAction(a.action), value: a.count, color: actionColor(a.action, i) }))}
              />
            ) : (
              <Skeleton />
            )}
          </Card>
        ) : null}
        {show("offenders") ? (
          <Card title="Most punished members">
            {p ? (
              <BarList
                color="rgba(229, 72, 77, 0.28)"
                items={p.topUsers.map((u) => ({
                  key: u.id,
                  value: u.count,
                  label: <PersonTag id={u.id} people={people} />,
                  hint: "See their record",
                  onClick: () => setDrill({ kind: "member", id: u.id }),
                }))}
              />
            ) : (
              <Skeleton />
            )}
          </Card>
        ) : null}
        {show("issuers") ? (
          <Card title="Most active staff">
            {p ? (
              <BarList
                color="rgba(62, 99, 221, 0.3)"
                items={p.topIssuers.map((u) => ({
                  key: u.id,
                  value: u.count,
                  label: <PersonTag id={u.id} people={people} automod={u.automod} />,
                  hint: "See what they worked on",
                  onClick: () => setDrill({ kind: "staff", id: u.id, automod: u.automod }),
                }))}
              />
            ) : (
              <Skeleton />
            )}
          </Card>
        ) : null}
        {show("reasons") ? (
          <Card title="Top reasons">
            {p ? (
              <BarList
                color="rgba(245, 155, 42, 0.3)"
                items={p.topReasons.map((r) => ({
                  key: r.reason,
                  value: r.count,
                  label: (
                    <span className="adm-reason">
                      <RichText text={r.reason} mentions={data?.mentions} people={people} />
                    </span>
                  ),
                  hint: "See who got this",
                  onClick: () => setDrill({ kind: "reason", reason: r.reason }),
                }))}
              />
            ) : (
              <Skeleton />
            )}
          </Card>
        ) : null}
        {show("hours") ? (
          <Card title="Busiest hours (Mountain Time)" span={3}>
            {p ? <HourStrip hours={p.hours} /> : <Skeleton short />}
          </Card>
        ) : null}
        {isAdmin && show("ticketTimeline") ? (
          <Card title="Tickets over time" span={2}>
            {t ? (
              <StackedBars
                points={t.timeline}
                unit={unit}
                series={t.byType.map((x, i) => ({ key: x.type, label: prettyAction(x.type), color: TICKET_COLORS[x.type] ?? actionColor(x.type, i + 3) }))}
              />
            ) : (
              <Skeleton />
            )}
          </Card>
        ) : null}
        {isAdmin && show("ticketTypes") ? (
          <Card title="Ticket types">
            {t ? (
              <Donut
                label="tickets"
                parts={t.byType.map((x, i) => ({ key: x.type, label: prettyAction(x.type), value: x.count, color: TICKET_COLORS[x.type] ?? actionColor(x.type, i + 3) }))}
              />
            ) : (
              <Skeleton />
            )}
          </Card>
        ) : null}
        {isAdmin && show("ticketStaff") ? (
          <Card title="Top ticket handlers">
            {t ? (
              <BarList
                color="rgba(18, 165, 148, 0.3)"
                items={t.topStaff.map((u) => ({ key: u.id, value: u.count, label: <PersonLink id={u.id} people={people} onOpen={onOpenMember} compact /> }))}
              />
            ) : (
              <Skeleton />
            )}
          </Card>
        ) : null}
        {isAdmin && show("ticketOpeners") ? (
          <Card title="Most tickets opened">
            {t ? (
              <BarList
                color="rgba(214, 64, 159, 0.28)"
                items={t.topOpeners.map((u) => ({ key: u.id, value: u.count, label: <PersonLink id={u.id} people={people} onOpen={onOpenMember} compact /> }))}
              />
            ) : (
              <Skeleton />
            )}
          </Card>
        ) : null}
        {isAdmin && show("ticketStatus") ? (
          <Card title="Ticket status">
            {t ? (
              <div className="adm-stat-list">
                {Object.entries(t.byStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, n]) => (
                    <div key={status}>
                      <span className={status === "Open" ? "adm-status adm-status--active" : "adm-status"}>{status === "Open" ? "● Open" : status}</span>
                      <strong>{n.toLocaleString()}</strong>
                    </div>
                  ))}
                <div>
                  <span className="adm-muted">Average time to close</span>
                  <strong>{formatMs(t.avgResolveMs)}</strong>
                </div>
              </div>
            ) : (
              <Skeleton />
            )}
          </Card>
        ) : null}
      </div>

    </div>
  );
}

function Kpi({ label, value, text, hint, tone, onClick }: { label: string; value?: number; text?: string; hint?: string; tone?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={`adm-kpi${tone ? ` adm-kpi--${tone}` : ""}${onClick ? " is-link" : ""}`} onClick={onClick}>
      <small>{label}</small>
      <strong>{text ?? (value === undefined ? "…" : value.toLocaleString())}</strong>
      {hint ? <span>{hint}</span> : null}
    </Tag>
  );
}

function Card({ title, span = 1, children }: { title: string; span?: 1 | 2 | 3; children: React.ReactNode }) {
  return (
    <section className={`adm-card adm-card--span${span}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Skeleton({ short }: { short?: boolean }) {
  return <div className={`adm-skeleton${short ? " adm-skeleton--short" : ""}`} aria-hidden="true" />;
}
