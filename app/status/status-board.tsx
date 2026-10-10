"use client";

import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleHelp, Clock, Wrench, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DayBar, Health, Incident, PartStatus, StatusView } from "../../lib/status";
import { SiteLogo } from "../ui-icons";

const HEALTH: Record<Health, { label: string; Icon: typeof CheckCircle2 }> = {
  up: { label: "Operational", Icon: CheckCircle2 },
  degraded: { label: "Having problems", Icon: AlertTriangle },
  down: { label: "Outage", Icon: XCircle },
  unknown: { label: "No data", Icon: CircleHelp },
};
const OVERALL: Record<Health, string> = {
  up: "All systems operational",
  degraded: "Some things are having problems",
  down: "Major outage",
  unknown: "Checking…",
};
const STEP: Record<string, string> = { investigating: "Investigating", identified: "Identified", monitoring: "Monitoring", resolved: "Resolved", scheduled: "Scheduled" };

const pct = (n: number | null) => (n === null ? "—" : `${(Math.floor(n * 10000) / 100).toFixed(2)}%`);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

function barTone(b: DayBar): string {
  if (b.uptime === null) return b.incidents.length ? "is-degraded" : "is-none";
  if (b.uptime >= 0.999 && !b.incidents.length) return "is-up";
  if (b.uptime >= 0.98) return "is-degraded";
  return "is-down";
}

function Bars({ part }: { part: PartStatus }) {
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const b = hover !== null ? part.days[hover.i] : null;
  return (
    <div className="sp-bars-wrap">
      <div className="sp-bars" onMouseLeave={() => setHover(null)} role="img" aria-label={`${part.name}: ${pct(part.uptime90)} uptime over 90 days`}>
        {part.days.map((d, i) => (
          <span key={d.day} className={`sp-bar ${barTone(d)}`} onMouseEnter={(e) => setHover({ i, x: e.currentTarget.offsetLeft })} onClick={(e) => setHover({ i, x: e.currentTarget.offsetLeft })} />
        ))}
      </div>
      {b ? (
        <div className="sp-tip" style={{ left: hover?.x ?? 0 }}>
          <b>{dayLabel(b.day)}</b>
          <span>{b.uptime === null ? "No data" : `${pct(b.uptime)} uptime${b.downMinutes ? ` · ${b.downMinutes} min down` : ""}`}</span>
          {b.incidents.map((t) => (
            <small key={t}>{t}</small>
          ))}
        </div>
      ) : null}
      <div className="sp-bars-foot">
        <span>90 days ago</span>
        <span className="sp-line" />
        <span>{pct(part.uptime90)} uptime</span>
        <span className="sp-line" />
        <span>Today</span>
      </div>
    </div>
  );
}

function IncidentCard({ i, parts }: { i: Incident; parts: Map<string, string> }) {
  return (
    <article className={`sp-incident is-${i.status === "scheduled" ? "maintenance" : i.impact}${i.resolvedAt ? " is-resolved" : ""}`}>
      <header>
        <h3>{i.title}</h3>
        <span className="sp-affects">Affects: {i.parts.map((p) => parts.get(p) ?? p).join(", ")}</span>
        {i.scheduledFor ? (
          <span className="sp-affects">
            <Clock size={12} aria-hidden="true" /> {when(i.scheduledFor)}
            {i.scheduledUntil ? ` – ${when(i.scheduledUntil)}` : ""}
          </span>
        ) : null}
      </header>
      <ol>
        {i.updates.map((u, n) => (
          <li key={n}>
            <b>{STEP[u.status] ?? u.status}</b> <span>{u.text}</span>
            <time>{when(u.at)}</time>
          </li>
        ))}
      </ol>
    </article>
  );
}

export function StatusBoard({ initial }: { initial: StatusView | null }) {
  const [data, setData] = useState<StatusView | null>(initial);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const load = () =>
      fetch("/api/status", { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => {
          if (r?.ok) {
            setData(r);
            setFailed(false);
          } else setFailed(true);
        })
        .catch(() => setFailed(true));
    const t = window.setInterval(() => document.visibilityState === "visible" && void load(), 30_000);
    if (!initial) void load();
    return () => window.clearInterval(t);
  }, [initial]);

  const names = useMemo(() => new Map((data?.parts ?? []).map((p) => [p.key, p.name])), [data]);
  const groups = useMemo(() => {
    const out = new Map<string, PartStatus[]>();
    for (const p of data?.parts ?? []) out.set(p.group, [...(out.get(p.group) ?? []), p]);
    return Array.from(out);
  }, [data]);
  const pastByDay = useMemo(() => {
    const out = new Map<string, Incident[]>();
    for (const i of data?.past ?? []) {
      const d = (i.resolvedAt ?? i.startedAt).slice(0, 10);
      out.set(d, [...(out.get(d) ?? []), i]);
    }
    return Array.from(out);
  }, [data]);

  const overall = data?.overall ?? "unknown";
  const OverallIcon = HEALTH[overall].Icon;

  return (
    <div className="st">
      <header className="sp-top">
        <a className="sp-brand" href="https://www.kittykingdom.net">
          <SiteLogo className="sp-logo" alt="" />
          <span>
            <b>Kitty Kingdom</b>
            <small>Status</small>
          </span>
        </a>
        <a className="sp-home" href="https://www.kittykingdom.net">
          Go to kittykingdom.net <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </header>

      <section className={`sp-overall is-${overall}`} aria-live="polite">
        <OverallIcon size={28} aria-hidden="true" />
        <div>
          <h1>{failed && !data ? "Couldn't load the status" : OVERALL[overall]}</h1>
          <p>{data ? `Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })} · refreshes every 30 seconds` : "Loading…"}</p>
        </div>
      </section>

      {data?.active.length ? (
        <section className="sp-section">
          <h2>Current incidents</h2>
          {data.active.map((i) => (
            <IncidentCard key={i.id} i={i} parts={names} />
          ))}
        </section>
      ) : null}

      {data?.scheduled.length ? (
        <section className="sp-section">
          <h2>
            <Wrench size={16} aria-hidden="true" /> Scheduled maintenance
          </h2>
          {data.scheduled.map((i) => (
            <IncidentCard key={i.id} i={i} parts={names} />
          ))}
        </section>
      ) : null}

      {groups.map(([group, parts]) => (
        <section key={group} className="sp-section sp-group">
          <h2>{group}</h2>
          <ul className="sp-parts">
            {parts.map((p) => {
              const H = HEALTH[p.health];
              return (
                <li key={p.key} className="sp-part">
                  <div className="sp-part-head">
                    <div>
                      <b>{p.name}</b>
                      <small>{p.about}</small>
                    </div>
                    <span className={`sp-pill is-${p.health}`} title={p.ms !== null ? `${p.ms} ms` : undefined}>
                      <H.Icon size={14} aria-hidden="true" /> {p.health === "up" ? H.label : p.detail}
                    </span>
                  </div>
                  {p.key !== "discord" ? (
                    <Bars part={p} />
                  ) : (
                    <a className="sp-ext" href="https://discordstatus.com" target="_blank" rel="noreferrer">
                      Full details on discordstatus.com <ArrowUpRight size={12} aria-hidden="true" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="sp-section">
        <h2>Past incidents</h2>
        {pastByDay.length ? (
          pastByDay.map(([day, list]) => (
            <div key={day} className="sp-past-day">
              <h3>{dayLabel(day)}</h3>
              {list.map((i) => (
                <IncidentCard key={i.id} i={i} parts={names} />
              ))}
            </div>
          ))
        ) : (
          <p className="sp-muted">No incidents in the last 90 days.</p>
        )}
      </section>
    </div>
  );
}
