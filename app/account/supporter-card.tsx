"use client";

import { Check, CircleAlert, Crown, Gem, Loader2, Lock, Palette, PauseCircle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NITRO, TIERS, itemsLabel, pct, type Tier } from "../../lib/perks";
import type { RoleStyle, SupporterStatus } from "../../lib/supporter";
import { LeafEmote } from "../ui-icons";
import { TierIcon } from "../tier-icon";
import { ColorPicker } from "./color-picker";
import "./supporter-card.css";

const HOLO = ["#A9C9FF", "#FFBBEC", "#FFC3A0"];

function tierPerks(t: Tier) {
  const out = [
    `${t.monthly.toLocaleString()} Leaves + ${itemsLabel(t.items)} every month`,
    `${pct(t.xp)} XP and ${pct(t.leaf)} Leaves on everything`,
    `+${t.daily} Leaves on every Daily Reward`,
  ];
  if (t.customRole) out.push(t.roleExtras ? "Custom role with gradient, holographic style and an icon" : "Custom role: your own name and colors");
  if (t.premiumGames) out.push("25 slot spins at once and the premium scratch-offs");
  out.push(`Weekly Royal Chest (/chest): ${t.chest.toLocaleString()}+ Leaves${t.chestItems.length ? ` + ${t.chestItems.join(", ")}` : ""}`);
  out.push(`Daily Royal Wheel (/wheel): Leaf prizes ×${t.wheelMult}`);
  out.push(`${Math.round(t.discount * 100)}% off everything in the Store`);
  out.push(`+${t.weight} weight in Social's hourly Featured draw`);
  return out;
}

const NITRO_PERKS = [
  `${NITRO.perBoost.toLocaleString()} Leaves for every boost`,
  `${NITRO.monthly.toLocaleString()} Leaves + ${itemsLabel(NITRO.items)} every month`,
  `${pct(NITRO.xp)} XP and ${pct(NITRO.leaf)} Leaves on everything`,
  "Daily Reward streak bonus up to +700",
  "25 slot spins at once and the premium scratch-offs",
  "Emotes and stickers from other servers",
];

function rolePaint(style: RoleStyle, color: string, color2: string) {
  if (style === "holographic") return `linear-gradient(90deg, ${HOLO.join(", ")})`;
  if (style === "gradient") return `linear-gradient(90deg, ${color}, ${color2})`;
  return color;
}

function RolePreview({ name, style, color, color2, icon, displayName }: { name: string; style: RoleStyle; color: string; color2: string; icon: string; displayName: string }) {
  const paint = rolePaint(style, color, color2);
  const textStyle = style === "solid" ? { color } : { backgroundImage: paint, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
  return (
    <div className="sp-preview" aria-label="Preview">
      <small>Preview in Discord</small>
      <div className="sp-preview-msg">
        <span className="sp-preview-avatar" aria-hidden="true">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <div>
          <p>
            <b className={style === "holographic" ? "sp-holo" : undefined} style={textStyle as React.CSSProperties}>
              {displayName}
            </b>
            {icon ? <span className="sp-preview-icon">{icon}</span> : null}
            <span className="sp-preview-time">Today at 4:20 PM</span>
          </p>
          <p className="sp-preview-text">Check out my new role!</p>
        </div>
      </div>
      <span className="sp-preview-pill">
        <i style={{ background: paint }} aria-hidden="true" />
        {icon ? `${icon} ` : ""}
        {name || "Your role"}
      </span>
    </div>
  );
}

export function SupporterCard({ displayName }: { displayName: string }) {
  const [status, setStatus] = useState<SupporterStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [titleSaving, setTitleSaving] = useState(false);
  const [editing, setEditing] = useState<"color" | "color2">("color");
  const [saved, setSaved] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", style: "solid" as RoleStyle, color: "#E8622C", color2: "#F5B83D", icon: "" });

  const load = useCallback(async (fillForm = false) => {
    const res = await fetch("/api/account/supporter", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!res?.ok) return setError(res?.error ?? "Couldn't load your perks.");
    setStatus(res.status);
    const r = res.status.customRole;
    if (fillForm) {
      setForm(r ? { name: r.name, style: r.style, color: r.color, color2: r.color2 ?? "#F5B83D", icon: r.icon ?? "" } : (f) => ({ ...f, name: `${displayName}`.slice(0, 32) }));
    }
  }, [displayName]);

  useEffect(() => {
    void load(true);
  }, [load]);

  async function chooseTitle(variant: 0 | 1) {
    setTitleSaving(true);
    const res = await fetch("/api/account/supporter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "title", variant }) })
      .then((r) => r.json())
      .catch(() => null);
    setTitleSaving(false);
    if (res?.ok) setStatus(res.status);
    else setError(res?.error ?? "Couldn't change your title.");
  }

  // While the bot is applying a change, check back every few seconds
  useEffect(() => {
    if (status?.customRole?.status !== "pending" && !status?.titlePending) return;
    const t = window.setInterval(() => void load(false), 3000);
    return () => window.clearInterval(t);
  }, [status?.customRole?.status, status?.titlePending, load]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(null);
    const res = await fetch("/api/account/supporter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError(res?.error ?? "Couldn't save your role.");
    setStatus(res.status);
    setSaved("Saved! Your role updates in Discord in a few seconds.");
  }

  if (!status) return <p className="roles-muted">{error ?? "Loading your perks…"}</p>;
  const tier = TIERS.find((t) => t.key === status.tier) ?? null;

  if (!tier && !status.nitro) {
    return (
      <div className="sp">
        <div className="sp-empty">
          <Sparkles size={22} aria-hidden="true" />
          <div>
            <b>Become a supporter and unlock a lot more</b>
            <p>
              Patreon tiers start at <b>$5/month</b> with {TIERS[0].monthly.toLocaleString()} <LeafEmote size={14} /> every month, bigger XP and Leaf bonuses and a bigger Daily Reward. From <b>$10</b> you get your own <b>custom role</b>, designed right here.
            </p>
          </div>
        </div>
        <div className="sp-mini-tiers">
          {TIERS.map((t) => (
            <div key={t.key} style={{ "--tier": t.color } as React.CSSProperties}>
              <span><TierIcon tier={t.key} size={22} /></span>
              <b>{t.name}</b>
              <small>${t.price}/month</small>
            </div>
          ))}
        </div>
        <a className="sp-cta" href="/patreon">
          See every perk
        </a>
      </div>
    );
  }

  const role = status.customRole;
  const roleBadge =
    role?.status === "pending" ? (
      <span className="sp-badge is-pending"><Loader2 size={13} className="sp-spin" aria-hidden="true" /> Updating in Discord…</span>
    ) : role?.status === "applied" ? (
      <span className="sp-badge is-live"><Check size={13} aria-hidden="true" /> Live in Discord</span>
    ) : role?.status === "paused" ? (
      <span className="sp-badge is-paused"><PauseCircle size={13} aria-hidden="true" /> Paused</span>
    ) : role?.status === "error" ? (
      <span className="sp-badge is-error"><CircleAlert size={13} aria-hidden="true" /> {role.error}</span>
    ) : null;

  return (
    <div className="sp">
      <div className="sp-hero" style={{ "--tier": tier?.color ?? NITRO.color } as React.CSSProperties}>
        <span className="sp-hero-emoji"><TierIcon tier={tier?.key ?? "nitro"} size={24} /></span>
        <div>
          <small>Your supporter perks</small>
          <h3>
            {tier ? tier.titles[status.variant] : null}
            {tier && status.nitro ? " + " : null}
            {status.nitro ? "Nitro Booster" : null}
          </h3>
          <p>
            <b>{status.monthly.toLocaleString()}</b> <LeafEmote size={14} /> every month
            {status.nextChargeDate ? ` · renews ${new Date(status.nextChargeDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
          </p>
        </div>
      </div>

      {tier ? (
        <div className="sp-title">
          <span>Your title</span>
          <div className="sp-seg" role="radiogroup" aria-label="Your title">
            {tier.titles.map((t, i) => (
              <button key={t} type="button" role="radio" aria-checked={status.variant === i} className={status.variant === i ? "is-on" : ""} disabled={titleSaving} onClick={() => chooseTitle(i as 0 | 1)}>
                {t}
              </button>
            ))}
          </div>
          {status.titlePending ? (
            <span className="sp-badge is-pending">
              <Loader2 size={13} className="sp-spin" aria-hidden="true" /> Switching your role…
            </span>
          ) : (
            <small>Your Discord role is “{tier.titles[status.variant]} (Patreon)”.</small>
          )}
        </div>
      ) : null}

      <div className="sp-perks">
        {tier ? (
          <div>
            <h4><TierIcon tier={tier.key} size={16} /> {tier.titles[status.variant]} perks</h4>
            <ul>{tierPerks(tier).map((p) => <li key={p}><Check size={14} aria-hidden="true" /> {p}</li>)}</ul>
          </div>
        ) : null}
        {status.nitro ? (
          <div>
            <h4><TierIcon tier="nitro" size={16} /> Nitro Booster</h4>
            <ul>{NITRO_PERKS.map((p) => <li key={p}><Check size={14} aria-hidden="true" /> {p}</li>)}</ul>
          </div>
        ) : null}
      </div>

      <div className="sp-role">
        <div className="sp-role-head">
          <h4><Palette size={17} aria-hidden="true" /> Custom role</h4>
          {roleBadge}
        </div>
        {status.canCustomRole ? (
          <div className="sp-role-grid">
            <div className="sp-form">
              <label>
                <span>Role name</span>
                <input value={form.name} maxLength={32} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pumpkin Spice Royalty" />
              </label>
              <div className="sp-field">
                <span>Style</span>
                <div className="sp-seg" role="radiogroup" aria-label="Role style">
                  {(["solid", "gradient", "holographic"] as RoleStyle[]).map((s) => {
                    const locked = s === "holographic" && !status.canExtras;
                    return (
                      <button key={s} type="button" role="radio" aria-checked={form.style === s} className={form.style === s ? "is-on" : ""} disabled={locked} onClick={() => setForm({ ...form, style: s })} title={locked ? "King / Queen perk" : undefined}>
                        {locked ? <Lock size={12} aria-hidden="true" /> : null} {s[0].toUpperCase() + s.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
              {form.style !== "holographic" ? (
                <div className="sp-colors">
                  {form.style === "gradient" ? (
                    <div className="sp-seg sp-color-tabs" role="tablist" aria-label="Which color">
                      {(["color", "color2"] as const).map((k) => (
                        <button key={k} type="button" role="tab" aria-selected={editing === k} className={editing === k ? "is-on" : ""} onClick={() => setEditing(k)}>
                          <i style={{ background: form[k] }} aria-hidden="true" /> {k === "color" ? "Start color" : "End color"}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {form.style === "gradient" ? <div className="sp-grad-bar" style={{ background: `linear-gradient(90deg, ${form.color}, ${form.color2})` }} aria-hidden="true" /> : null}
                  <ColorPicker
                    label={form.style === "gradient" ? (editing === "color" ? "Start color" : "End color") : "Role color"}
                    value={form.style === "gradient" ? form[editing] : form.color}
                    onChange={(hex) => setForm((f) => ({ ...f, [form.style === "gradient" ? editing : "color"]: hex }))}
                  />
                </div>
              ) : (
                <p className="sp-note"><Crown size={14} aria-hidden="true" /> Discord&apos;s shimmering holographic style (fixed colors).</p>
              )}
              <label>
                <span>
                  Role icon {status.canExtras ? "(one emoji, optional)" : <em><Lock size={11} aria-hidden="true" /> King / Queen</em>}
                </span>
                <input value={form.icon} maxLength={16} disabled={!status.canExtras} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder={status.canExtras ? "🦊" : "Upgrade to add an icon"} />
              </label>
              {error ? <p className="sp-error" role="alert">{error}</p> : null}
              {saved ? <p className="sp-saved" role="status">{saved}</p> : null}
              <button type="button" className="sp-save" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? "Saving…" : role ? "Save changes" : "Create my role"}
              </button>
              <p className="sp-note">You can also use <code>/myrole</code> in Discord. Names are checked by AutoMod.</p>
            </div>
            <RolePreview name={form.name} style={form.style} color={form.color} color2={form.color2} icon={status.canExtras ? form.icon : ""} displayName={displayName} />
          </div>
        ) : (
          <div className="sp-locked">
            <Lock size={18} aria-hidden="true" />
            <p>
              Design your own role (name, solid or gradient color) as a <b>Prince / Princess ($10)</b>. <b>King / Queen ($20)</b> adds the holographic style and a role icon.{" "}
              <a href="/patreon">See the tiers</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
