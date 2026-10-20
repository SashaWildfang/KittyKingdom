"use client";

import "./bots/bots.css";
import "./chat-events-tab.css";
import {
  Brain,
  Calculator,
  CalendarDays,
  Check,
  Flower2,
  Grid2x2,
  Hand,
  Hash,
  History,
  Keyboard,
  Leaf,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Shuffle,
  Snowflake,
  Sparkles,
  Sun,
  Ticket,
  Trash2,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ChatEventRow, ChatEventsView, RunRow } from "../../lib/chat-events/store";
import { EVENT_SEASONS, EVENT_TYPES, outcomeChances, rangeLabel, type ChatEvent, type ChatEventSettings, type EventSeason, type EventType, type Outcome, type Question, type Range, type Reward } from "../../lib/chat-events/types";
import { timeAgo, useLive } from "./admin-shared";
import { Picker, channelOptions, roleOptions, type Meta } from "./bots/pickers";
import { useCurrency } from "../season-context";
import { CurrencyAmount, LeafEmote, XpAmount } from "../ui-icons";

type Data = ChatEventsView & { ok: boolean; canEdit: boolean };

const SEASON_ICON: Record<string, LucideIcon> = { Leaf, Snowflake, Flower2, Sun, CalendarDays };
const TYPE_ICON: Record<string, LucideIcon> = { Hand, Shuffle, Grid2x2, Ticket, Users, Keyboard, Brain, Hash, Calculator };

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: "Request failed." }));
  if (!r.ok || j.ok === false) throw new Error(j.error ?? "Request failed.");
  return j;
}

function Overlay({ children }: { children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return createPortal(children, document.body);
}

/** Escape closes the dialog or drawer (a picker's own menu catches Escape first). */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const esc = (k: KeyboardEvent) => k.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
}

/** Which seasons' events can run right now (mirrors current_seasons() in the bot). */
function liveSeasons(s: ChatEventSettings, season: string): Set<string> {
  const keys = new Set<string>(s.seasonMode === "all" ? ["spring", "summer", "fall", "winter"] : [s.seasonMode === "auto" ? season : s.seasonMode]);
  if (s.includeAllYear || s.seasonMode === "all") keys.add("any");
  return keys;
}

export function ChatEventsTab() {
  const { data, error, reload } = useLive<Data>("/api/admin/chat-events", 10_000);
  const cur = useCurrency();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [season, setSeason] = useState<EventSeason | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ChatEventRow | null>(null);
  const [running, setRunning] = useState<ChatEventRow | "random" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/bots/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setMeta(r))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (data && !season) setSeason(data.season.key as EventSeason);
  }, [data, season]);

  const live = useMemo(() => (data ? liveSeasons(data.settings, data.season.key) : new Set<string>()), [data]);
  const pool = useMemo(() => (data ? data.events.filter((e) => e.enabled && live.has(e.season) && e.weight > 0) : []), [data, live]);
  const poolWeight = pool.reduce((s, e) => s + e.weight, 0) || 1;
  const shown = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.events.filter((e) => (needle ? `${e.name} ${e.title} ${EVENT_TYPES[e.type].label}`.toLowerCase().includes(needle) : e.season === season));
  }, [data, season, q]);
  const channelName = (id: string) => meta?.channels.find((c) => c.id === id)?.name ?? null;

  if (error && !data) return <p className="adm-error">{error}</p>;
  if (!data) return <div className="adm-skeleton" style={{ height: "18rem" }} />;

  const synced = data.appliedVersion !== null && data.appliedVersion >= data.version;
  const botUp = data.botSeenAt && Date.now() - new Date(data.botSeenAt).getTime() < 90_000;

  return (
    <section className="adm-panel ce">
      <header className="ce-head">
        <div>
          <p className="eyebrow">Chat events</p>
          <h2>Seasonal chat events</h2>
          <p className="adm-muted">
            The Economy Bot drops these into busy chats. Right now it picks from{" "}
            <b>{data.settings.seasonMode === "auto" ? `${data.season.name} events` : data.settings.seasonMode === "all" ? "every season" : `${EVENT_SEASONS.find((s) => s.key === data.settings.seasonMode)?.label} events`}</b>
            {live.has("any") ? " and the all-year ones" : ""}. Rewards are paid in {cur.many}.
          </p>
        </div>
        <div className="ce-head-actions">
          <span className={`ce-bot ${botUp ? (synced ? "is-ok" : "is-wait") : "is-off"}`}>
            <i aria-hidden="true" />
            {!botUp ? "Bot offline" : synced ? "Live in the bot" : "Bot picking up changes…"}
          </span>
          <button type="button" className="adm-btn adm-btn--small" onClick={() => setRunning("random")} disabled={!pool.length}>
            <Zap size={14} aria-hidden="true" /> Run a random one
          </button>
          {data.canEdit ? (
            <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => setShowSettings(true)}>
              <Settings size={14} aria-hidden="true" /> Settings
            </button>
          ) : null}
        </div>
      </header>

      {!data.settings.enabled ? <p className="ce-warn">Chat events are switched off, so none pop up by themselves. You can still run them by hand.</p> : null}

      <div className="adm-kpis ce-kpis">
        <div className="adm-kpi adm-kpi--orange">
          <small>On right now</small>
          <strong>{pool.length}</strong>
          <span>events the bot can pick</span>
        </div>
        <div className="adm-kpi">
          <small>Ran (30 days)</small>
          <strong>{data.totals.runs.toLocaleString()}</strong>
          <span>{data.totals.players.toLocaleString()} plays</span>
        </div>
        <div className="adm-kpi adm-kpi--blue">
          <small>Members who played</small>
          <strong>{data.totals.people.toLocaleString()}</strong>
          <span>different people, 30 days</span>
        </div>
        <div className="adm-kpi adm-kpi--green">
          <small>{cur.many} paid out</small>
          <strong>{data.totals.leaves.toLocaleString()}</strong>
          <span><XpAmount n={data.totals.xp} size={14} /> · 30 days</span>
        </div>
      </div>

      <div className="ce-toolbar">
        <div className="adm-seg" role="tablist" aria-label="Season">
          {EVENT_SEASONS.map((s) => {
            const Icon = SEASON_ICON[s.icon];
            const count = data.events.filter((e) => e.season === s.key).length;
            return (
              <button key={s.key} type="button" role="tab" aria-selected={!q && season === s.key} className={!q && season === s.key ? "is-active" : undefined} onClick={() => (setSeason(s.key), setQ(""))}>
                <Icon size={14} aria-hidden="true" /> {s.label}
                <span className="ce-count">{count}</span>
                {live.has(s.key) ? <span className="ce-live-dot" title="Running now" /> : null}
              </button>
            );
          })}
        </div>
        <label className="adm-search">
          <Search size={15} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every event" />
        </label>
        {data.canEdit ? (
          <button type="button" className="adm-btn adm-btn--small" onClick={() => setCreating(true)}>
            <Plus size={14} aria-hidden="true" /> New event
          </button>
        ) : null}
      </div>

      {season && !q && !live.has(season) ? (
        <p className="adm-muted ce-note">These aren&apos;t running right now ({data.settings.seasonMode === "auto" ? `it's ${data.season.name}` : "the season is set in Settings"}). They switch on by themselves when their season comes round. You can still run them by hand to try them.</p>
      ) : null}

      <ul className="ce-grid">
        {shown.map((e) => {
          const Icon = TYPE_ICON[EVENT_TYPES[e.type].icon] ?? Sparkles;
          const st = data.stats[e.id];
          const inPool = pool.includes(e);
          return (
            <li key={e.id} className={`ce-card${e.enabled ? "" : " is-off"}`} style={{ ["--ce" as string]: e.color }}>
              <button type="button" className="ce-card-main" onClick={() => setEditing(e)}>
                <span className="ce-emoji" aria-hidden="true">
                  <Emoji value={e.emoji} />
                </span>
                <span className="ce-card-body">
                  <span className="ce-card-title">
                    <b>{e.name}</b>
                    {!e.enabled ? <span className="ce-tag">Off</span> : inPool ? <span className="ce-tag is-live">Live · {Math.round((100 * e.weight) / poolWeight)}%</span> : null}
                    {!e.builtIn ? <span className="ce-tag is-custom">Custom</span> : e.changed ? <span className="ce-tag">Edited</span> : null}
                  </span>
                  <span className="ce-card-type">
                    <Icon size={13} aria-hidden="true" /> {EVENT_TYPES[e.type].label} · {e.seconds}s
                  </span>
                  <span className="ce-card-reward"><CurrencyAmount text={rewardSummary(e, cur.many)} size={14} /></span>
                  <span className="ce-card-stats">{st ? `Ran ${st.runs}× · ${st.players} plays · last ${timeAgo(st.last)}` : "Hasn't run in the last 30 days"}</span>
                </span>
              </button>
              <div className="ce-card-actions">
                <button type="button" className="adm-btn adm-btn--tiny" onClick={() => setRunning(e)}>
                  <Play size={12} aria-hidden="true" /> Run now
                </button>
                <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost" onClick={() => setEditing(e)}>
                  <Pencil size={12} aria-hidden="true" /> {data.canEdit ? "Edit" : "View"}
                </button>
              </div>
            </li>
          );
        })}
        {!shown.length ? <li className="adm-muted ce-empty">No events here.</li> : null}
      </ul>

      <section className="ce-runs">
        <h3>
          <History size={16} aria-hidden="true" /> Recent events
        </h3>
        {!data.runs.length ? <p className="adm-muted">Nothing has run yet. Events show up here as soon as they finish.</p> : null}
        <ul>
          {data.runs.map((r) => (
            <RunItem key={r.id} r={r} open={openRun === r.id} onToggle={() => setOpenRun(openRun === r.id ? null : r.id)} channel={r.channelName ?? channelName(r.channelId)} many={cur.many} />
          ))}
        </ul>
      </section>

      {editing ? <Editor event={editing} canEdit={data.canEdit} many={cur.many} onClose={() => setEditing(null)} onSaved={() => (reload(), setEditing(null))} onRun={() => (setRunning(editing), setEditing(null))} /> : null}
      {running ? <RunDialog event={running} meta={meta} data={data} onClose={() => setRunning(null)} onDone={reload} /> : null}
      {showSettings ? <SettingsDrawer data={data} meta={meta} onClose={() => setShowSettings(false)} onSaved={() => (reload(), setShowSettings(false))} /> : null}
      {creating ? (
        <CreateDialog
          season={season ?? "any"}
          onClose={() => setCreating(false)}
          onCreated={(e) => {
            setCreating(false);
            setSeason(e.season);
            setQ("");
            reload();
            setEditing({ ...e, builtIn: false, changed: true });
          }}
        />
      ) : null}
    </section>
  );
}

function Emoji({ value }: { value: string }) {
  const m = /^<(a?):\w+:(\d+)>$/.exec(value);
  if (m) return <img src={`https://cdn.discordapp.com/emojis/${m[2]}.${m[1] ? "gif" : "png"}?size=64`} alt="" width={26} height={26} />;
  return <>{value}</>;
}

function rewardSummary(e: ChatEvent, many: string) {
  if (e.type === "draw") {
    const o = e.outcomes ?? [];
    const best = Math.max(0, ...o.map((x) => x.leaves[1]));
    const worst = Math.min(0, ...o.map((x) => x.leaves[0]));
    return `${o.length} outcomes · up to ${best.toLocaleString()} 🍁${worst < 0 ? ` · can lose ${Math.abs(worst)} 🍁` : ""}`;
  }
  const r = e.reward;
  if (!r) return "";
  const parts = [r.leaves[1] ? `${rangeLabel(r.leaves)} 🍁` : "", r.xp[1] ? `${rangeLabel(r.xp)} XP` : ""].filter(Boolean);
  const who = e.type === "raffle" ? `${e.winners} winners get ` : e.type === "goal" ? "every helper gets " : e.type === "trivia" || e.type === "pick" ? "each winner gets " : "";
  return `${who}${parts.join(" + ") || "nothing"}`;
}

function RunItem({ r, open, onToggle, channel, many }: { r: RunRow; open: boolean; onToggle: () => void; channel: string | null; many: string }) {
  return (
    <li className={`ce-run${open ? " is-open" : ""}`}>
      <button type="button" onClick={onToggle}>
        <span className="ce-run-name">
          <b>{r.name}</b>
          <small>
            #{channel ?? r.channelId} · {timeAgo(r.startedAt)}{r.trigger === "manual" ? " · run by staff" : ""}
          </small>
        </span>
        <span className="ce-run-stat">
          <Users size={13} aria-hidden="true" /> {r.players}
        </span>
        <span className={`ce-run-stat ${r.totalLeaves < 0 ? "is-neg" : "is-pos"}`}>
          {r.totalLeaves >= 0 ? "+" : ""}
          {r.totalLeaves.toLocaleString()} <LeafEmote size={14} />
        </span>
      </button>
      {open ? (
        <ul className="ce-run-results">
          {r.results.length ? (
            r.results.map((x, i) => (
              <li key={i}>
                <span>{x.name}</span>
                {x.text ? <small>{x.text}</small> : null}
                <b className={x.leaves < 0 || x.xp < 0 ? "is-neg" : "is-pos"}>
                  <CurrencyAmount text={[x.leaves ? `${x.leaves > 0 ? "+" : ""}${x.leaves.toLocaleString()} 🍁` : "", x.xp ? `${x.xp > 0 ? "+" : ""}${x.xp} XP` : ""].filter(Boolean).join(" · ") || "nothing"} size={13} />
                </b>
              </li>
            ))
          ) : (
            <li className="adm-muted">Nobody won anything.</li>
          )}
        </ul>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------------------------------- editor
/** A labelled field. Pickers use `box` (a plain div): inside a <label>, a click on the field would also press
 *  the first button in it (a chip's remove ×). */
function Field({ label, help, children, wide, box }: { label: string; help?: string; children: ReactNode; wide?: boolean; box?: boolean }) {
  const Tag = box ? "div" : "label";
  return (
    <Tag className={`ce-field${wide ? " is-wide" : ""}`}>
      <span>{label}</span>
      {children}
      {help ? <small>{help}</small> : null}
    </Tag>
  );
}

function Num({ value, onChange, min, max, disabled }: { value: number; onChange: (n: number) => void; min?: number; max?: number; disabled?: boolean }) {
  return <input type="number" className="adm-input" value={Number.isFinite(value) ? value : 0} min={min} max={max} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />;
}

function RangeInput({ value, onChange, disabled, negative }: { value: Range; onChange: (r: Range) => void; disabled?: boolean; negative?: boolean }) {
  const lo = negative ? -100000 : 0;
  return (
    <span className="ce-range">
      <Num value={value[0]} min={lo} max={100000} disabled={disabled} onChange={(n) => onChange([n, value[1]])} />
      <i>to</i>
      <Num value={value[1]} min={lo} max={100000} disabled={disabled} onChange={(n) => onChange([value[0], n])} />
    </span>
  );
}

function RewardInput({ value, onChange, disabled, many, negative }: { value: Reward; onChange: (r: Reward) => void; disabled?: boolean; many: string; negative?: boolean }) {
  return (
    <div className="ce-reward">
      <Field label={many}>
        <RangeInput value={value.leaves} negative={negative} disabled={disabled} onChange={(leaves) => onChange({ ...value, leaves })} />
      </Field>
      <Field label="XP">
        <RangeInput value={value.xp} negative={negative} disabled={disabled} onChange={(xp) => onChange({ ...value, xp })} />
      </Field>
    </div>
  );
}

function Editor({ event, canEdit, many, onClose, onSaved, onRun }: { event: ChatEventRow; canEdit: boolean; many: string; onClose: () => void; onSaved: () => void; onRun: () => void }) {
  const [e, setE] = useState<ChatEvent>(() => structuredClone(event));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const set = <K extends keyof ChatEvent>(k: K, v: ChatEvent[K]) => setE((x) => ({ ...x, [k]: v }));
  const f = EVENT_TYPES[e.type].fields;
  const off = !canEdit;
  const dirty = JSON.stringify(e) !== JSON.stringify(structuredClone(event));

  useEscape(onClose);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await send(`/api/admin/chat-events/${encodeURIComponent(e.id)}`, "PUT", { event: e });
      onSaved();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    try {
      await send(`/api/admin/chat-events/${encodeURIComponent(e.id)}`, "DELETE");
      onSaved();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Couldn't reset.");
      setBusy(false);
    }
  };

  return (
    <Overlay>
      <div className="adm-drawer-backdrop" onMouseDown={(x) => x.target === x.currentTarget && onClose()}>
        <aside className="adm-drawer ce-drawer" role="dialog" aria-label={e.name} style={{ ["--ce" as string]: e.color }}>
          <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
          <div className="ce-drawer-head">
            <span className="ce-emoji is-big" aria-hidden="true">
              <Emoji value={e.emoji} />
            </span>
            <div>
              <p className="eyebrow">
                {EVENT_TYPES[e.type].label} · {EVENT_SEASONS.find((s) => s.key === e.season)?.label}
              </p>
              <h2>{e.name}</h2>
              <p className="adm-muted">{EVENT_TYPES[e.type].about}</p>
            </div>
          </div>

          <div className="adm-drawer-section ce-form">
            <label className="ce-switch">
              <input type="checkbox" checked={e.enabled} disabled={off} onChange={(x) => set("enabled", x.target.checked)} />
              <span>{e.enabled ? "On: it can pop up in chat" : "Off: it only runs when staff start it"}</span>
            </label>
            <Field label="Name">
              <input className="adm-input" value={e.name} maxLength={60} disabled={off} onChange={(x) => set("name", x.target.value)} />
            </Field>
            <Field label="Emoji" help="An emoji, or a server emoji like <:name:id>">
              <input className="adm-input" value={e.emoji} maxLength={64} disabled={off} onChange={(x) => set("emoji", x.target.value)} />
            </Field>
            <Field label="Colour">
              <input type="color" className="ce-color" value={e.color} disabled={off} onChange={(x) => set("color", x.target.value)} />
            </Field>
            <Field label="Season">
              <select className="adm-select" value={e.season} disabled={off} onChange={(x) => set("season", x.target.value as EventSeason)}>
                {EVENT_SEASONS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="How often" help="Compared with the other events on at the same time. 0 = never by itself.">
              <Num value={e.weight} min={0} max={100} disabled={off} onChange={(n) => set("weight", n)} />
            </Field>
            <Field label="Seconds to play">
              <Num value={e.seconds} min={5} max={900} disabled={off} onChange={(n) => set("seconds", n)} />
            </Field>
            <Field label="Title" wide>
              <input className="adm-input" value={e.title} maxLength={200} disabled={off} onChange={(x) => set("title", x.target.value)} />
            </Field>
            <Field label="Message" wide help="Can use {reward} {seconds} {goal} {winners} {min} {max}">
              <textarea className="adm-input" rows={3} value={e.text} maxLength={1500} disabled={off} onChange={(x) => set("text", x.target.value)} />
            </Field>
            {f.includes("button") ? (
              <Field label="Button">
                <input className="adm-input" value={e.button ?? ""} maxLength={80} disabled={off} onChange={(x) => set("button", x.target.value)} />
              </Field>
            ) : null}
            {f.includes("winners") ? (
              <Field label="Winners">
                <Num value={e.winners ?? 3} min={1} max={25} disabled={off} onChange={(n) => set("winners", n)} />
              </Field>
            ) : null}
            {f.includes("goal") ? (
              <>
                <Field label="Clicks needed">
                  <Num value={e.goal ?? 25} min={1} max={1000} disabled={off} onChange={(n) => set("goal", n)} />
                </Field>
                <Field label="Most clicks per person" help="So a few people can't do it alone. 0 = no limit.">
                  <Num value={e.maxPerUser ?? 6} min={0} max={1000} disabled={off} onChange={(n) => set("maxPerUser", n)} />
                </Field>
              </>
            ) : null}
            {f.includes("min") ? (
              <>
                <Field label="Lowest number">
                  <Num value={e.min ?? 1} disabled={off} onChange={(n) => set("min", n)} />
                </Field>
                <Field label="Highest number">
                  <Num value={e.max ?? 100} disabled={off} onChange={(n) => set("max", n)} />
                </Field>
              </>
            ) : null}
            {f.includes("difficulty") ? (
              <Field label="Difficulty">
                <select className="adm-select" value={e.difficulty ?? "normal"} disabled={off} onChange={(x) => set("difficulty", x.target.value as ChatEvent["difficulty"])}>
                  <option value="easy">Easy (adding and taking away)</option>
                  <option value="normal">Normal (two-digit sums, times tables)</option>
                  <option value="hard">Hard (a × b + c)</option>
                </select>
              </Field>
            ) : null}
            {f.includes("winText") ? (
              <Field label="Win message" wide help={e.type === "pick" ? "Can use {answer}" : e.type === "goal" ? "Can use {players} {reward}" : "Can use {user} {time} {reward}"}>
                <input className="adm-input" value={e.winText ?? ""} maxLength={500} disabled={off} onChange={(x) => set("winText", x.target.value)} />
              </Field>
            ) : null}
            {f.includes("missText") ? (
              <Field label={e.type === "pick" ? "Message for wrong picks" : "If nobody wins"} wide>
                <input className="adm-input" value={e.missText ?? ""} maxLength={500} disabled={off} onChange={(x) => set("missText", x.target.value)} />
              </Field>
            ) : null}
          </div>

          {f.includes("reward") ? (
            <div className="adm-drawer-section">
              <h3>{e.type === "goal" ? "Every helper gets (if they make it)" : e.type === "raffle" ? "Each winner gets" : "Reward"}</h3>
              <RewardInput value={e.reward ?? { leaves: [0, 0], xp: [0, 0] }} many={many} disabled={off} onChange={(r) => set("reward", r)} />
            </div>
          ) : null}
          {f.includes("miss") ? (
            <div className="adm-drawer-section">
              <h3>Wrong picks get</h3>
              <p className="adm-muted">Use minus numbers to take some away.</p>
              <RewardInput value={e.miss ?? { leaves: [0, 0], xp: [0, 0] }} many={many} negative disabled={off} onChange={(r) => set("miss", r)} />
            </div>
          ) : null}
          {f.includes("outcomes") ? <OutcomesEditor value={e.outcomes ?? []} many={many} disabled={off} onChange={(o) => set("outcomes", o)} /> : null}
          {f.includes("options") ? <OptionsEditor value={e.options ?? []} disabled={off} onChange={(o) => set("options", o)} /> : null}
          {f.includes("questions") ? <QuestionsEditor value={e.questions ?? []} disabled={off} onChange={(o) => set("questions", o)} /> : null}
          {f.includes("words") || f.includes("phrases") ? (
            <div className="adm-drawer-section">
              <h3>{f.includes("words") ? "Words" : "Phrases"}</h3>
              <p className="adm-muted">One per line. A random one is picked each time.</p>
              <textarea
                className="adm-input ce-lines"
                rows={8}
                disabled={off}
                value={(f.includes("words") ? e.words : e.phrases)?.join("\n") ?? ""}
                onChange={(x) => set(f.includes("words") ? "words" : "phrases", x.target.value.split("\n"))}
              />
              <small className="adm-muted">{((f.includes("words") ? e.words : e.phrases) ?? []).filter((w) => w.trim()).length} in the list</small>
            </div>
          ) : null}

          <div className="adm-drawer-section">
            <h3>Preview</h3>
            <Preview e={e} many={many} />
          </div>

          {err ? <p className="adm-error">{err}</p> : null}
          <div className="ce-drawer-foot">
            <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={onRun}>
              <Play size={14} aria-hidden="true" /> Run now
            </button>
            {canEdit && event.changed ? (
              confirmReset ? (
                <button type="button" className="adm-btn adm-btn--small adm-btn--danger" disabled={busy} onClick={reset}>
                  {event.builtIn ? "Yes, put it back" : "Yes, delete it"}
                </button>
              ) : (
                <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => setConfirmReset(true)}>
                  {event.builtIn ? <RotateCcw size={14} aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />} {event.builtIn ? "Reset to default" : "Delete"}
                </button>
              )
            ) : null}
            <span style={{ flex: 1 }} />
            {canEdit ? (
              <button type="button" className="adm-btn adm-btn--small" disabled={busy || !dirty} onClick={save}>
                <Check size={14} aria-hidden="true" /> {busy ? "Saving…" : "Save"}
              </button>
            ) : (
              <span className="adm-muted">Only admins can change events.</span>
            )}
          </div>
        </aside>
      </div>
    </Overlay>
  );
}

function OutcomesEditor({ value, onChange, disabled, many }: { value: Outcome[]; onChange: (o: Outcome[]) => void; disabled: boolean; many: string }) {
  const chances = outcomeChances(value);
  const upd = (i: number, o: Partial<Outcome>) => onChange(value.map((x, j) => (j === i ? { ...x, ...o } : x)));
  const avg = value.reduce((s, o, i) => s + (chances[i] / 100) * ((o.leaves[0] + o.leaves[1]) / 2), 0);
  return (
    <div className="adm-drawer-section">
      <h3>Outcomes</h3>
      <p className="adm-muted">
        Everyone who joins gets one of these at random. Minus numbers take {many} or XP away (never below 0, and nobody loses a level). On average a player gets <b>{Math.round(avg)}</b> {many}.
      </p>
      <ul className="ce-outcomes">
        {value.map((o, i) => (
          <li key={i}>
            <div className="ce-outcome-top">
              <input className="adm-input" value={o.text} placeholder="what happened, e.g. got a triple scoop" disabled={disabled} onChange={(x) => upd(i, { text: x.target.value })} />
              <span className="ce-chance" title="Chance">
                <Num value={o.weight} min={0} max={1000} disabled={disabled} onChange={(n) => upd(i, { weight: n })} />
                <small>{chances[i].toFixed(0)}%</small>
              </span>
              {!disabled ? (
                <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <X size={12} />
                </button>
              ) : null}
            </div>
            <div className="ce-reward">
              <Field label={many}>
                <RangeInput value={o.leaves} negative disabled={disabled} onChange={(leaves) => upd(i, { leaves })} />
              </Field>
              <Field label="XP">
                <RangeInput value={o.xp} negative disabled={disabled} onChange={(xp) => upd(i, { xp })} />
              </Field>
            </div>
          </li>
        ))}
      </ul>
      {!disabled && value.length < 20 ? (
        <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost" onClick={() => onChange([...value, { text: "", weight: 10, leaves: [0, 0], xp: [0, 0] }])}>
          <Plus size={12} aria-hidden="true" /> Add outcome
        </button>
      ) : null}
    </div>
  );
}

function OptionsEditor({ value, onChange, disabled }: { value: { label: string; emoji?: string }[]; onChange: (o: { label: string; emoji?: string }[]) => void; disabled: boolean }) {
  const upd = (i: number, o: Partial<{ label: string; emoji?: string }>) => onChange(value.map((x, j) => (j === i ? { ...x, ...o } : x)));
  return (
    <div className="adm-drawer-section">
      <h3>Choices</h3>
      <p className="adm-muted">2 to 5 buttons. One is picked as the lucky one each time.</p>
      <ul className="ce-options">
        {value.map((o, i) => (
          <li key={i}>
            <input className="adm-input ce-opt-emoji" value={o.emoji ?? ""} placeholder="🎃" disabled={disabled} onChange={(x) => upd(i, { emoji: x.target.value })} />
            <input className="adm-input" value={o.label} maxLength={80} disabled={disabled} onChange={(x) => upd(i, { label: x.target.value })} />
            {!disabled && value.length > 2 ? (
              <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X size={12} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!disabled && value.length < 5 ? (
        <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost" onClick={() => onChange([...value, { label: "" }])}>
          <Plus size={12} aria-hidden="true" /> Add choice
        </button>
      ) : null}
    </div>
  );
}

function QuestionsEditor({ value, onChange, disabled }: { value: Question[]; onChange: (o: Question[]) => void; disabled: boolean }) {
  const upd = (i: number, q: Partial<Question>) => onChange(value.map((x, j) => (j === i ? { ...x, ...q } : x)));
  return (
    <div className="adm-drawer-section">
      <h3>Questions ({value.length})</h3>
      <p className="adm-muted">Put the right answer first; the buttons are shuffled in Discord. 2 to 5 answers each.</p>
      <ul className="ce-questions">
        {value.map((q, i) => (
          <li key={i}>
            <div className="ce-outcome-top">
              <input className="adm-input" value={q.q} placeholder="Question" maxLength={250} disabled={disabled} onChange={(x) => upd(i, { q: x.target.value })} />
              {!disabled ? (
                <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost" aria-label="Remove question" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <X size={12} />
                </button>
              ) : null}
            </div>
            <div className="ce-answers">
              {[0, 1, 2, 3, 4].map((k) => (
                <input
                  key={k}
                  className={`adm-input${k === 0 ? " is-right" : ""}`}
                  value={q.answers[k] ?? ""}
                  placeholder={k === 0 ? "Right answer" : k < 2 ? "Wrong answer" : "Wrong answer (optional)"}
                  maxLength={80}
                  disabled={disabled}
                  onChange={(x) => {
                    const answers = [...q.answers];
                    answers[k] = x.target.value;
                    upd(i, { answers: answers.map((a) => a ?? "") });
                  }}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      {!disabled ? (
        <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost" onClick={() => onChange([...value, { q: "", answers: ["", "", "", ""] }])}>
          <Plus size={12} aria-hidden="true" /> Add question
        </button>
      ) : null}
    </div>
  );
}

/** Roughly how it looks in Discord. */
function Preview({ e, many }: { e: ChatEvent; many: string }) {
  const r = e.reward ?? { leaves: [0, 0] as Range, xp: [0, 0] as Range };
  const reward = [r.leaves[1] ? `${rangeLabel(r.leaves)} 🍁` : "", r.xp[1] ? `${rangeLabel(r.xp)} XP` : ""].filter(Boolean).join(" + ") || "bragging rights";
  const fill = (t: string) =>
    t.replace(/\{(\w+)\}/g, (m, k: string) => String(({ reward, seconds: e.seconds, goal: e.goal, winners: e.winners, min: e.min, max: e.max } as Record<string, unknown>)[k] ?? m));
  const body = fill(e.text).replace(/\*\*(.+?)\*\*/g, "$1");
  const buttons = e.type === "pick" ? (e.options ?? []).map((o) => `${o.emoji ?? ""} ${o.label}`) : e.type === "trivia" ? e.questions?.[0]?.answers ?? [] : EVENT_TYPES[e.type].fields.includes("button") ? [`${e.emoji} ${e.button ?? "Join"}`] : [];
  const sample =
    e.type === "scramble" ? (e.words?.[0] ?? "honey").toUpperCase().split("").reverse().join(" ") : e.type === "typer" ? e.phrases?.[0] ?? "" : e.type === "math" ? "47 + 12 = ?" : null;
  return (
    <div className="ce-preview" style={{ ["--ce" as string]: e.color }}>
      <b>
        <Emoji value={e.emoji} /> {e.title}
      </b>
      {e.type === "trivia" && e.questions?.[0] ? <p className="ce-preview-q">{e.questions[0].q}</p> : null}
      <p>
        <CurrencyAmount text={body} size={15} />
      </p>
      {sample ? <code>{sample}</code> : null}
      {["draw", "raffle"].includes(e.type) ? <p>👥 Nobody yet. Be the first!</p> : e.type === "pick" ? <p>👥 Nobody has picked yet.</p> : e.type === "trivia" ? <p>👥 Nobody has answered yet.</p> : null}
      <p>⏳ Ends in {e.seconds} seconds</p>
      <small>{e.name} · chat event</small>
      {buttons.length ? (
        <div className="ce-preview-buttons">
          {buttons.map((b, i) => (
            <span key={i} className={e.type === "trivia" ? "is-blue" : e.type === "pick" ? "is-grey" : undefined}>
              {b}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------- run / create / settings
function RunDialog({ event, meta, data, onClose, onDone }: { event: ChatEventRow | "random"; meta: Meta | null; data: Data; onClose: () => void; onDone: () => void }) {
  const [channel, setChannel] = useState<string | null>(data.settings.channels[0] ?? null);
  const [ping, setPing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const req = reqId ? data.requests.find((r) => r.id === reqId) : null;
  useEscape(onClose);

  useEffect(() => {
    if (!reqId || (req && req.status !== "pending" && req.status !== "working")) return;
    const t = window.setInterval(onDone, 2000);
    return () => window.clearInterval(t);
  }, [reqId, req, onDone]);

  const go = async () => {
    if (!channel) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await send("/api/admin/chat-events/run", "POST", { eventId: event === "random" ? "random" : event.id, channelId: channel, ping });
      setReqId(r.id);
      onDone();
    } catch (x) {
      setMsg({ ok: false, text: x instanceof Error ? x.message : "Couldn't start it." });
    } finally {
      setBusy(false);
    }
  };
  const status = req ? (req.status === "done" ? { ok: true, text: "It's running in Discord now!" } : req.status === "failed" ? { ok: false, text: req.error ?? "The bot couldn't start it." } : { ok: true, text: "Sent: the bot starts it in a few seconds…" }) : reqId ? { ok: true, text: "Sent: the bot starts it in a few seconds…" } : msg;

  return (
    <Overlay>
      <div className="adm-drawer-backdrop ce-modal-wrap" onMouseDown={(x) => x.target === x.currentTarget && onClose()}>
        <div className="ce-modal" role="dialog" aria-label="Run an event">
          <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
          <h3>{event === "random" ? "Run a random event" : `Run ${event.name}`}</h3>
          <p className="adm-muted">{event === "random" ? "The bot picks one of the events that are on right now, the same way it does in chat." : "It starts straight away, even if it's switched off or out of season."}</p>
          <Field box label="Channel">
            <Picker kind="channel" value={channel} options={channelOptions(meta, "text")} onChange={(v) => setChannel((v as string) ?? null)} />
          </Field>
          {data.settings.pingRole ? (
            <label className="ce-switch">
              <input type="checkbox" checked={ping} onChange={(x) => setPing(x.target.checked)} />
              <span>Ping the events role</span>
            </label>
          ) : null}
          {status ? <p className={status.ok ? "ce-ok" : "adm-error"}>{status.text}</p> : null}
          <div className="ce-drawer-foot">
            <span style={{ flex: 1 }} />
            <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={onClose}>
              Close
            </button>
            <button type="button" className="adm-btn adm-btn--small" disabled={busy || !channel || Boolean(reqId && (!req || req.status === "pending" || req.status === "working"))} onClick={go}>
              <Play size={14} aria-hidden="true" /> {reqId ? "Run again" : "Run it"}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function CreateDialog({ season, onClose, onCreated }: { season: EventSeason; onClose: () => void; onCreated: (e: ChatEvent) => void }) {
  const [type, setType] = useState<EventType>("draw");
  const [s, setS] = useState<EventSeason>(season);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEscape(onClose);
  const go = async () => {
    setBusy(true);
    try {
      const r = await send("/api/admin/chat-events", "POST", { type, season: s });
      onCreated(r.event);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Couldn't add it.");
      setBusy(false);
    }
  };
  return (
    <Overlay>
      <div className="adm-drawer-backdrop ce-modal-wrap" onMouseDown={(x) => x.target === x.currentTarget && onClose()}>
        <div className="ce-modal is-wide" role="dialog" aria-label="New event">
          <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
          <h3>New chat event</h3>
          <p className="adm-muted">Pick what kind of game it is. It starts switched off with example text, so you can set it up first.</p>
          <div className="ce-types">
            {(Object.keys(EVENT_TYPES) as EventType[]).map((k) => {
              const Icon = TYPE_ICON[EVENT_TYPES[k].icon] ?? Sparkles;
              return (
                <button key={k} type="button" className={type === k ? "is-on" : undefined} onClick={() => setType(k)}>
                  <Icon size={18} aria-hidden="true" />
                  <b>{EVENT_TYPES[k].label}</b>
                  <small>{EVENT_TYPES[k].about}</small>
                </button>
              );
            })}
          </div>
          <Field label="Season">
            <select className="adm-select" value={s} onChange={(x) => setS(x.target.value as EventSeason)}>
              {EVENT_SEASONS.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
          </Field>
          {err ? <p className="adm-error">{err}</p> : null}
          <div className="ce-drawer-foot">
            <span style={{ flex: 1 }} />
            <button type="button" className="adm-btn adm-btn--small" disabled={busy} onClick={go}>
              <Plus size={14} aria-hidden="true" /> Add and edit
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function SettingsDrawer({ data, meta, onClose, onSaved }: { data: Data; meta: Meta | null; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState<ChatEventSettings>(() => ({ ...data.settings }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof ChatEventSettings>(k: K, v: ChatEventSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(data.settings);
  useEscape(onClose);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await send("/api/admin/chat-events", "PUT", { settings: s });
      onSaved();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };
  const perHour = Math.min(s.maxPerHour, 60 * (s.chancePercent / 100));
  return (
    <Overlay>
      <div className="adm-drawer-backdrop" onMouseDown={(x) => x.target === x.currentTarget && onClose()}>
        <aside className="adm-drawer ce-drawer" role="dialog" aria-label="Chat event settings">
          <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
          <h2>Chat event settings</h2>
          <p className="adm-muted">These apply to every event. Changes reach the bot within about 15 seconds.</p>
          <div className="adm-drawer-section ce-form">
            <label className="ce-switch is-wide">
              <input type="checkbox" checked={s.enabled} onChange={(x) => set("enabled", x.target.checked)} />
              <span>{s.enabled ? "Events pop up in busy chats by themselves" : "Off: events only run when staff start them"}</span>
            </label>
            <Field label="Which season's events" wide>
              <select className="adm-select" value={s.seasonMode} onChange={(x) => set("seasonMode", x.target.value as ChatEventSettings["seasonMode"])}>
                <option value="auto">Follow the season (it&apos;s {data.season.name} now)</option>
                <option value="fall">Always Autumn</option>
                <option value="winter">Always Winter</option>
                <option value="spring">Always Spring</option>
                <option value="summer">Always Summer</option>
                <option value="all">Every season mixed together</option>
              </select>
            </Field>
            <label className="ce-switch is-wide">
              <input type="checkbox" checked={s.includeAllYear} onChange={(x) => set("includeAllYear", x.target.checked)} />
              <span>Mix in the all-year events too</span>
            </label>
            <Field box label="Only in these channels" wide help="Leave empty for any channel outside the categories below.">
              <Picker kind="channel" multiple value={s.channels} options={channelOptions(meta, "text")} onChange={(v) => set("channels", (v as string[]) ?? [])} />
            </Field>
            {!s.channels.length ? (
              <Field box label="Never in these categories" wide>
                <Picker kind="channel" multiple value={s.excludedCategories} options={channelOptions(meta, "category")} onChange={(v) => set("excludedCategories", (v as string[]) ?? [])} />
              </Field>
            ) : null}
            <Field label="Needs this many people chatting">
              <Num value={s.minChatters} min={1} max={50} onChange={(n) => set("minChatters", n)} />
            </Field>
            <Field label="Counts as chatting for (seconds)" help="After their last message">
              <Num value={s.chatterSeconds} min={15} max={3600} onChange={(n) => set("chatterSeconds", n)} />
            </Field>
            <Field label="Chance each minute (%)" help="Checked once a minute while a chat is busy">
              <Num value={s.chancePercent} min={0} max={100} onChange={(n) => set("chancePercent", n)} />
            </Field>
            <Field label="At most per hour">
              <Num value={s.maxPerHour} min={0} max={60} onChange={(n) => set("maxPerHour", n)} />
            </Field>
            <Field label="Wait between events in a channel (minutes)">
              <Num value={s.channelCooldownMinutes} min={0} max={1440} onChange={(n) => set("channelCooldownMinutes", n)} />
            </Field>
            <Field label="Wait between any two events (minutes)">
              <Num value={s.globalCooldownMinutes} min={0} max={1440} onChange={(n) => set("globalCooldownMinutes", n)} />
            </Field>
            <Field label="Reward multiplier" help="×2 for a double-rewards weekend. Losses aren't multiplied.">
              <select className="adm-select" value={s.rewardMultiplier} onChange={(x) => set("rewardMultiplier", Number(x.target.value))}>
                {[0.5, 1, 1.5, 2, 3, 5].map((m) => (
                  <option key={m} value={m}>
                    ×{m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Remove the results after (seconds)" help="0 keeps them in chat">
              <Num value={s.deleteAfterSeconds} min={0} max={86400} onChange={(n) => set("deleteAfterSeconds", n)} />
            </Field>
            <label className="ce-switch is-wide">
              <input type="checkbox" checked={s.streaks} onChange={(x) => set("streaks", x.target.checked)} />
              <span>Call out win streaks (&ldquo;has won 3 in a row!&rdquo;)</span>
            </label>
            <Field box label="Role to ping when staff run one" wide help="Optional. Staff choose whether to ping each time.">
              <Picker kind="role" allowEmpty value={s.pingRole} options={roleOptions(meta)} onChange={(v) => set("pingRole", (v as string) || null)} />
            </Field>
          </div>
          <p className="adm-muted ce-note">In a channel that stays busy, that&apos;s about {perHour < 1 ? "less than 1" : perHour.toFixed(perHour < 10 ? 1 : 0)} events an hour.</p>
          {err ? <p className="adm-error">{err}</p> : null}
          <div className="ce-drawer-foot">
            <span style={{ flex: 1 }} />
            <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="adm-btn adm-btn--small" disabled={busy || !dirty} onClick={save}>
              <Check size={14} aria-hidden="true" /> {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </aside>
      </div>
    </Overlay>
  );
}
