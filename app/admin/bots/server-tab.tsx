"use client";

import "./bots.css";
import { Gem, Hash, Shield, Smile, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { GuildInfo, GuildSettings } from "../../../lib/bot-settings/guild";
import { ChangeLog } from "./change-log";
import { Picker, channelOptions, type Meta } from "./pickers";

type Data = { ok: boolean; error?: string; settings: GuildSettings; info: GuildInfo };

const VERIFICATION = [
  [0, "None", "Anyone can chat right away."],
  [1, "Low", "Must have a verified email."],
  [2, "Medium", "…and be on Discord for 5 minutes."],
  [3, "High", "…and be in the server for 10 minutes."],
  [4, "Highest", "Must have a verified phone number."],
] as const;
const FILTER = [
  [0, "Off", "Don't scan media."],
  [1, "Members without roles", "Scan media from members without a role."],
  [2, "Everyone", "Scan media from everyone."],
] as const;
const AFK = [60, 300, 900, 1800, 3600];
const FLAGS = [
  [1, "Welcome message when someone joins"],
  [2, "Thank-you message when someone boosts"],
  [4, "Server setup tips"],
  [8, "Sticker reply button on welcome messages"],
] as const;
const LOCALES = ["en-US", "en-GB", "es-ES", "fr", "de", "pt-BR", "it", "nl", "pl", "ru", "ja", "ko", "zh-CN"];

/** Admin → Bots → Discord Server: the server's own settings, changed through the bot. */
export function ServerSettingsTab() {
  const [data, setData] = useState<Data | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [form, setForm] = useState<GuildSettings | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const r = await fetch("/api/admin/bots/server", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    setData(r ?? { ok: false, error: "Couldn't reach Discord." });
    if (r?.ok) setForm(r.settings);
  };
  useEffect(() => {
    void load();
    fetch("/api/admin/bots/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setMeta(r))
      .catch(() => undefined);
  }, []);

  if (!data) return <div className="adm-skeleton" style={{ height: 480 }} />;
  if (!data.ok || !form) return <p className="adm-error">{data.error ?? "Couldn't load the server settings."}</p>;

  const changes = Object.fromEntries(Object.entries(form).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(data.settings[k as keyof GuildSettings])));
  const dirty = Object.keys(changes).length;
  const set = <K extends keyof GuildSettings>(k: K, v: GuildSettings[K]) => {
    setForm({ ...form, [k]: v });
    setMsg(null);
  };
  const save = async () => {
    setBusy(true);
    const r = await fetch("/api/admin/bots/server", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes, reason }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return setMsg({ ok: false, text: r?.error ?? "Couldn't save." });
    setData(r);
    setForm(r.settings);
    setReason("");
    setMsg({ ok: true, text: "Saved in Discord. It's in the server's audit log and the history below." });
  };
  const { info } = data;
  const text = channelOptions(meta, "text");
  const voice = channelOptions(meta, "voice");
  const chan = (k: "afk_channel_id" | "system_channel_id" | "rules_channel_id" | "public_updates_channel_id" | "safety_alerts_channel_id", opts = text) => (
    <Picker kind="channel" options={opts} value={form[k]} allowEmpty onChange={(v) => set(k, (v as string | null) ?? null)} placeholder="None" />
  );

  return (
    <section className="adm-panel bs">
      <header className="adm-card bs-guild">
        {info.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.icon} alt="" width={64} height={64} />
        ) : null}
        <div>
          <h2>{data.settings.name}</h2>
          <p className="adm-muted">{data.settings.description ?? "No description"}</p>
        </div>
        <ul className="bs-guild-stats">
          <li>
            <Users size={15} aria-hidden="true" /> <b>{info.members?.toLocaleString() ?? "?"}</b> members{info.online !== null ? ` · ${info.online.toLocaleString()} online` : ""}
          </li>
          <li>
            <Gem size={15} aria-hidden="true" /> <b>{info.boosts}</b> boosts · level {info.boostTier}
          </li>
          <li>
            <Hash size={15} aria-hidden="true" /> <b>{info.channels}</b> channels · <b>{info.roles}</b> roles
          </li>
          <li>
            <Smile size={15} aria-hidden="true" /> <b>{info.emojis}</b> emoji · <b>{info.stickers}</b> stickers
          </li>
        </ul>
      </header>

      <div className="adm-card bs-section">
        <header>
          <h3>Profile</h3>
        </header>
        <div className="bs-field">
          <div className="bs-field-text">
            <b>Server name</b>
            <small>2 to 100 characters.</small>
          </div>
          <div className="bs-field-control">
            <input className="bs-text" value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} />
          </div>
        </div>
        <div className="bs-field">
          <div className="bs-field-text">
            <b>Description</b>
            <small>Shown in Server Discovery and invites (Community servers). Up to 120 characters.</small>
          </div>
          <div className="bs-field-control">
            <textarea className="bs-text" rows={3} maxLength={120} value={form.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />
          </div>
        </div>
        <div className="bs-field">
          <div className="bs-field-text">
            <b>Server language</b>
            <small>Used for Discovery and system messages.</small>
          </div>
          <div className="bs-field-control">
            <select className="adm-select" value={form.preferred_locale} onChange={(e) => set("preferred_locale", e.target.value)}>
              {Array.from(new Set([form.preferred_locale, ...LOCALES])).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="bs-field">
          <div className="bs-field-text">
            <b>Boost progress bar</b>
            <small>Show the boost goal bar under the server name.</small>
          </div>
          <div className="bs-field-control">
            <button type="button" role="switch" aria-checked={form.premium_progress_bar_enabled} className={`bs-switch${form.premium_progress_bar_enabled ? " is-on" : ""}`} onClick={() => set("premium_progress_bar_enabled", !form.premium_progress_bar_enabled)}>
              <span aria-hidden="true" />
              {form.premium_progress_bar_enabled ? "On" : "Off"}
            </button>
          </div>
        </div>
      </div>

      <div className="adm-card bs-section">
        <header>
          <h3>
            <Shield size={18} aria-hidden="true" /> Safety
          </h3>
        </header>
        <div className="bs-field">
          <div className="bs-field-text">
            <b>Verification level</b>
            <small>What new members need before they can chat.</small>
          </div>
          <div className="bs-field-control bs-choices">
            {VERIFICATION.map(([v, label, hint]) => (
              <button key={v} type="button" className={form.verification_level === v ? "is-on" : undefined} onClick={() => set("verification_level", v)}>
                <b>{label}</b>
                <small>{hint}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="bs-field">
          <div className="bs-field-text">
            <b>Explicit media filter</b>
            <small>Discord&apos;s automatic scan of images and videos.</small>
          </div>
          <div className="bs-field-control bs-choices">
            {FILTER.map(([v, label, hint]) => (
              <button key={v} type="button" className={form.explicit_content_filter === v ? "is-on" : undefined} onClick={() => set("explicit_content_filter", v)}>
                <b>{label}</b>
                <small>{hint}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="bs-field">
          <div className="bs-field-text">
            <b>Default notifications</b>
            <small>What new members are notified about.</small>
          </div>
          <div className="bs-field-control">
            <select className="adm-select" value={form.default_message_notifications} onChange={(e) => set("default_message_notifications", Number(e.target.value))}>
              <option value={0}>All messages</option>
              <option value={1}>Only @mentions</option>
            </select>
          </div>
        </div>
      </div>

      <div className="adm-card bs-section">
        <header>
          <h3>Channels</h3>
        </header>
        <div className="bs-field">
          <div className="bs-field-text">
            <b>System messages channel</b>
            <small>Where Discord posts joins and boosts.</small>
          </div>
          <div className="bs-field-control">
            {chan("system_channel_id")}
            <div className="bs-flags">
              {FLAGS.map(([bit, label]) => {
                // Discord stores these as "suppress" flags: a set bit means the message is OFF
                const on = (form.system_channel_flags & bit) === 0;
                return (
                  <label key={bit}>
                    <input type="checkbox" checked={on} onChange={(e) => set("system_channel_flags", e.target.checked ? form.system_channel_flags & ~bit : form.system_channel_flags | bit)} />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="bs-field">
          <div className="bs-field-text">
            <b>AFK channel</b>
            <small>Idle members in voice are moved here.</small>
          </div>
          <div className="bs-field-control">
            {chan("afk_channel_id", voice)}
            <select className="adm-select" value={form.afk_timeout} onChange={(e) => set("afk_timeout", Number(e.target.value))} aria-label="AFK timeout">
              {AFK.map((s) => (
                <option key={s} value={s}>
                  after {s < 3600 ? `${s / 60} minute${s === 60 ? "" : "s"}` : "1 hour"}
                </option>
              ))}
            </select>
          </div>
        </div>
        {info.community ? (
          <>
            <div className="bs-field">
              <div className="bs-field-text">
                <b>Rules channel</b>
                <small>Required for Community servers.</small>
              </div>
              <div className="bs-field-control">{chan("rules_channel_id")}</div>
            </div>
            <div className="bs-field">
              <div className="bs-field-text">
                <b>Community updates channel</b>
                <small>Where Discord sends moderator notices.</small>
              </div>
              <div className="bs-field-control">{chan("public_updates_channel_id")}</div>
            </div>
            <div className="bs-field">
              <div className="bs-field-text">
                <b>Safety alerts channel</b>
                <small>Raid and spam alerts from Discord.</small>
              </div>
              <div className="bs-field-control">{chan("safety_alerts_channel_id")}</div>
            </div>
          </>
        ) : null}
      </div>

      {msg ? <p className={msg.ok ? "adm-notice" : "adm-error"}>{msg.text}</p> : null}
      {dirty ? (
        <div className="bs-savebar">
          <b>
            {dirty} unsaved change{dirty === 1 ? "" : "s"}
          </b>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (goes in Discord's audit log)" maxLength={200} aria-label="Reason" />
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => (setForm(data.settings), setMsg(null))} disabled={busy}>
            Discard
          </button>
          <button type="button" className="adm-btn" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save to Discord"}
          </button>
        </div>
      ) : null}

      <ChangeLog bot="server" />
    </section>
  );
}
