"use client";

import { Award, Check, Paintbrush, ShieldCheck, ShoppingBag, Star, Type } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import {
  BADGE_HUES,
  BADGE_ICONS,
  BADGE_SHAPES,
  RARITY,
  SLOTS,
  SLOT_HINT,
  SLOT_PLURAL,
  TITLE_HUES,
  type CosmeticSlot,
  type CustomBadge,
  type Flair,
} from "../../lib/cosmetics";
import type { BadgeShape } from "../../lib/badges";
import type { InventoryEntry, StoreState } from "../../lib/store";
import { BadgeMedal } from "../account/badge-medal";
import { CosmeticPreview } from "../cosmetic-flair";
import { SocialMini } from "./store-fx";

type Act = (path: string, body: Record<string, unknown>) => Promise<boolean>;

function BadgeDesigner({ badge, busy, act, index }: { badge: { id: string; design: CustomBadge | null }; busy: boolean; act: Act; index: number }) {
  const d = badge.design;
  const [name, setName] = useState(d?.name ?? "");
  const [desc, setDesc] = useState(d?.desc ?? "");
  const [icon, setIcon] = useState(d?.icon ?? "Star");
  const [shape, setShape] = useState(d?.shape ?? "circle");
  const [hue, setHue] = useState(d?.hue ?? BADGE_HUES[0]);
  const [open, setOpen] = useState(!d);
  const dirty = !d || d.name !== name || d.desc !== desc || d.icon !== icon || d.shape !== shape || d.hue !== hue;

  return (
    <article className={`locker-badge${open ? " is-open" : ""}`}>
      <button type="button" className="locker-badge-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <BadgeMedal icon={icon} shape={shape as BadgeShape} hue={hue} tier={4} size={46} />
        <span>
          <strong>{name || `Custom Badge ${index + 1}`}</strong>
          <small>{d ? (desc || "Shown on your profile") : "Not designed yet: tap to design it"}</small>
        </span>
        <Paintbrush size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className="locker-badge-body">
          <div className="locker-fields">
            <label>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="e.g. Night Owl Royalty" />
            </label>
            <label>
              <span>Description (optional)</span>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={80} placeholder="What it means to you" />
            </label>
          </div>
          <span className="locker-label">Icon</span>
          <div className="locker-picks locker-picks--icons">
            {BADGE_ICONS.map((i) => (
              <button key={i} type="button" className={i === icon ? "is-on" : undefined} onClick={() => setIcon(i)} aria-label={i} aria-pressed={i === icon}>
                <BadgeMedal icon={i} shape="circle" hue={hue} tier={0} size={30} />
              </button>
            ))}
          </div>
          <span className="locker-label">Shape</span>
          <div className="locker-picks">
            {BADGE_SHAPES.map((s) => (
              <button key={s} type="button" className={s === shape ? "is-on" : undefined} onClick={() => setShape(s)} aria-label={s} aria-pressed={s === shape}>
                <BadgeMedal icon={icon} shape={s as BadgeShape} hue={hue} tier={4} size={32} />
              </button>
            ))}
          </div>
          <span className="locker-label">Color</span>
          <div className="locker-swatches">
            {BADGE_HUES.map((h) => (
              <button key={h} type="button" className={h === hue ? "is-on" : undefined} style={{ "--sw": h } as CSSProperties} onClick={() => setHue(h)} aria-label={`Color ${h}`} aria-pressed={h === hue} />
            ))}
          </div>
          <div className="locker-actions">
            <button type="button" className="store-primary" disabled={busy || !dirty || name.trim().length < 2} onClick={() => void act("/api/store/locker", { action: "badge", badgeId: badge.id, name, desc, icon, shape, hue })}>
              {busy ? "Saving…" : "Save badge"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

/** The Locker: wear your cosmetics, write your title and design your badges. */
export function Locker({ state, busy, act, onShop }: { state: StoreState; busy: boolean; act: Act; onShop: (category?: string) => void }) {
  const owned = state.inventory.filter((e) => e.cosmetic);
  const [hover, setHover] = useState<{ slot: CosmeticSlot; key: string | null } | null>(null);
  const preview: Flair = { ...state.flair, ...(hover ? { [hover.slot]: hover.key } : {}) };
  const titleOwned = state.inventory.some((e) => e.itemId === "custom_title");
  const [titleText, setTitleText] = useState(state.customTitle?.text ?? "");
  const [titleHue, setTitleHue] = useState(state.customTitle?.hue ?? TITLE_HUES[0]);
  useEffect(() => {
    setTitleText(state.customTitle?.text ?? "");
    setTitleHue(state.customTitle?.hue ?? TITLE_HUES[0]);
  }, [state.customTitle]);
  const badges = state.inventory.find((e) => e.itemId === "custom_badge")?.badges ?? [];
  const bySlot = (slot: CosmeticSlot) => owned.filter((e) => e.cosmetic?.slot === slot);

  const slotTile = (slot: CosmeticSlot, e: InventoryEntry | null) => {
    const key = e?.cosmetic?.key ?? null;
    const on = state.flair[slot] === key;
    return (
      <button
        key={e?.itemId ?? `none-${slot}`}
        type="button"
        className={`locker-tile${on ? " is-on" : ""}${e ? ` rarity-${e.rarity}` : ""}`}
        disabled={busy}
        onMouseEnter={() => setHover({ slot, key })}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover({ slot, key })}
        onBlur={() => setHover(null)}
        onClick={() => !on && void act("/api/store/locker", { action: "equip", slot, itemId: e?.itemId ?? null })}
        aria-pressed={on}
      >
        <span className="locker-tile-look">
          {key ? <CosmeticPreview slot={slot} cosKey={key} me={state.me} compact /> : <span className="cprev is-compact locker-none" />}
        </span>
        <span className="locker-tile-name">{e ? e.name : "None"}</span>
        {e ? <span className="locker-tile-rarity" style={{ color: RARITY[e.rarity].color }}>{RARITY[e.rarity].label}</span> : null}
        {on ? (
          <span className="locker-tile-check" aria-hidden="true">
            <Check size={12} />
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="locker">
      <aside className="locker-preview">
        <span className="locker-label">How you look</span>
        <SocialMini me={state.me} flair={preview} title={titleOwned && titleText.trim() ? { text: titleText.trim(), hue: titleHue } : state.customTitle} />
        <p className="store-muted">Your Social profile, as others see it. Hover anything to try it on.</p>
        <div className="locker-stock">
          <span title="Streak Shields">
            <ShieldCheck size={15} aria-hidden="true" /> {state.shields} shield{state.shields === 1 ? "" : "s"}
          </span>
          <span title="Super Likes">
            <Star size={15} aria-hidden="true" /> {state.superLikes} Super Like{state.superLikes === 1 ? "" : "s"}
          </span>
        </div>
      </aside>

      <div className="locker-main">
        {SLOTS.map((slot) => (
          <section key={slot} className="locker-slot">
            <header>
              <h3>
                {SLOT_PLURAL[slot]} <small className="store-muted">{SLOT_HINT[slot]}</small>
              </h3>
              {!bySlot(slot).length ? (
                <button type="button" className="store-link-button" onClick={() => onShop("Cosmetics")}>
                  <ShoppingBag size={13} aria-hidden="true" /> Browse {SLOT_PLURAL[slot].toLowerCase()}
                </button>
              ) : null}
            </header>
            <div className="locker-tiles">
              {slotTile(slot, null)}
              {bySlot(slot).map((e) => slotTile(slot, e))}
            </div>
          </section>
        ))}

        <section className="locker-slot">
          <header>
            <h3>
              <Type size={16} aria-hidden="true" /> Custom title
            </h3>
          </header>
          {titleOwned ? (
            <div className="locker-title">
              <input value={titleText} onChange={(e) => setTitleText(e.target.value)} maxLength={24} placeholder="Write your title (2–24 characters)" aria-label="Custom title" />
              <div className="locker-swatches">
                {TITLE_HUES.map((h) => (
                  <button key={h} type="button" className={h === titleHue ? "is-on" : undefined} style={{ "--sw": h } as CSSProperties} onClick={() => setTitleHue(h)} aria-label={`Color ${h}`} aria-pressed={h === titleHue} />
                ))}
              </div>
              <div className="locker-actions">
                <button type="button" className="store-primary" disabled={busy || (titleText.trim().length > 0 && titleText.trim().length < 2)} onClick={() => void act("/api/store/locker", { action: "title", text: titleText, hue: titleHue })}>
                  {titleText.trim() ? "Save title" : "Remove title"}
                </button>
              </div>
              <small className="store-muted">Shown instead of a badge title. It goes through the same word filter as the rest of the site.</small>
            </div>
          ) : (
            <p className="locker-locked">
              Write your own title in any color.{" "}
              <button type="button" className="store-link-button" onClick={() => onShop("Perks")}>
                Get a Custom Title
              </button>
            </p>
          )}
        </section>

        <section className="locker-slot">
          <header>
            <h3>
              <Award size={16} aria-hidden="true" /> Custom badges
            </h3>
          </header>
          {badges.length ? (
            <div className="locker-badges">
              {badges.map((b, i) => (
                <BadgeDesigner key={b.id} badge={b} busy={busy} act={act} index={i} />
              ))}
            </div>
          ) : (
            <p className="locker-locked">
              Design a one-of-a-kind badge for your profile.{" "}
              <button type="button" className="store-link-button" onClick={() => onShop("Perks")}>
                Get a Custom Badge
              </button>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
