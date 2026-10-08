"use client";

import "./bots.css";
import {
  Activity,
  Bot,
  CircleDot,
  Code2,
  Crown,
  Download,
  CalendarDays,
  BadgeCheck,
  Bell,
  ClipboardList,
  DoorOpen,
  Folder,
  PanelTop,
  Lock,
  LogOut,
  SquareTerminal,
  Trash2,
  VolumeX,
  Dices,
  ExternalLink,
  FileText,
  Gift,
  MessageSquare,
  Puzzle,
  Rocket,
  TrendingUp,
  Gem,
  Heart,
  History,
  Image as ImageIcon,
  Link2,
  Megaphone,
  Mic,
  Palette,
  RotateCcw,
  ScrollText,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { botDef, type Field } from "../../../lib/bot-settings/schema";
import type { BotSettingsView } from "../../../lib/bot-settings/store";
import { timeAgo } from "../admin-shared";
import { ChangeLog } from "./change-log";
import { Picker, channelOptions, roleOptions, type Meta } from "./pickers";

const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  scroll: ScrollText,
  image: ImageIcon,
  crown: Crown,
  palette: Palette,
  bag: ShoppingBag,
  gem: Gem,
  link: Link2,
  shield: Shield,
  heart: Heart,
  mic: Mic,
  sparkles: Sparkles,
  megaphone: Megaphone,
  message: MessageSquare,
  trending: TrendingUp,
  calendar: CalendarDays,
  dice: Dices,
  puzzle: Puzzle,
  rocket: Rocket,
  gift: Gift,
  door: DoorOpen,
  volumex: VolumeX,
  logout: LogOut,
  lock: Lock,
  terminal: SquareTerminal,
  trash: Trash2,
  folder: Folder,
  bell: Bell,
  clipboard: ClipboardList,
  badge: BadgeCheck,
  panel: PanelTop,
  file: FileText,
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Shows a value the way a config file would. */
function yamlValue(v: unknown, indent = "  "): string {
  if (Array.isArray(v)) return v.length ? "\n" + v.map((x) => `${indent}- ${JSON.stringify(x)}`).join("\n") : " []";
  if (v === null || v === undefined) return " ~";
  if (typeof v === "string") return ` ${JSON.stringify(v)}`;
  return ` ${String(v)}`;
}

/** Admin → Bots → one bot: every setting, grouped like a config file, with live status and history. */
export function BotSettingsTab({ botKey }: { botKey: string }) {
  const bot = botDef(botKey);
  const [data, setData] = useState<(BotSettingsView & { ok: boolean; error?: string }) | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [section, setSection] = useState(bot?.sections[0]?.key ?? "");
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [view, setView] = useState<"form" | "raw" | "history">("form");
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [importText, setImportText] = useState<string | null>(null);

  // Background refreshes keep the last good copy (and any unsaved edits) if one request fails
  const load = async () => {
    const r = await fetch(`/api/admin/bots/${botKey}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    setData((prev) => (r?.ok ? r : prev?.ok ? prev : (r ?? { ok: false, error: "Couldn't load the settings." })));
  };
  useEffect(() => {
    if (!bot?.ready) return;
    void load();
    fetch("/api/admin/bots/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setMeta(r))
      .catch(() => undefined);
    const t = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botKey]);

  const fields = useMemo(() => (bot ? bot.sections.flatMap((s) => s.fields.map((f) => ({ ...f, section: s.key }))) : []), [bot]);

  if (!bot) return <p className="adm-error">Unknown bot.</p>;
  if (!bot.ready) return <ComingSoon name={bot.name} about={bot.about} />;
  if (!data) return <div className="adm-skeleton" style={{ height: 480 }} />;
  if (!data.ok) return <p className="adm-error">{data.error}</p>;

  const valueOf = (f: Field) => (f.key in draft ? draft[f.key] : data.values[f.key]);
  const dirtyKeys = Object.keys(draft).filter((k) => !same(draft[k], data.values[k]));
  const online = data.heartbeatAt ? Date.now() - Date.parse(data.heartbeatAt) < 3 * 60_000 : false;
  const live = data.appliedVersion !== null && data.appliedVersion >= data.version;
  const needle = q.trim().toLowerCase();
  const matches = (f: Field) => !needle || `${f.label} ${f.help} ${f.key}`.toLowerCase().includes(needle);
  const shownSections = bot.sections.filter((s) => (needle ? s.fields.some(matches) : s.key === section));

  const set = (key: string, v: unknown) => {
    setDraft((d) => ({ ...d, [key]: v }));
    setMsg(null);
  };
  const save = async () => {
    const changes: Record<string, unknown> = {};
    for (const k of dirtyKeys) changes[k] = draft[k];
    setBusy(true);
    const r = await fetch(`/api/admin/bots/${botKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes, note }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return setMsg({ ok: false, text: r?.error ?? "Couldn't save." });
    setData(r);
    setDraft({});
    setNote("");
    setMsg({ ok: true, text: `Saved as version ${r.version}. The bot picks it up within about 10 seconds.` });
  };
  const resetField = (f: Field) => set(f.key, f.default);

  const raw = bot.sections
    .filter((s) => s.fields.length)
    .map((s) => `# ${s.title}: ${s.about}\n${s.key}:\n${s.fields.map((f) => `  ${f.key.split(".").slice(1).join(".")}:${yamlValue(valueOf(f), "    ")}`).join("\n")}`)
    .join("\n\n");
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(Object.fromEntries(fields.map((f) => [f.key, valueOf(f)])), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${bot.key}-bot-settings.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const applyImport = () => {
    try {
      const obj = JSON.parse(importText ?? "{}") as Record<string, unknown>;
      const known = new Set(fields.map((f) => f.key));
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) if (known.has(k)) next[k] = v;
      setDraft((d) => ({ ...d, ...next }));
      setImportText(null);
      setView("form");
      setMsg({ ok: true, text: `Loaded ${Object.keys(next).length} settings into the form. Review them, then save.` });
    } catch {
      setMsg({ ok: false, text: "That isn't valid JSON." });
    }
  };

  return (
    <section className="adm-panel bs">
      <header className="adm-card bs-head">
        <div className="bs-head-bot">
          <span className="bs-head-icon" aria-hidden="true">
            <Bot size={22} />
          </span>
          <div>
            <h2>{bot.name}</h2>
            <p className="adm-muted">{bot.about}</p>
          </div>
        </div>
        <div className="bs-head-status">
          <span className={`bs-pill ${online ? "is-ok" : "is-off"}`} title={data.heartbeatAt ? `Last heard from ${timeAgo(data.heartbeatAt)}` : "Never heard from"}>
            <CircleDot size={13} aria-hidden="true" /> {online ? `Online${data.latencyMs ? ` · ${data.latencyMs}ms` : ""}` : data.heartbeatAt ? `Offline · last seen ${timeAgo(data.heartbeatAt)}` : "Not connected yet"}
          </span>
          <span className={`bs-pill ${live ? "is-ok" : "is-wait"}`} title="Settings version saved / applied by the bot">
            {live ? `Live: version ${data.version}` : data.appliedVersion === null ? "Waiting for the bot to connect" : `Applying version ${data.version}…`}
          </span>
          {data.updatedAt ? (
            <small className="adm-muted">
              Last change {timeAgo(data.updatedAt)}
              {data.updatedBy ? ` by ${data.updatedBy}` : ""}
            </small>
          ) : null}
        </div>
      </header>

      <div className="bs-toolbar">
        <div className="adm-seg" role="tablist">
          <button type="button" className={view === "form" ? "is-active" : undefined} onClick={() => setView("form")}>
            Settings
          </button>
          <button type="button" className={view === "raw" ? "is-active" : undefined} onClick={() => setView("raw")}>
            <Code2 size={14} aria-hidden="true" /> Config file
          </button>
          <button type="button" className={view === "history" ? "is-active" : undefined} onClick={() => (setHistoryKey(null), setView("history"))}>
            <History size={14} aria-hidden="true" /> History
          </button>
        </div>
        {view === "form" ? (
          <label className="adm-search bs-search">
            <Search size={15} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every setting" aria-label="Search settings" />
          </label>
        ) : null}
      </div>

      {view === "raw" ? (
        <div className="adm-card bs-raw">
          <div className="bs-raw-actions">
            <p className="adm-muted">Every setting as a config file (what the bot is using, plus your unsaved edits). Export it as JSON to keep a backup, or import one to load it into the form.</p>
            <button type="button" className="adm-btn adm-btn--small" onClick={exportJson}>
              <Download size={14} aria-hidden="true" /> Export JSON
            </button>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setImportText(importText === null ? "" : null)}>
              <Upload size={14} aria-hidden="true" /> Import JSON
            </button>
          </div>
          {importText !== null ? (
            <div className="bs-import">
              <textarea rows={8} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{ "media.level": 5, ... }' />
              <button type="button" className="adm-btn adm-btn--small" onClick={applyImport} disabled={!importText.trim()}>
                Load into the form
              </button>
            </div>
          ) : null}
          <pre>{raw}</pre>
        </div>
      ) : view === "history" ? (
        <ChangeLog bot={botKey} settingKey={historyKey} onClearKey={() => setHistoryKey(null)} onReverted={() => void load()} />
      ) : (
        <div className="bs-layout">
          <nav className="bs-nav" aria-label="Sections">
            {bot.sections.map((s) => {
              const Icon = ICONS[s.icon] ?? Sparkles;
              const changed = s.fields.filter((f) => data.changed.includes(f.key)).length;
              const unsaved = s.fields.filter((f) => dirtyKeys.includes(f.key)).length;
              return (
                <button key={s.key} type="button" className={!needle && section === s.key ? "is-on" : undefined} onClick={() => (setQ(""), setSection(s.key))}>
                  <Icon size={16} aria-hidden="true" />
                  <span>{s.title}</span>
                  {unsaved ? <em className="bs-badge is-unsaved">{unsaved}</em> : changed ? <em className="bs-badge">{changed}</em> : null}
                </button>
              );
            })}
          </nav>

          <div className="bs-sections">
            {shownSections.map((s) => {
              const Icon = ICONS[s.icon] ?? Sparkles;
              return (
                <div key={s.key} className="adm-card bs-section">
                  <header>
                    <h3>
                      <Icon size={18} aria-hidden="true" /> {s.title}
                    </h3>
                    <p className="adm-muted">{s.about}</p>
                    {s.link ? (
                      <a className="adm-btn adm-btn--ghost adm-btn--small" href={s.link.href}>
                        <ExternalLink size={14} aria-hidden="true" /> {s.link.label}
                      </a>
                    ) : null}
                  </header>
                  {s.fields.filter(matches).map((f) => {
                    const v = valueOf(f);
                    const isDefault = same(v, f.default);
                    const unsaved = dirtyKeys.includes(f.key);
                    return (
                      <div key={f.key} className={`bs-field${unsaved ? " is-unsaved" : ""}`}>
                        <div className="bs-field-text">
                          <b>
                            {f.label}
                            {f.shared ? <em className="bs-tag is-shared" title="The website uses this setting too">bot + website</em> : null}
                            {unsaved ? <em className="bs-tag is-unsaved">unsaved</em> : !isDefault ? <em className="bs-tag">changed</em> : null}
                          </b>
                          <small>{f.help}</small>
                          <code className="bs-key">{f.key}</code>
                        </div>
                        <div className="bs-field-control">
                          <Control field={f} value={v} meta={meta} onChange={(nv) => set(f.key, nv)} />
                          <div className="bs-field-actions">
                            {!isDefault ? (
                              <button type="button" onClick={() => resetField(f)} title="Back to the default">
                                <RotateCcw size={13} aria-hidden="true" /> Default
                              </button>
                            ) : null}
                            <button type="button" onClick={() => (setHistoryKey(f.key), setView("history"))} title="Who changed this and when">
                              <History size={13} aria-hidden="true" /> History
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!s.fields.length && !s.link ? <p className="adm-muted">Nothing to set here yet.</p> : null}
                </div>
              );
            })}
            {needle && !shownSections.length ? <div className="adm-empty">No settings match “{q}”.</div> : null}
          </div>
        </div>
      )}

      {msg ? <p className={msg.ok ? "adm-notice" : "adm-error"}>{msg.text}</p> : null}
      {dirtyKeys.length ? (
        <div className="bs-savebar" role="region" aria-label="Unsaved changes">
          <b>
            {dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? "" : "s"}
          </b>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (optional, shown in History)" maxLength={200} aria-label="Change note" />
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => (setDraft({}), setMsg(null))} disabled={busy}>
            Discard
          </button>
          <button type="button" className="adm-btn" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

const TIMEZONES = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
})();

/** The input for one setting. */
function Control({ field: f, value, meta, onChange }: { field: Field; value: unknown; meta: Meta | null; onChange: (v: unknown) => void }) {
  switch (f.type) {
    case "toggle":
      return (
        <button type="button" role="switch" aria-checked={Boolean(value)} className={`bs-switch${value ? " is-on" : ""}`} onClick={() => onChange(!value)}>
          <span aria-hidden="true" />
          {value ? "On" : "Off"}
        </button>
      );
    case "number":
      return (
        <span className="bs-number">
          <input type="number" value={value === null || value === undefined ? "" : String(value)} min={f.min} max={f.max} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
          {f.unit ? <small>{f.unit}</small> : null}
          {f.min !== undefined && f.max !== undefined ? <small className="bs-range">{f.min}–{f.max.toLocaleString()}</small> : null}
        </span>
      );
    case "select":
      return (
        <select className="adm-select" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "text":
    case "timezone":
      return (
        <>
          <input className="bs-text" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} maxLength={f.maxLength} list={f.type === "timezone" ? "bs-timezones" : undefined} />
          {f.type === "timezone" ? (
            <datalist id="bs-timezones">
              {["US/Mountain", "US/Pacific", "US/Central", "US/Eastern", ...TIMEZONES].map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          ) : null}
        </>
      );
    case "color": {
      const hex = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : String(f.default);
      return (
        <span className="bs-color">
          <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={f.label} />
          <input className="bs-text" value={String(value ?? "")} maxLength={7} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
        </span>
      );
    }
    case "textarea":
      return <textarea className="bs-text" rows={4} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} maxLength={f.maxLength} />;
    case "list": {
      const lines = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="bs-list">
          <textarea rows={Math.min(12, Math.max(4, lines.length + 1))} value={lines.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} spellCheck />
          <small>
            {lines.filter((l) => l.trim()).length} line{lines.length === 1 ? "" : "s"}
            {f.maxItems ? ` (max ${f.maxItems})` : ""}
            {f.itemHint ? ` · ${f.itemHint}` : ""}
          </small>
        </div>
      );
    }
    case "channel":
    case "channels":
      return (
        <Picker
          kind="channel"
          multiple={f.type === "channels"}
          allowEmpty={f.default === null}
          options={channelOptions(meta, f.channelKind ?? "any")}
          value={(value as string | string[] | null) ?? (f.type === "channels" ? [] : null)}
          onChange={onChange}
          placeholder={f.type === "channels" ? (f.channelKind === "category" ? "No categories" : "None") : "Pick a channel"}
        />
      );
    case "role":
    case "roles":
      return (
        <Picker
          kind="role"
          multiple={f.type === "roles"}
          allowEmpty={f.default === null}
          options={roleOptions(meta)}
          value={(value as string | string[] | null) ?? (f.type === "roles" ? [] : null)}
          onChange={onChange}
          placeholder={f.default === null ? "Automatic" : "Pick a role"}
        />
      );
  }
}

function ComingSoon({ name, about }: { name: string; about: string }) {
  return (
    <section className="adm-panel">
      <div className="adm-card bs-soon">
        <Bot size={28} aria-hidden="true" />
        <h2>{name}</h2>
        <p className="adm-muted">{about}</p>
        <p>
          This bot&apos;s settings page is next. It will work the same way as the Main Bot: every feature&apos;s settings in one place, saved changes reach the bot within seconds, and every
          change is logged with who made it.
        </p>
      </div>
    </section>
  );
}
