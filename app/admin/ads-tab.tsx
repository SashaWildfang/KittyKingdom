"use client";

import "./ads-tab.css";
import { Megaphone, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { AD_LIMITS, type AdSettings } from "../../lib/ads-catalog";
import { formatDate, timeAgo, useLive } from "./admin-shared";

type Overview = {
  ok: boolean;
  error?: string;
  settings: AdSettings;
  total: number;
  lastWeek: number;
  lastAt: string | null;
  perAd: { key: string; label: string; about: string; shown: number; lastShown: string | null }[];
  recent: { key: string; label: string; channelId: string; channelName: string | null; trigger: "auto" | "manual"; at: string }[];
};

const NUMBERS: { key: keyof typeof AD_LIMITS; label: string; unit: string; hint: string }[] = [
  { key: "threshold", label: "Messages needed", unit: "messages", hint: "How many messages a channel needs (inside the window) before it can get a tip." },
  { key: "windowMinutes", label: "Counting window", unit: "minutes", hint: "Only messages this recent count, so quiet channels never trigger a tip." },
  { key: "minChatters", label: "Different people", unit: "people", hint: "At least this many people must be chatting. Stops one person spamming a tip out." },
  { key: "channelCooldown", label: "Channel cooldown", unit: "minutes", hint: "Minimum time between tips in the same channel." },
  { key: "globalCooldown", label: "Server cooldown", unit: "minutes", hint: "Minimum time between tips anywhere in the server." },
  { key: "deleteAfter", label: "Delete after", unit: "minutes", hint: "Tips remove themselves after this long. 0 keeps them." },
];

/** Admin → Ads: the bot's server tips. Settings reach the bot within a minute. */
export function AdsTab() {
  const { data, error, reload } = useLive<Overview>("/api/admin/ads", 60_000);
  const [form, setForm] = useState<AdSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (data?.settings && !dirty) setForm(data.settings);
  }, [data, dirty]);

  // A failed load used to leave an empty box forever: say so, with a retry
  if (!data && error)
    return (
      <div className="adm-error" role="alert">
        Couldn&apos;t load the ad settings: {error}{" "}
        <button type="button" className="adm-btn adm-btn--small" onClick={() => void reload()}>
          Retry
        </button>
      </div>
    );
  if (!data || (data.ok && !form)) return <div className="adm-skeleton" style={{ height: 420 }} />;
  if (!data.ok || !form) return <p className="adm-error">{data.error ?? "Couldn't load the ad settings."}</p>;

  const change = (patch: Partial<AdSettings>) => {
    setForm({ ...form, ...patch });
    setDirty(true);
    setMsg(null);
  };
  const save = async () => {
    setBusy(true);
    const r = await fetch("/api/admin/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return setMsg({ ok: false, text: r?.error ?? "Couldn't save." });
    setDirty(false);
    setForm(r.settings);
    setMsg({ ok: true, text: "Saved. The bot uses the new settings within a minute." });
    await reload();
  };
  const maxShown = Math.max(1, ...data.perAd.map((a) => a.shown));
  const weight = (k: string) => form.weights[k] ?? 1;

  return (
    <section className="adm-panel ads">
      <div className="adm-kpis ads-kpis">
        <button type="button" className={`adm-kpi is-link ${form.enabled ? "adm-kpi--green" : "adm-kpi--red"}`} onClick={() => change({ enabled: !form.enabled })}>
          <small>Automatic tips</small>
          <strong>{form.enabled ? "On" : "Off"}</strong>
          <span>click to turn {form.enabled ? "off" : "on"} (then save)</span>
        </button>
        <div className="adm-kpi">
          <small>Tips posted</small>
          <strong>{data.total.toLocaleString()}</strong>
          <span>all time</span>
        </div>
        <div className="adm-kpi adm-kpi--blue">
          <small>Last 7 days</small>
          <strong>{data.lastWeek.toLocaleString()}</strong>
          <span>{data.lastAt ? `latest ${timeAgo(data.lastAt)}` : "none yet"}</span>
        </div>
        <div className="adm-kpi">
          <small>Tips turned on</small>
          <strong>
            {data.perAd.filter((a) => !form.disabled.includes(a.key) && weight(a.key) > 0).length} / {data.perAd.length}
          </strong>
          <span>in the rotation</span>
        </div>
      </div>

      <div className="adm-card ads-card">
        <h3>When tips go out</h3>
        <p className="adm-muted">
          A busy channel gets a tip when it has <b>{form.threshold}</b> messages in <b>{form.windowMinutes} min</b> from <b>{form.minChatters}+</b> people, at most
          once every <b>{form.channelCooldown} min</b> per channel and <b>{form.globalCooldown} min</b> across the server. A new tip replaces the last one in that channel.
        </p>
        <div className="ads-numbers">
          {NUMBERS.map((n) => (
            <label key={n.key} className="ads-number">
              <span>
                <b>{n.label}</b>
                <small>{n.hint}</small>
              </span>
              <span className="ads-number-input">
                <input
                  type="number"
                  min={AD_LIMITS[n.key][0]}
                  max={AD_LIMITS[n.key][1]}
                  value={form[n.key]}
                  onChange={(e) => change({ [n.key]: Number(e.target.value) } as Partial<AdSettings>)}
                />
                <small>{n.unit}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="adm-card ads-card">
        <h3>The tips</h3>
        <p className="adm-muted">Turn tips on or off and choose how often each one comes up. Every tip that&apos;s on plays once before any repeats; “2×” puts it in the rotation twice. Numbers in tips (Patreon perks, the jackpot, the latest news) are always live.</p>
        <ul className="ads-list">
          {data.perAd.map((a) => {
            const on = !form.disabled.includes(a.key) && weight(a.key) > 0;
            return (
              <li key={a.key} className={on ? undefined : "is-off"}>
                <label className="ads-toggle">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      const disabled = e.target.checked ? form.disabled.filter((k) => k !== a.key) : [...form.disabled, a.key];
                      const weights = { ...form.weights };
                      if (e.target.checked && weights[a.key] === 0) delete weights[a.key];
                      change({ disabled, weights });
                    }}
                  />
                  <span>
                    <b>{a.label}</b>
                    <small>{a.about}</small>
                  </span>
                </label>
                <div className="ads-meta">
                  <span className="ads-bar" aria-hidden="true">
                    <span style={{ width: `${(a.shown / maxShown) * 100}%` }} />
                  </span>
                  <small>
                    {a.shown.toLocaleString()}× {a.lastShown ? `· ${timeAgo(a.lastShown)}` : ""}
                  </small>
                  <select
                    className="adm-select"
                    value={String(Math.max(1, weight(a.key)))}
                    disabled={!on}
                    onChange={(e) => change({ weights: { ...form.weights, [a.key]: Number(e.target.value) } })}
                    aria-label={`How often: ${a.label}`}
                  >
                    <option value="1">Normal</option>
                    <option value="2">2× as often</option>
                    <option value="3">3× as often</option>
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="adm-card ads-card">
        <h3>Where tips never go</h3>
        <p className="adm-muted">Discord IDs, one per line or separated by commas. Right-click a channel or category in Discord → Copy ID (Developer Mode).</p>
        <div className="ads-excludes">
          <label>
            <b>Channels</b>
            <textarea
              rows={5}
              value={form.excludedChannels.join("\n")}
              onChange={(e) => change({ excludedChannels: e.target.value.split(/[\s,]+/).filter(Boolean) })}
            />
          </label>
          <label>
            <b>Categories</b>
            <textarea
              rows={5}
              value={form.excludedCategories.join("\n")}
              onChange={(e) => change({ excludedCategories: e.target.value.split(/[\s,]+/).filter(Boolean) })}
            />
          </label>
        </div>
      </div>

      <div className="ads-save">
        {msg ? <p className={msg.ok ? "adm-notice" : "adm-error"}>{msg.text}</p> : null}
        <button type="button" className="adm-btn" disabled={!dirty || busy} onClick={() => void save()}>
          <Save size={15} aria-hidden="true" /> {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
        {dirty ? (
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => (setDirty(false), setForm(data.settings), setMsg(null))}>
            Undo
          </button>
        ) : null}
      </div>

      <div className="adm-card ads-card">
        <h3>Latest tips posted</h3>
        {data.recent.length ? (
          <ul className="ads-recent">
            {data.recent.map((r, i) => (
              <li key={r.at + i}>
                <Megaphone size={14} aria-hidden="true" />
                <b>{r.label}</b>
                <span className="adm-muted">in #{r.channelName ?? r.channelId}</span>
                {r.trigger === "manual" ? <span className="adm-tag">by staff</span> : null}
                <time className="adm-muted" title={formatDate(r.at)}>
                  {timeAgo(r.at)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="adm-muted">No tips posted yet with the new system. Staff can post one any time with /ads play in Discord.</p>
        )}
      </div>
    </section>
  );
}
