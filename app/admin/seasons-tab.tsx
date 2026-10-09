"use client";

import "./seasons-tab.css";
import {
  AlertTriangle,
  Bot,
  CalendarRange,
  Crown,
  Check,
  Eye,
  EyeOff,
  Globe,
  Hash,
  ImageUp,
  Paintbrush,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BOT_ROLE_NAMES,
  DEFAULT_BOT_COLORS,
  DEFAULT_LEVEL_ROLES,
  LEVEL_TIERS,
  SEASONS,
  SEASON_KEYS,
  levelRoleName,
  seasonWindow,
  type AssetKind,
  type LevelRole,
  type SeasonConfig,
  type SeasonKey,
  type SeasonView,
} from "../../lib/seasons";
import type { AssetInfo, SeasonState } from "../../lib/season-store";
import { SeasonGlyph } from "../fall-effects";
import { SeasonOverride, readPreview, setSeasonPreview } from "../season-context";
import { formatDate, timeAgo, useLive, type People } from "./admin-shared";
import { Picker, type Meta } from "./bots/pickers";

type Data = {
  ok: boolean;
  error?: string;
  config: SeasonConfig;
  active: SeasonKey;
  calendar: SeasonKey;
  views: Record<SeasonKey, SeasonView>;
  state: SeasonState;
  assets: AssetInfo[];
  history: { at: string | null; by: string; what: string }[];
  people: People;
};

const KIND_LABEL: Record<AssetKind, { title: string; help: string }> = {
  logo: { title: "Server logo", help: "The Discord server icon (and the website logo). Square, at least 512×512." },
  banner: { title: "Server banner", help: "The Discord server banner (needs Boost Level 2) and the homepage art. 960×540 or bigger." },
  emote: { title: "Currency emote", help: "Shown next to amounts on the website. Square PNG, 256 KB max." },
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_SEASON: SeasonKey[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "fall", "fall", "fall", "winter"];

function daysUntil(date: string) {
  return Math.max(0, Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000));
}
function niceDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}
/** The last day of a [start, end) window. */
function lastDay(end: string) {
  const d = new Date(`${end}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
}

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined })
    .then((x) => x.json())
    .catch(() => null);
  if (!r?.ok) throw new Error(r?.error ?? "Something went wrong.");
  return r;
}

/** Admin → Overview → Seasons: the season, the site theme, the currency and the Discord look. */
export function SeasonsTab() {
  const { data, error, reload } = useLive<Data>("/api/admin/seasons", 15_000);
  const [draft, setDraft] = useState<SeasonConfig | null>(null);
  const [tab, setTab] = useState<SeasonKey | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<SeasonKey | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    setPreview(readPreview());
    const sync = () => setPreview(readPreview());
    window.addEventListener("kk-season-preview", sync);
    fetch("/api/admin/bots/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setMeta(r))
      .catch(() => undefined);
    return () => window.removeEventListener("kk-season-preview", sync);
  }, []);
  // Keep the draft in step with the server until someone edits it
  const dirty = useMemo(() => (draft && data ? JSON.stringify(strip(draft)) !== JSON.stringify(strip(data.config)) : false), [draft, data]);
  useEffect(() => {
    if (data && !dirty) setDraft(data.config);
    if (data && !tab) setTab(data.active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data || !draft || !tab) return error ? <p className="adm-error">{error}</p> : <div className="adm-skeleton" style={{ height: 480 }} />;

  const set = (patch: Partial<SeasonConfig>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setSeason = (key: SeasonKey, patch: Partial<SeasonConfig["seasons"][SeasonKey]>) =>
    setDraft((d) => (d ? { ...d, seasons: { ...d.seasons, [key]: { ...d.seasons[key], ...patch } } } : d));

  const save = async () => {
    setBusy("save");
    setMsg(null);
    try {
      const r = await send("/api/admin/seasons", "PATCH", strip(draft));
      setMsg({ ok: true, text: r.changed?.length ? `Saved: ${r.changed.join(" · ")}` : "Nothing changed." });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const apply = async () => {
    setBusy("apply");
    setMsg(null);
    try {
      await send("/api/admin/seasons/apply", "POST");
      setMsg({ ok: true, text: "Asked the Main Bot to update Discord. It picks this up within a minute." });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const liveKey = draft.mode === "manual" ? draft.manual : data.calendar;
  const live = SEASONS[liveKey];
  const win = seasonWindow(liveKey, new Date(), draft.timezone);
  const next = SEASON_KEYS[(SEASON_KEYS.indexOf(liveKey) + 1) % 4];
  const nextWin = seasonWindow(next, new Date(), draft.timezone);
  const month = new Date().getMonth();
  const botAlive = data.state.heartbeat ? Date.now() - new Date(data.state.heartbeat).getTime() < 5 * 60_000 : false;

  return (
    <section className="adm-panel sn" data-preview-season={liveKey}>
      {/* ---------------- hero */}
      <div className={`sn-hero is-${liveKey}`}>
        <div className="sn-hero-art" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`sn-hero-glyph g${i}`}>
              <SeasonGlyphFor season={liveKey} index={i} size={28 + (i % 3) * 14} />
            </span>
          ))}
        </div>
        <div className="sn-hero-copy">
          <small>{draft.mode === "manual" ? "Picked by hand" : "Automatic, by the calendar"}</small>
          <h2>
            <span aria-hidden="true">{live.icon}</span> {live.name} is live
          </h2>
          <p>
            {live.blurb}. Currency: <b>{draft.seasons[liveKey].currencyMany}</b>.
          </p>
          <p className="sn-hero-dates">
            {draft.mode === "auto" ? (
              <>
                Runs until <b>{lastDay(win.end)}</b> ({daysUntil(win.end)} days left). {SEASONS[next].icon} {SEASONS[next].name} starts {niceDate(nextWin.start)}.
              </>
            ) : (
              <>Stays {live.name} until you switch back to automatic. By the calendar it would be {SEASONS[data.calendar].name}.</>
            )}
          </p>
        </div>
        <div className="sn-hero-side">
          <span className={`sn-bot ${botAlive ? "is-on" : "is-off"}`}>
            <Bot size={14} aria-hidden="true" /> Main Bot {botAlive ? "connected" : data.state.heartbeat ? `last seen ${timeAgo(data.state.heartbeat)}` : "hasn't checked in yet"}
          </span>
          <span className="sn-bot">
            <Hash size={14} aria-hidden="true" /> Discord shows: {data.state.applied ? `${SEASONS[data.state.applied].icon} ${SEASONS[data.state.applied].name}` : "not applied yet"}
          </span>
          {preview ? (
            <button type="button" className="adm-btn adm-btn--small" onClick={() => setSeasonPreview(null)}>
              <EyeOff size={14} aria-hidden="true" /> Stop previewing {SEASONS[preview].name}
            </button>
          ) : null}
        </div>
      </div>

      {/* ---------------- calendar */}
      <div className="sn-year" aria-label="The year's seasons">
        {MONTHS.map((m, i) => (
          <div key={m} className={`sn-month is-${MONTH_SEASON[i]}${i === month ? " is-now" : ""}`}>
            <span>{m}</span>
            {i === month ? <b>Today</b> : null}
          </div>
        ))}
      </div>

      {/* ---------------- which season */}
      <div className="sn-grid">
        <div className="adm-card sn-card">
          <h3>
            <CalendarRange size={16} aria-hidden="true" /> Which season
          </h3>
          <div className="adm-seg" role="tablist" aria-label="Mode">
            <button type="button" className={draft.mode === "auto" ? "is-active" : undefined} onClick={() => set({ mode: "auto" })}>
              Automatic
            </button>
            <button type="button" className={draft.mode === "manual" ? "is-active" : undefined} onClick={() => set({ mode: "manual" })}>
              Pick by hand
            </button>
          </div>
          <div className="sn-pick">
            {SEASON_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className={`sn-pick-btn is-${k}${liveKey === k ? " is-on" : ""}`}
                disabled={draft.mode === "auto"}
                onClick={() => set({ manual: k })}
                title={draft.mode === "auto" ? "Switch to Pick by hand to choose" : `Use ${SEASONS[k].name}`}
              >
                <span aria-hidden="true">{SEASONS[k].icon}</span>
                <b>{SEASONS[k].name}</b>
                <small>{MONTHS[SEASONS[k].start[0] - 1]} – {MONTHS[(SEASONS[k].start[0] + 1) % 12]}</small>
              </button>
            ))}
          </div>
          <label className="sn-field">
            <span>Time zone the dates follow</span>
            <input value={draft.timezone} onChange={(e) => set({ timezone: e.target.value })} placeholder="US/Mountain" />
          </label>
          <p className="adm-muted sn-note">Switching the season or the mode needs two-factor sign-in, because it changes Discord too.</p>
        </div>

        <div className="adm-card sn-card">
          <h3>
            <Sparkles size={16} aria-hidden="true" /> Website effects
          </h3>
          <div className="sn-field">
            <span>Particles ({SEASONS[liveKey].particle})</span>
            <div className="adm-seg" role="tablist" aria-label="Particles">
              {(["full", "light", "off"] as const).map((p) => (
                <button key={p} type="button" className={draft.site.particles === p ? "is-active" : undefined} onClick={() => set({ site: { ...draft.site, particles: p } })}>
                  {p === "full" ? "Full" : p === "light" ? "Light" : "Off"}
                </button>
              ))}
            </div>
          </div>
          <Toggle label="Scenery" help="The sky and landscape behind every page." value={draft.site.scenery} onChange={(v) => set({ site: { ...draft.site, scenery: v } })} />
          <Toggle label="Click bursts" help="Buttons on the homepage burst into the season's shapes." value={draft.site.bursts} onChange={(v) => set({ site: { ...draft.site, bursts: v } })} />
          <p className="adm-muted sn-note">Members who ask their device for less motion never see moving effects.</p>
        </div>
      </div>

      {/* ---------------- per-season */}
      <div className="adm-card sn-card sn-seasons">
        <div className="sn-season-tabs" role="tablist" aria-label="Season">
          {SEASON_KEYS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`is-${k}${tab === k ? " is-active" : ""}`} onClick={() => setTab(k)}>
              <span aria-hidden="true">{SEASONS[k].icon}</span> {SEASONS[k].name}
              {liveKey === k ? <small>live</small> : null}
            </button>
          ))}
        </div>
        <SeasonEditor
          key={tab}
          season={tab}
          settings={draft.seasons[tab]}
          onChange={(p) => setSeason(tab, p)}
          assets={data.assets.filter((a) => a.season === tab)}
          botRoles={resolveBotRoles(meta, draft.discord.botRoles)}
          view={data.views[tab]}
          previewing={preview === tab}
          people={data.people}
          onAssetsChanged={reload}
          setMsg={setMsg}
        />
      </div>

      {/* ---------------- discord */}
      <DiscordCard draft={draft} set={set} data={data} meta={meta} liveKey={liveKey} busy={busy} onApply={apply} />

      {/* ---------------- history */}
      <div className="adm-card sn-card">
        <h3>
          <RotateCcw size={16} aria-hidden="true" /> History
        </h3>
        {data.history.length ? (
          <ul className="sn-history">
            {data.history.map((h, i) => (
              <li key={i}>
                <b>{data.people[h.by]?.name ?? (h.by === "bot" ? "Main Bot" : h.by || "Someone")}</b> {h.what}
                <time title={formatDate(h.at)}>{timeAgo(h.at)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="adm-muted">No changes yet.</p>
        )}
      </div>

      {dirty || msg ? (
        <div className={`sn-savebar${dirty ? " is-dirty" : ""}`}>
          {msg ? <span className={msg.ok ? "sn-ok" : "adm-error"}>{msg.text}</span> : <span>You have unsaved changes.</span>}
          {dirty ? (
            <span className="sn-savebar-actions">
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => (setDraft(data.config), setMsg(null))}>
                Undo
              </button>
              <button type="button" className="adm-btn adm-btn--small" disabled={busy === "save"} onClick={save}>
                <Save size={14} aria-hidden="true" /> {busy === "save" ? "Saving…" : "Save changes"}
              </button>
            </span>
          ) : (
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => setMsg(null)}>
              OK
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

type BotRole = { id: string; name: string; color: string | null };

/** The bot roles that get seasonal colors: the picked ones, or the bots' own roles named Zeo, Economy, Moderation or Tickets. */
function resolveBotRoles(meta: Meta | null, picked: string[]): BotRole[] {
  if (!meta) return [];
  if (picked.length) return picked.map((id) => meta.roles.find((r) => r.id === id) ?? { id, name: "Unknown role", color: null, managed: true });
  return meta.roles.filter((r) => r.managed && BOT_ROLE_NAMES.includes(r.name.trim().toLowerCase()));
}

/** A bot role's color this season (its own setting, or the season's colors in order). */
function botColor(settings: SeasonConfig["seasons"][SeasonKey], season: SeasonKey, roleId: string, index: number) {
  return settings.botRoleColors[roleId] ?? DEFAULT_BOT_COLORS[season][index % DEFAULT_BOT_COLORS[season].length];
}

/** Only the fields an admin edits (not version / timestamps). */
function strip(c: SeasonConfig) {
  return {
    mode: c.mode,
    manual: c.manual,
    timezone: c.timezone,
    site: c.site,
    discord: c.discord,
    seasons: Object.fromEntries(
      SEASON_KEYS.map((k) => {
        const { assets: _a, ...rest } = c.seasons[k];
        return [k, rest];
      }),
    ),
  } as Partial<SeasonConfig>;
}

/** SeasonGlyph draws the live season; this draws a given one (for the hero). */
function SeasonGlyphFor({ season, index, size }: { season: SeasonKey; index: number; size: number }) {
  return (
    <SeasonOverride season={season}>
      <SeasonGlyph index={index} size={size} />
    </SeasonOverride>
  );
}

function Toggle({ label, help, value, onChange }: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="sn-toggle">
      <span>
        <b>{label}</b>
        {help ? <small>{help}</small> : null}
      </span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

function SeasonEditor({
  season,
  settings,
  onChange,
  assets,
  view,
  previewing,
  people,
  onAssetsChanged,
  setMsg,
  botRoles,
}: {
  botRoles: BotRole[];
  season: SeasonKey;
  settings: SeasonConfig["seasons"][SeasonKey];
  onChange: (p: Partial<SeasonConfig["seasons"][SeasonKey]>) => void;
  assets: AssetInfo[];
  view: SeasonView;
  previewing: boolean;
  people: People;
  onAssetsChanged: () => void;
  setMsg: (m: { ok: boolean; text: string } | null) => void;
}) {
  const info = SEASONS[season];
  return (
    <div className="sn-editor">
      <div className="sn-editor-head">
        <div className={`sn-swatch is-${season}`}>
          {info.swatch.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </div>
        <div>
          <h4>
            {info.icon} {info.name}
          </h4>
          <p className="adm-muted">
            {info.blurb}. Particles: {info.particle}.
          </p>
        </div>
        <button type="button" className={`adm-btn adm-btn--small${previewing ? "" : " adm-btn--ghost"}`} onClick={() => setSeasonPreview(previewing ? null : season)}>
          {previewing ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />} {previewing ? "Stop preview" : "Preview on the website"}
        </button>
      </div>

      <div className="sn-editor-grid">
        <fieldset className="sn-fieldset">
          <legend>
            <Paintbrush size={14} aria-hidden="true" /> Currency
          </legend>
          <div className="sn-row">
            <label className="sn-field">
              <span>One</span>
              <input value={settings.currencyOne} maxLength={24} onChange={(e) => onChange({ currencyOne: e.target.value })} />
            </label>
            <label className="sn-field">
              <span>Many</span>
              <input value={settings.currencyMany} maxLength={24} onChange={(e) => onChange({ currencyMany: e.target.value })} />
            </label>
          </div>
          <p className="sn-example">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={view.emote} alt="" width={20} height={20} /> &ldquo;You earned <b>250 {settings.currencyMany}</b> and found <b>1 {settings.currencyOne}</b>!&rdquo;
          </p>
          <label className="sn-field">
            <span>
              Discord emoji <small>used in bot messages</small>
            </span>
            <input value={settings.discordEmoji} maxLength={80} onChange={(e) => onChange({ discordEmoji: e.target.value })} placeholder="❄️ or <:snowflake:123456789012345678>" />
          </label>
          <p className="adm-muted sn-note">A normal emoji, or a custom server emoji: type <code>\:name:</code> in Discord to copy its code.</p>
          <label className="sn-field">
            <span>
              Channel emoji <small>in front of the 🍂-style channel names</small>
            </span>
            <input value={settings.channelEmoji} maxLength={16} onChange={(e) => onChange({ channelEmoji: e.target.value })} />
          </label>
        </fieldset>

        <fieldset className="sn-fieldset sn-art">
          <legend>
            <ImageUp size={14} aria-hidden="true" /> Art
          </legend>
          {(["logo", "banner", "emote"] as AssetKind[]).map((kind) => (
            <AssetSlot
              key={kind}
              season={season}
              kind={kind}
              current={settings.assets[kind] ?? null}
              uploads={assets.filter((a) => a.kind === kind)}
              people={people}
              onChanged={onAssetsChanged}
              setMsg={setMsg}
            />
          ))}
          <div className="sn-row sn-row--toggles">
            <Toggle label="Logo on the website" value={settings.siteLogo} onChange={(v) => onChange({ siteLogo: v })} />
            <Toggle label="Banner on the website" value={settings.siteBanner} onChange={(v) => onChange({ siteBanner: v })} />
          </div>
        </fieldset>
      </div>

      <fieldset className="sn-fieldset">
        <legend>
          <Crown size={14} aria-hidden="true" /> Level roles
        </legend>
        <p className="adm-muted sn-note">The same 11 roles all year: members keep them (and their perks), only the name and color change with the season.</p>
        <div className="sn-levels">
          {settings.levelRoles.map((lr, i) => (
            <LevelRow
              key={LEVEL_TIERS[i].id}
              index={i}
              role={lr}
              onChange={(next) => onChange({ levelRoles: settings.levelRoles.map((x, j) => (j === i ? next : x)) })}
            />
          ))}
        </div>
        <div className="sn-slot-actions">
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => onChange({ levelRoles: DEFAULT_LEVEL_ROLES[season].map((x) => ({ ...x })) })}>
            <RotateCcw size={12} aria-hidden="true" /> Use the suggested {info.name} roles
          </button>
        </div>
      </fieldset>

      <fieldset className="sn-fieldset">
        <legend>
          <Bot size={14} aria-hidden="true" /> Bot role colors
        </legend>
        {botRoles.length ? (
          <div className="sn-botroles">
            {botRoles.map((br, i) => {
              const color = botColor(settings, season, br.id, i);
              return (
                <label key={br.id} className="sn-botrole">
                  <input type="color" value={color} onChange={(e) => onChange({ botRoleColors: { ...settings.botRoleColors, [br.id]: e.target.value } })} />
                  <span className="sn-pill" style={{ color, borderColor: color }}>
                    @{br.name}
                  </span>
                </label>
              );
            })}
            {Object.keys(settings.botRoleColors).length ? (
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => onChange({ botRoleColors: {} })}>
                Use the season&apos;s colors
              </button>
            ) : null}
          </div>
        ) : (
          <p className="adm-muted sn-note">No bot roles found yet. Pick them in the Discord section below.</p>
        )}
      </fieldset>
    </div>
  );
}

function LevelRow({ index, role, onChange }: { index: number; role: LevelRole; onChange: (r: LevelRole) => void }) {
  return (
    <div className="sn-level">
      <small className="sn-level-range">Lv {LEVEL_TIERS[index].range}</small>
      <input type="color" value={role.color} onChange={(e) => onChange({ ...role, color: e.target.value })} aria-label={`Color for levels ${LEVEL_TIERS[index].range}`} />
      <input className="sn-level-emoji" value={role.emoji} maxLength={16} onChange={(e) => onChange({ ...role, emoji: e.target.value })} aria-label="Emoji" />
      <input className="sn-level-name" value={role.name} maxLength={40} onChange={(e) => onChange({ ...role, name: e.target.value })} aria-label="Name" />
      <span className="sn-pill" style={{ color: role.color, borderColor: role.color }} title="How it looks in Discord">
        {levelRoleName(role, index)}
      </span>
    </div>
  );
}

function AssetSlot({
  season,
  kind,
  current,
  uploads,
  people,
  onChanged,
  setMsg,
}: {
  season: SeasonKey;
  kind: AssetKind;
  current: string | null;
  uploads: AssetInfo[];
  people: People;
  onChanged: () => void;
  setMsg: (m: { ok: boolean; text: string } | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const src = current ? `/season/${kind}?s=${season}&id=${current}` : `/season/${kind}?s=${season}`;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const upload = (file: File) => {
    const form = new FormData();
    form.set("season", season);
    form.set("kind", kind);
    form.set("file", file);
    void run(() => send("/api/admin/seasons/assets", "POST", form), `${SEASONS[season].name} ${KIND_LABEL[kind].title.toLowerCase()} updated.`);
  };
  return (
    <div className={`sn-slot sn-slot--${kind}`}>
      <div className="sn-slot-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" />
        {!current ? <small>Default</small> : null}
      </div>
      <div className="sn-slot-body">
        <b>{KIND_LABEL[kind].title}</b>
        <small className="adm-muted">{KIND_LABEL[kind].help}</small>
        <div className="sn-slot-actions">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button type="button" className="adm-btn adm-btn--tiny" disabled={busy} onClick={() => input.current?.click()}>
            <ImageUp size={12} aria-hidden="true" /> {busy ? "Uploading…" : "Upload"}
          </button>
          {current ? (
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" disabled={busy} onClick={() => run(() => send("/api/admin/seasons/assets/default", "PATCH", { season, kind }), "Back to the default.")}>
              Use default
            </button>
          ) : null}
          {uploads.length ? (
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Hide" : `Past uploads (${uploads.length})`}
            </button>
          ) : null}
        </div>
        {showAll ? (
          <ul className="sn-uploads">
            {uploads.map((a) => (
              <li key={a.id} className={a.id === current ? "is-on" : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/season/${kind}?s=${season}&id=${a.id}`} alt="" />
                <span>
                  {a.name || "image"}
                  <small>
                    {Math.round(a.size / 1024)} KB · {people[a.by ?? ""]?.name ?? "admin"} · {timeAgo(a.at)}
                  </small>
                </span>
                {a.id === current ? (
                  <span className="sn-inuse">
                    <Check size={12} aria-hidden="true" /> In use
                  </span>
                ) : (
                  <button type="button" className="adm-btn adm-btn--tiny" disabled={busy} onClick={() => run(() => send(`/api/admin/seasons/assets/${a.id}`, "PATCH", { season, kind }), "Switched.")}>
                    Use
                  </button>
                )}
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny sn-danger" disabled={busy} aria-label="Delete" onClick={() => run(() => send(`/api/admin/seasons/assets/${a.id}`, "DELETE"), "Deleted.")}>
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function DiscordCard({
  draft,
  set,
  data,
  meta,
  liveKey,
  busy,
  onApply,
}: {
  draft: SeasonConfig;
  set: (p: Partial<SeasonConfig>) => void;
  data: Data;
  meta: Meta | null;
  liveKey: SeasonKey;
  busy: string | null;
  onApply: () => void;
}) {
  const emojis = SEASON_KEYS.map((k) => draft.seasons[k].channelEmoji);
  const to = draft.seasons[liveKey].channelEmoji;
  // Channels and categories whose names start with any season's channel emoji
  const plan = useMemo(() => {
    if (!meta) return null;
    const rows: { id: string; name: string; next: string; category: boolean }[] = [];
    const swap = (name: string) => {
      const from = emojis.find((e) => name.startsWith(e));
      return from ? to + name.slice(from.length) : null;
    };
    if (draft.discord.renameCategories)
      for (const c of meta.categories) {
        const n = swap(c.name);
        if (n) rows.push({ id: c.id, name: c.name, next: n, category: true });
      }
    if (draft.discord.renameChannels)
      for (const c of meta.channels) {
        const n = swap(c.name);
        if (n) rows.push({ id: c.id, name: c.name, next: n, category: false });
      }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, JSON.stringify(emojis), to, draft.discord.renameCategories, draft.discord.renameChannels]);
  const changing = plan?.filter((r) => r.name !== r.next) ?? [];
  const botRoles = resolveBotRoles(meta, draft.discord.botRoles);
  const liveSettings = draft.seasons[liveKey];
  const roleRows = [
    ...(draft.discord.levelRoles
      ? LEVEL_TIERS.map((t, i) => {
          const now = meta?.roles.find((r) => r.id === t.id);
          return { id: t.id, from: now?.name ?? "Level role", fromColor: now?.color ?? null, to: levelRoleName(liveSettings.levelRoles[i], i), toColor: liveSettings.levelRoles[i].color };
        })
      : []),
    ...(draft.discord.botRoleColors
      ? botRoles.map((b, i) => ({ id: b.id, from: b.name, fromColor: b.color, to: b.name, toColor: botColor(liveSettings, liveKey, b.id, i) }))
      : []),
  ];

  return (
    <div className="adm-card sn-card">
      <h3>
        <Globe size={16} aria-hidden="true" /> Discord
      </h3>
      <p className="adm-muted sn-note">
        When the season changes, the Main Bot swaps the season emoji at the start of channel and category names (only the ones that already start with a season emoji), and sets the season&apos;s server icon and banner if you uploaded them.
      </p>
      <div className="sn-row sn-row--toggles">
        <Toggle label="Channel emojis" value={draft.discord.renameChannels} onChange={(v) => set({ discord: { ...draft.discord, renameChannels: v } })} />
        <Toggle label="Category emojis" value={draft.discord.renameCategories} onChange={(v) => set({ discord: { ...draft.discord, renameCategories: v } })} />
        <Toggle label="Server icon" value={draft.discord.swapIcon} onChange={(v) => set({ discord: { ...draft.discord, swapIcon: v } })} />
        <Toggle label="Server banner" value={draft.discord.swapBanner} onChange={(v) => set({ discord: { ...draft.discord, swapBanner: v } })} />
        <Toggle label="Level roles" help="Names and colors" value={draft.discord.levelRoles} onChange={(v) => set({ discord: { ...draft.discord, levelRoles: v } })} />
        <Toggle label="Bot role colors" value={draft.discord.botRoleColors} onChange={(v) => set({ discord: { ...draft.discord, botRoleColors: v } })} />
      </div>
      {draft.discord.botRoleColors ? (
        <div className="sn-field">
          <span>
            Bot roles to recolor <small>empty: the bots&apos; own roles named Zeo, Economy, Moderation or Tickets</small>
          </span>
          <Picker
            kind="role"
            multiple
            value={draft.discord.botRoles}
            onChange={(v) => set({ discord: { ...draft.discord, botRoles: (v as string[]) ?? [] } })}
            options={(meta?.roles ?? []).filter((r) => r.managed).map((r) => ({ id: r.id, label: r.name, color: r.color, sub: "Bot role" }))}
            placeholder={botRoles.length ? `Automatic: ${botRoles.map((b) => b.name).join(", ")}` : "Automatic"}
          />
        </div>
      ) : null}

      <div className="sn-plan">
        <div className="sn-plan-head">
          <b>
            {SEASONS[liveKey].icon} What {SEASONS[liveKey].name} looks like in Discord
          </b>
          <small className="adm-muted">{plan ? `${plan.length} name${plan.length === 1 ? "" : "s"} carry a season emoji · ${changing.length} would change` : "Loading the channel list…"}</small>
        </div>
        {plan?.length ? (
          <ul className="sn-plan-list">
            {plan.map((r) => (
              <li key={r.id} className={r.name === r.next ? "is-same" : undefined}>
                <small>{r.category ? "Category" : "#"}</small>
                <span className="sn-from">{r.name}</span>
                {r.name === r.next ? <span className="adm-muted">already set</span> : <span className="sn-to">→ {r.next}</span>}
              </li>
            ))}
          </ul>
        ) : plan ? (
          <p className="adm-muted">No channel or category names start with a season emoji.</p>
        ) : null}
        {roleRows.length ? (
          <>
            <b className="sn-plan-sub">Roles</b>
            <ul className="sn-plan-list sn-plan-roles">
              {roleRows.map((r) => {
                const same = r.from === r.to && (r.fromColor ?? "").toLowerCase() === r.toColor.toLowerCase();
                return (
                  <li key={r.id} className={same ? "is-same" : undefined}>
                    <i className="sn-dot" style={{ background: r.fromColor ?? "var(--muted)" }} />
                    <span className="sn-from">{r.from}</span>
                    {same ? (
                      <span className="adm-muted">already set</span>
                    ) : (
                      <span className="sn-to">
                        → <i className="sn-dot" style={{ background: r.toColor }} /> {r.to}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
        <ul className="sn-plan-extra">
          <li>
            Server icon: {draft.discord.swapIcon ? (draft.seasons[liveKey].assets.logo ? "the uploaded " + SEASONS[liveKey].name + " logo" : "unchanged (no logo uploaded)") : "not changed (off)"}
          </li>
          <li>
            Server banner: {draft.discord.swapBanner ? (draft.seasons[liveKey].assets.banner ? "the uploaded " + SEASONS[liveKey].name + " banner" : "unchanged (no banner uploaded)") : "not changed (off)"}
          </li>
          <li>Currency in bot messages: {draft.seasons[liveKey].discordEmoji} {draft.seasons[liveKey].currencyMany}</li>
        </ul>
      </div>

      <div className="sn-apply">
        <button type="button" className="adm-btn adm-btn--small" disabled={busy === "apply" || data.state.pending} onClick={onApply}>
          {data.state.pending ? <RefreshCw size={14} className="sn-spin" aria-hidden="true" /> : <Wand2 size={14} aria-hidden="true" />}{" "}
          {data.state.pending ? "Waiting for the bot…" : "Apply to Discord now"}
        </button>
        <span className="adm-muted">
          The bot also does this on its own when the season changes.
          {data.state.appliedAt ? ` Last applied ${timeAgo(data.state.appliedAt)} (${data.state.applied ? SEASONS[data.state.applied].name : "?"}).` : ""}
        </span>
      </div>
      {data.state.rolesPending ? (
        <p className="adm-muted sn-note">
          {data.state.rolesPending} role change{data.state.rolesPending === 1 ? " is" : "s are"} waiting for a bot ranked above {data.state.rolesPending === 1 ? "that role" : "those roles"} (the Main Bot can only edit roles below its own).
        </p>
      ) : null}
      {data.state.errors.length || data.state.channels.some((c) => !c.ok) || data.state.roles.some((c) => !c.ok) ? (
        <div className="sn-errors">
          <b>
            <AlertTriangle size={14} aria-hidden="true" /> Last time, some things didn&apos;t work
          </b>
          <ul>
            {data.state.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {data.state.roles
              .filter((c) => !c.ok)
              .map((c) => (
                <li key={`r${c.id}`}>
                  {c.from}: {c.error ?? "couldn't change"}
                </li>
              ))}
            {data.state.channels
              .filter((c) => !c.ok)
              .map((c) => (
                <li key={c.id}>
                  {c.from}: {c.error ?? "couldn't rename"}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
