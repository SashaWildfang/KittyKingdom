"use client";

import "./bots/bots.css";
import "./lockdown-tab.css";
import { AlertTriangle, Check, Clock, History, Lock, LockOpen, Megaphone, ShieldAlert, ShieldCheck, Siren, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import type { HistoryRow, LockRow, LockdownState } from "../../lib/lockdown";
import { LOCKDOWN_OPTION_LABELS, LOCKDOWN_PRESETS, LOCK_DURATIONS, type LockdownOptions } from "../../lib/lockdown-presets";
import { timeAgo, useLive } from "./admin-shared";
import { Picker, channelOptions, type Meta } from "./bots/pickers";

type Data = {
  ok: boolean;
  perms: { canLock: boolean; canLockdown: boolean };
  botOnline: boolean;
  lockdown: LockdownState;
  locks: LockRow[];
  history: HistoryRow[];
};
type Result = { ok: boolean; text: string; notes?: string[] };

async function act(body: Record<string, unknown>): Promise<Result> {
  try {
    const r = await fetch("/api/admin/lockdown", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({ ok: false, error: "Request failed." }));
    if (!r.ok || j.ok === false) return { ok: false, text: j.error ?? "Request failed." };
    let res = j as { id: string; status: string; result: string | null; notes: string[] };
    // Still waiting on the bot: keep checking for a little while
    for (let i = 0; i < 10 && res.status === "pending"; i++) {
      await new Promise((ok) => setTimeout(ok, 1500));
      const s = await fetch(`/api/admin/lockdown/${res.id}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (s?.ok) res = s;
    }
    if (res.status === "pending") return { ok: false, text: "The bot hasn't picked this up yet. Is the Moderation Bot online?" };
    return { ok: res.status === "done", text: res.result ?? (res.status === "done" ? "Done." : "The bot couldn't do that."), notes: res.notes };
  } catch {
    return { ok: false, text: "Request failed." };
  }
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

function left(iso: string | null, now: number) {
  if (!iso) return null;
  const s = Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

// Channel mentions in the bot's replies (<#123>) shown as #name
let channelName: (id: string) => string = (id) => id;
const pretty = (t: string) => t.replace(/<#(\d+)>/g, (_, id: string) => `#${channelName(id)}`);

function ResultNote({ r }: { r: Result | null }) {
  if (!r) return null;
  return (
    <div className={r.ok ? "ld-result is-ok" : "ld-result is-bad"} role="status">
      {r.ok ? <Check size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />}
      <span>
        {pretty(r.text)}
        {r.notes?.length ? (
          <ul>
            {r.notes.map((n, i) => (
              <li key={i}>{pretty(n)}</li>
            ))}
          </ul>
        ) : null}
      </span>
    </div>
  );
}

export function LockdownTab() {
  const { data, error, reload } = useLive<Data>("/api/admin/lockdown", 5_000);
  const [meta, setMeta] = useState<Meta | null>(null);
  const now = useNow();
  useEffect(() => {
    fetch("/api/admin/bots/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setMeta(r))
      .catch(() => undefined);
  }, []);
  const name = (id: string, fallback: string | null) => meta?.channels.find((c) => c.id === id)?.name ?? fallback ?? id;
  channelName = (id) => name(id, null);

  if (error && !data) return <p className="adm-error">{error}</p>;
  if (!data) return <div className="adm-skeleton" style={{ height: "18rem" }} />;

  return (
    <section className="adm-panel ld">
      {!data.botOnline ? (
        <p className="ld-warn">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            The Moderation Bot looks offline, so nothing here will happen until it&apos;s back. In Discord, <code>/lock</code> and <code>/lockdown</code> need it too.
          </span>
        </p>
      ) : null}
      {data.lockdown.active ? <ActiveLockdown data={data} now={now} onDone={reload} /> : <StartLockdown data={data} onDone={reload} />}
      <ChannelLocks data={data} meta={meta} now={now} name={name} onDone={reload} />
      <section className="ld-card">
        <h3>
          <History size={16} aria-hidden="true" /> History
        </h3>
        {!data.history.length ? <p className="adm-muted">Nothing yet. Ended locks and lockdowns show up here.</p> : null}
        <ul className="ld-history">
          {data.history.map((h) => (
            <li key={h.id}>
              <span className={`ld-hist-icon is-${h.kind}`}>{h.kind === "lockdown" ? <Siren size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}</span>
              <span className="ld-hist-main">
                <b>{h.name ?? "Channel"}</b>
                <small>
                  {h.byName ? `by ${h.byName}` : ""}
                  {h.reason ? ` · ${h.reason}` : ""}
                  {h.kicked ? ` · ${h.kicked} joins blocked` : ""}
                </small>
              </span>
              <span className="ld-hist-when">
                {h.startedAt && h.endedAt ? `${left(h.endedAt, new Date(h.startedAt).getTime())}` : ""}
                <small>
                  {h.how === "timer" ? "ended by timer" : h.how === "lockdown" ? "with the lockdown" : h.endedByName ? `ended by ${h.endedByName}` : "ended"} · {timeAgo(h.endedAt)}
                </small>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------- server lockdown
function StartLockdown({ data, onDone }: { data: Data; onDone: () => void }) {
  const [preset, setPreset] = useState("raid");
  const [opts, setOpts] = useState<LockdownOptions>(() => ({ ...LOCKDOWN_PRESETS.raid }));
  const [reason, setReason] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const pick = (k: string) => {
    setPreset(k);
    const { label: _l, about: _a, ...o } = LOCKDOWN_PRESETS[k];
    setOpts(o);
  };
  const start = async () => {
    setBusy(true);
    setRes(null);
    const r = await act({ action: "start", preset, options: opts, reason, seconds });
    setRes(r);
    setBusy(false);
    setConfirm(false);
    if (r.ok) setReason("");
    onDone();
  };
  const toggle = (k: keyof LockdownOptions) =>
    setOpts((o) => ({ ...o, [k]: k === "joinAction" ? (o.joinAction === "kick" ? "none" : "kick") : k === "slowmode" ? (o.slowmode ? 0 : 30) : !o[k] }));
  const isOn = (k: keyof LockdownOptions) => (k === "joinAction" ? opts.joinAction === "kick" : k === "slowmode" ? opts.slowmode > 0 : Boolean(opts[k]));

  return (
    <section className="ld-hero is-clear">
      <div className="ld-hero-head">
        <span className="ld-hero-icon">
          <ShieldCheck size={26} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">Server lockdown</p>
          <h2>All clear</h2>
          <p className="adm-muted">The server isn&apos;t in lockdown. If there&apos;s a raid or a spam wave, start one here or with /lockdown start in Discord.</p>
        </div>
      </div>
      {data.perms.canLockdown ? (
        <div className="ld-start">
          <div className="ld-presets" role="radiogroup" aria-label="Preset">
            {Object.entries(LOCKDOWN_PRESETS).map(([k, p]) => (
              <button key={k} type="button" role="radio" aria-checked={preset === k} className={preset === k ? "is-on" : undefined} onClick={() => pick(k)}>
                <b>{p.label}</b>
                <small>{p.about}</small>
              </button>
            ))}
          </div>
          <div className="ld-options">
            {LOCKDOWN_OPTION_LABELS.map((o) => (
              <label key={o.key} className={`ld-option${isOn(o.key) ? " is-on" : ""}`}>
                <input type="checkbox" checked={isOn(o.key)} onChange={() => toggle(o.key)} />
                <span>
                  <b>{o.label}</b>
                  <small>{o.about}</small>
                </span>
                {o.key === "slowmode" && opts.slowmode ? (
                  <select className="adm-select" value={opts.slowmode} onClick={(e) => e.preventDefault()} onChange={(e) => setOpts((x) => ({ ...x, slowmode: Number(e.target.value) }))}>
                    {[5, 10, 15, 30, 60, 120, 300, 600].map((s) => (
                      <option key={s} value={s}>
                        {s < 60 ? `${s}s` : `${s / 60}m`}
                      </option>
                    ))}
                  </select>
                ) : null}
              </label>
            ))}
          </div>
          <div className="ld-row">
            <label className="ld-field ld-grow">
              <span>Reason (members see this)</span>
              <input className="ld-input" value={reason} maxLength={300} placeholder="e.g. We're dealing with a raid, hang tight!" onChange={(e) => setReason(e.target.value)} />
            </label>
            <label className="ld-field">
              <span>Ends</span>
              <select className="adm-select" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
                {LOCK_DURATIONS.map(([l, s]) => (
                  <option key={s} value={s}>
                    {s ? `After ${l}` : "When someone ends it"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ResultNote r={res} />
          <div className="ld-actions">
            {confirm ? (
              <>
                <span className="ld-confirm-text">This announces the lockdown in Discord with a ping. Sure?</span>
                <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
                <button type="button" className="adm-btn adm-btn--small adm-btn--danger" disabled={busy} onClick={start}>
                  <Siren size={14} aria-hidden="true" /> {busy ? "Starting…" : "Yes, lock it down"}
                </button>
              </>
            ) : (
              <button type="button" className="adm-btn adm-btn--small adm-btn--danger" disabled={!reason.trim()} onClick={() => setConfirm(true)}>
                <Siren size={14} aria-hidden="true" /> Start lockdown
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="adm-muted">Only the roles in Admin → Bots → Moderation Bot → Command permissions (/lockdown) can start one.</p>
      )}
    </section>
  );
}

function ActiveLockdown({ data, now, onDone }: { data: Data; now: number; onDone: () => void }) {
  const l = data.lockdown;
  const [msg, setMsg] = useState("");
  const [post, setPost] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const run = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setRes(null);
    const r = await act(body);
    setRes(r);
    setBusy(null);
    if (r.ok && key === "update") setMsg("");
    setConfirmEnd(false);
    onDone();
  };
  const on = LOCKDOWN_OPTION_LABELS.filter((o) => (o.key === "joinAction" ? l.options?.joinAction === "kick" : o.key === "slowmode" ? Boolean(l.options?.slowmode) : Boolean(l.options?.[o.key])));

  return (
    <section className="ld-hero is-active">
      <div className="ld-hero-head">
        <span className="ld-hero-icon">
          <Siren size={26} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">Server lockdown</p>
          <h2>Lockdown is on</h2>
          <p>
            Started {timeAgo(l.startedAt)}
            {l.byName ? ` by ${l.byName}` : ""}
            {l.reason ? (
              <>
                {" "}
                · <i>{l.reason}</i>
              </>
            ) : null}
          </p>
        </div>
        <div className="ld-hero-stats">
          <span>
            <Timer size={14} aria-hidden="true" /> {l.until ? `ends in ${left(l.until, now)}` : "until someone ends it"}
          </span>
          <span>
            <ShieldAlert size={14} aria-hidden="true" /> {l.kicked} joins blocked
          </span>
        </div>
      </div>
      <div className="ld-chips">
        {on.map((o) => (
          <span key={o.key} className="ld-chip">
            {o.label}
            {o.key === "slowmode" ? ` (${l.options?.slowmode}s)` : ""}
          </span>
        ))}
      </div>
      {l.notes.length ? (
        <ul className="ld-notes">
          {l.notes.map((n, i) => (
            <li key={i}>
              <AlertTriangle size={13} aria-hidden="true" /> {n}
            </li>
          ))}
        </ul>
      ) : null}
      <ol className="ld-updates">
        {l.updates
          .slice()
          .reverse()
          .map((u, i) => (
            <li key={i}>
              <b>{u.msg}</b>
              <small>
                {u.byName ?? "Staff"} · {timeAgo(u.at)}
              </small>
            </li>
          ))}
      </ol>
      {data.perms.canLockdown ? (
        <>
          <div className="ld-row">
            <label className="ld-field ld-grow">
              <span>Post an update</span>
              <input className="ld-input" value={msg} maxLength={1000} placeholder="e.g. Raid accounts removed, reopening soon" onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && msg.trim() && run("update", { action: "update", message: msg, post })} />
            </label>
            <label className="ld-check">
              <input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} /> Also post it in announcements
            </label>
            <button type="button" className="adm-btn adm-btn--small" disabled={!msg.trim() || busy !== null} onClick={() => run("update", { action: "update", message: msg, post })}>
              <Megaphone size={14} aria-hidden="true" /> {busy === "update" ? "Posting…" : "Post"}
            </button>
          </div>
          <ResultNote r={res} />
          <div className="ld-actions">
            <label className="ld-field">
              <span>Timer</span>
              <select className="adm-select" value="" disabled={busy !== null} onChange={(e) => e.target.value !== "" && run("timer", { action: "lockdown-timer", seconds: Number(e.target.value) })}>
                <option value="">{l.until ? `Ends in ${left(l.until, now)}` : "No end time"}: change…</option>
                {LOCK_DURATIONS.map(([lbl, s]) => (
                  <option key={s} value={s}>
                    {s ? `End in ${lbl}` : "Keep it on until someone ends it"}
                  </option>
                ))}
              </select>
            </label>
            <span style={{ flex: 1 }} />
            {confirmEnd ? (
              <>
                <span className="ld-confirm-text">Everything goes back to how it was.</span>
                <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => setConfirmEnd(false)}>
                  Cancel
                </button>
                <button type="button" className="adm-btn adm-btn--small" disabled={busy !== null} onClick={() => run("end", { action: "end" })}>
                  <ShieldCheck size={14} aria-hidden="true" /> {busy === "end" ? "Ending…" : "Yes, end it"}
                </button>
              </>
            ) : (
              <button type="button" className="adm-btn adm-btn--small" onClick={() => setConfirmEnd(true)}>
                <ShieldCheck size={14} aria-hidden="true" /> End lockdown
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="adm-muted">Only the roles allowed to use /lockdown can update or end it.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------- channel locks
function ChannelLocks({ data, meta, now, name, onDone }: { data: Data; meta: Meta | null; now: number; name: (id: string, f: string | null) => string; onDone: () => void }) {
  const [channels, setChannels] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(1800);
  const [reason, setReason] = useState("");
  const [quiet, setQuiet] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const run = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setRes(null);
    const r = await act(body);
    setRes(r);
    setBusy(null);
    if (r.ok && key === "lock") {
      setChannels([]);
      setReason("");
    }
    onDone();
  };

  return (
    <section className="ld-card">
      <h3>
        <Lock size={16} aria-hidden="true" /> Locked channels <span className="ld-count">{data.locks.length}</span>
      </h3>
      <p className="adm-muted">Only staff can talk in a locked channel. Unlocking puts every permission back exactly how it was. Timers keep running through bot restarts.</p>
      {data.locks.length ? (
        <ul className="ld-locks">
          {data.locks.map((k) => (
            <li key={k.channelId}>
              <span className="ld-lock-icon">
                <Lock size={14} aria-hidden="true" />
              </span>
              <span className="ld-lock-main">
                <b>#{name(k.channelId, k.channelName)}</b>
                <small>
                  {k.byName ? `by ${k.byName}` : ""} · {timeAgo(k.startedAt)}
                  {k.lockdown ? " · part of the lockdown" : k.source === "website" ? " · from the website" : ""}
                  {k.reason ? ` · ${k.reason}` : ""}
                </small>
              </span>
              <span className="ld-lock-time">
                <Clock size={13} aria-hidden="true" /> {k.until ? `opens in ${left(k.until, now)}` : "until unlocked"}
              </span>
              {data.perms.canLock ? (
                <span className="ld-lock-actions">
                  <select className="adm-select" value="" aria-label="Change timer" disabled={busy !== null} onChange={(e) => e.target.value !== "" && run(`t${k.channelId}`, { action: "extend", channelIds: [k.channelId], seconds: Number(e.target.value) })}>
                    <option value="">Timer…</option>
                    {LOCK_DURATIONS.map(([lbl, s]) => (
                      <option key={s} value={s}>
                        {s ? `Open in ${lbl}` : "Until unlocked"}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="adm-btn adm-btn--tiny" disabled={busy !== null} onClick={() => run(`u${k.channelId}`, { action: "unlock", channelIds: [k.channelId] })}>
                    <LockOpen size={12} aria-hidden="true" /> {busy === `u${k.channelId}` ? "Unlocking…" : "Unlock"}
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ld-empty">
          <LockOpen size={16} aria-hidden="true" /> No channels are locked.
        </p>
      )}
      {data.locks.length > 1 && data.perms.canLock ? (
        <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" disabled={busy !== null} onClick={() => run("all", { action: "unlock", channelIds: data.locks.filter((k) => !k.lockdown).map((k) => k.channelId) })}>
          <LockOpen size={14} aria-hidden="true" /> Unlock all{data.locks.some((k) => k.lockdown) ? " (except the lockdown's)" : ""}
        </button>
      ) : null}

      {data.perms.canLock ? (
        <div className="ld-lock-form">
          <h4>Lock channels</h4>
          <div className="ld-row">
            <div className="ld-field ld-grow">
              <span>Channels or categories</span>
              <Picker kind="channel" multiple value={channels} options={channelOptions(meta, "mixed")} placeholder="Pick channels (a category locks everything in it)" onChange={(v) => setChannels((v as string[]) ?? [])} />
            </div>
          </div>
          <div className="ld-row">
            <label className="ld-field">
              <span>For</span>
              <select className="adm-select" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
                {LOCK_DURATIONS.map(([l, s]) => (
                  <option key={s} value={s}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="ld-field ld-grow">
              <span>Reason (shown in the channel)</span>
              <input className="ld-input" value={reason} maxLength={300} placeholder="Optional" onChange={(e) => setReason(e.target.value)} />
            </label>
            <label className="ld-check">
              <input type="checkbox" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} /> Quiet (no notice in the channel)
            </label>
          </div>
          <ResultNote r={res} />
          <div className="ld-actions">
            <button type="button" className="adm-btn adm-btn--small" disabled={!channels.length || busy !== null} onClick={() => run("lock", { action: "lock", channelIds: channels, seconds, reason, notice: !quiet })}>
              <Lock size={14} aria-hidden="true" /> {busy === "lock" ? "Locking…" : `Lock ${channels.length > 1 ? `${channels.length} channels` : "channel"}`}
            </button>
          </div>
        </div>
      ) : (
        <>
          <ResultNote r={res} />
          <p className="adm-muted">Jr Mods and up can lock channels (Admin → Bots → Moderation Bot → Command permissions → /lock).</p>
        </>
      )}
    </section>
  );
}
