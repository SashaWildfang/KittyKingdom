"use client";

// Store → Shop (v3): a sidebar of sections, rails of items on the front page, a full grid per section, and one
// drawer for looking at an item (try-on for cosmetics) and buying it.

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Crown, Eye, Flame, Hourglass, LayoutGrid, Minus, Package, Plus, Search, ShoppingCart, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { RARITY, SLOTS, SLOT_HINT, SLOT_LABELS, SLOT_PLURAL, type CosmeticSlot, type Flair } from "../../lib/cosmetics";
import type { StoreItem, StoreState } from "../../lib/store";
import { CosmeticPreview } from "../cosmetic-flair";
import { CATEGORY_ICONS, CATEGORY_ORDER, ItemVisual, Leaf, MAX_BUY, formatCountdown, maxFor, swatchStyle } from "./store-helpers";
import { SocialMini } from "./store-fx";
import { useCurrency } from "../season-context";

export type ShopSort = "featured" | "price-asc" | "price-desc" | "name" | "rarity";
/** "home", "drops", "daily", "weekly" or a category name */
export type ShopViewKey = string;

const isDrop = (i: StoreItem) => Boolean(i.availableUntil);
const isRoleItem = (i: StoreItem) => Boolean(i.roleId) || i.category === "Roles";
const ownedOut = (i: StoreItem) => (isRoleItem(i) || !i.stackable) && i.owned > 0;

type ShopProps = {
  state: StoreState;
  now: number;
  cart: Record<string, number>;
  view: ShopViewKey;
  onView: (v: ShopViewKey) => void;
  onOpen: (item: StoreItem) => void;
  onAdd: (item: StoreItem) => void;
};

export function ShopView({ state, now, cart, view, onView, onOpen, onAdd }: ShopProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ShopSort>("featured");
  const [slot, setSlot] = useState<CosmeticSlot | "all">("all");
  const [hideOwned, setHideOwned] = useState(false);
  const [affordable, setAffordable] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // Going to another section starts at its top
  useEffect(() => {
    setSlot("all");
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 0) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
  }, [view]);

  const pass = (i: StoreItem) => (!hideOwned || !ownedOut(i)) && (!affordable || i.price <= state.balance);
  const items = state.items.filter(pass);
  const q = query.trim().toLowerCase();

  // The sections in the sidebar
  const categories = useMemo(() => {
    const have = new Set(state.items.map((i) => i.category));
    return [...CATEGORY_ORDER.filter((c) => have.has(c)), ...Array.from(have).filter((c) => !CATEGORY_ORDER.includes(c)).sort()];
  }, [state.items]);
  const listFor = (key: ShopViewKey) =>
    key === "drops" ? items.filter(isDrop) : key === "daily" ? items.filter((i) => !isDrop(i) && i.rotation === "daily") : key === "weekly" ? items.filter((i) => !isDrop(i) && i.rotation === "weekly") : items.filter((i) => i.category === key);
  const nav: { key: ShopViewKey; label: string; icon: ReactNode; count?: number; ends?: string | null }[] = [
    { key: "home", label: "Featured", icon: <LayoutGrid size={16} /> },
    ...(state.items.some(isDrop) ? [{ key: "drops", label: "Limited & seasonal", icon: <Crown size={16} />, count: listFor("drops").length, ends: state.items.filter(isDrop).map((i) => i.availableUntil!).sort()[0] ?? null }] : []),
    { key: "daily", label: "Daily deals", icon: <Flame size={16} />, count: listFor("daily").length, ends: state.nextDaily },
    { key: "weekly", label: "Weekly deals", icon: <Hourglass size={16} />, count: listFor("weekly").length, ends: state.nextWeekly },
    ...categories.map((c) => ({ key: c, label: c, icon: CATEGORY_ICONS[c] ?? <Package size={16} />, count: listFor(c).length })),
  ];

  // What the main area shows
  const sortList = (list: StoreItem[]) =>
    sort === "price-asc"
      ? [...list].sort((a, b) => a.price - b.price)
      : sort === "price-desc"
        ? [...list].sort((a, b) => b.price - a.price)
        : sort === "name"
          ? [...list].sort((a, b) => a.name.localeCompare(b.name))
          : sort === "rarity"
            ? [...list].sort((a, b) => RARITY[b.rarity].order - RARITY[a.rarity].order || b.price - a.price)
            : list;
  const searching = Boolean(q);
  let title = nav.find((n) => n.key === view)?.label ?? view;
  let list: StoreItem[] = [];
  if (searching) {
    title = `Results for “${query.trim()}”`;
    list = items.filter((i) => `${i.name} ${i.description} ${i.category} ${RARITY[i.rarity].label} ${i.cosmetic ? SLOT_LABELS[i.cosmetic.slot] : ""}`.toLowerCase().includes(q));
  } else if (view !== "home") {
    list = listFor(view);
    if (view === "Cosmetics") {
      if (slot !== "all") list = list.filter((i) => i.cosmetic?.slot === slot);
      if (sort === "featured") list = [...list].sort((a, b) => SLOTS.indexOf(a.cosmetic!.slot) - SLOTS.indexOf(b.cosmetic!.slot) || RARITY[a.rarity].order - RARITY[b.rarity].order || a.price - b.price);
    }
  }
  const shown = sortList(list);
  const current = nav.find((n) => n.key === view);

  // Front page rails
  const drops = items.filter(isDrop).sort((a, b) => b.price - a.price);
  const cosmeticPicks = SLOTS.flatMap((s) =>
    items
      .filter((i) => !isDrop(i) && i.cosmetic?.slot === s && !i.owned)
      .sort((a, b) => RARITY[b.rarity].order - RARITY[a.rarity].order || b.price - a.price)
      .slice(0, 2),
  );
  const rails: { key: ShopViewKey; title: string; icon: ReactNode; ends?: string | null; sub?: string; items: StoreItem[] }[] = [
    { key: "drops", title: "Limited & seasonal", icon: <Crown size={17} />, sub: "Gone when the timer runs out", items: drops },
    { key: "daily", title: "Daily deals", icon: <Flame size={17} />, ends: state.nextDaily, items: listFor("daily") },
    { key: "weekly", title: "Weekly deals", icon: <Hourglass size={17} />, ends: state.nextWeekly, items: listFor("weekly") },
    { key: "Cosmetics", title: "Profile cosmetics", icon: CATEGORY_ICONS.Cosmetics, sub: "Banners, frames, name effects and more for your Social profile", items: cosmeticPicks },
    ...categories
      .filter((c) => c !== "Cosmetics")
      .map((c) => ({ key: c, title: c, icon: CATEGORY_ICONS[c] ?? <Package size={17} />, items: listFor(c).filter((i) => !isDrop(i) && i.rotation === "permanent") })),
  ];

  const card = (item: StoreItem) => (
    <ShopCard key={item.itemId} item={item} me={state.me} balance={state.balance} now={item.availableUntil && now ? Math.floor(now / 60_000) * 60_000 : 0} inCart={cart[item.itemId] ?? 0} onOpen={() => onOpen(item)} onAdd={() => onAdd(item)} />
  );

  return (
    <div className="sv3-shop" ref={top}>
      <aside className="sv3-side">
        <label className="sv3-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the store…" aria-label="Search the store" />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={14} />
            </button>
          ) : null}
        </label>
        <nav className="sv3-nav" aria-label="Store sections">
          {nav.map((n) => (
            <button key={n.key} type="button" className={!searching && view === n.key ? "is-on" : undefined} aria-current={!searching && view === n.key ? "page" : undefined} onClick={() => (setQuery(""), onView(n.key))}>
              <span className="sv3-nav-icon" aria-hidden="true">
                {n.icon}
              </span>
              <span className="sv3-nav-label">
                {n.label}
                {n.ends && now ? <small>{formatCountdown(new Date(n.ends).getTime() - now)}</small> : null}
              </span>
              {typeof n.count === "number" ? <em>{n.count}</em> : null}
            </button>
          ))}
        </nav>
        <button type="button" className={`sv3-filter-toggle${hideOwned || affordable ? " is-on" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}>
          <SlidersHorizontal size={15} aria-hidden="true" /> Filters{hideOwned || affordable ? ` (${Number(hideOwned) + Number(affordable)})` : ""}
        </button>
        <div className={`sv3-filters${filtersOpen ? " is-open" : ""}`}>
          <label className="sv3-check">
            <input type="checkbox" checked={hideOwned} onChange={(e) => setHideOwned(e.target.checked)} /> Hide what I own
          </label>
          <label className="sv3-check">
            <input type="checkbox" checked={affordable} onChange={(e) => setAffordable(e.target.checked)} /> Only what I can afford
          </label>
        </div>
      </aside>

      <div className="sv3-main">
        {searching || view !== "home" ? (
          <>
            <div className="sv3-bar">
              <div className="sv3-bar-title">
                {!searching && current ? <span className="sv3-bar-icon">{current.icon}</span> : <Search size={18} aria-hidden="true" />}
                <div>
                  <h2>{title}</h2>
                  <small>
                    {shown.length} item{shown.length === 1 ? "" : "s"}
                    {!searching && current?.ends && now ? ` · new items in ${formatCountdown(new Date(current.ends).getTime() - now)}` : ""}
                  </small>
                </div>
              </div>
              <select className="sv3-sort" value={sort} onChange={(e) => setSort(e.target.value as ShopSort)} aria-label="Sort">
                <option value="featured">Featured</option>
                <option value="rarity">Rarest first</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">A–Z</option>
              </select>
            </div>
            {!searching && view === "Cosmetics" ? (
              <div className="sv3-chips" role="group" aria-label="Kind of cosmetic">
                <button type="button" className={slot === "all" ? "is-on" : undefined} onClick={() => setSlot("all")}>
                  Everything
                </button>
                {SLOTS.map((s) => (
                  <button key={s} type="button" className={slot === s ? "is-on" : undefined} onClick={() => setSlot(s)} title={SLOT_HINT[s]}>
                    {SLOT_PLURAL[s]} <small>{listFor("Cosmetics").filter((i) => i.cosmetic?.slot === s).length}</small>
                  </button>
                ))}
              </div>
            ) : null}
            {shown.length ? (
              <div className="sv3-grid">{shown.map(card)}</div>
            ) : (
              <Empty searching={searching} filtered={hideOwned || affordable} onClear={() => (setHideOwned(false), setAffordable(false), setQuery(""))} />
            )}
          </>
        ) : (
          <>
            {drops.length ? <Spotlight items={drops} now={now} me={state.me} flair={state.flair} onOpen={onOpen} /> : null}
            {rails.map((r) =>
              r.items.length ? (
                <Rail key={r.key} title={r.title} icon={r.icon} sub={r.ends && now ? `New items in ${formatCountdown(new Date(r.ends).getTime() - now)}` : r.sub} onAll={() => onView(r.key)} count={listFor(r.key).length}>
                  {r.items.map(card)}
                </Rail>
              ) : null,
            )}
            {!rails.some((r) => r.items.length) ? <Empty searching={false} filtered={hideOwned || affordable} onClear={() => (setHideOwned(false), setAffordable(false))} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

function Empty({ searching, filtered, onClear }: { searching: boolean; filtered: boolean; onClear: () => void }) {
  return (
    <div className="sv3-empty">
      <Sparkles size={22} aria-hidden="true" />
      <p>{searching ? "Nothing matches that search." : filtered ? "Nothing here with these filters." : "Nothing here right now. Check back after the next rotation!"}</p>
      {searching || filtered ? (
        <button type="button" className="store-ghost-button" onClick={onClear}>
          Clear {searching ? "search" : "filters"}
        </button>
      ) : null}
    </div>
  );
}

/** A titled row of cards that scrolls sideways, with "See all". */
function Rail({ title, icon, sub, count, onAll, children }: { title: string; icon: ReactNode; sub?: string | null; count: number; onAll: () => void; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const update = () => {
    const el = row.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };
  useEffect(update, []);
  const scroll = (dir: number) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <section className="sv3-rail">
      <div className="sv3-rail-head">
        <h2>
          <span className="sv3-bar-icon" aria-hidden="true">
            {icon}
          </span>
          {title}
        </h2>
        {sub ? <small>{sub}</small> : null}
        <div className="sv3-rail-tools">
          <button type="button" className="sv3-round" onClick={() => scroll(-1)} disabled={edges.start} aria-label={`Scroll ${title} back`}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="sv3-round" onClick={() => scroll(1)} disabled={edges.end} aria-label={`Scroll ${title} forward`}>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="sv3-all" onClick={onAll}>
            See all {count}
          </button>
        </div>
      </div>
      <div className="sv3-rail-row" ref={row} onScroll={update}>
        {children}
      </div>
    </section>
  );
}

// ---------- Item card ----------
type CardProps = { item: StoreItem; me: StoreState["me"]; balance: number; now: number; inCart: number; onOpen: () => void; onAdd: () => void };

function ShopCardInner({ item, me, balance, now, inCart, onOpen, onAdd }: CardProps) {
  const cur = useCurrency();
  const rarity = RARITY[item.rarity];
  const isRole = isRoleItem(item);
  const owned = ownedOut(item);
  const soldOut = item.stock === 0;
  const capped = item.maxOwned !== null && item.owned >= item.maxOwned;
  const limit = Boolean(item.dailyLimit && item.boughtToday >= item.dailyLimit);
  const short = item.price - balance;
  const full = inCart > 0 && inCart >= maxFor(item);
  const endsIn = item.availableUntil && now ? new Date(item.availableUntil).getTime() - now : null;
  const ribbon = item.edition ? `${item.stock ?? 0}/${item.edition} left` : item.season ? item.season : item.isNew ? "New" : null;

  let status: ReactNode = null;
  if (owned) status = <span className="sv3-chip is-owned"><Check size={13} aria-hidden="true" /> {item.equipped ? "Equipped" : "Owned"}</span>;
  else if (soldOut) status = <span className="sv3-chip">Sold out</span>;
  else if (capped) status = <span className="sv3-chip is-owned">Max owned</span>;
  else if (limit) status = <span className="sv3-chip">Limit today</span>;

  return (
    <article className={`sv3-card rarity-${item.rarity}${owned ? " is-owned" : ""}${item.cosmetic ? " is-cosmetic" : ""}`} style={{ "--rarity": rarity.color } as CSSProperties}>
      <button type="button" className="sv3-card-hit" onClick={onOpen} aria-label={`${item.name}, ${rarity.label}, ${cur.amount(item.price)}. View details`} />
      <div className="sv3-card-art" style={isRole ? swatchStyle(item.roleColors) : undefined}>
        {item.cosmetic ? (
          <CosmeticPreview slot={item.cosmetic.slot} cosKey={item.cosmetic.key} me={me} />
        ) : isRole ? (
          <span className="sv3-swatch" aria-hidden="true" />
        ) : (
          <ItemVisual icon={item.icon} roleColors={item.roleColors} isRole={false} large />
        )}
        {ribbon ? <span className={`sv3-ribbon${item.edition ? " is-limited" : item.season ? " is-season" : ""}`}>{ribbon}</span> : null}
        <span className="sv3-rarity">{rarity.label}</span>
        {item.cosmetic ? (
          <span className="sv3-tryon">
            <Eye size={12} aria-hidden="true" /> Try on
          </span>
        ) : null}
      </div>
      <div className="sv3-card-body">
        <span className="sv3-card-kind">{item.cosmetic ? SLOT_LABELS[item.cosmetic.slot] : item.category}</span>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        {item.edition ? (
          <span className="sv3-stock" aria-hidden="true">
            <span style={{ width: `${Math.max(3, ((item.stock ?? 0) / item.edition) * 100)}%` }} />
          </span>
        ) : null}
        {endsIn !== null && endsIn > 0 ? (
          <span className="sv3-ends">
            <Hourglass size={12} aria-hidden="true" /> {formatCountdown(endsIn)} left
          </span>
        ) : null}
        <div className="sv3-card-foot">
          <span className={`sv3-price${short > 0 && !owned ? " is-short" : ""}`} title={short > 0 && !owned ? `You need ${short.toLocaleString()} more` : undefined}>
            <Leaf size={17} />
            {item.price.toLocaleString()}
          </span>
          {status ?? (
            <button
              type="button"
              className={`sv3-add${inCart ? " is-in" : ""}`}
              onClick={onAdd}
              disabled={full || short > 0}
              aria-label={full ? `${item.name} is in your cart` : short > 0 ? `Not enough ${cur.lower} for ${item.name}` : `Add ${item.name} to cart`}
              title={short > 0 ? `You need ${short.toLocaleString()} more` : full ? "In your cart" : "Add to cart"}
            >
              {inCart ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
              {inCart ? (item.stackable ? `×${inCart}` : "In cart") : <ShoppingCart size={14} aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/** Cards only redraw when something on them changes (not every second, and not on every refresh). */
const ShopCard = memo(ShopCardInner, (a, b) => {
  const x = a.item;
  const y = b.item;
  return (
    x.itemId === y.itemId &&
    x.owned === y.owned &&
    x.stock === y.stock &&
    x.equipped === y.equipped &&
    x.boughtToday === y.boughtToday &&
    x.price === y.price &&
    x.availableUntil === y.availableUntil &&
    a.inCart === b.inCart &&
    a.balance === b.balance &&
    a.now === b.now &&
    a.me.name === b.me.name &&
    a.me.avatar === b.me.avatar
  );
});

// ---------- Spotlight (limited & seasonal) ----------
function Spotlight({ items, now, me, flair, onOpen }: { items: StoreItem[]; now: number; me: StoreState["me"]; flair: Flair; onOpen: (item: StoreItem) => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % items.length), 7000);
    return () => window.clearInterval(t);
  }, [paused, items.length]);
  const item = items[Math.min(index, items.length - 1)];
  if (!item) return null;
  const rarity = RARITY[item.rarity];
  const endsIn = item.availableUntil && now ? new Date(item.availableUntil).getTime() - now : null;
  const tryFlair: Flair = item.cosmetic ? { ...flair, [item.cosmetic.slot]: item.cosmetic.key } : flair;
  const go = (d: number) => setIndex((i) => (i + d + items.length) % items.length);
  return (
    <section className="sv3-spot" style={{ "--rarity": rarity.color } as CSSProperties} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel" aria-label="Limited and seasonal items">
      <div className="sv3-spot-copy" key={item.itemId}>
        <span className="sv3-spot-kicker">
          <Crown size={14} aria-hidden="true" /> {item.edition ? "Limited drop" : item.season ?? "Seasonal"}
        </span>
        <h2>{item.name}</h2>
        <p>{item.description}</p>
        <div className="sv3-spot-meta">
          <span className="sv3-rarity is-inline">{rarity.label}</span>
          {item.cosmetic ? <span className="sv3-chip">{SLOT_LABELS[item.cosmetic.slot]}</span> : null}
          {endsIn !== null && endsIn > 0 ? (
            <span className="sv3-chip is-timer">
              <Hourglass size={12} aria-hidden="true" /> {formatCountdown(endsIn)} left
            </span>
          ) : null}
          {item.edition ? <span className="sv3-chip is-timer">{item.stock ?? 0} of {item.edition} left</span> : null}
        </div>
        <div className="sv3-spot-actions">
          <button type="button" className="store-primary" onClick={() => onOpen(item)}>
            {item.cosmetic ? (
              <>
                <Eye size={16} aria-hidden="true" /> Try it on
              </>
            ) : (
              "View"
            )}
          </button>
          <span className="sv3-price is-big">
            <Leaf size={22} />
            {item.price.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="sv3-spot-stage" key={`s-${item.itemId}`}>
        {item.cosmetic ? <SocialMini me={me} flair={tryFlair} compact /> : <ItemVisual icon={item.icon} roleColors={item.roleColors} isRole={isRoleItem(item)} large />}
      </div>
      {items.length > 1 ? (
        <div className="sv3-spot-nav">
          <button type="button" className="sv3-round" onClick={() => go(-1)} aria-label="Previous">
            <ChevronLeft size={16} />
          </button>
          <span>
            {index + 1} / {items.length}
          </span>
          <button type="button" className="sv3-round" onClick={() => go(1)} aria-label="Next">
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </section>
  );
}

// ---------- Item drawer ----------
export function ItemDrawer({ item, state, now, busy, inCart, onClose, onBuy, onAddToCart }: { item: StoreItem; state: StoreState; now: number; busy: boolean; inCart: number; onClose: () => void; onBuy: (amount: number) => void; onAddToCart: (amount: number) => void }) {
  const cur = useCurrency();
  const rarity = RARITY[item.rarity];
  const isRole = isRoleItem(item);
  const owned = ownedOut(item);
  const soldOut = item.stock === 0;
  const capped = item.maxOwned !== null && item.owned >= item.maxOwned;
  const dailyLeft = item.dailyLimit ? Math.max(item.dailyLimit - item.boughtToday, 0) : MAX_BUY;
  const room = Math.max(0, maxFor(item) - inCart);
  const maxAmount = item.stackable ? Math.max(1, Math.min(MAX_BUY, item.stock ?? MAX_BUY, dailyLeft, Math.floor(state.balance / Math.max(item.price, 1)) || 1)) : 1;
  const [amount, setAmount] = useState(1);
  const [compare, setCompare] = useState(false);
  const total = item.price * amount;
  const short = total - state.balance;
  const endsIn = item.availableUntil && now ? new Date(item.availableUntil).getTime() - now : null;
  const blocked = owned ? "You already own this." : soldOut ? "Sold out." : capped ? "You have the most you can own." : dailyLeft <= 0 ? "You've bought the most you can today." : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Drawn at the page root: the Store is its own layer, which would keep the drawer under the site's top bar
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="sv3-drawer-backdrop" onClick={onClose}>
      <aside className="sv3-drawer" role="dialog" aria-modal="true" aria-label={item.name} onClick={(e) => e.stopPropagation()} style={{ "--rarity": rarity.color } as CSSProperties}>
        <button type="button" className="sv3-drawer-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className="sv3-drawer-stage" style={isRole ? swatchStyle(item.roleColors) : undefined}>
          {item.cosmetic ? (
            <>
              <SocialMini me={state.me} flair={compare ? state.flair : { ...state.flair, [item.cosmetic.slot]: item.cosmetic.key }} title={state.customTitle} />
              <div className="sv3-compare" role="group" aria-label="Compare">
                <button type="button" className={!compare ? "is-on" : undefined} onClick={() => setCompare(false)}>
                  With it
                </button>
                <button type="button" className={compare ? "is-on" : undefined} onClick={() => setCompare(true)}>
                  What you have now
                </button>
              </div>
            </>
          ) : isRole ? (
            <span className="sv3-swatch is-big" aria-hidden="true" />
          ) : (
            <ItemVisual icon={item.icon} roleColors={item.roleColors} isRole={false} large />
          )}
        </div>
        <div className="sv3-drawer-body">
          <div className="sv3-spot-meta">
            <span className="sv3-rarity is-inline">{rarity.label}</span>
            <span className="sv3-chip">{item.cosmetic ? SLOT_LABELS[item.cosmetic.slot] : item.category}</span>
            {item.season ? <span className="sv3-chip">{item.season}</span> : null}
            {item.stackable && item.owned ? <span className="sv3-chip">You have {item.owned}</span> : null}
          </div>
          <h2>{item.name}</h2>
          <p>{item.description}</p>
          <ul className="sv3-facts">
            {endsIn !== null && endsIn > 0 ? (
              <li>
                <Hourglass size={14} aria-hidden="true" /> Leaves the store in <b>{formatCountdown(endsIn)}</b>
              </li>
            ) : null}
            {item.edition ? (
              <li>
                <Crown size={14} aria-hidden="true" /> <b>{item.stock ?? 0}</b> of {item.edition} left, ever
              </li>
            ) : item.stock !== null ? (
              <li>
                <Package size={14} aria-hidden="true" /> <b>{item.stock}</b> left in stock
              </li>
            ) : null}
            {item.dailyLimit ? (
              <li>
                <Flame size={14} aria-hidden="true" /> Up to {item.dailyLimit} a day ({dailyLeft} left today)
              </li>
            ) : null}
            {item.cosmetic ? <li>{SLOT_HINT[item.cosmetic.slot]}. Equip it in your Locker after buying.</li> : null}
            {isRole ? <li>Equip it from your Inventory after buying; it shows on your Discord profile.</li> : null}
          </ul>

          {!blocked && item.stackable ? (
            <div className="sv3-qty">
              <span>Quantity</span>
              <div>
                <button type="button" className="sv3-round" onClick={() => setAmount((a) => Math.max(1, a - 1))} disabled={amount <= 1} aria-label="Fewer">
                  <Minus size={14} />
                </button>
                <input type="number" min={1} max={maxAmount} value={amount} onChange={(e) => setAmount(Math.min(maxAmount, Math.max(1, Math.floor(Number(e.target.value) || 1))))} aria-label="Quantity" />
                <button type="button" className="sv3-round" onClick={() => setAmount((a) => Math.min(maxAmount, a + 1))} disabled={amount >= maxAmount} aria-label="More">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ) : null}

          <dl className="sv3-receipt">
            <div>
              <dt>Your balance</dt>
              <dd>
                {state.balance.toLocaleString()} <Leaf size={15} />
              </dd>
            </div>
            <div>
              <dt>Price{amount > 1 ? ` (${amount} × ${item.price.toLocaleString()})` : ""}</dt>
              <dd>
                − {total.toLocaleString()} <Leaf size={15} />
              </dd>
            </div>
            <div className={short > 0 ? "is-short" : "is-total"}>
              <dt>{short > 0 ? "You need" : "Left after"}</dt>
              <dd>
                {short > 0 ? `${short.toLocaleString()} more` : (state.balance - total).toLocaleString()} <Leaf size={15} />
              </dd>
            </div>
          </dl>
        </div>
        <div className="sv3-drawer-foot">
          {blocked ? (
            <p className="sv3-blocked">
              <Check size={15} aria-hidden="true" /> {blocked}
              {owned && item.cosmetic ? " Equip it in your Locker." : ""}
            </p>
          ) : (
            <>
              <button type="button" className="store-ghost-button" onClick={() => onAddToCart(amount)} disabled={room <= 0}>
                <ShoppingCart size={15} aria-hidden="true" /> {room <= 0 ? "In your cart" : "Add to cart"}
              </button>
              <button type="button" className="store-primary" disabled={busy || short > 0} onClick={() => onBuy(amount)}>
                {busy ? "Buying…" : short > 0 ? `Not enough ${cur.lower}` : `Buy now · ${total.toLocaleString()}`}
              </button>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
