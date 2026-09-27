"use client";

import { Check, Pencil, Pin, PinOff, Sparkles, Type, X } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { MAX_SHOWCASE, TIER_NAMES, type BadgeCategory, type BadgeShowcase, type EarnedBadge } from "../../lib/badges";
import { BadgeMedal } from "./badge-medal";
import { BADGES_EVENT } from "./profile-badges";

const CATEGORIES: { key: BadgeCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "chat", label: "Chat" },
  { key: "social", label: "Social" },
  { key: "voice", label: "Voice" },
  { key: "economy", label: "Leaves" },
  { key: "loyalty", label: "Loyalty" },
  { key: "special", label: "Special" },
];

const fmt = (n: number) => Math.round(n).toLocaleString();
function duration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${m}m` : `${m}m`;
}
function unit(b: EarnedBadge, n: number) {
  switch (b.unit) {
    case "duration":
      return duration(n);
    case "days":
      return `${fmt(n)} days`;
    case "percent":
      return `${fmt(n)}%`;
    case "chars":
      return `${fmt(n)} characters`;
    case "years":
      return `${(Math.floor(n * 10) / 10).toString()} years`;
    default:
      return fmt(n);
  }
}
const tierName = (b: EarnedBadge) => (b.tiers.length === 1 ? (b.tier ? "Special" : "Locked") : b.tier ? TIER_NAMES[b.tier - 1] : "Locked");

function Detail({ b, onClose }: { b: EarnedBadge; onClose: () => void }) {
  const special = b.tiers.length === 1;
  return (
    <div className="st-bdetail" style={{ "--hue": b.hue } as CSSProperties}>
      <button type="button" className="st-x" onClick={onClose} aria-label="Close">
        <X size={15} />
      </button>
      <BadgeMedal icon={b.icon} shape={b.shape} hue={b.hue} tier={b.tier} size={96} />
      <div className="st-bdetail-copy">
        <p className="st-eyebrow">{tierName(b)}</p>
        <h4>{b.name}</h4>
        <p>
          {b.desc}: <b>{unit(b, b.value)}</b>
        </p>
        {special ? (
          <p className="adm-muted">{b.tier ? "You've got it!" : "A special badge. Earn it and it's yours."}</p>
        ) : (
          <ol className="st-tiers">
            {b.tiers.map((t, i) => (
              <li key={t} className={b.tier > i ? "is-done" : b.tier === i ? "is-next" : undefined}>
                <span className={`st-tier-dot st-tier-dot--${i + 1}`}>{b.tier > i ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                <b>{TIER_NAMES[i]}</b>
                <small>{unit(b, t)}</small>
                {b.tier === i ? (
                  <span className="st-tier-bar">
                    <i style={{ width: `${b.progress * 100}%` }} />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function BadgeCollection({ badges, showcase, onSaved }: { badges: EarnedBadge[]; showcase: BadgeShowcase; onSaved: (s: BadgeShowcase) => void }) {
  const [cat, setCat] = useState<BadgeCategory | "all">("all");
  const [sort, setSort] = useState<"progress" | "tier" | "name">("tier");
  const [hideLocked, setHideLocked] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pinned, setPinned] = useState<string[]>(showcase.pinned.map((p) => p.id));
  const [title, setTitle] = useState<string | null>(showcase.title?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const earned = badges.filter((b) => b.tier > 0);
  const byId = new Map(badges.map((b) => [b.id, b]));
  const list = useMemo(() => {
    const out = badges.filter((b) => (cat === "all" || b.category === cat) && (!hideLocked || b.tier > 0));
    return out.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "progress" ? b.progress - a.progress || b.tier - a.tier : b.tier - a.tier || b.progress - a.progress));
  }, [badges, cat, sort, hideLocked]);
  const detail = open ? byId.get(open) ?? null : null;
  const counts = [1, 2, 3, 4].map((t) => badges.filter((b) => b.tiers.length > 1 && b.tier === t).length);

  const togglePin = (id: string) => {
    setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_SHOWCASE ? p : [...p, id]));
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/badges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned, title }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!body.ok) return setError(body.error ?? "Couldn't save your badges.");
    onSaved(body.showcase);
    window.dispatchEvent(new CustomEvent(BADGES_EVENT, { detail: body.showcase }));
    setEditing(false);
  };

  return (
    <div className="st-bcol">
      <div className="st-bshow">
        <div className="st-bshow-copy">
          <p className="st-eyebrow">Your showcase</p>
          <h4>
            {earned.length} of {badges.length} badges
          </h4>
          <p className="adm-muted">
            {counts[0]} bronze · {counts[1]} silver · {counts[2]} gold · {counts[3]} diamond
          </p>
        </div>
        <div className="st-bshow-slots">
          {Array.from({ length: MAX_SHOWCASE }, (_, i) => {
            const b = pinned[i] ? byId.get(pinned[i]) : null;
            return b ? (
              <button key={i} type="button" className="st-bslot is-full" onClick={() => (editing ? togglePin(b.id) : setOpen(b.id))} title={editing ? "Unpin" : b.name}>
                <BadgeMedal icon={b.icon} shape={b.shape} hue={b.hue} tier={b.tier} size={58} />
                <small>{b.name}</small>
              </button>
            ) : (
              <span key={i} className="st-bslot">
                <Pin size={16} aria-hidden="true" />
                <small>{editing ? "Tap a badge" : "Empty"}</small>
              </span>
            );
          })}
        </div>
        <div className="st-bshow-actions">
          {editing ? (
            <>
              <label className="st-btitle">
                <Type size={14} aria-hidden="true" />
                <select value={title ?? ""} onChange={(e) => setTitle(e.target.value || null)} aria-label="Badge title">
                  <option value="">No title</option>
                  {earned.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="acct-button acct-button--small" onClick={() => void save()} disabled={busy}>
                <Check size={15} aria-hidden="true" /> {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="acct-button acct-button--small acct-button--ghost"
                onClick={() => {
                  setEditing(false);
                  setPinned(showcase.pinned.map((p) => p.id));
                  setTitle(showcase.title?.id ?? null);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="acct-button acct-button--small acct-button--ghost" onClick={() => setEditing(true)} disabled={!earned.length}>
              <Pencil size={14} aria-hidden="true" /> Customize
            </button>
          )}
        </div>
        {editing ? <p className="st-bshow-hint">Tap earned badges to pin up to {MAX_SHOWCASE}. They and your title show on your profile card.</p> : null}
        {error ? <p className="tfa-error">{error}</p> : null}
      </div>

      <div className="st-bfilters">
        <div className="st-seg st-seg--small" role="tablist" aria-label="Category">
          {CATEGORIES.map((c) => (
            <button key={c.key} type="button" role="tab" aria-selected={cat === c.key} className={cat === c.key ? "is-on" : undefined} onClick={() => setCat(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="st-seg st-seg--small" role="tablist" aria-label="Sort">
          {(
            [
              ["tier", "Best first"],
              ["progress", "Closest to next"],
              ["name", "A–Z"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={sort === k} className={sort === k ? "is-on" : undefined} onClick={() => setSort(k)}>
              {l}
            </button>
          ))}
        </div>
        <label className="st-toggle">
          <input type="checkbox" checked={hideLocked} onChange={(e) => setHideLocked(e.target.checked)} /> Hide locked
        </label>
      </div>

      {detail ? <Detail b={detail} onClose={() => setOpen(null)} /> : null}

      <div className="st-badges">
        {list.map((b, i) => {
          const isPinned = pinned.includes(b.id);
          const canPin = editing && b.tier > 0;
          return (
            <button
              key={b.id}
              type="button"
              className={`st-badge2${b.tier ? "" : " is-locked"}${open === b.id ? " is-open" : ""}${isPinned ? " is-pinned" : ""}${editing && !b.tier ? " is-disabled" : ""}`}
              style={{ "--hue": b.hue, "--d": `${Math.min(i, 24) * 30}ms` } as CSSProperties}
              onClick={() => (editing ? canPin && togglePin(b.id) : setOpen(open === b.id ? null : b.id))}
            >
              {editing && b.tier ? <span className="st-pin">{isPinned ? <PinOff size={13} /> : <Pin size={13} />}</span> : null}
              {title === b.id ? (
                <span className="st-title-tag">
                  <Sparkles size={11} /> Title
                </span>
              ) : null}
              <BadgeMedal icon={b.icon} shape={b.shape} hue={b.hue} tier={b.tier} size={62} />
              <b>{b.name}</b>
              <small className={`st-tier-name st-tier-name--${b.tier}`}>{tierName(b)}</small>
              {b.tiers.length > 1 && b.tier < 4 ? (
                <span className="st-badge-bar">
                  <i style={{ width: `${b.progress * 100}%` }} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
