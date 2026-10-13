"use client";

// Admin → Bots → Consoles: each bot's SparkedHost server. Live state and resources, the console output, and
// start / restart / stop (two-factor required, every action logged).

import "./console-tab.css";
import { Copy, Download, KeyRound, Pause, Play, Power, RotateCw, Search, Skull, Square, Terminal } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ServerStatus } from "../../../lib/bot-console";
import { timeAgo, useLive } from "../admin-shared";

type Overview = {
  ok: boolean;
  error?: string;
  configured: boolean;
  servers: ServerStatus[];
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

export function ConsoleTab() {
  const { data, error, reload } = useLive<Overview>("/api/admin/bots/console", 5_000);
  const [selected, setSelected] = useState("main");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!data && error) return <p className="adm-error">Couldn&apos;t load the bot servers: {error}</p>;
  if (!data) return <div className="adm-skeleton" style={{ height: 480 }} />;
  if (!data.configured) return <SetupCard />;

  const server = data.servers.find((s) => s.key === selected) ?? data.servers[0];

  const power = async (signal: "start" | "stop" | "restart" | "kill") => {
    const warn: Record<string, string> = {
      stop: `Stop the ${server.name}? It stays offline until someone starts it again.`,
      restart: `Restart the ${server.name}? It's offline for a few seconds.`,
      kill: `Force-stop the ${server.name}? Like pulling the plug: anything it was saving may be lost. Use it only if Stop is stuck.`,
    };
    if (warn[signal] && !window.confirm(warn[signal])) return;
    setBusy(signal);
    setMsg(null);
    const r = await fetch(`/api/admin/bots/console/${server.key}/power`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signal }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(null);
    setMsg(r?.ok ? { ok: true, text: r.message } : { ok: false, text: r?.error ?? "Couldn't send that." });
    await reload();
  };

  return (
    <section className="bc">
      <div className="bc-servers" role="tablist" aria-label="Bots">
        {data.servers.map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={s.key === server.key} className={`bc-server${s.key === server.key ? " is-on" : ""}`} onClick={() => (setSelected(s.key), setMsg(null))}>
            <span className="bc-server-top">
              <b>{s.name}</b>
              <StateBadge s={s} />
            </span>
            {s.error ? (
              <small className="bc-server-err">{s.error}</small>
            ) : (
              <>
                <Meter label="CPU" value={s.cpu} max={s.cpuLimit ?? 100} text={s.cpu === null ? "—" : `${s.cpu.toFixed(1)}%`} />
                <Meter label="RAM" value={s.memory} max={s.memoryLimit} text={bytes(s.memory)} />
                <small className="bc-server-up">{s.state === "running" ? `Up ${uptime(s.uptimeMs)}` : STATE_TEXT[s.state]}</small>
              </>
            )}
          </button>
        ))}
      </div>

      <div className="bc-main">
        <div className="adm-card bc-head">
          <div className="bc-head-title">
            <span className={`bc-head-icon is-${server.state}`}>
              <Terminal size={20} />
            </span>
            <div>
              <h3>{server.name}</h3>
              <small>
                <StateBadge s={server} /> {server.state === "running" ? `· up ${uptime(server.uptimeMs)}` : ""} · RAM {bytes(server.memory)}
                {server.memoryLimit ? ` of ${bytes(server.memoryLimit)}` : ""} · disk {bytes(server.disk)}
              </small>
            </div>
          </div>
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
        </div>
        {msg ? (
          <p className={msg.ok ? "bc-msg is-ok" : "bc-msg is-err"} role="status">
            {msg.text}
          </p>
        ) : null}

        <ConsoleView key={server.key} serverKey={server.key} name={server.name} state={server.state} />

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
                    <b>{a.by || "Someone"}</b> {a.ok ? SIGNAL_TEXT[a.signal]?.toLowerCase() ?? a.signal : `tried to ${a.signal}`} the <b>{data.servers.find((s) => s.key === a.server)?.name ?? a.server}</b>
                  </span>
                  {a.ok ? null : <small className="bc-msg is-err">{a.error}</small>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="adm-muted">Nothing yet. Actions from here are listed with who did them.</p>
          )}
        </div>
      </div>
    </section>
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
        <p className="adm-muted">The consoles and power buttons use SparkedHost&apos;s panel API. This tab replaces the Discord console channel and /restartsystem. To turn it on:</p>
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
