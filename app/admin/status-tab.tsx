"use client";

import "./status-tab.css";
import { ArrowUpRight, CheckCircle2, Megaphone, Send, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import type { Incident, IncidentStatus, PartKey, StatusView } from "../../lib/status";
import { formatDate, timeAgo, useLive } from "./admin-shared";

const PARTS: [PartKey, string][] = [
  ["website", "Website"],
  ["database", "Database"],
  ["main", "Zeo (Main Bot)"],
  ["economy", "Economy Bot"],
  ["moderation", "Moderation Bot"],
  ["ticketing", "Ticket Bot"],
  ["discord", "Discord"],
];
const STEPS: [IncidentStatus, string][] = [
  ["investigating", "Investigating"],
  ["identified", "Identified"],
  ["monitoring", "Monitoring"],
  ["resolved", "Resolved"],
];
const HEALTH_LABEL = { up: "Operational", degraded: "Problems", down: "Outage", unknown: "No data" } as const;

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    .then((x) => x.json())
    .catch(() => null);
  if (!r?.ok) throw new Error(r?.error ?? "Something went wrong.");
  return r;
}

/** Admin → Overview → Status: what status.kittykingdom.net shows, and posting incidents/maintenance. */
export function StatusTab() {
  const { data: live } = useLive<StatusView & { ok: boolean }>("/api/status", 30_000);
  const { data, error, reload } = useLive<{ ok: boolean; incidents: Incident[] }>("/api/admin/status", 0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ title: "", impact: "minor", status: "investigating", parts: [] as PartKey[], text: "", scheduledFor: "", scheduledUntil: "" });
  const [busy, setBusy] = useState(false);
  const scheduled = form.status === "scheduled";

  const create = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await send("/api/admin/status", "POST", {
        ...form,
        impact: scheduled ? "maintenance" : form.impact,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : null,
        scheduledUntil: form.scheduledUntil ? new Date(form.scheduledUntil).toISOString() : null,
      });
      setForm({ title: "", impact: "minor", status: "investigating", parts: [], text: "", scheduledFor: "", scheduledUntil: "" });
      setMsg({ ok: true, text: "Posted. It's on the status page now." });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const open = (data?.incidents ?? []).filter((i) => !i.resolvedAt);
  const closed = (data?.incidents ?? []).filter((i) => i.resolvedAt);

  return (
    <section className="adm-panel stt">
      <div className="adm-card stt-live">
        <div className="stt-live-head">
          <h3>Right now</h3>
          <a className="adm-btn adm-btn--ghost adm-btn--small" href="https://status.kittykingdom.net" target="_blank" rel="noreferrer">
            Open the status page <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </div>
        <ul className="stt-parts">
          {(live?.parts ?? []).map((p) => (
            <li key={p.key} className={`is-${p.health}`}>
              <i aria-hidden="true" />
              <b>{p.name}</b>
              <small>
                {p.health === "up" ? HEALTH_LABEL.up : p.detail}
                {p.ms !== null ? ` · ${p.ms} ms` : ""}
              </small>
              <span>{p.uptime90 === null ? "—" : `${(p.uptime90 * 100).toFixed(2)}%`}</span>
            </li>
          ))}
        </ul>
        <p className="adm-muted stt-note">Bots check in every minute; the Main Bot also checks the website and database. Uptime is over the last 90 days.</p>
      </div>

      <div className="adm-card stt-form">
        <h3>
          <Megaphone size={16} aria-hidden="true" /> Post an incident or maintenance
        </h3>
        <div className="adm-seg" role="tablist" aria-label="Kind">
          <button type="button" className={!scheduled ? "is-active" : undefined} onClick={() => setForm({ ...form, status: "investigating" })}>
            Something&apos;s wrong
          </button>
          <button type="button" className={scheduled ? "is-active" : undefined} onClick={() => setForm({ ...form, status: "scheduled" })}>
            <Wrench size={13} aria-hidden="true" /> Planned maintenance
          </button>
        </div>
        <label className="stt-field">
          <span>Title</span>
          <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={scheduled ? "Bot maintenance" : "Economy Bot isn't responding"} />
        </label>
        <div className="stt-field">
          <span>What&apos;s affected</span>
          <div className="stt-chips">
            {PARTS.map(([k, label]) => (
              <button key={k} type="button" className={form.parts.includes(k) ? "is-on" : undefined} onClick={() => setForm({ ...form, parts: form.parts.includes(k) ? form.parts.filter((x) => x !== k) : [...form.parts, k] })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {scheduled ? (
          <div className="stt-row">
            <label className="stt-field">
              <span>Starts</span>
              <input type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
            </label>
            <label className="stt-field">
              <span>Ends (optional)</span>
              <input type="datetime-local" value={form.scheduledUntil} onChange={(e) => setForm({ ...form, scheduledUntil: e.target.value })} />
            </label>
          </div>
        ) : (
          <div className="stt-row">
            <label className="stt-field">
              <span>How bad</span>
              <select className="adm-select" value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })}>
                <option value="minor">Partly working (yellow)</option>
                <option value="major">Not working (red)</option>
              </select>
            </label>
            <label className="stt-field">
              <span>Stage</span>
              <select className="adm-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STEPS.filter(([k]) => k !== "resolved").map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <label className="stt-field">
          <span>Message for members</span>
          <textarea rows={3} maxLength={2000} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder={scheduled ? "The bots will restart a few times while we update them." : "We know about it and are looking into it."} />
        </label>
        <div className="stt-actions">
          {msg ? <span className={msg.ok ? "stt-ok" : "adm-error"}>{msg.text}</span> : <span />}
          <button type="button" className="adm-btn adm-btn--small" disabled={busy} onClick={create}>
            <Send size={13} aria-hidden="true" /> {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {error ? <p className="adm-error">{error}</p> : null}
      <div className="stt-list">
        <h3>Open ({open.length})</h3>
        {open.length ? open.map((i) => <IncidentAdmin key={i.id} i={i} onChanged={reload} />) : <p className="adm-muted">Nothing open.</p>}
        <h3>Resolved</h3>
        {closed.length ? closed.slice(0, 20).map((i) => <IncidentAdmin key={i.id} i={i} onChanged={reload} />) : <p className="adm-muted">None yet.</p>}
      </div>
    </section>
  );
}

function IncidentAdmin({ i, onChanged }: { i: Incident; onChanged: () => void }) {
  const [status, setStatus] = useState<IncidentStatus>(i.status === "scheduled" ? "investigating" : i.status);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setText("");
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className={`adm-card stt-inc is-${i.resolvedAt ? "resolved" : i.status === "scheduled" ? "maintenance" : i.impact}`}>
      <header>
        <b>{i.title}</b>
        <small className="adm-muted">
          {i.status === "scheduled" ? `Scheduled ${formatDate(i.scheduledFor)}` : `Started ${timeAgo(i.startedAt)}`}
          {i.resolvedAt ? ` · resolved ${timeAgo(i.resolvedAt)}` : ""} · {i.parts.join(", ")}
        </small>
      </header>
      <ol>
        {i.updates.map((u, n) => (
          <li key={n}>
            <b>{u.status}</b> {u.text} <time>{formatDate(u.at)}</time>
          </li>
        ))}
      </ol>
      <div className="stt-update">
        <select className="adm-select" value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus)}>
          {STEPS.map(([k, l]) => (
            <option key={k} value={k}>
              {k === "investigating" && i.status === "scheduled" ? "Start now (in progress)" : l}
            </option>
          ))}
        </select>
        <input value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder={status === "resolved" ? "It's fixed. Thanks for your patience!" : "What's new?"} />
        <button type="button" className="adm-btn adm-btn--small" disabled={busy || !text.trim()} onClick={() => run(() => send(`/api/admin/status/${i.id}`, "PATCH", { status, text }))}>
          {status === "resolved" ? <CheckCircle2 size={13} aria-hidden="true" /> : <Send size={13} aria-hidden="true" />} Update
        </button>
        {confirm ? (
          <button type="button" className="adm-btn adm-btn--danger adm-btn--small" disabled={busy} onClick={() => run(() => send(`/api/admin/status/${i.id}`, "DELETE"))}>
            Delete for good
          </button>
        ) : (
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" aria-label="Delete" onClick={() => setConfirm(true)}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {err ? <p className="adm-error">{err}</p> : null}
    </article>
  );
}
