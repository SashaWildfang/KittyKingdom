"use client";

import {
  AlertTriangle,
  AtSign,
  Ban,
  Bell,
  Brush,
  Copy,
  Eye,
  EyeOff,
  FlaskConical,
  History,
  Image as ImageIcon,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  MessageSquareWarning,
  Pencil,
  Plus,
  Repeat,
  ScanText,
  Shield,
  ShieldAlert,
  Siren,
  Smile,
  Split,
  Tag,
  Trash2,
  Type,
  UserPlus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RULE_LABELS } from "../../lib/automod-data";
import { testMessage, type AutomodWord } from "../../lib/automod-engine";
import type { AutomodConfig, AutomodEvent, RuleKey } from "../../lib/automod";
import { Pager, PersonLink, formatDate, timeAgo, useLive, type People } from "./admin-shared";

type Places = { channels: { id: string; name: string; category: boolean; parent: string | null }[]; roles: { id: string; name: string; color: string | null }[] };
type Change = { id: string; at: string | null; source: string; byId: string | null; byName: string | null; summary: string };
type SettingsResponse = { ok: boolean; config: AutomodConfig; places: Places; changes: Change[]; canEdit: boolean; error?: string };
type Activity = {
  ok: boolean;
  total: number;
  byRule: { rule: string; label: string; n: number }[];
  byAction: Record<string, number>;
  members: { id: string; n: number; last: string | null }[];
  terms: { term: string; n: number }[];
  series: { at: string | null; n: number }[];
  unit: "hour" | "day";
  page: number;
  rows: AutomodEvent[];
  people: People;
};

const RULES: { key: RuleKey; name: string; icon: LucideIcon; about: string }[] = [
  { key: "words", name: "Blocked words", icon: Ban, about: "Sees through look-alike letters, zero-width tricks, s p a c e d or split words, leetspeak, accents and fancy fonts." },
  { key: "splits", name: "Words split over messages", icon: Split, about: "Catches a blocked word typed a few letters per message (n / i / g …) and removes every piece." },
  { key: "edits", name: "Check edited messages", icon: Pencil, about: "Re-checks messages when they're edited, so a clean message can't be swapped for a bad one." },
  { key: "invites", name: "Invite links", icon: Mail, about: "Blocks invites to other servers, even hidden ones like “discord . gg / abc”. Our own invites are fine." },
  { key: "scams", name: "Scam & phishing links", icon: ShieldAlert, about: "Fake Discord/Steam sites, disguised links, “free nitro” bait, look-alike web addresses and @everyone link drops." },
  { key: "newcomers", name: "Newcomer link lock", icon: UserPlus, about: "Brand-new members can't post links for a little while (spam bots' favourite trick)." },
  { key: "mentions", name: "Mass mentions", icon: AtSign, about: "Too many people or roles pinged in one message." },
  { key: "pings", name: "Ping spam", icon: Bell, about: "Pinging the same person over and over within 30 seconds." },
  { key: "spam", name: "Spam", icon: Zap, about: "Rapid messages, the same message repeated, and lots of tiny messages in a row." },
  { key: "crosspost", name: "Cross-channel spam", icon: Copy, about: "The same message posted in several channels within 30 seconds." },
  { key: "media", name: "Media spam", icon: ImageIcon, about: "Lots of files or images in a few seconds." },
  { key: "caps", name: "Caps lock", icon: Type, about: "Two shouty all-caps messages within a minute (the first one is always fine)." },
  { key: "formatting", name: "Formatting spam", icon: ScanText, about: "Walls of text, zalgo text, keyboard smashing and long character runs." },
  { key: "emoji", name: "Emoji spam", icon: Smile, about: "A message that's mostly a huge pile of emojis." },
  { key: "names", name: "Nickname filter", icon: Tag, about: "Names with blocked words get reset to “Renamed Kitty ####” (or just flagged for staff)." },
  { key: "mediaHint", name: "Media perms helper", icon: ImageIcon, about: "Explains how to unlock media when a low-level member asks why they can't post pictures." },
  { key: "dm", name: "DM members about strikes", icon: Mail, about: "Sends a friendly DM explaining the strike, what happens next and how to appeal." },
];
const RULE_NUMBERS: Partial<Record<RuleKey, { key: "limit" | "channels" | "lines" | "minutes"; label: string; min: number; max: number }>> = {
  mentions: { key: "limit", label: "People per message", min: 2, max: 50 },
  pings: { key: "limit", label: "Pings of one person in 30s", min: 2, max: 20 },
  crosspost: { key: "channels", label: "Channels within 30s", min: 2, max: 10 },
  media: { key: "limit", label: "Files within 10s", min: 2, max: 30 },
  formatting: { key: "lines", label: "Lines per message", min: 5, max: 200 },
  emoji: { key: "limit", label: "Emojis per message", min: 5, max: 100 },
  newcomers: { key: "minutes", label: "Minutes after joining", min: 1, max: 1440 },
};
const ACTION_TEXT: Record<string, string> = { punish: "Remove + strike", delete: "Remove, no strike", alert: "Flag for staff", rename: "Reset nickname" };
const LADDER = ["Warning", "Warning", "5m mute", "10m mute", "15m mute", "30m mute", "1h mute", "1 day mute"];
const SECTIONS = [
  { key: "activity", label: "Activity", icon: ListChecks },
  { key: "rules", label: "Rules", icon: Shield },
  { key: "words", label: "Words", icon: Ban },
  { key: "places", label: "Channels & roles", icon: MapPin },
  { key: "test", label: "Test a message", icon: FlaskConical },
  { key: "history", label: "Changes", icon: History },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

function actionBadge(e: AutomodEvent) {
  if (e.action === "punish") return { text: e.offense ? `Strike ${e.offense} · ${LADDER[(e.offense - 1) % 8]}` : "Strike", tone: "red" };
  if (e.action === "delete") return { text: "Removed, no strike", tone: "blue" };
  if (e.action === "rename") return { text: "Name reset", tone: "gold" };
  return { text: e.rule === "raid" ? "Raid alert" : "Flagged", tone: "gold" };
}

export function AutoModTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [section, setSection] = useState<Section>("activity");
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/automod", { cache: "no-store" });
    const data = (await r.json().catch(() => null)) as SettingsResponse | null;
    if (!r.ok || !data?.ok) setError(data?.error ?? "Couldn't load AutoMod settings.");
    else {
      setSettings(data);
      setError(null);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  async function change(body: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch("/api/admin/automod", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        setNotice(`⚠️ ${data?.error ?? "Couldn't save that."}`);
        return false;
      }
      setNotice(`✅ ${data.message}`);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  const cfg = settings?.config;
  const canEdit = Boolean(settings?.canEdit);

  return (
    <div className="am">
      <header className={`am-head${cfg?.raid.on ? " is-raid" : ""}`}>
        <div className="am-head-title">
          <Shield size={22} aria-hidden="true" />
          <div>
            <b>AutoMod</b>
            <small>
              {cfg
                ? cfg.seeded
                  ? `Settings v${cfg.version}${cfg.updatedAt ? ` · changed ${timeAgo(cfg.updatedAt)}${cfg.updatedBy?.name ? ` by ${cfg.updatedBy.name}` : ""}${cfg.updatedBy?.source ? ` (${cfg.updatedBy.source === "website" ? "website" : "Discord"})` : ""}` : ""}`
                  : "Waiting for the bot"
                : "Loading…"}
            </small>
          </div>
        </div>
        {cfg ? <RaidSwitch raid={cfg.raid} busy={busy} onChange={(on, minutes) => change({ type: "raid", on, minutes })} /> : null}
      </header>

      {cfg && !cfg.seeded ? (
        <p className="am-banner">
          <AlertTriangle size={16} /> The moderation bot hasn&apos;t started with the new AutoMod yet. Upload the new <code>moderation/events/automod.py</code> and restart it; it imports the
          current word list on first start, then everything here goes live.
        </p>
      ) : null}
      {error ? <p className="adm-error">{error}</p> : null}
      {notice ? (
        <p className="am-notice" role="status">
          {notice}
        </p>
      ) : null}

      <nav className="adm-seg am-sections" role="tablist" aria-label="AutoMod sections">
        {SECTIONS.map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={section === s.key} className={section === s.key ? "is-active" : undefined} onClick={() => setSection(s.key)}>
            <s.icon size={14} aria-hidden="true" /> {s.label}
          </button>
        ))}
      </nav>

      {section === "activity" ? <ActivitySection onOpenMember={onOpenMember} /> : null}
      {!cfg ? (section !== "activity" ? <div className="adm-skeleton" /> : null) : null}
      {cfg && section === "rules" ? <RulesSection cfg={cfg} canEdit={canEdit} busy={busy} change={change} /> : null}
      {cfg && section === "words" ? <WordsSection cfg={cfg} canEdit={canEdit} busy={busy} change={change} /> : null}
      {cfg && section === "places" && settings ? <PlacesSection cfg={cfg} places={settings.places} canEdit={canEdit} busy={busy} change={change} /> : null}
      {cfg && section === "test" ? <TestSection cfg={cfg} /> : null}
      {settings && section === "history" ? <ChangesSection changes={settings.changes} /> : null}
      {!canEdit && settings && section !== "activity" && section !== "test" && section !== "history" ? (
        <p className="adm-muted am-foot">Staff can look and switch raid mode; changing settings is for admins.</p>
      ) : null}
    </div>
  );
}

function RaidSwitch({ raid, busy, onChange }: { raid: AutomodConfig["raid"]; busy: boolean; onChange: (on: boolean, minutes?: number) => void }) {
  const [minutes, setMinutes] = useState(30);
  if (raid.on) {
    return (
      <div className="am-raid is-on">
        <Siren size={16} aria-hidden="true" />
        <span>
          <b>Raid mode on</b>
          <small>{raid.until ? `until ${new Date(raid.until).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "until turned off"}</small>
        </span>
        <button type="button" className="adm-btn adm-btn--small" disabled={busy} onClick={() => onChange(false)}>
          Turn off
        </button>
      </div>
    );
  }
  return (
    <div className="am-raid">
      <Siren size={16} aria-hidden="true" />
      <span>
        <b>Raid mode off</b>
        <small>Stricter limits, links locked for new joins. Never kicks or bans.</small>
      </span>
      <select className="adm-select" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="How long">
        {[15, 30, 60, 120, 360].map((m) => (
          <option key={m} value={m}>
            {m < 60 ? `${m} min` : `${m / 60} h`}
          </option>
        ))}
      </select>
      <button type="button" className="adm-btn adm-btn--small am-danger" disabled={busy} onClick={() => onChange(true, minutes)}>
        Turn on
      </button>
    </div>
  );
}

// ---------- Activity ----------
function ActivitySection({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [range, setRange] = useState("7d");
  const [rule, setRule] = useState<string | null>(null);
  const [member, setMember] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  useEffect(() => setPage(0), [range, rule, member]);
  const q = new URLSearchParams({ range, page: String(page) });
  if (rule) q.set("rule", rule);
  if (member) q.set("member", member);
  const live = useLive<Activity>(`/api/admin/automod/activity?${q}`, 15_000);
  const a = live.data;
  const max = Math.max(1, ...(a?.series ?? []).map((s) => s.n));
  const strikes = a?.byAction.punish ?? 0;

  return (
    <div className="am-activity">
      <div className="adm-toolbar am-toolbar">
        <div className="adm-seg" role="tablist" aria-label="Time range">
          {["24h", "7d", "30d", "90d"].map((r) => (
            <button key={r} type="button" className={range === r ? "is-active" : undefined} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
        {rule || member ? (
          <button type="button" className="adm-chip-btn is-active" onClick={() => { setRule(null); setMember(null); }}>
            {rule ? RULE_LABELS[rule] ?? rule : ""}{rule && member ? " · " : ""}{member ? a?.people?.[member]?.name ?? "member" : ""} ✕
          </button>
        ) : null}
      </div>

      <div className="adm-kpis">
        <div className="adm-kpi">
          <small>Caught</small>
          <strong>{a ? a.total.toLocaleString() : "…"}</strong>
          <span>{range === "24h" ? "last 24 hours" : `last ${range.replace("d", " days")}`}</span>
        </div>
        <div className="adm-kpi adm-kpi--red">
          <small>Strikes</small>
          <strong>{a ? strikes.toLocaleString() : "…"}</strong>
          <span>{a?.total ? `${Math.round((strikes / a.total) * 100)}% of catches` : " "}</span>
        </div>
        <div className="adm-kpi adm-kpi--blue">
          <small>Removed, no strike</small>
          <strong>{a ? (a.byAction.delete ?? 0).toLocaleString() : "…"}</strong>
          <span>newcomer links, emoji piles…</span>
        </div>
        <div className="adm-kpi adm-kpi--yellow">
          <small>Flagged / names reset</small>
          <strong>{a ? ((a.byAction.alert ?? 0) + (a.byAction.rename ?? 0)).toLocaleString() : "…"}</strong>
          <span>{a ? `${a.byAction.rename ?? 0} names reset` : " "}</span>
        </div>
      </div>

      <div className="am-grid">
        <section className="adm-card am-span2">
          <h3>Catches over time</h3>
          {a?.series.length ? (
            <div className="am-bars" role="img" aria-label="Catches over time">
              {a.series.map((s) => (
                <span key={s.at} style={{ height: `${Math.max(4, (s.n / max) * 100)}%` }} title={`${s.at ? new Date(s.at).toLocaleString(undefined, a.unit === "hour" ? { hour: "numeric" } : { month: "short", day: "numeric" }) : ""}: ${s.n}`}>
                  <i>{s.n}</i>
                </span>
              ))}
            </div>
          ) : (
            <p className="adm-empty">{a ? "All quiet 🌙 nothing caught in this range." : "Loading…"}</p>
          )}
        </section>
        <section className="adm-card">
          <h3>By rule</h3>
          <ul className="am-rank">
            {(a?.byRule ?? []).map((r) => (
              <li key={r.rule}>
                <button type="button" className={rule === r.rule ? "is-on" : undefined} onClick={() => setRule(rule === r.rule ? null : r.rule)}>
                  <span>{r.label}</span>
                  <i style={{ width: `${(r.n / Math.max(1, a!.byRule[0].n)) * 100}%` }} />
                  <b>{r.n}</b>
                </button>
              </li>
            ))}
            {a && !a.byRule.length ? <li className="adm-muted">Nothing yet</li> : null}
          </ul>
        </section>
        <section className="adm-card">
          <h3>Most caught members</h3>
          <ul className="am-rank am-rank--people">
            {(a?.members ?? []).map((m) => (
              <li key={m.id}>
                <button type="button" className={member === m.id ? "is-on" : undefined} onClick={() => setMember(member === m.id ? null : m.id)} title="Filter the feed to this member">
                  <span>{a!.people[m.id]?.name ?? m.id}</span>
                  <b>{m.n}</b>
                </button>
                <button type="button" className="am-open" onClick={() => onOpenMember(m.id)} aria-label="Open member">
                  ↗
                </button>
              </li>
            ))}
            {a && !a.members.length ? <li className="adm-muted">Nobody 🎉</li> : null}
          </ul>
        </section>
        <section className="adm-card">
          <h3>Most matched words</h3>
          <div className="am-terms">
            {(a?.terms ?? []).map((t) => (
              <button key={t.term} type="button" className={reveal[`t:${t.term}`] ? "is-shown" : undefined} onClick={() => setReveal((r) => ({ ...r, [`t:${t.term}`]: !r[`t:${t.term}`] }))} title="Click to show">
                <span>{t.term}</span> <b>{t.n}</b>
              </button>
            ))}
            {a && !a.terms.length ? <p className="adm-muted">None matched.</p> : null}
          </div>
        </section>
      </div>

      <section className="adm-card am-feed">
        <h3>Latest catches</h3>
        {a?.rows.length ? (
          <ol>
            {a.rows.map((e) => {
              const badge = actionBadge(e);
              return (
                <li key={e.id}>
                  <time dateTime={e.at} title={formatDate(e.at)}>
                    {timeAgo(e.at)}
                  </time>
                  <div className="am-feed-who">
                    {e.userId ? <PersonLink id={e.userId} people={a.people} onOpen={onOpenMember} compact /> : <b>Server</b>}
                  </div>
                  <div className="am-feed-what">
                    <b>{e.label}</b>
                    <span className={`am-badge am-badge--${badge.tone}`}>{badge.text}</span>
                    <small>{e.reason.replace(/`([^`]+)`/g, "“$1”").replace(/Inappropriate language: “[^”]+”/, "Blocked word")}</small>
                    {e.content ? (
                      <button type="button" className={`am-spoiler${reveal[e.id] ? " is-shown" : ""}`} onClick={() => setReveal((r) => ({ ...r, [e.id]: !r[e.id] }))}>
                        {reveal[e.id] ? e.content : "Show message"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="adm-empty">{a ? "Nothing caught with these filters." : "Loading…"}</p>
        )}
        {a && a.total > 25 ? <Pager page={page} total={a.total} pageSize={25} onPage={setPage} /> : null}
      </section>
    </div>
  );
}

// ---------- Rules ----------
type ChangeFn = (body: Record<string, unknown>) => Promise<boolean>;

function RulesSection({ cfg, canEdit, busy, change }: { cfg: AutomodConfig; canEdit: boolean; busy: boolean; change: ChangeFn }) {
  return (
    <>
      <section className="adm-card am-ladder">
        <h3>Strike ladder</h3>
        <p className="adm-muted">Unchanged: every strike moves one step, then it starts over. Strikes fade after a day (an hour for small formatting slips). AutoMod never kicks or bans.</p>
        <ol>
          {LADDER.map((l, i) => (
            <li key={i} className={i < 2 ? "is-warn" : i < 5 ? "is-mid" : "is-high"}>
              <small>{i + 1}</small>
              {l}
            </li>
          ))}
        </ol>
      </section>
      <div className="am-rules">
        {RULES.map((r) => {
          const s = cfg.rules[r.key] ?? { on: false };
          const num = RULE_NUMBERS[r.key];
          const actions = r.key === "names" ? ["rename", "alert"] : s.action ? ["punish", "delete", "alert"] : [];
          return (
            <article key={r.key} className={`am-rule${s.on ? " is-on" : ""}`}>
              <header>
                <r.icon size={18} aria-hidden="true" />
                <b>{r.name}</b>
                <label className="am-switch">
                  <input type="checkbox" checked={s.on} disabled={!canEdit || busy} onChange={(e) => change({ type: "rule", rule: r.key, on: e.target.checked })} />
                  <span aria-hidden="true" />
                  <em className="sr-only">{s.on ? "On" : "Off"}</em>
                </label>
              </header>
              <p>{r.about}</p>
              {s.on && (actions.length || num) ? (
                <div className="am-rule-controls">
                  {actions.length ? (
                    <select className="adm-select" value={s.action} disabled={!canEdit || busy} onChange={(e) => change({ type: "rule", rule: r.key, action: e.target.value })} aria-label="What it does">
                      {actions.map((a) => (
                        <option key={a} value={a}>
                          {ACTION_TEXT[a]}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {num ? <NumberSetting label={num.label} min={num.min} max={num.max} value={Number(s[num.key] ?? num.min)} disabled={!canEdit || busy} onSave={(v) => change({ type: "rule", rule: r.key, value: v })} /> : null}
                </div>
              ) : null}
            </article>
          );
        })}
        <article className="am-rule is-on">
          <header>
            <Siren size={18} aria-hidden="true" />
            <b>Raid watch</b>
          </header>
          <p>When lots of people join at once, staff get pinged. With auto raid mode on, it also switches raid mode on for 30 minutes.</p>
          <div className="am-rule-controls">
            <label className="adm-toggle">
              <input type="checkbox" checked={cfg.raid.auto} disabled={!canEdit || busy} onChange={(e) => change({ type: "raidSettings", auto: e.target.checked })} /> Auto raid mode
            </label>
            <NumberSetting label="Joins in a minute" min={3} max={100} value={cfg.raid.joins} disabled={!canEdit || busy} onSave={(v) => change({ type: "raidSettings", joins: v })} />
          </div>
        </article>
      </div>
    </>
  );
}

function NumberSetting({ label, value, min, max, disabled, onSave }: { label: string; value: number; min: number; max: number; disabled: boolean; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n >= min && n <= max && n !== value) onSave(n);
    else setV(String(value));
  };
  return (
    <label className="am-number">
      <span>{label}</span>
      <input type="number" min={min} max={max} value={v} disabled={disabled} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
    </label>
  );
}

// ---------- Words ----------
function WordsSection({ cfg, canEdit, busy, change }: { cfg: AutomodConfig; canEdit: boolean; busy: boolean; change: ChangeFn }) {
  const [show, setShow] = useState(false);
  const [search, setSearch] = useState("");
  const [word, setWord] = useState("");
  const [sev, setSev] = useState<"standard" | "severe">("standard");
  const [match, setMatch] = useState<"word" | "partial">("word");
  const [allowWord, setAllowWord] = useState("");
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...cfg.words].filter((w) => !q || w.w.includes(q)).sort((a, b) => Number(b.sev === "severe") - Number(a.sev === "severe") || a.w.localeCompare(b.w));
  }, [cfg.words, search]);
  const severe = cfg.words.filter((w) => w.sev === "severe").length;

  return (
    <div className="am-words">
      {canEdit ? (
        <form
          className="adm-card am-add"
          onSubmit={async (e) => {
            e.preventDefault();
            if (word.trim() && (await change({ type: "addWord", w: word, sev, match }))) setWord("");
          }}
        >
          <h3>Block a word or phrase</h3>
          <div className="am-add-row">
            <input className="am-input" value={word} onChange={(e) => setWord(e.target.value)} placeholder="Type it plainly; leetspeak, spacing and look-alikes are caught automatically" maxLength={60} />
            <div className="adm-seg" role="radiogroup" aria-label="Severity">
              <button type="button" className={sev === "standard" ? "is-active" : undefined} onClick={() => setSev("standard")} title="Allowed in relaxed channels">
                Standard
              </button>
              <button type="button" className={sev === "severe" ? "is-active" : undefined} onClick={() => setSev("severe")} title="Blocked everywhere, even relaxed and exempt channels">
                Severe
              </button>
            </div>
            <div className="adm-seg" role="radiogroup" aria-label="Match">
              <button type="button" className={match === "word" ? "is-active" : undefined} onClick={() => setMatch("word")} title="The whole word (plus plurals)">
                Whole word
              </button>
              <button type="button" className={match === "partial" ? "is-active" : undefined} onClick={() => setMatch("partial")} title="Anywhere, even inside other words (careful!)">
                Anywhere
              </button>
            </div>
            <button type="submit" className="adm-btn" disabled={busy || !word.trim()}>
              <Plus size={14} /> Block
            </button>
          </div>
        </form>
      ) : null}

      <section className="adm-card">
        <div className="am-words-head">
          <h3>
            Blocked ({cfg.words.length}) · {severe} severe
          </h3>
          <input className="am-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" aria-label="Search words" />
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setShow(!show)}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />} {show ? "Hide words" : "Show words"}
          </button>
        </div>
        <ul className={`am-word-list${show ? " is-shown" : ""}`}>
          {list.map((w) => (
            <WordRow key={w.w} w={w} canEdit={canEdit} busy={busy} change={change} />
          ))}
          {!list.length ? <li className="adm-muted">No words{search ? " match that search" : " yet"}.</li> : null}
        </ul>
      </section>

      <section className="adm-card">
        <h3>Always allowed ({cfg.allow.length})</h3>
        <p className="adm-muted">Real words the filter should never touch (place names like Nigeria, or words a partial match catches by mistake).</p>
        <div className="am-chips">
          {cfg.allow.map((a) => (
            <span key={a} className="am-chip">
              {a}
              {canEdit ? (
                <button type="button" onClick={() => change({ type: "allow", w: a, remove: true })} disabled={busy} aria-label={`Remove ${a}`}>
                  ✕
                </button>
              ) : null}
            </span>
          ))}
        </div>
        {canEdit ? (
          <form
            className="am-inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (allowWord.trim() && (await change({ type: "allow", w: allowWord }))) setAllowWord("");
            }}
          >
            <input className="am-input" value={allowWord} onChange={(e) => setAllowWord(e.target.value)} placeholder="Add a word to always allow" maxLength={40} />
            <button type="submit" className="adm-btn adm-btn--small" disabled={busy || !allowWord.trim()}>
              Allow
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function WordRow({ w, canEdit, busy, change }: { w: AutomodWord; canEdit: boolean; busy: boolean; change: ChangeFn }) {
  const [peek, setPeek] = useState(false);
  return (
    <li className={`${w.sev === "severe" ? "is-severe" : ""}${peek ? " is-peek" : ""}`}>
      <button type="button" className="am-word" onClick={() => setPeek(!peek)} title="Click to show">
        {w.w}
      </button>
      <span className={`am-badge am-badge--${w.sev === "severe" ? "red" : "blue"}`}>{w.sev === "severe" ? "Severe" : "Standard"}</span>
      <span className="am-badge">{w.match === "partial" ? "Anywhere" : "Whole word"}</span>
      {canEdit ? (
        <span className="am-word-actions">
          <select
            className="adm-select"
            value={`${w.sev}:${w.match}`}
            disabled={busy}
            aria-label="Change"
            onChange={(e) => {
              const [sev, match] = e.target.value.split(":");
              change({ type: "editWord", w: w.w, sev, match });
            }}
          >
            <option value="standard:word">Standard · whole word</option>
            <option value="standard:partial">Standard · anywhere</option>
            <option value="severe:word">Severe · whole word</option>
            <option value="severe:partial">Severe · anywhere</option>
          </select>
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy} onClick={() => confirm("Unblock this word?") && change({ type: "removeWord", w: w.w })} aria-label="Unblock">
            <Trash2 size={14} />
          </button>
        </span>
      ) : null}
    </li>
  );
}

// ---------- Places ----------
function PlacesSection({ cfg, places, canEdit, busy, change }: { cfg: AutomodConfig; places: Places; canEdit: boolean; busy: boolean; change: ChangeFn }) {
  const name = (id: string) => places.channels.find((c) => c.id === id)?.name ?? places.roles.find((r) => r.id === id)?.name ?? id;
  const blocks: { type: string; title: string; about: string; ids: string[]; options: { id: string; name: string }[]; prefix: string }[] = [
    {
      type: "exemptChannel",
      title: "Exempt channels",
      about: "Skip AutoMod here (bot channels, staff areas). Severe words and scam links are still blocked everywhere.",
      ids: cfg.exemptChannels,
      options: places.channels.map((c) => ({ id: c.id, name: `${c.category ? "📁 " : "#"}${c.name}` })),
      prefix: "#",
    },
    {
      type: "relaxed",
      title: "Relaxed categories",
      about: "Standard words are allowed inside these categories (18+ areas and the like). Severe words still aren't.",
      ids: cfg.relaxedCategories,
      options: places.channels.filter((c) => c.category).map((c) => ({ id: c.id, name: `📁 ${c.name}` })),
      prefix: "📁 ",
    },
    {
      type: "exemptRole",
      title: "Exempt roles",
      about: "Members with these roles skip AutoMod (staff always do). Severe words and scams still count.",
      ids: cfg.exemptRoles,
      options: places.roles.map((r) => ({ id: r.id, name: `@${r.name}` })),
      prefix: "@",
    },
  ];
  return (
    <div className="am-places">
      {blocks.map((b) => (
        <PlaceBlock key={b.type} {...b} name={name} canEdit={canEdit} busy={busy} change={change} />
      ))}
    </div>
  );
}

function PlaceBlock({ type, title, about, ids, options, prefix, name, canEdit, busy, change }: { type: string; title: string; about: string; ids: string[]; options: { id: string; name: string }[]; prefix: string; name: (id: string) => string; canEdit: boolean; busy: boolean; change: ChangeFn }) {
  const [pick, setPick] = useState("");
  return (
    <section className="adm-card">
      <h3>
        {title} ({ids.length})
      </h3>
      <p className="adm-muted">{about}</p>
      <div className="am-chips">
        {ids.map((id) => (
          <span key={id} className="am-chip">
            {prefix}
            {name(id)}
            {canEdit ? (
              <button type="button" disabled={busy} onClick={() => change({ type, id, remove: true })} aria-label="Remove">
                ✕
              </button>
            ) : null}
          </span>
        ))}
        {!ids.length ? <span className="adm-muted">None</span> : null}
      </div>
      {canEdit ? (
        <div className="am-inline-form">
          <select className="adm-select" value={pick} onChange={(e) => setPick(e.target.value)} aria-label={`Add to ${title}`}>
            <option value="">Add…</option>
            {options
              .filter((o) => !ids.includes(o.id))
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
          <button type="button" className="adm-btn adm-btn--small" disabled={busy || !pick} onClick={async () => (await change({ type, id: pick })) && setPick("")}>
            Add
          </button>
        </div>
      ) : null}
    </section>
  );
}

// ---------- Test ----------
const EXAMPLES = ["free nitro for everyone 🎁 https://dlscord-gift.com/claim", "join my server discord . gg / coolplace", "[https://discord.com/gifts](https://steamcommnity.ru/login)", "g o o d  m o r n i n g everyone!!"];

function TestSection({ cfg }: { cfg: AutomodConfig }) {
  const [text, setText] = useState("");
  const [show, setShow] = useState(false);
  const r = useMemo(() => (text.trim() ? testMessage(text, cfg.words, cfg.allow) : null), [text, cfg.words, cfg.allow]);
  return (
    <section className="adm-card am-test">
      <h3>Test a message</h3>
      <p className="adm-muted">Runs the exact same filter as the bot, right here in your browser. Nothing is posted or punished.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Paste or type a message…" />
      <div className="am-chips">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="am-chip am-chip--btn" onClick={() => setText(ex)}>
            {ex.length > 38 ? `${ex.slice(0, 38)}…` : ex}
          </button>
        ))}
      </div>
      {r ? (
        <ul className="am-results">
          <li>
            <MessageSquareWarning size={15} /> <span>Reads as</span> <code>{r.readsAs || "(nothing)"}</code>
          </li>
          {r.word ? (
            <li className="is-bad">
              <Ban size={15} /> <span>Blocked word</span>
              <button type="button" className={`am-word${show ? " is-peek" : ""}`} onClick={() => setShow(!show)}>
                {r.word.term}
              </button>
              <small>
                {r.word.severe ? "severe" : "standard"} · found {r.word.how === "split" ? "split into pieces" : r.word.how === "phrase" ? "as a phrase" : "as a word"}
                {r.relaxedOk ? " · allowed in relaxed channels" : ""}
              </small>
            </li>
          ) : null}
          {r.scam ? (
            <li className="is-bad">
              <ShieldAlert size={15} /> <span>Scam check</span> <small>{r.scam}</small>
            </li>
          ) : null}
          {r.invites.length ? (
            <li className="is-warn">
              <Link2 size={15} /> <span>Invite</span> <code>{r.invites.join(", ")}</code> <small>blocked unless it&apos;s our own server</small>
            </li>
          ) : null}
          {r.emojis >= (cfg.rules.emoji?.limit ?? 20) ? (
            <li className="is-warn">
              <Smile size={15} /> <span>Emoji spam</span> <small>{r.emojis} emojis</small>
            </li>
          ) : null}
          {!r.word && !r.scam && !r.invites.length && r.emojis < (cfg.rules.emoji?.limit ?? 20) ? (
            <li className="is-good">
              <Shield size={15} /> <span>All clear</span> <small>AutoMod wouldn&apos;t touch this (spam and flood checks depend on timing, so they can&apos;t be tested here).</small>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}

// ---------- Changes ----------
function ChangesSection({ changes }: { changes: Change[] }) {
  return (
    <section className="adm-card am-changes">
      <h3>Recent setting changes</h3>
      {changes.length ? (
        <ol>
          {changes.map((c) => (
            <li key={c.id}>
              <span className={`am-badge ${c.source === "website" ? "am-badge--blue" : c.source === "automod" ? "am-badge--gold" : ""}`}>
                {c.source === "website" ? <Brush size={12} /> : c.source === "automod" ? <Repeat size={12} /> : null}
                {c.source === "website" ? "Website" : c.source === "automod" ? "Automatic" : "Discord"}
              </span>
              <b>{c.summary}</b>
              <small>
                {c.byName ?? "Someone"} · <time title={formatDate(c.at)}>{timeAgo(c.at)}</time>
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="adm-empty">No changes yet.</p>
      )}
    </section>
  );
}
