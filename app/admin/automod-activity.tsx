"use client";

// Admin → AutoMod → Activity: what AutoMod caught. Every number opens a breakdown, a bar opens that day (or hour),
// and a catch opens with the conversation around it and the member's AutoMod history.

import "./automod-activity.css";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Clock, ExternalLink, Eye, EyeOff, Flag, Hash, MessageSquareWarning, Minus, ShieldCheck, Trash2, Users, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RULE_LABELS } from "../../lib/automod-data";
import type { AutomodEvent, ContextMessage } from "../../lib/automod";
import { Avatar, LiveBadge, Pager, PersonLink, formatDate, timeAgo, useLive, type People } from "./admin-shared";
import { StackedBars } from "./admin-charts";
import { periodBounds, periodLabel } from "./drill-panel";

// One per rule, in RULE_LABELS order (words, severe, invites, scams, mentions, pings, spam, crosspost, media, caps,
// formatting, emoji, newcomers, names, mediaChannels), then raid
const RULE_COLORS = ["#e5484d", "#9f1239", "#5865f2", "#f97316", "#d6409f", "#ec4899", "#46a758", "#14b8a6", "#0ea5e9", "#f59b2a", "#a855f7", "#eab308", "#64748b", "#c084fc", "#38bdf8", "#8b8d98"];
const RULE_KEYS = Object.keys(RULE_LABELS);
/** The same color for a rule everywhere (page, breakdowns, every range) */
function ruleColor(rule: string) {
  const i = rule === "raid" ? RULE_KEYS.length : RULE_KEYS.indexOf(rule);
  const n = i >= 0 ? i : Array.from(rule).reduce((h, c) => h + c.charCodeAt(0), 0);
  return RULE_COLORS[n % RULE_COLORS.length];
}
const LADDER = ["Warning", "Warning", "5m mute", "10m mute", "15m mute", "30m mute", "1h mute", "1 day mute"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RANGE_TEXT: Record<string, string> = { "24h": "last 24 hours", "7d": "last 7 days", "30d": "last 30 days", "90d": "last 90 days" };

export type Activity = {
  ok: boolean;
  days: number;
  since: string;
  until: string;
  total: number;
  prevTotal: number;
  uniqueMembers: number;
  repeatMembers: number;
  byRule: { rule: string; label: string; n: number }[];
  byAction: Record<string, number>;
  members: { id: string; n: number; strikes: number; last: string | null }[];
  byChannel: { id: string; n: number }[];
  hours: number[];
  weekdays: number[];
  offenses: { offense: number; n: number }[];
  terms: { term: string; n: number }[];
  timeline: { bucket: string; action: string; count: number }[];
  unit: "hour" | "day";
  page: number;
  rows: AutomodEvent[];
  people: People;
  channelNames: Record<string, string>;
};

type CatchDetail = {
  ok: boolean;
  canAllow?: boolean;
  error?: string;
  event: AutomodEvent;
  before: ContextMessage[];
  caught: ContextMessage;
  after: ContextMessage[];
  contextSource: "bot" | "live" | "none";
  history: AutomodEvent[];
  totals: Record<string, number>;
  people: People;
  channelName: string | null;
  jumpUrl: string | null;
};

/** A breakdown to open: one of the headline numbers, or a clicked bar */
type Scope = { action: string | null; from?: string; to?: string; title: string; kicker: string };

export function actionBadge(e: AutomodEvent) {
  if (e.action === "punish") return { text: e.offense ? `Strike ${e.offense} · ${LADDER[(e.offense - 1) % 8]}` : "Strike", tone: "red" };
  if (e.action === "delete") return { text: "Removed, no strike", tone: "blue" };
  if (e.action === "rename") return { text: "Name reset", tone: "gold" };
  return { text: e.rule === "raid" ? "Raid alert" : "Flagged", tone: "gold" };
}

const cleanReason = (r: string) => r.replace(/`([^`]+)`/g, "“$1”").replace(/Inappropriate language: “[^”]+”/, "Blocked word");
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const channelName = (a: { channelNames: Record<string, string> }, id: string | null) => (id ? (a.channelNames[id] ? `#${a.channelNames[id]}` : "a channel") : "—");

function Delta({ now, before }: { now: number; before: number }) {
  if (!before && !now) return <span className="am2-delta">no change</span>;
  if (!before) return <span className="am2-delta is-up">new this period</span>;
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return <span className="am2-delta"><Minus size={12} /> same as before</span>;
  // Fewer catches is good news
  return (
    <span className={`am2-delta ${change > 0 ? "is-up" : "is-down"}`} title={`${before.toLocaleString()} in the period before`}>
      {change > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {Math.abs(change)}% vs before
    </span>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

// ---------- The tab ----------
export function ActivitySection({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [range, setRange] = useState("7d");
  const [rule, setRule] = useState<string | null>(null);
  const [member, setMember] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<Scope | null>(null);
  const [catchId, setCatchId] = useState<string | null>(null);
  useEffect(() => setPage(0), [range, rule, member, channel]);

  const base = new URLSearchParams({ range });
  if (rule) base.set("rule", rule);
  if (member) base.set("member", member);
  if (channel) base.set("channel", channel);
  const q = new URLSearchParams(base);
  q.set("page", String(page));
  const live = useLive<Activity>(`/api/admin/automod/activity?${q}`, 5_000);
  const a = live.data;

  // While this tab is open, everything it shows counts as seen (clears the tab's bubble)
  useEffect(() => {
    if (a) void fetch("/api/admin/automod/unread", { method: "POST" }).catch(() => undefined);
  }, [a]);

  const rangeText = RANGE_TEXT[range] ?? range;
  const openAction = (action: string | null, title: string) => setScope({ action, title, kicker: `Breakdown · ${rangeText}` });
  const openMember = (id: string) => {
    setScope(null);
    setCatchId(null);
    onOpenMember(id);
  };
  const filtered = rule || member || channel;

  return (
    <div className="am-activity am2">
      <div className="adm-toolbar am-toolbar">
        <div className="adm-seg" role="tablist" aria-label="Time range">
          {["24h", "7d", "30d", "90d"].map((r) => (
            <button key={r} type="button" className={range === r ? "is-active" : undefined} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
        {rule ? (
          <button type="button" className="adm-chip-btn is-active" onClick={() => setRule(null)}>
            Rule: {RULE_LABELS[rule] ?? rule} ✕
          </button>
        ) : null}
        {member ? (
          <button type="button" className="adm-chip-btn is-active" onClick={() => setMember(null)}>
            Member: {a?.people?.[member]?.name ?? "member"} ✕
          </button>
        ) : null}
        {channel ? (
          <button type="button" className="adm-chip-btn is-active" onClick={() => setChannel(null)}>
            Channel: {a ? channelName(a, channel) : "…"} ✕
          </button>
        ) : null}
        {filtered ? (
          <button type="button" className="adm-chip-btn" onClick={() => (setRule(null), setMember(null), setChannel(null))}>
            Clear filters
          </button>
        ) : null}
        <LiveBadge updatedAt={live.updatedAt} loading={live.loading} />
      </div>

      {!a && live.error ? <p className="adm-error">{live.error}</p> : null}
      <Kpis a={a} rangeText={rangeText} onPick={openAction} />

      <section className="adm-card am2-chart">
        <div className="am2-chart-head">
          <div>
            <h3>Catches over time</h3>
            <p className="adm-muted">Click a bar for that {a?.unit === "hour" ? "hour" : "day"}&apos;s full breakdown. Click a rule below the chart to hide it.</p>
          </div>
          {a?.total ? <ChartFacts a={a} /> : null}
        </div>
        {!a ? (
          <div className="adm-skeleton" style={{ height: 180 }} />
        ) : a.total ? (
          <TimelineChart
            a={a}
            hidden={hidden}
            onToggle={(k) => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
            onPick={(bucket) => {
              const { from, to } = periodBounds(bucket, a.unit);
              setScope({ action: null, from: from.toISOString(), to: to.toISOString(), title: periodLabel(bucket, a.unit), kicker: a.unit === "hour" ? "Hour overview" : "Day overview" });
            }}
          />
        ) : (
          <p className="adm-empty">All quiet 🌙 nothing caught in this range.</p>
        )}
      </section>

      {a?.total ? (
        <div className="am2-grid">
          <RuleList a={a} active={rule} onPick={(r) => setRule(rule === r ? null : r)} />
          <ChannelList a={a} active={channel} onPick={(c) => setChannel(channel === c ? null : c)} />
          <WhenCard a={a} />
          <MemberList a={a} active={member} onPick={(m) => setMember(member === m ? null : m)} onOpen={openMember} />
          <LadderCard a={a} onOpen={() => openAction("punish", "Strikes")} />
          <TermsCard a={a} />
          <MistakesCard />
        </div>
      ) : null}

      <Feed a={a} title="Latest catches" onCatch={setCatchId} onOpenMember={openMember} page={page} onPage={setPage} />

      {scope && typeof document !== "undefined"
        ? createPortal(<OverviewPanel base={base} scope={scope} onClose={() => setScope(null)} onCatch={setCatchId} onOpenMember={openMember} />, document.body)
        : null}
      {catchId && typeof document !== "undefined"
        ? createPortal(<CatchPanel id={catchId} onClose={() => setCatchId(null)} onCatch={setCatchId} onOpenMember={openMember} />, document.body)
        : null}
    </div>
  );
}

// ---------- Headline numbers ----------
function Kpis({ a, rangeText, onPick }: { a: Activity | null; rangeText: string; onPick: (action: string | null, title: string) => void }) {
  const n = (v: number | undefined) => (a ? (v ?? 0).toLocaleString() : "…");
  const strikes = a?.byAction.punish ?? 0;
  const removed = a?.byAction.delete ?? 0;
  const flagged = (a?.byAction.alert ?? 0) + (a?.byAction.rename ?? 0);
  const cards: { key: string | null; title: string; icon: ReactNode; tone: string; value: string; sub: ReactNode }[] = [
    { key: null, title: "Caught", icon: <ShieldCheck size={16} />, tone: "", value: n(a?.total), sub: a ? <Delta now={a.total} before={a.prevTotal} /> : rangeText },
    { key: "punish", title: "Strikes", icon: <Zap size={16} />, tone: "red", value: n(strikes), sub: a?.total ? `${pct(strikes, a.total)}% of catches` : "removed + strike" },
    { key: "delete", title: "Removed", icon: <Trash2 size={16} />, tone: "blue", value: n(removed), sub: "no strike given" },
    { key: "flagged", title: "Flagged", icon: <Flag size={16} />, tone: "yellow", value: n(flagged), sub: a ? `${a.byAction.rename ?? 0} names reset` : " " },
  ];
  return (
    <div className="am2-kpis">
      {cards.map((c) => (
        <button key={c.title} type="button" className={`am2-kpi${c.tone ? ` am2-kpi--${c.tone}` : ""}`} onClick={() => onPick(c.key, c.title)} disabled={!a}>
          <span className="am2-kpi-top">
            {c.icon} {c.title}
          </span>
          <strong>{c.value}</strong>
          <small>{c.sub}</small>
          <span className="am2-kpi-go">Open breakdown →</span>
        </button>
      ))}
      <div className="am2-kpi am2-kpi--static">
        <span className="am2-kpi-top">
          <Users size={16} /> Members caught
        </span>
        <strong>{n(a?.uniqueMembers)}</strong>
        <small>{a ? `${a.repeatMembers} caught more than once` : " "}</small>
      </div>
    </div>
  );
}

function ChartFacts({ a }: { a: Activity }) {
  const perBucket = new Map<string, number>();
  for (const p of a.timeline) perBucket.set(p.bucket, (perBucket.get(p.bucket) ?? 0) + p.count);
  const busiest = Array.from(perBucket).sort((x, y) => y[1] - x[1])[0];
  const peakHour = a.hours.indexOf(Math.max(...a.hours));
  const hourText = (h: number) => new Date(2026, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" });
  const perDay = a.total / Math.max(1, a.days);
  return (
    <dl className="am2-facts">
      <div>
        <dt>Busiest {a.unit}</dt>
        <dd>{busiest ? `${a.unit === "hour" ? new Date(busiest[0]).toLocaleTimeString(undefined, { hour: "numeric" }) : new Date(busiest[0]).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${busiest[1]}` : "—"}</dd>
      </div>
      <div>
        <dt>Per day</dt>
        <dd>{perDay >= 10 ? Math.round(perDay) : perDay.toFixed(1)}</dd>
      </div>
      <div>
        <dt>Peak hour</dt>
        <dd>{hourText(peakHour)}</dd>
      </div>
    </dl>
  );
}

function TimelineChart({ a, hidden, onToggle, onPick, height = 190 }: { a: Activity; hidden?: Set<string>; onToggle?: (k: string) => void; onPick?: (bucket: string) => void; height?: number }) {
  const all = a.byRule.map((r) => ({ key: r.rule, label: r.label, color: ruleColor(r.rule) }));
  const series = all.filter((s) => !hidden?.has(s.key));
  return (
    <>
      <StackedBars points={a.timeline} series={series} unit={a.unit} height={height} onPick={onPick} />
      <div className="am2-legend">
        {all.map((s) =>
          onToggle ? (
            <button key={s.key} type="button" className={hidden?.has(s.key) ? "is-off" : undefined} onClick={() => onToggle(s.key)} aria-pressed={!hidden?.has(s.key)}>
              <i style={{ background: s.color }} /> {s.label}
            </button>
          ) : (
            <span key={s.key}>
              <i style={{ background: s.color }} /> {s.label}
            </span>
          ),
        )}
      </div>
    </>
  );
}

// ---------- Breakdowns ----------
function Rank({ rows, active, onPick, empty }: { rows: { key: string; label: ReactNode; n: number; color?: string; extra?: ReactNode }[]; active?: string | null; onPick?: (k: string) => void; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (!rows.length) return <p className="adm-muted">{empty}</p>;
  return (
    <ul className="am2-rank">
      {rows.map((r) => {
        const inner = (
          <>
            <i style={{ width: `${(r.n / max) * 100}%`, ...(r.color ? { background: `color-mix(in srgb, ${r.color} 22%, transparent)` } : {}) }} />
            {r.color ? <span className="am2-dot" style={{ background: r.color }} /> : null}
            <span className="am2-rank-label">{r.label}</span>
            {r.extra}
            <b>{r.n.toLocaleString()}</b>
            <small>{pct(r.n, total)}%</small>
          </>
        );
        return (
          <li key={r.key}>
            {onPick ? (
              <button type="button" className={active === r.key ? "is-on" : undefined} onClick={() => onPick(r.key)}>
                {inner}
              </button>
            ) : (
              <div>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RuleList({ a, active, onPick }: { a: Activity; active?: string | null; onPick?: (r: string) => void }) {
  return (
    <section className="adm-card am2-card">
      <h3>By rule</h3>
      <Rank rows={a.byRule.map((r) => ({ key: r.rule, label: r.label, n: r.n, color: ruleColor(r.rule) }))} active={active} onPick={onPick} empty="Nothing yet" />
    </section>
  );
}

function ChannelList({ a, active, onPick }: { a: Activity; active?: string | null; onPick?: (c: string) => void }) {
  return (
    <section className="adm-card am2-card">
      <h3>By channel</h3>
      <Rank
        rows={a.byChannel.map((c) => ({ key: c.id, label: <><Hash size={13} aria-hidden="true" /> {a.channelNames[c.id] ?? "unknown channel"}</>, n: c.n }))}
        active={active}
        onPick={onPick}
        empty="No channel catches (nickname checks and raid alerts aren't in a channel)."
      />
    </section>
  );
}

function WhenCard({ a }: { a: Activity }) {
  const maxH = Math.max(1, ...a.hours);
  const maxW = Math.max(1, ...a.weekdays);
  // Monday first
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <section className="adm-card am2-card">
      <h3>When it happens</h3>
      <p className="adm-muted am2-sub">Hour of day (your time)</p>
      <div className="am2-hours" role="img" aria-label="Catches by hour of day">
        {a.hours.map((n, h) => (
          <span key={h} title={`${new Date(2026, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" })}: ${n}`} style={{ opacity: n ? 0.25 + (n / maxH) * 0.75 : 0.08 }} />
        ))}
      </div>
      <div className="am2-hours-axis">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>12a</span>
      </div>
      <p className="adm-muted am2-sub">Day of the week</p>
      <div className="am2-week">
        {order.map((d) => (
          <div key={d} title={`${WEEKDAYS[d]}: ${a.weekdays[d]}`}>
            <span style={{ height: `${Math.max(4, (a.weekdays[d] / maxW) * 100)}%` }} />
            <small>{WEEKDAYS[d][0]}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function MemberList({ a, active, onPick, onOpen }: { a: Activity; active?: string | null; onPick?: (m: string) => void; onOpen: (id: string) => void }) {
  return (
    <section className="adm-card am2-card">
      <h3>Most caught members</h3>
      {a.members.length ? (
        <ul className="am2-people">
          {a.members.map((m) => {
            const p = a.people[m.id];
            return (
              <li key={m.id} className={active === m.id ? "is-on" : undefined}>
                <button type="button" className="am2-people-main" onClick={() => (onPick ? onPick(m.id) : onOpen(m.id))} title={onPick ? "Show only this member's catches" : "Open member"}>
                  <Avatar person={p} id={m.id} size={26} />
                  <span>
                    <b>{p?.name ?? m.id}</b>
                    <small>
                      {m.strikes ? `${m.strikes} strike${m.strikes === 1 ? "" : "s"} · ` : ""}last {timeAgo(m.last)}
                    </small>
                  </span>
                  <em>{m.n}</em>
                </button>
                <button type="button" className="am2-icon" onClick={() => onOpen(m.id)} aria-label={`Open ${p?.name ?? "member"}`}>
                  <ExternalLink size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="adm-muted">Nobody 🎉</p>
      )}
    </section>
  );
}

function LadderCard({ a, onOpen }: { a: Activity; onOpen?: () => void }) {
  const max = Math.max(1, ...a.offenses.map((o) => o.n));
  return (
    <section className="adm-card am2-card">
      <h3>Strike ladder</h3>
      <p className="adm-muted am2-sub">How far up the ladder strikes went</p>
      {a.offenses.length ? (
        <ol className="am2-ladder">
          {a.offenses.map((o) => (
            <li key={o.offense}>
              <span>
                <b>Strike {o.offense}</b> <small>{LADDER[(o.offense - 1) % 8]}</small>
              </span>
              <i>
                <span style={{ width: `${(o.n / max) * 100}%` }} />
              </i>
              <em>{o.n}</em>
            </li>
          ))}
        </ol>
      ) : (
        <p className="adm-muted">No strikes in this range.</p>
      )}
      {onOpen && a.offenses.length ? (
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small am2-card-more" onClick={onOpen}>
          All strikes →
        </button>
      ) : null}
    </section>
  );
}

function TermsCard({ a }: { a: Activity }) {
  const [shown, setShown] = useState<Record<string, boolean>>({});
  return (
    <section className="adm-card am2-card">
      <h3>Most matched words</h3>
      <p className="adm-muted am2-sub">Blurred; click one to show it</p>
      <div className="am-terms">
        {a.terms.map((t) => (
          <button key={t.term} type="button" className={shown[t.term] ? "is-shown" : undefined} onClick={() => setShown((r) => ({ ...r, [t.term]: !r[t.term] }))}>
            <span>{t.term}</span> <b>{t.n}</b>
          </button>
        ))}
        {!a.terms.length ? <p className="adm-muted">None matched.</p> : null}
      </div>
    </section>
  );
}

// ---------- The list of catches ----------
function Feed({ a, title, onCatch, onOpenMember, page, onPage }: { a: Activity | null; title: string; onCatch: (id: string) => void; onOpenMember: (id: string) => void; page: number; onPage: (p: number) => void }) {
  // New catches flash in as they arrive
  const known = useRef<Set<string> | null>(null);
  const fresh = useMemo(() => {
    const ids = new Set(a?.rows.map((r) => r.id) ?? []);
    const prev = known.current;
    const out = new Set(prev ? Array.from(ids).filter((id) => !prev.has(id)) : []);
    if (a) known.current = new Set([...(prev ? Array.from(prev) : []), ...Array.from(ids)]);
    return out;
  }, [a]);
  return (
    <section className="adm-card am2-feed">
      <h3>
        {title} {a ? <span className="adm-muted">· {a.total.toLocaleString()}</span> : null}
      </h3>
      {a?.rows.length ? (
        <ol>
          {a.rows.map((e) => {
            const badge = actionBadge(e);
            return (
              <li key={e.id} className={fresh.has(e.id) ? "is-new" : undefined}>
                <button type="button" className="am2-feed-row" onClick={() => onCatch(e.id)} aria-label={`Open catch: ${e.label}`} />
                <time dateTime={e.at} title={formatDate(e.at)}>
                  {timeAgo(e.at)}
                </time>
                <div className="am2-feed-who">{e.userId ? <PersonLink id={e.userId} people={a.people} onOpen={onOpenMember} compact /> : <b>Server</b>}</div>
                <div className="am2-feed-what">
                  <span className="am2-feed-line">
                    <b>{e.label}</b>
                    <span className={`am-badge am-badge--${badge.tone}`}>{badge.text}</span>
                    {e.falsePositive ? <span className="am-badge am2-fp-tag">Mistake</span> : null}
                    {e.channelId ? <span className="am2-feed-ch">{channelName(a, e.channelId)}</span> : null}
                  </span>
                  <small>{cleanReason(e.reason)}</small>
                </div>
                <span className="am2-feed-open">
                  {e.hasContext ? <MessageSquareWarning size={14} aria-label="Has context" /> : null} View →
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="adm-empty">{a ? "Nothing caught with these filters." : "Loading…"}</p>
      )}
      {a && a.total > 25 ? <Pager page={page} total={a.total} pageSize={25} onPage={onPage} /> : null}
    </section>
  );
}

// ---------- Breakdown drawer (a headline number or a bar) ----------
function OverviewPanel({ base, scope, onClose, onCatch, onOpenMember }: { base: URLSearchParams; scope: Scope; onClose: () => void; onCatch: (id: string) => void; onOpenMember: (id: string) => void }) {
  const [page, setPage] = useState(0);
  const q = new URLSearchParams(base);
  if (scope.action) q.set("action", scope.action);
  if (scope.from && scope.to) {
    q.set("from", scope.from);
    q.set("to", scope.to);
  }
  q.set("page", String(page));
  const { data: a, error } = useLive<Activity>(`/api/admin/automod/activity?${q}`, 15_000);
  useEscape(onClose);
  const strikes = a?.byAction.punish ?? 0;
  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <aside className="adm-drawer am2-drawer" onClick={(e) => e.stopPropagation()} aria-label={scope.kicker}>
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <header className="am2-drawer-head">
          <span className="am2-drawer-icon">{scope.from ? <CalendarDays size={22} /> : <ShieldCheck size={22} />}</span>
          <div>
            <small>{scope.kicker}</small>
            <h2>{scope.title}</h2>
          </div>
        </header>
        {error && !a ? <p className="adm-error">{error}</p> : null}
        {!a ? <div className="adm-skeleton" style={{ height: 320 }} /> : null}
        {a ? (
          <>
            <div className="am2-mini">
              <div>
                <small>Catches</small>
                <b>{a.total.toLocaleString()}</b>
                <Delta now={a.total} before={a.prevTotal} />
              </div>
              <div>
                <small>Members</small>
                <b>{a.uniqueMembers}</b>
                <span className="am2-delta">{a.repeatMembers} more than once</span>
              </div>
              {scope.action === "punish" ? (
                <div>
                  <small>Highest strike</small>
                  <b>{a.offenses.length ? a.offenses[a.offenses.length - 1].offense : "—"}</b>
                  <span className="am2-delta">{a.offenses.length ? LADDER[(a.offenses[a.offenses.length - 1].offense - 1) % 8] : "none"}</span>
                </div>
              ) : (
                <div>
                  <small>Strikes</small>
                  <b>{strikes}</b>
                  <span className="am2-delta">{a.total ? `${pct(strikes, a.total)}% of catches` : "—"}</span>
                </div>
              )}
            </div>
            {a.total ? (
              <>
                <section className="adm-card am2-card">
                  <h3>Over time</h3>
                  <TimelineChart a={a} height={130} />
                </section>
                <RuleList a={a} />
                <ChannelList a={a} />
                <MemberList a={a} onOpen={onOpenMember} />
                {strikes ? <LadderCard a={a} /> : null}
                {a.terms.length ? <TermsCard a={a} /> : null}
                <WhenCard a={a} />
              </>
            ) : null}
            <Feed a={a} title="Catches" onCatch={onCatch} onOpenMember={onOpenMember} page={page} onPage={setPage} />
          </>
        ) : null}
      </aside>
    </div>
  );
}

// ---------- One catch, in context ----------
function CatchPanel({ id, onClose, onCatch, onOpenMember }: { id: string; onClose: () => void; onCatch: (id: string) => void; onOpenMember: (id: string) => void }) {
  const { data, error, reload } = useLive<CatchDetail>(`/api/admin/automod/event/${id}`, 0);
  const [reveal, setReveal] = useState(false);
  useEffect(() => setReveal(false), [id]);
  useEscape(onClose);
  const e = data?.event;
  const badge = e ? actionBadge(e) : null;
  const sensitive = e ? ["words", "severe", "names", "splits"].includes(e.rule) : true;

  const Line = ({ m }: { m: ContextMessage }) => {
    const p = data?.people[m.authorId];
    const hide = m.caught && sensitive && !reveal;
    return (
      <li className={`am2-msg${m.caught ? " is-caught" : ""}${m.bot ? " is-bot" : ""}`}>
        <Avatar person={p} id={m.authorId || null} size={30} />
        <div>
          <span className="am2-msg-head">
            <b>{p?.name ?? m.name ?? "Someone"}</b>
            <time title={formatDate(m.at)}>{new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
            {m.caught ? <span className={`am-badge am-badge--${badge?.tone ?? "red"}`}>Caught</span> : null}
            {m.deleted && !m.caught ? <span className="am-badge">deleted</span> : null}
          </span>
          {hide ? (
            <button type="button" className="am-spoiler" onClick={() => setReveal(true)}>
              <Eye size={13} aria-hidden="true" /> Show the message
            </button>
          ) : (
            <p>
              {m.content || <i className="adm-muted">{m.files ? `${m.files} attachment${m.files === 1 ? "" : "s"}` : "(no text)"}</i>}
              {m.caught && sensitive && reveal ? (
                <button type="button" className="am2-hide" onClick={() => setReveal(false)} aria-label="Hide again">
                  <EyeOff size={13} />
                </button>
              ) : null}
            </p>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="adm-drawer-backdrop am2-catch-backdrop" onClick={onClose}>
      <aside className="adm-drawer am2-drawer" onClick={(ev) => ev.stopPropagation()} aria-label="AutoMod catch">
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        {error && !data ? <p className="adm-error">{error}</p> : null}
        {!data || !e ? (
          <div className="adm-skeleton" style={{ height: 360 }} />
        ) : (
          <>
            <header className="am2-drawer-head">
              <span className={`am2-drawer-icon am2-drawer-icon--${badge?.tone}`}>
                <ShieldCheck size={22} />
              </span>
              <div>
                <small>AutoMod catch · {formatDate(e.at)}</small>
                <h2>{e.label}</h2>
              </div>
            </header>
            <div className="am2-catch-meta">
              {e.userId ? <PersonLink id={e.userId} people={data.people} onOpen={onOpenMember} /> : <b>Server</b>}
              <span className={`am-badge am-badge--${badge?.tone}`}>{badge?.text}</span>
              {data.channelName ? (
                <span className="am2-feed-ch">
                  <Hash size={12} aria-hidden="true" />
                  {data.channelName}
                </span>
              ) : null}
              {data.jumpUrl ? (
                <a className="adm-btn adm-btn--ghost adm-btn--small" href={data.jumpUrl} target="_blank" rel="noopener noreferrer">
                  Open in Discord <ExternalLink size={13} />
                </a>
              ) : null}
            </div>
            <p className="am2-reason">{cleanReason(e.reason)}</p>
            <FalsePositiveBox id={e.id} event={e} canAllow={Boolean(data.canAllow)} onDone={reload} />

            <section className="adm-card am2-card">
              <h3>
                <Clock size={15} aria-hidden="true" /> In context
              </h3>
              <ol className="am2-chat">
                {data.before.map((m) => (
                  <Line key={m.id} m={m} />
                ))}
                <Line m={{ ...data.caught, name: data.people[data.caught.authorId]?.name ?? data.caught.name }} />
                {data.after.map((m) => (
                  <Line key={m.id} m={m} />
                ))}
              </ol>
              <p className="adm-muted am2-sub">
                {data.contextSource === "bot"
                  ? `The ${data.before.length} messages before it were saved when AutoMod caught it${data.after.length ? "; what came after is from Live Chat" : ""}.`
                  : data.contextSource === "live"
                    ? "From Live Chat, which keeps the last 72 hours."
                    : "No context saved for this one: it's older than 72 hours and from before AutoMod started saving context."}
              </p>
            </section>

            {e.userId ? (
              <section className="adm-card am2-card">
                <h3>
                  {data.people[e.userId]?.name ?? "This member"}&apos;s AutoMod history
                </h3>
                <div className="am2-mini am2-mini--small">
                  <div>
                    <small>Strikes</small>
                    <b>{data.totals.punish ?? 0}</b>
                  </div>
                  <div>
                    <small>Removed</small>
                    <b>{data.totals.delete ?? 0}</b>
                  </div>
                  <div>
                    <small>Flagged</small>
                    <b>{(data.totals.alert ?? 0) + (data.totals.rename ?? 0)}</b>
                  </div>
                </div>
                <ol className="am2-history">
                  {data.history.map((h) => {
                    const b = actionBadge(h);
                    return (
                      <li key={h.id} className={h.id === e.id ? "is-here" : undefined}>
                        <button type="button" onClick={() => onCatch(h.id)} disabled={h.id === e.id}>
                          <time title={formatDate(h.at)}>{timeAgo(h.at)}</time>
                          <b>{h.label}</b>
                          <span className={`am-badge am-badge--${b.tone}`}>{b.text}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--small am2-card-more" onClick={() => onOpenMember(e.userId!)}>
                  Open their full record →
                </button>
              </section>
            ) : null}
          </>
        )}
      </aside>
    </div>
  );
}

// ---------- False positives ----------
function FalsePositiveBox({ id, event, canAllow, onDone }: { id: string; event: AutomodEvent; canAllow: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [allow, setAllow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fp = event.falsePositive;

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/admin/automod/event/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return setMsg(r?.error ?? "That didn't work.");
    if (!body.undo) setMsg([r.strikesCleared ? `Took back ${r.strikesCleared === 1 ? "the strike" : `${r.strikesCleared} strikes`}.` : null, r.allowed ? `'${r.allowed}' is on the allow list now.` : null].filter(Boolean).join(" ") || "Marked as a mistake.");
    setOpen(false);
    onDone();
  }

  if (fp) {
    return (
      <div className="am2-fp is-done">
        <b>Marked as a mistake</b> by {fp.byName} · {timeAgo(fp.at)}
        {fp.strikesCleared ? ` · strike taken back` : ""}
        {fp.allowed ? ` · '${fp.allowed}' allowed` : ""}
        {fp.note ? <p>{fp.note}</p> : null}
        <button type="button" className="adm-link" disabled={busy} onClick={() => void send({ undo: true })}>
          Undo
        </button>
        {msg ? <p className="adm-muted">{msg}</p> : null}
      </div>
    );
  }
  return (
    <div className="am2-fp">
      {!open ? (
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setOpen(true)}>
          AutoMod got this wrong
        </button>
      ) : (
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            void send({ note, allow });
          }}
        >
          <p className="adm-muted">
            {event.action === "punish" ? "This takes back the strike it gave, so it won't count toward a longer mute. " : ""}
            {event.action === "punish" && /mute/i.test(event.reason) ? "If they're still muted, unmute them with /unmute. " : ""}
            Marking mistakes shows which rules need adjusting.
          </p>
          <input value={note} maxLength={300} onChange={(ev) => setNote(ev.target.value)} placeholder="Why was it wrong? (optional)" aria-label="Note" />
          {event.term && canAllow ? (
            <label className="am2-fp-allow">
              <input type="checkbox" checked={allow} onChange={(ev) => setAllow(ev.target.checked)} /> Also allow &apos;{event.term}&apos; from now on
            </label>
          ) : null}
          <div className="am2-fp-row">
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn--small" disabled={busy}>
              Mark as a mistake
            </button>
          </div>
        </form>
      )}
      {msg ? <p className="adm-error">{msg}</p> : null}
    </div>
  );
}

function MistakesCard() {
  const { data } = useLive<{ rules: { rule: string; total: number; falsePositives: number }[] }>("/api/admin/automod/false-positives", 120_000);
  const rows = (data?.rules ?? []).filter((r) => r.falsePositives > 0);
  return (
    <section className="adm-card am2-card">
      <h3>Mistakes by rule</h3>
      <p className="adm-muted am2-sub">Catches staff marked as wrong in the last 30 days. A rule with lots of these probably needs loosening.</p>
      {rows.length ? (
        <ol className="am2-fp-list">
          {rows.slice(0, 8).map((r) => (
            <li key={r.rule}>
              <b>{RULE_LABELS[r.rule] ?? r.rule}</b>
              <span>
                {r.falsePositives} of {r.total} <small className="adm-muted">({Math.round((r.falsePositives / Math.max(1, r.total)) * 100)}%)</small>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="adm-empty">{data ? "None marked yet. Open a catch and use “AutoMod got this wrong”." : "Loading…"}</p>
      )}
    </section>
  );
}
