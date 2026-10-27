"use client";

// Admin → Bots → Consoles: each bot's SparkedHost server. Live state and resources, the console output, and
// start / restart / stop (two-factor required, every action logged).

import "./console-tab.css";
import { Copy, Download, KeyRound, Pause, Play, Power, RotateCw, Search, Skull, Square, Terminal } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ServerStatus } from "../../../lib/bot-console";
import { timeAgo, useLive } from "../admin-shared";
import { askConfirm } from "../../confirm-dialog";

type Overview = {
  ok: boolean;
  error?: string;
  configured: boolean;
  servers: ServerStatus[];
  open?: Record<string, { errors: number; warnings: number }>;
  outdated?: Record<string, number>;
  actions: { at: string | null; server: string; signal: string; by: string; ok: boolean; error: string | null }[];
};
type Logs = { ok: boolean; error?: string; lines: string[]; at: string };

const STATE_TEXT: Record<string, string> = { running: "Online", starting: "Starting", stopping: "Stopping", offline: "Offline", unknown: "Unknown" };
const SIGNAL_TEXT: Record<string, string> = { start: "Started", stop: "Stopped", restart: "Restarted", kill: "Force-stopped" };

function bytes(n: number | null) {
  if (n === null) return "—";
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  return `${Math.round(n / 1048576)} MB`;
}
function uptime(ms: number | null) {
  if (!ms) return "—";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m}m`;
}

// ---------- ANSI colours in console lines ----------
const ANSI_COLORS: Record<number, string> = {
  30: "#6b7280", 31: "#f87171", 32: "#4ade80", 33: "#facc15", 34: "#60a5fa", 35: "#e879f9", 36: "#22d3ee", 37: "#e5e7eb",
  90: "#9ca3af", 91: "#fca5a5", 92: "#86efac", 93: "#fde047", 94: "#93c5fd", 95: "#f0abfc", 96: "#67e8f9", 97: "#ffffff",
};
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[([0-9;]*)m/g;
// eslint-disable-next-line no-control-regex
const OTHER_ESCAPES = /\x1b\[[0-9;?]*[A-Za-ln-z]|\x1b[()][A-Z0-9]|\r/g;

function AnsiLine({ text }: { text: string }) {
  const clean = text.replace(OTHER_ESCAPES, "");
  const parts: ReactNode[] = [];
  let color: string | undefined;
  let bold = false;
  let last = 0;
  let m: RegExpExecArray | null;
  ANSI.lastIndex = 0;
  const push = (s: string, i: number) => {
    if (!s) return;
    parts.push(color || bold ? <span key={i} style={{ color, fontWeight: bold ? 700 : undefined }}>{s}</span> : <Fragment key={i}>{s}</Fragment>);
  };
  while ((m = ANSI.exec(clean))) {
    push(clean.slice(last, m.index), m.index);
    for (const c of (m[1] || "0").split(";").map(Number)) {
      if (c === 0) (color = undefined), (bold = false);
      else if (c === 1) bold = true;
      else if (c === 22) bold = false;
      else if (c === 39) color = undefined;
      else if (ANSI_COLORS[c]) color = ANSI_COLORS[c];
    }
    last = m.index + m[0].length;
  }
  push(clean.slice(last), clean.length + 1);
  return <>{parts.length ? parts : " "}</>;
}
const plain = (text: string) => text.replace(ANSI, "").replace(OTHER_ESCAPES, "");

/** A line's tone, from what it says (errors red, warnings amber) when the bot didn't colour it */
function tone(text: string) {
  const t = plain(text);
  if (/traceback|error|exception|❌|failed/i.test(t)) return "is-error";
  if (/warn|⚠️/i.test(t)) return "is-warn";
  if (/^\[?(pterodactyl daemon|sparked)/i.test(t) || /container@/i.test(t)) return "is-daemon";
  return "";
}

// The bots (the same list as lib/bot-console.ts BOT_SERVERS, kept here so the browser doesn't load server code)
const BOTS = [
  { key: "main", name: "Main Bot" },
  { key: "moderation", name: "Moderation Bot" },
  { key: "economy", name: "Economy Bot" },
  { key: "ticketing", name: "Ticket Bot" },
];
type View = "console" | "issues" | "resources" | "versions" | "uptime";

export function ConsoleTab() {
  const { data, error, reload } = useLive<Overview>("/api/admin/bots/console", 5_000);
  const [selected, setSelected] = useState("main");
  const [view, setView] = useState<View>("console");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // A bell alert links here with ?bot=…: open that bot's issues
  useEffect(() => {
    const bot = new URL(window.location.href).searchParams.get("bot");
    if (bot && BOTS.some((b) => b.key === bot)) {
      setSelected(bot);
      setView("issues");
    }
  }, []);

  if (!data && error) return <p className="adm-error">Couldn&apos;t load the bot servers: {error}</p>;
  if (!data) return <div className="adm-skeleton" style={{ height: 480 }} />;

  const open = data.open ?? {};
  const status = (key: string) => data.servers.find((s) => s.key === key) ?? null;
  const server = status(selected);
  const bot = BOTS.find((b) => b.key === selected) ?? BOTS[0];
  const views: { key: View; label: string; badge?: number }[] = [
    { key: "console", label: "Console" },
    { key: "issues", label: "Issues", badge: (open[bot.key]?.errors ?? 0) + (open[bot.key]?.warnings ?? 0) },
    { key: "resources", label: "Resources" },
    { key: "versions", label: "Up to date?", badge: data.outdated?.[bot.key] ?? 0 },
    { key: "uptime", label: "Uptime" },
  ];

  const power = async (signal: "start" | "stop" | "restart" | "kill") => {
    if (!server) return;
    const warn: Record<string, string> = {
      stop: "It stays offline until someone starts it again.",
      restart: "It's offline for a few seconds while it restarts.",
      kill: "Like pulling the plug: anything it was saving may be lost. Use it only if Stop is stuck.",
    };
    // In-page confirm: the browser's own pop-up can be switched off ("don't show again"), which blocked restarts
    if (warn[signal] && !(await askConfirm(warn[signal], { title: `${signal === "kill" ? "Force-stop" : signal[0].toUpperCase() + signal.slice(1)} the ${server.name}?`, danger: signal !== "restart", confirmLabel: signal === "kill" ? "Force stop" : signal === "stop" ? "Stop it" : "Restart" }))) return;
    setBusy(signal);
    setMsg(null);
    const r = await fetch(`/api/admin/bots/console/${server.key}/power`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signal }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(null);
    setMsg(r?.ok ? { ok: true, text: r.message } : { ok: false, text: r?.error ?? "Couldn't send that." });
    await reload();
  };

  // Restart every bot, a couple of seconds apart (each one is logged like a single restart)
  const restartAll = async () => {
    const running = data.servers.filter((s) => s.state === "running" || s.state === "starting");
    if (!running.length) return setMsg({ ok: false, text: "None of the bots are running. Start them one at a time." });
    if (!(await askConfirm(`This restarts ${running.map((s) => s.name).join(", ")}, a couple of seconds apart. Each one is offline for a few seconds.`, { title: "Restart all bots?", confirmLabel: "Restart all" }))) return;
    setBusy("all");
    setMsg(null);
    const failed: string[] = [];
    for (const s of running) {
      const r = await fetch(`/api/admin/bots/console/${s.key}/power`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signal: "restart" }) })
        .then((x) => x.json())
        .catch(() => null);
      if (!r?.ok) failed.push(`${s.name}: ${r?.error ?? "couldn't send it"}`);
      await new Promise((res) => window.setTimeout(res, 2_000));
    }
    setBusy(null);
    setMsg(failed.length ? { ok: false, text: `Restarted ${running.length - failed.length} of ${running.length}. ${failed.join(" · ")}` } : { ok: true, text: `Restarting all ${running.length} bots… They're back in under a minute.` });
    await reload();
  };

  return (
    <>
      {!data.configured ? <SetupCard /> : null}
      <section className="bc">
        <div className="bc-servers" role="tablist" aria-label="Bots">
          {data.configured ? (
            <button type="button" className="adm-btn adm-btn--small bc-restart-all" disabled={Boolean(busy)} onClick={() => void restartAll()}>
              <RotateCw size={14} className={busy === "all" ? "set-spin" : undefined} /> {busy === "all" ? "Restarting all…" : "Restart all bots"}
            </button>
          ) : null}
          {BOTS.map((b) => {
            const s = status(b.key);
            const errors = open[b.key]?.errors ?? 0;
            return (
              <button key={b.key} type="button" role="tab" aria-selected={b.key === bot.key} className={`bc-server${b.key === bot.key ? " is-on" : ""}`} onClick={() => (setSelected(b.key), setMsg(null))}>
                <span className="bc-server-top">
                  <b>{b.name}</b>
                  {s ? <StateBadge s={s} /> : null}
                </span>
                {errors ? (
                  <span className="bc-issue-pill" title="Open errors">
                    {errors} error{errors === 1 ? "" : "s"}
                  </span>
                ) : null}
                {!s ? null : s.error ? (
                  <small className="bc-server-err">{s.error}</small>
                ) : (
                  <>
                    <Meter label="CPU" value={s.cpu} max={s.cpuLimit ?? 100} text={s.cpu === null ? "—" : `${s.cpu.toFixed(1)}%`} />
                    <Meter label="RAM" value={s.memory} max={s.memoryLimit} text={bytes(s.memory)} />
                    <small className="bc-server-up">{s.state === "running" ? `Up ${uptime(s.uptimeMs)}` : STATE_TEXT[s.state]}</small>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="bc-main">
          <div className="adm-card bc-head">
            <div className="bc-head-title">
              <span className={`bc-head-icon is-${server?.state ?? "unknown"}`}>
                <Terminal size={20} />
              </span>
              <div>
                <h3>{bot.name}</h3>
                {server ? (
                  <small>
                    <StateBadge s={server} /> {server.state === "running" ? `· up ${uptime(server.uptimeMs)}` : ""} · RAM {bytes(server.memory)}
                    {server.memoryLimit ? ` of ${bytes(server.memoryLimit)}` : ""} · disk {bytes(server.disk)}
                  </small>
                ) : (
                  <small>Connect SparkedHost to see its state and control it.</small>
                )}
              </div>
            </div>
            {server ? (
              <div className="bc-actions">
                <button type="button" className="adm-btn adm-btn--small bc-start" disabled={Boolean(busy) || server.state !== "offline"} onClick={() => void power("start")}>
                  <Play size={14} /> {busy === "start" ? "Starting…" : "Start"}
                </button>
                <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" disabled={Boolean(busy) || server.state === "offline" || server.state === "stopping"} onClick={() => void power("restart")}>
                  <RotateCw size={14} /> {busy === "restart" ? "Restarting…" : "Restart"}
                </button>
                {server.state === "stopping" || server.state === "starting" ? (
                  <button type="button" className="adm-btn adm-btn--small adm-btn--ghost bc-danger" disabled={Boolean(busy)} onClick={() => void power("kill")}>
                    <Skull size={14} /> Force stop
                  </button>
                ) : (
                  <button type="button" className="adm-btn adm-btn--small adm-btn--ghost bc-danger" disabled={Boolean(busy) || server.state === "offline"} onClick={() => void power("stop")}>
                    <Square size={14} /> {busy === "stop" ? "Stopping…" : "Stop"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
          {msg ? (
            <p className={msg.ok ? "bc-msg is-ok" : "bc-msg is-err"} role="status">
              {msg.text}
            </p>
          ) : null}

          <nav className="adm-seg bc-views" role="tablist" aria-label="What to show">
            {views.map((v) => (
              <button key={v.key} type="button" role="tab" aria-selected={view === v.key} className={view === v.key ? "is-active" : undefined} onClick={() => setView(v.key)}>
                {v.label}
                {v.badge ? <span className={`bc-view-badge${open[bot.key]?.errors ? " is-error" : ""}`}>{v.badge}</span> : null}
              </button>
            ))}
          </nav>

          {view === "console" ? (
            server ? (
              <ConsoleView key={bot.key} serverKey={bot.key} name={bot.name} state={server.state} />
            ) : (
              <p className="adm-muted">The console needs SparkedHost connected (see above).</p>
            )
          ) : null}
          {view === "issues" ? <IssuesView key={bot.key} bot={bot.key} name={bot.name} onChange={() => void reload()} /> : null}
          {view === "resources" ? <ResourcesView bot={bot.key} /> : null}
          {view === "versions" ? <VersionsView bot={bot.key} name={bot.name} /> : null}
          {view === "uptime" ? <UptimeView bot={bot.key} name={bot.name} /> : null}

          {data.configured ? (
            <div className="adm-card bc-history">
              <h3>
                <Power size={15} aria-hidden="true" /> Recent start / stop / restart
              </h3>
              {data.actions.length ? (
                <ol>
                  {data.actions.map((a, i) => (
                    <li key={i}>
                      <time>{a.at ? timeAgo(a.at) : ""}</time>
                      <span>
                        <b>{a.by || "Someone"}</b> {a.ok ? SIGNAL_TEXT[a.signal]?.toLowerCase() ?? a.signal : `tried to ${a.signal}`} the <b>{BOTS.find((b) => b.key === a.server)?.name ?? a.server}</b>
                      </span>
                      {a.ok ? null : <small className="bc-msg is-err">{a.error}</small>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="adm-muted">Nothing yet. Actions from here are listed with who did them.</p>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

// ---------- Issues ----------
type Issue = { id: string; bot: string; level: "error" | "warning"; title: string; detail: string; count: number; firstAt: string | null; lastAt: string | null; resolved: boolean; resolvedBy: string | null; hint?: { cause: string; fix: string } | null };

function IssuesView({ bot, name, onChange }: { bot: string; name: string; onChange: () => void }) {
  const [showFixed, setShowFixed] = useState(false);
  const { data, error, reload } = useLive<{ ok: boolean; issues: Issue[] }>(`/api/admin/bots/issues?bot=${bot}${showFixed ? "" : "&open=1"}`, 10_000);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolve = async (body: Record<string, string>) => {
    setBusy(true);
    await fetch("/api/admin/bots/issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    await reload();
    onChange();
  };
  const issues = data?.issues ?? [];
  const openCount = issues.filter((i) => !i.resolved).length;
  return (
    <div className="adm-card bc-issues">
      <div className="bc-issues-head">
        <div>
          <h3>Problems in the console</h3>
          <p className="adm-muted">
            Errors and warnings the {name} printed, grouped when they repeat. New errors alert admins in the bell. Marking one fixed hides it until it happens again.
          </p>
        </div>
        <div className="bc-issues-tools">
          <label className="bc-check">
            <input type="checkbox" checked={showFixed} onChange={(e) => setShowFixed(e.target.checked)} /> Show fixed
          </label>
          {openCount ? (
            <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" disabled={busy} onClick={async () => (await askConfirm(`Mark all ${openCount} open problems for the ${name} as fixed?`, { confirmLabel: "Mark fixed" })) && void resolve({ bot })}>
              Mark all fixed
            </button>
          ) : null}
        </div>
      </div>
      {error && !data ? <p className="adm-error">{error}</p> : null}
      {!data ? <div className="adm-skeleton" style={{ height: 160 }} /> : null}
      {data && !issues.length ? <p className="bc-all-clear">✓ No problems{showFixed ? "" : " open"}. Errors show up here as soon as the bot prints them (with the new events/health.py).</p> : null}
      <ul className="bc-issue-list">
        {issues.map((i) => (
          <li key={i.id} className={`bc-issue is-${i.level}${i.resolved ? " is-fixed" : ""}`}>
            <button type="button" className="bc-issue-main" onClick={() => setOpenId(openId === i.id ? null : i.id)} aria-expanded={openId === i.id}>
              <span className={`bc-issue-level is-${i.level}`}>{i.level === "error" ? "Error" : "Warning"}</span>
              <span className="bc-issue-title">
                {i.title}
                {i.hint ? <small className="bc-issue-hint">{i.hint.cause}</small> : null}
              </span>
              <span className="bc-issue-meta">
                {i.count > 1 ? <b>×{i.count.toLocaleString()}</b> : null} {i.lastAt ? timeAgo(i.lastAt) : ""}
              </span>
            </button>
            {openId === i.id ? (
              <div className="bc-issue-body">
                <p className="adm-muted">
                  First seen {i.firstAt ? new Date(i.firstAt).toLocaleString() : "—"} · last {i.lastAt ? new Date(i.lastAt).toLocaleString() : "—"}
                  {i.resolved ? ` · marked fixed${i.resolvedBy ? ` by ${i.resolvedBy}` : ""}` : ""}
                </p>
                {i.hint ? (
                  <div className="bc-hint">
                    <b>Likely cause:</b> {i.hint.cause} <span className="adm-muted">{i.hint.fix}</span>
                  </div>
                ) : null}
                {i.detail ? <pre className="bc-trace">{i.detail}</pre> : null}
                {!i.resolved ? (
                  <button type="button" className="adm-btn adm-btn--small" disabled={busy} onClick={() => void resolve({ id: i.id })}>
                    Mark fixed
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Resources ----------
type Advice = { tone: "bad" | "warn" | "good" | "info"; title: string; text: string };
type HealthPoint = { t: string; rss: number | null; rssMax: number | null; cpu: number | null; cpuMax: number | null; lag: number | null; latency: number | null };
type BotHealth = {
  key: string;
  name: string;
  samples: number;
  points: HealthPoint[];
  memPeak: number | null;
  memAvg: number | null;
  memLimit: number | null;
  cpuP95: number | null;
  cpuAvg: number | null;
  cpuLimit: number | null;
  lagP95: number | null;
  latencyAvg: number | null;
  restarts: number;
  suggestedMemory: number | null;
  advice: Advice[];
};

function ResourcesView({ bot }: { bot: string }) {
  const [range, setRange] = useState<"24h" | "7d">("24h");
  const { data, error } = useLive<{ ok: boolean; bots: BotHealth[]; plan: Advice[] }>(`/api/admin/bots/health?range=${range}`, 60_000);
  if (error && !data) return <p className="adm-error">{error}</p>;
  if (!data) return <div className="adm-skeleton" style={{ height: 360 }} />;
  const h = data.bots.find((b) => b.key === bot);
  return (
    <div className="bc-res">
      <div className="adm-card bc-plan">
        <div className="bc-issues-head">
          <h3>Where the RAM should go</h3>
          <div className="adm-seg" role="tablist" aria-label="Range">
            {(["24h", "7d"] as const).map((r) => (
              <button key={r} type="button" className={range === r ? "is-active" : undefined} onClick={() => setRange(r)}>
                {r === "24h" ? "Last 24 hours" : "Last 7 days"}
              </button>
            ))}
          </div>
        </div>
        <table className="bc-table">
          <thead>
            <tr>
              <th>Bot</th>
              <th>RAM peak</th>
              <th>Limit</th>
              <th>Suggested</th>
              <th>CPU (busy)</th>
              <th>Restarts</th>
            </tr>
          </thead>
          <tbody>
            {data.bots.map((b) => (
              <tr key={b.key} className={b.key === bot ? "is-on" : undefined}>
                <td>{b.name}</td>
                <td>{bytes(b.memPeak)}</td>
                <td>{bytes(b.memLimit)}</td>
                <td className={b.suggestedMemory && b.memLimit ? (b.suggestedMemory > b.memLimit ? "is-up" : "is-down") : undefined}>{b.suggestedMemory ? bytes(b.suggestedMemory) : b.samples >= 30 ? "keep" : "—"}</td>
                <td>{b.cpuP95 === null ? "—" : `${Math.round(b.cpuP95)}%${b.cpuLimit ? ` of ${b.cpuLimit}%` : ""}`}</td>
                <td>{b.samples ? b.restarts : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.plan.map((a, i) => (
          <AdviceRow key={i} a={a} />
        ))}
      </div>

      {h ? (
        <div className="adm-card bc-res-bot">
          <h3>{h.name}</h3>
          {h.advice.map((a, i) => (
            <AdviceRow key={i} a={a} />
          ))}
          {h.points.length > 1 ? (
            <div className="bc-charts">
              <LineChart title="RAM" points={h.points} value={(p) => p.rss} peak={(p) => p.rssMax} limit={h.memLimit} format={(v) => bytes(v)} color="#22c55e" />
              <LineChart title="CPU" points={h.points} value={(p) => p.cpu} peak={(p) => p.cpuMax} limit={h.cpuLimit} format={(v) => `${Math.round(v)}%`} color="#60a5fa" />
              <LineChart title="Freezes (event-loop delay)" points={h.points} value={(p) => p.lag} format={(v) => `${Math.round(v)} ms`} color="#f59e0b" />
              <LineChart title="Discord latency" points={h.points} value={(p) => p.latency} format={(v) => `${Math.round(v)} ms`} color="#a78bfa" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AdviceRow({ a }: { a: Advice }) {
  return (
    <p className={`bc-advice is-${a.tone}`}>
      <b>{a.title}</b> {a.text}
    </p>
  );
}

/** A small line chart: the average, a faint band up to the peak, and the limit as a dashed line. */
function LineChart({ title, points, value, peak, limit, format, color }: { title: string; points: HealthPoint[]; value: (p: HealthPoint) => number | null; peak?: (p: HealthPoint) => number | null; limit?: number | null; format: (v: number) => string; color: string }) {
  const W = 600;
  const H = 120;
  const vals = points.map(value);
  const peaks = peak ? points.map(peak) : vals;
  const all = [...vals, ...peaks].filter((v): v is number => typeof v === "number");
  if (!all.length) return null;
  const max = Math.max(...all, limit ?? 0) * 1.08 || 1;
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const path = (list: (number | null)[]) => list.map((v, i) => (v === null ? "" : `${i === 0 || list[i - 1] === null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join("");
  const latest = [...vals].reverse().find((v) => v !== null) ?? null;
  const highest = Math.max(...all);
  return (
    <figure className="bc-chart">
      <figcaption>
        <b>{title}</b>
        <span>
          now {latest === null ? "—" : format(latest)} · peak {format(highest)}
          {limit ? ` · limit ${format(limit)}` : ""}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${title} over time`}>
        {peak ? <path d={path(peaks)} fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /> : null}
        <path d={path(vals)} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {limit && limit <= max ? <line x1="0" x2={W} y1={y(limit)} y2={y(limit)} stroke="#ef4444" strokeDasharray="6 5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      <div className="bc-chart-axis">
        <span>{new Date(points[0].t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" })}</span>
        <span>{new Date(points[points.length - 1].t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" })}</span>
      </div>
    </figure>
  );
}

function StateBadge({ s }: { s: ServerStatus }) {
  const state = s.error ? "unknown" : s.suspended ? "offline" : s.state;
  return <span className={`bc-state is-${state}`}>{s.error ? "Unreachable" : s.suspended ? "Suspended" : STATE_TEXT[s.state]}</span>;
}

function Meter({ label, value, max, text }: { label: string; value: number | null; max: number | null; text: string }) {
  const pct = value !== null && max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span className="bc-meter">
      <small>{label}</small>
      <i>
        <span style={{ width: `${pct}%`, background: pct > 85 ? "#ef4444" : pct > 65 ? "#f59e0b" : undefined } as CSSProperties} />
      </i>
      <em>{text}</em>
    </span>
  );
}

function ConsoleView({ serverKey, name, state }: { serverKey: string; name: string; state: string }) {
  const [paused, setPaused] = useState(false);
  const [follow, setFollow] = useState(true);
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState(false);
  // Faster while it's starting or stopping, so you can watch it happen
  const every = paused ? 0 : state === "starting" || state === "stopping" ? 2_000 : 4_000;
  const { data, error, updatedAt } = useLive<Logs>(`/api/admin/bots/console/${serverKey}/logs`, every);
  const box = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => data?.lines ?? [], [data]);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? lines.filter((l) => plain(l).toLowerCase().includes(q)) : lines;
  }, [lines, filter]);

  // Stick to the bottom while following; scrolling up stops following, scrolling back down resumes it
  useLayoutEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [shown, follow]);
  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom !== follow) setFollow(atBottom);
  };
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1_000);
    return () => window.clearInterval(t);
  }, []);

  const text = lines.map(plain).join("\n");
  return (
    <div className="adm-card bc-console">
      <div className="bc-console-bar">
        <span className="bc-console-title">
          <Terminal size={15} aria-hidden="true" /> Console
          <small>{paused ? "paused" : updatedAt ? `updated ${Math.max(0, Math.round((Date.now() - updatedAt) / 1000))}s ago` : "loading…"}</small>
        </span>
        <label className="bc-search">
          <Search size={14} aria-hidden="true" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter lines" aria-label="Filter console lines" />
        </label>
        <button type="button" className="bc-tool" onClick={() => setPaused(!paused)} aria-pressed={paused} title={paused ? "Resume" : "Pause updates"}>
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button
          type="button"
          className="bc-tool"
          title="Copy"
          onClick={() => {
            void navigator.clipboard?.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_200);
          }}
        >
          {copied ? "✓" : <Copy size={14} />}
        </button>
        <button
          type="button"
          className="bc-tool"
          title="Download"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
            const a = Object.assign(document.createElement("a"), { href: url, download: `${serverKey}-console-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.log` });
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={14} />
        </button>
      </div>
      <div className="bc-terminal" ref={box} onScroll={onScroll} role="log" aria-label={`${name} console`} aria-live="off">
        {!data && !error ? <p className="bc-empty">Connecting to the console…</p> : null}
        {error && !data ? <p className="bc-empty is-err">{error}</p> : null}
        {data && !shown.length ? <p className="bc-empty">{filter ? "No lines match." : state === "offline" ? "The bot is offline. Start it to see its console." : "No output yet."}</p> : null}
        {shown.map((l, i) => (
          <div key={i} className={`bc-line ${tone(l)}`}>
            <AnsiLine text={l} />
          </div>
        ))}
      </div>
      {!follow ? (
        <button type="button" className="bc-jump" onClick={() => setFollow(true)}>
          ↓ Jump to latest
        </button>
      ) : null}
      {error && data ? <p className="bc-msg is-err">Last update failed: {error}</p> : null}
    </div>
  );
}

function SetupCard() {
  return (
    <div className="adm-card bc-setup">
      <span className="bc-head-icon">
        <KeyRound size={20} />
      </span>
      <div>
        <h3>Connect SparkedHost</h3>
        <p className="adm-muted">The live consoles and the start / restart / stop buttons use SparkedHost&apos;s panel API (Issues and Resources below already work: the bots report those themselves). To turn it on:</p>
        <ol>
          <li>
            On <b>control.sparkedhost.us</b>, open <b>Account → API Credentials</b> and create a new key (description e.g. “Website consoles”).
          </li>
          <li>
            In Vercel → the site&apos;s <b>Settings → Environment Variables</b>, add <code>PTERO_API_KEY</code> with that key (Production), then redeploy.
          </li>
        </ol>
        <p className="adm-muted">Only admins can see this tab, and starting, stopping or restarting needs two-factor turned on. Every action is logged with who did it.</p>
      </div>
    </div>
  );
}

// ---------- Up to date? ----------
type VersionReport = { bot: string; reportedAt: string | null; startedAt: string | null; latestAt: string; outdated: string[]; missing: string[]; extra: string[]; total: number };

function VersionsView({ bot, name }: { bot: string; name: string }) {
  const { data, error } = useLive<{ bots: VersionReport[] }>("/api/admin/bots/versions", 30_000);
  const v = data?.bots.find((b) => b.bot === bot);
  const behind = v ? v.outdated.length + v.missing.length : 0;
  return (
    <div className="adm-card bc-versions">
      <h3>Is the {name} up to date?</h3>
      <p className="adm-muted">The bot reports a fingerprint of its code files when it starts (and every 15 minutes). Files listed here don&apos;t match the latest version yet: upload them, then restart the bot.</p>
      {error && !data ? <p className="adm-error">{error}</p> : null}
      {!data ? <div className="adm-skeleton" style={{ height: 120 }} /> : null}
      {v && !v.reportedAt ? <p className="bc-warn">This bot hasn&apos;t reported yet. Upload <code>events/fingerprint.py</code> and restart it once; after that this check works on its own.</p> : null}
      {v?.reportedAt ? (
        <>
          <p className={behind ? "bc-warn" : "bc-all-clear"}>
            {behind ? `${behind} file${behind === 1 ? "" : "s"} to upload` : `✓ All ${v.total} code files match the latest version.`}
            <small className="adm-muted">
              {" "}
              · checked {timeAgo(v.reportedAt)}
              {v.startedAt ? ` · running since ${new Date(v.startedAt).toLocaleString()}` : ""} · latest version from {new Date(v.latestAt).toLocaleString()}
            </small>
          </p>
          {v.outdated.length ? (
            <>
              <h4>Changed (upload these)</h4>
              <ul className="bc-files">
                {v.outdated.map((f) => (
                  <li key={f}>
                    <code>{f}</code>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {v.missing.length ? (
            <>
              <h4>New files (not on the server yet)</h4>
              <ul className="bc-files">
                {v.missing.map((f) => (
                  <li key={f}>
                    <code>{f}</code>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {v.extra.length ? (
            <details className="bc-extra">
              <summary>{v.extra.length} file{v.extra.length === 1 ? "" : "s"} on the server that aren&apos;t in the latest version</summary>
              <p className="adm-muted">Usually old leftovers. They&apos;re harmless unless the bot loads them (anything in cmds/ or events/ gets loaded).</p>
              <ul className="bc-files">
                {v.extra.map((f) => (
                  <li key={f}>
                    <code>{f}</code>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------- Uptime ----------
function UptimeView({ bot, name }: { bot: string; name: string }) {
  const [days, setDays] = useState(7);
  const { data, error } = useLive<{ days: { day: string; hours: { up: number; down: number }[] }[] }>(`/api/admin/bots/uptime?part=${bot}&days=${days}`, 60_000);
  const totals = (data?.days ?? []).flatMap((d) => d.hours).reduce((a, h) => ({ up: a.up + h.up, down: a.down + h.down }), { up: 0, down: 0 });
  const pct = totals.up + totals.down ? (totals.up / (totals.up + totals.down)) * 100 : null;
  return (
    <div className="adm-card bc-uptime">
      <div className="bc-uptime-head">
        <div>
          <h3>{name} uptime</h3>
          <p className="adm-muted">Each square is an hour. Green: up the whole hour · amber: down for part of it · red: down most of it · grey: no record.</p>
        </div>
        <select className="adm-select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={1}>Today</option>
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>
      {error && !data ? <p className="adm-error">{error}</p> : null}
      {pct !== null ? (
        <p>
          <b>{pct.toFixed(pct > 99.9 ? 2 : 1)}%</b> <span className="adm-muted">up over this period ({Math.round(totals.down)} minutes down)</span>
        </p>
      ) : null}
      <div className="bc-grid" role="img" aria-label={`Hourly uptime for the last ${days} days`}>
        {data?.days.map((d) => (
          <div key={d.day} className="bc-grid-row">
            <span className="bc-grid-day">{new Date(`${d.day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            {d.hours.map((h, i) => {
              const seen = h.up + h.down;
              const cls = !seen ? "is-none" : h.down === 0 ? "is-up" : h.down < seen / 2 ? "is-part" : "is-down";
              return <span key={i} className={`bc-cell ${cls}`} title={`${d.day} ${String(i).padStart(2, "0")}:00 UTC · ${seen ? `${h.up} min up, ${h.down} down` : "no record"}`} />;
            })}
          </div>
        ))}
      </div>
      <p className="adm-muted bc-grid-note">Hours are in UTC.</p>
    </div>
  );
}
