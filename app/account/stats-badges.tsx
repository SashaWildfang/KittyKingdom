"use client";

import { ArrowDown, ArrowUp, Check, History, Pencil, Pin, Sparkles, Type, X } from "lucide-react";
import type { BadgeEarned, BadgeHistory } from "../../lib/badge-history";
import { earnedText } from "./badge-tip";
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
  { key: "events", label: "Events" },
  { key: "website", label: "Website" },
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

function Detail({ b, earned, onClose }: { b: EarnedBadge; earned?: BadgeEarned | null; onClose: () => void }) {
  const special = b.tiers.length === 1;
  const when = b.tier ? earnedText(earned, b.tiers) : null;
  return (
    <div className="st-bdetail" style={{ "--hue": b.hue } as CSSProperties}>
      <button type="button" className="st-x" onClick={onClose} aria-label="Close">
        <X size={15} />
      </button>
      <BadgeMedal icon={b.icon} shape={b.shape} hue={b.hue} tier={b.tier} size={96} />
      <div className="st-bdetail-copy">
        <p className="st-eyebrow">{tierName(b)}</p>
        <h4>{b.name}</h4>
        {/* One-off badges are done or not done, so there's no number to show */}
        {special ? (
          <p>{b.desc}</p>
        ) : (
          <p>
            {b.desc}: <b>{unit(b, b.value)}</b>
          </p>
        )}
        {when ? <p className="st-bdetail-when">{when}</p> : null}
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

const agoFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
  ];
  for (let i = 0; i < steps.length; i++) {
    if (Math.abs(s) < steps[i][0]) return agoFmt.format(Math.round(s / (i ? steps[i - 1][0] : 1)), steps[i][1]);
  }
  return agoFmt.format(Math.round(s / 31557600), "year");
}

/** Newly earned badges, tier-ups and badges lost (like a streak ending), newest first. */
function RecentBadges({ history, byId, onOpen }: { history: BadgeHistory; byId: Map<string, EarnedBadge>; onOpen: (id: string) => void }) {
  const events = history.events.filter((e) => byId.has(e.id)).slice(0, 8);
  return (
    <section className="st-brecent" aria-label="Recent badge activity">
      <p className="st-eyebrow">
        <History size={13} aria-hidden="true" /> Recent badge activity
      </p>
      {events.length ? (
        <ul>
          {events.map((e, i) => {
            const b = byId.get(e.id)!;
            const tier = (t: number) => (b.tiers.length === 1 ? "Special" : TIER_NAMES[t - 1]);
            const up = e.to > e.from;
            const text = e.from === 0 ? (
              <>
                Earned <b>{b.name}</b>
                {b.tiers.length > 1 ? ` · ${tier(e.to)}` : ""}
              </>
            ) : e.to === 0 ? (
              <>
                Lost <b>{b.name}</b>
              </>
            ) : (
              <>
                <b>{b.name}</b> {up ? "moved up to" : "dropped to"} {tier(e.to)}
              </>
            );
            return (
              <li key={`${e.id}-${e.at}-${i}`}>
                <button type="button" onClick={() => onOpen(e.id)} className={up ? "is-up" : "is-down"}>
                  <BadgeMedal icon={b.icon} shape={b.shape} hue={b.hue} tier={e.to || b.tier} size={30} />
                  <span className="st-brecent-text">{text}</span>
                  <span className="st-brecent-when">
                    {up ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />} {ago(e.at)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="adm-muted">Nothing new yet. When you earn a badge or reach a new tier, it shows up here.</p>
      )}
    </section>
  );
}

export function BadgeCollection({ badges, showcase, history, onSaved }: { badges: EarnedBadge[]; showcase: BadgeShowcase; history?: BadgeHistory; onSaved: (s: BadgeShowcase) => void }) {
  const [cat, setCat] = useState<BadgeCategory | "all">("all");
  const [sort, setSort] = useState<"progress" | "tier" | "name">("tier");
  const [hideLocked, setHideLocked] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const fromShowcase = () => Array.from({ length: MAX_SHOWCASE }, (_, i) => showcase.pinned[i]?.id ?? null);
  const [pinned, setPinned] = useState<(string | null)[]>(fromShowcase);
  // Which slot the next tapped badge goes into (a pin slot, the title, or none)
  const [slot, setSlot] = useState<number | "title" | null>(null);
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

  const place = (id: string) => {
    if (slot === "title") {
      setTitle(id);
      setSlot(null);
      return;
    }
    const next = [...pinned];
    const target = typeof slot === "number" ? slot : next.includes(id) ? -1 : next.indexOf(null);
    if (target === -1) {
      // No slot picked and it's already pinned (or every slot is full): tapping it again unpins it
      const at = next.indexOf(id);
      if (at >= 0) next[at] = null;
      setPinned(next);
      return;
    }
    const existing = next.indexOf(id);
    if (existing >= 0) next[existing] = next[target];
    next[target] = id;
    setPinned(next);
    // Carry on to the next empty slot, if any
    const empty = next.indexOf(null);
    setSlot(typeof slot === "number" && empty >= 0 ? empty : null);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: pinned.filter(Boolean), title }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!body.ok) return setError(body.error ?? "Couldn't save your badges.");
    onSaved(body.showcase);
    window.dispatchEvent(new CustomEvent(BADGES_EVENT, { detail: body.showcase }));
    setEditing(false);
    setSlot(null);
  };
  const titleBadge = title ? byId.get(title) ?? null : null;

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
          {pinned.map((id, i) => {
            const b = id ? byId.get(id) : null;
            const active = editing && slot === i;
            return (
              <div key={i} className={`st-bslot${b ? " is-full" : ""}${active ? " is-active" : ""}${editing ? " is-editing" : ""}`}>
                <button
                  type="button"
                  className="st-bslot-hit"
                  onClick={() => (editing ? setSlot(active ? null : i) : b ? setOpen(b.id) : setEditing(true))}
                  aria-label={b ? `${b.name}${editing ? ", pick a badge to replace it" : ""}` : `Empty slot ${i + 1}`}
                >
                  {b ? <BadgeMedal icon={b.icon} shape={b.shape} hue={b.hue} tier={b.tier} size={58} /> : <Pin size={16} aria-hidden="true" />}
                  <small>{b ? b.name : active ? "Tap a badge" : `Slot ${i + 1}`}</small>
                </button>
                {editing && b ? (
                  <button
                    type="button"
                    className="st-bslot-clear"
                    aria-label={`Remove ${b.name}`}
                    onClick={() => setPinned((p) => p.map((x, j) => (j === i ? null : x)))}
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
            );
          })}
          <div className={`st-bslot st-bslot--title${titleBadge ? " is-full" : ""}${editing && slot === "title" ? " is-active" : ""}${editing ? " is-editing" : ""}`}>
            <button type="button" className="st-bslot-hit" onClick={() => (editing ? setSlot(slot === "title" ? null : "title") : setEditing(true))} aria-label="Badge title">
              {titleBadge ? (
                <span className="st-title-pill" style={{ "--hue": titleBadge.hue } as CSSProperties}>
                  <Sparkles size={12} aria-hidden="true" /> {titleBadge.name}
                </span>
              ) : (
                <Type size={16} aria-hidden="true" />
              )}
              <small>{editing && slot === "title" ? "Tap a badge" : "Title"}</small>
            </button>
            {editing && titleBadge ? (
              <button type="button" className="st-bslot-clear" aria-label="Remove title" onClick={() => setTitle(null)}>
                <X size={12} />
              </button>
            ) : null}
          </div>
        </div>
        <div className="st-bshow-actions">
          {editing ? (
            <>
              <button type="button" className="acct-button acct-button--small" onClick={() => void save()} disabled={busy}>
                <Check size={15} aria-hidden="true" /> {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="acct-button acct-button--small acct-button--ghost"
                onClick={() => {
                  setEditing(false);
                  setSlot(null);
                  setPinned(fromShowcase());
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
        {editing ? (
          <p className="st-bshow-hint">
            {slot === null ? "Pick a slot (or the title), then tap an earned badge to put it there." : slot === "title" ? "Tap an earned badge to use its name as your title." : `Tap an earned badge for slot ${slot + 1}.`}
          </p>
        ) : null}
        {error ? <p className="tfa-error">{error}</p> : null}
      </div>

      {history ? <RecentBadges history={history} byId={byId} onOpen={setOpen} /> : null}

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

      {detail ? <Detail b={detail} earned={history?.earned[detail.id]} onClose={() => setOpen(null)} /> : null}

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
              onClick={() => (editing ? canPin && place(b.id) : setOpen(open === b.id ? null : b.id))}
            >
              {isPinned ? (
                <span className="st-pin">
                  <Pin size={11} /> {pinned.indexOf(b.id) + 1}
                </span>
              ) : null}
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
