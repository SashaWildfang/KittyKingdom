"use client";

import { ArrowDownRight, ArrowUpRight, Globe2, MousePointerClick, Radio } from "lucide-react";
import { BarList, Donut, LineChart } from "./admin-charts";
import { LiveBadge, formatMs, useLive, useStored } from "./admin-shared";
import { TrafficTimes } from "./traffic-times";

type Row = { key: string; views: number; visitors: number };
type Totals = { views: number; visitors: number; sessions: number; bounces: number; durationMs: number; newVisitors: number; signedInViews: number };
type Report = {
  range: string;
  unit: "hour" | "day" | "week";
  totals: Totals;
  previous: Totals;
  live: { onSite: number | null; pages: { path: string; views: number }[] };
  timeline: { bucket: string; views: number; visitors: number }[];
  pages: (Row & { avgMs: number | null })[];
  entries: Row[];
  referrers: Row[];
  utm: Row[];
  countries: Row[];
  devices: Row[];
  browsers: Row[];
  os: Row[];
  screens: Row[];
  audience: Row[];
  hours: number[];
  hourVisitors: number[];
  weekdays: number[];
  weekdayVisitors: number[];
  heat: { views: number[][]; visitors: number[][] };
  site: {
    accounts: number;
    verified: number;
    linked: number;
    signups: number;
    prevSignups: number;
    discordLinks: number;
    logins: number;
    prevLogins: number;
    activeAccounts: number;
    publishedNews: number;
    signupTimeline: { bucket: string; count: number }[];
  };
};

const RANGES = [
  { key: "24h", label: "24 hours", prev: "the day before" },
  { key: "7d", label: "7 days", prev: "the week before" },
  { key: "30d", label: "30 days", prev: "the 30 days before" },
  { key: "90d", label: "90 days", prev: "the 90 days before" },
  { key: "365d", label: "1 year", prev: "the year before" },
];

const PALETTE = ["#f59b2a", "#3e63dd", "#46a758", "#8e4ec6", "#e5484d", "#12a594", "#d6409f", "#978365"];

const PAGE_NAMES: Record<string, string> = {
  "/": "Home",
  "/news": "News",
  "/store": "Leaf Shop",
  "/leaderboards": "Leaderboards",
  "/staff": "Staff",
  "/account": "My Account",
  "/login": "Log in",
  "/register": "Create account",
  "/reviews": "Reviews",
  "/discord": "Discord",
  "/privacy": "Privacy",
  "/terms": "Terms",
  "/support": "Support",
  "/forgot-password": "Forgot password",
  "/reset-password": "Reset password",
};

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/** 🇺🇸 from "US" */
function flag(code: string) {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...Array.from(code).map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐";
}

function countryName(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function Delta({ now, before, invert, prevLabel }: { now: number; before: number; invert?: boolean; prevLabel: string }) {
  if (!before && !now) return <span className="adm-delta">no change</span>;
  if (!before) return <span className="adm-delta is-up">new</span>;
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return <span className="adm-delta">same as {prevLabel}</span>;
  const good = invert ? change < 0 : change > 0;
  return (
    <span className={`adm-delta ${good ? "is-up" : "is-down"}`} title={`Compared with ${prevLabel}`}>
      {change > 0 ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownRight size={13} aria-hidden="true" />}
      {Math.abs(change)}%
    </span>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="adm-kpi">
      <small>{label}</small>
      <strong>{value}</strong>
      {children ? <span>{children}</span> : null}
    </div>
  );
}

function Card({ title, span = 1, children, hint }: { title: string; span?: 1 | 2 | 3; children: React.ReactNode; hint?: string }) {
  return (
    <section className={`adm-card adm-card--span${span}`}>
      <h3>
        {title}
        {hint ? <small className="adm-card-hint">{hint}</small> : null}
      </h3>
      {children}
    </section>
  );
}

const bars = (list: Row[], label: (key: string) => React.ReactNode = (k) => k) =>
  list.map((r) => ({ key: r.key, value: r.views, label: label(r.key) }));

/** Website traffic and site statistics (admins only). */
export function TrafficTab() {
  const [range, setRange] = useStored("traffic-range", "7d");
  const { data, error, loading, updatedAt } = useLive<Report>(`/api/admin/traffic?range=${range}`, 30_000);
  const prevLabel = RANGES.find((r) => r.key === range)?.prev ?? "before";
  const t = data?.totals;
  const p = data?.previous;
  const pagesPerVisit = t && t.sessions ? t.views / t.sessions : 0;
  const prevPagesPerVisit = p && p.sessions ? p.views / p.sessions : 0;
  const avgVisit = t && t.sessions ? t.durationMs / t.sessions : 0;
  const prevAvgVisit = p && p.sessions ? p.durationMs / p.sessions : 0;
  const s = data?.site;

  return (
    <div className="adm-overview adm-traffic">
      <div className="adm-toolbar">
        <div className="adm-seg" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.key} type="button" role="tab" aria-selected={range === r.key} className={range === r.key ? "is-active" : undefined} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        <LiveBadge updatedAt={updatedAt} loading={loading} />
      </div>

      {error ? <p className="adm-error">{error}</p> : null}

      <section className="adm-traffic-live">
        <span className="adm-traffic-live-now">
          <Radio size={16} aria-hidden="true" /> <strong>{data?.live.onSite ?? "…"}</strong> on the site right now
        </span>
        {data?.live.pages.length ? (
          <span className="adm-traffic-live-pages">
            Last 5 min:
            {data.live.pages.map((lp) => (
              <em key={lp.path}>
                {PAGE_NAMES[lp.path] ?? lp.path} <b>{lp.views}</b>
              </em>
            ))}
          </span>
        ) : (
          <span className="adm-muted">No page views in the last 5 minutes.</span>
        )}
      </section>

      <div className="adm-kpis">
        <Stat label="Page views" value={t ? t.views.toLocaleString() : "…"}>{t && p ? <Delta now={t.views} before={p.views} prevLabel={prevLabel} /> : null}</Stat>
        <Stat label="Unique visitors" value={t ? t.visitors.toLocaleString() : "…"}>{t && p ? <Delta now={t.visitors} before={p.visitors} prevLabel={prevLabel} /> : null}</Stat>
        <Stat label="Visits" value={t ? t.sessions.toLocaleString() : "…"}>{t && p ? <Delta now={t.sessions} before={p.sessions} prevLabel={prevLabel} /> : null}</Stat>
        <Stat label="Pages per visit" value={t ? pagesPerVisit.toFixed(1) : "…"}>{t && p ? <Delta now={pagesPerVisit} before={prevPagesPerVisit} prevLabel={prevLabel} /> : null}</Stat>
        <Stat label="Avg. visit length" value={t ? formatMs(avgVisit) : "…"}>{t && p ? <Delta now={avgVisit} before={prevAvgVisit} prevLabel={prevLabel} /> : null}</Stat>
        <Stat label="Bounce rate" value={t ? `${pct(t.bounces, t.sessions)}%` : "…"}>
          {t && p ? <Delta now={pct(t.bounces, t.sessions)} before={pct(p.bounces, p.sessions)} invert prevLabel={prevLabel} /> : null}
        </Stat>
        <Stat label="New visitors" value={t ? `${pct(t.newVisitors, t.visitors)}%` : "…"}>{t ? `${t.newVisitors.toLocaleString()} first-timers` : null}</Stat>
        <Stat label="Signed-in views" value={t ? `${pct(t.signedInViews, t.views)}%` : "…"}>{t ? `${t.signedInViews.toLocaleString()} views` : null}</Stat>
      </div>

      <div className="adm-grid">
        <Card title="Traffic over time" span={3} hint={data?.unit === "hour" ? "per hour" : data?.unit === "week" ? "per week" : "per day"}>
          {data ? (
            <LineChart
              unit={data.unit}
              points={data.timeline.map((d) => ({ bucket: d.bucket, values: { views: d.views, visitors: d.visitors } }))}
              series={[
                { key: "views", label: "Page views", color: "#f59b2a" },
                { key: "visitors", label: "Visitors", color: "#3e63dd" },
              ]}
            />
          ) : (
            <div className="adm-skeleton" />
          )}
        </Card>

        <Card title="Top pages" span={2}>
          {data?.pages.length ? (
            <table className="adm-table adm-traffic-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Views</th>
                  <th>Visitors</th>
                  <th>Avg. time</th>
                </tr>
              </thead>
              <tbody>
                {data.pages.map((pg) => (
                  <tr key={pg.key}>
                    <td>
                      <span className="adm-traffic-page">
                        <strong>{PAGE_NAMES[pg.key] ?? pg.key}</strong>
                        {PAGE_NAMES[pg.key] ? <small>{pg.key}</small> : null}
                      </span>
                      <span className="adm-traffic-bar" style={{ width: `${(pg.views / data.pages[0].views) * 100}%` }} />
                    </td>
                    <td>{pg.views.toLocaleString()}</td>
                    <td>{pg.visitors.toLocaleString()}</td>
                    <td>{formatMs(pg.avgMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : data ? (
            <p className="adm-empty">No page views yet.</p>
          ) : (
            <div className="adm-skeleton" />
          )}
        </Card>

        <Card title="Where people land" hint="first page of a visit">
          {data ? <BarList color="rgba(245, 155, 42, 0.3)" items={bars(data.entries, (k) => PAGE_NAMES[k] ?? k)} /> : <div className="adm-skeleton" />}
        </Card>

        <Card title="Referrers" hint="sites that sent visitors">
          {data ? (
            <BarList
              color="rgba(62, 99, 221, 0.3)"
              items={bars(data.referrers, (k) => (
                <span className="adm-traffic-ref">
                  {k === "Direct / none" ? <MousePointerClick size={13} aria-hidden="true" /> : <Globe2 size={13} aria-hidden="true" />} {k}
                </span>
              ))}
            />
          ) : (
            <div className="adm-skeleton" />
          )}
        </Card>

        <Card title="Countries">
          {data ? (
            <BarList
              color="rgba(70, 167, 88, 0.3)"
              items={bars(data.countries, (k) => (
                <span>
                  {flag(k)} {countryName(k)}
                </span>
              ))}
            />
          ) : (
            <div className="adm-skeleton" />
          )}
        </Card>

        <Card title="Visitors">
          {data ? (
            <Donut label="views" parts={data.audience.map((a, i) => ({ key: a.key, label: a.key, value: a.views, color: ({ Guest: "#8b8d98", "Signed in": "#46a758", "Discord linked": "#5865f2" } as Record<string, string>)[a.key] ?? PALETTE[i] }))} />
          ) : (
            <div className="adm-skeleton" />
          )}
        </Card>

        <Card title="Devices">
          {data ? <Donut label="views" parts={data.devices.map((d, i) => ({ key: d.key, label: d.key[0].toUpperCase() + d.key.slice(1), value: d.views, color: PALETTE[i % PALETTE.length] }))} /> : <div className="adm-skeleton" />}
        </Card>

        <Card title="Browsers">{data ? <BarList color="rgba(142, 78, 198, 0.3)" items={bars(data.browsers)} /> : <div className="adm-skeleton" />}</Card>

        <Card title="Operating systems">{data ? <BarList color="rgba(18, 165, 148, 0.3)" items={bars(data.os)} /> : <div className="adm-skeleton" />}</Card>

        <Card title="Screen sizes">{data ? <BarList color="rgba(214, 64, 159, 0.28)" items={bars(data.screens)} /> : <div className="adm-skeleton" />}</Card>

        <Card title="Campaign links" hint="?utm_source= or ?ref=">
          {data ? data.utm.length ? <BarList color="rgba(245, 155, 42, 0.3)" items={bars(data.utm)} /> : <p className="adm-empty">Add ?ref=discord to links you share to see them here.</p> : <div className="adm-skeleton" />}
        </Card>

        <Card title="When people visit" span={3}>
          {data ? <TrafficTimes data={data} range={range} /> : <div className="adm-skeleton" />}
        </Card>
      </div>

      <h2 className="adm-section-title">Site statistics</h2>
      <div className="adm-kpis">
        <Stat label="Accounts" value={s ? s.accounts.toLocaleString() : "…"}>{s ? `${pct(s.verified, s.accounts)}% email verified` : null}</Stat>
        <Stat label="New accounts" value={s ? s.signups.toLocaleString() : "…"}>{s ? <Delta now={s.signups} before={s.prevSignups} prevLabel={prevLabel} /> : null}</Stat>
        <Stat label="Discord linked" value={s ? `${pct(s.linked, s.accounts)}%` : "…"}>{s ? `${s.discordLinks.toLocaleString()} linked in this range` : null}</Stat>
        <Stat label="Log-ins" value={s ? s.logins.toLocaleString() : "…"}>{s ? <Delta now={s.logins} before={s.prevLogins} prevLabel={prevLabel} /> : null}</Stat>
        <Stat label="Active accounts" value={s ? s.activeAccounts.toLocaleString() : "…"}>signed in and browsing</Stat>
        <Stat label="Sign-up rate" value={s && t ? `${pct(s.signups, t.visitors)}%` : "…"}>of unique visitors</Stat>
        <Stat label="News posts" value={s ? s.publishedNews.toLocaleString() : "…"}>published</Stat>
      </div>
      <div className="adm-grid">
        <Card title="New accounts over time" span={3}>
          {data ? (
            <LineChart
              unit={data.unit}
              height={170}
              points={Array.from(new Set([...data.timeline.map((d) => d.bucket), ...(s?.signupTimeline.map((x) => x.bucket) ?? [])]))
                .sort()
                .map((bucket) => ({ bucket, values: { signups: s?.signupTimeline.find((x) => x.bucket === bucket)?.count ?? 0 } }))}
              series={[{ key: "signups", label: "New accounts", color: "#46a758" }]}
            />
          ) : (
            <div className="adm-skeleton" />
          )}
        </Card>
      </div>

      <p className="adm-muted adm-traffic-note">
        First-party stats: no third-party trackers, no IP addresses stored, visitors are anonymous random IDs. Admin pages, bots and browsers with Do Not Track aren&apos;t counted. Views are kept for about 13 months.
      </p>
    </div>
  );
}
