"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Backpack, Check, ChevronLeft, ChevronRight, CircleAlert, Crown, Eye, Flame, Gift, Heart, Hourglass, LayoutGrid, Minus, Package, Paintbrush, Plus, Repeat, Rocket, Search, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Star, Trash2, Wand2, X } from "lucide-react";
import { RARITY, SLOTS, SLOT_HINT, SLOT_LABELS, SLOT_PLURAL, type CosmeticSlot, type Flair } from "../../lib/cosmetics";
import { CosmeticPreview } from "../cosmetic-flair";
import type { InventoryEntry, StoreItem, StoreState } from "../../lib/store";
import { LeafEmote, StoreItemIcon } from "../ui-icons";
import { Locker } from "./locker";
import { TradesView } from "./trades";
import { Celebrate, CountUp, SocialMini, StoreBackdrop, tiltHandlers } from "./store-fx";

const MAX_BUY = 50;
const POLL_MS = 15000;
const CART_KEY = "kk-cart";
type Cart = Record<string, number>;
type Sort = "featured" | "price-asc" | "price-desc" | "name" | "rarity";
const CATEGORY_ORDER = ["Cosmetics", "Social", "Perks", "Roles", "Boosters", "Gifts"];
const CATEGORY_ICONS: Record<string, ReactNode> = {
  All: <LayoutGrid size={15} />,
  Drops: <Crown size={15} />,
  Cosmetics: <Wand2 size={15} />,
  Social: <Heart size={15} />,
  Perks: <Star size={15} />,
  Roles: <Paintbrush size={15} />,
  Boosters: <Rocket size={15} />,
  Gifts: <Gift size={15} />,
};

/** The most of an item you could put in the cart right now. */
function maxFor(item: StoreItem) {
  if (!item.stackable) return item.owned > 0 ? 0 : 1;
  const dailyLeft = item.dailyLimit ? Math.max(item.dailyLimit - item.boughtToday, 0) : MAX_BUY;
  return Math.max(0, Math.min(MAX_BUY, item.stock ?? MAX_BUY, dailyLeft));
}

type Toast = { id: number; tone: "success" | "error"; text: string };
type Modal =
  | { kind: "buy"; item: StoreItem }
  | { kind: "preview"; item: StoreItem }
  | { kind: "use"; entry: InventoryEntry }
  | { kind: "gift"; entry: InventoryEntry }
  | null;
type Member = { id: string; username: string; displayName: string; avatar: string | null };

// ---------- small helpers ----------
function Leaf({ size = 18 }: { size?: number }) {
  return <LeafEmote size={size} className="store-leaf" />;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  if (seconds % 86400 === 0) return `${seconds / 86400} day${seconds === 86400 ? "" : "s"}`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
  return `${Math.round(seconds / 60)} min`;
}

function swatchStyle(colors: string[]): CSSProperties {
  const stops = colors.length === 0 ? ["#f59b2a", "#c85f18"] : colors.length === 1 ? [colors[0], colors[0]] : colors;
  return { "--swatch": `linear-gradient(135deg, ${stops.join(", ")})` } as CSSProperties;
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** A cosmetic shown on a tiny avatar (frames), card strip (banners) or name sample (name effects). */
/** A small preview of a cosmetic (cart, inventory, buy window). */
function CosmeticThumb({ cosmetic, large = false }: { cosmetic: NonNullable<StoreItem["cosmetic"]>; name: string; large?: boolean }) {
  return (
    <span className={`store-cos-thumb${large ? " is-large" : ""}`} aria-hidden="true">
      <CosmeticPreview slot={cosmetic.slot} cosKey={cosmetic.key} compact />
    </span>
  );
}

function ItemVisual({ icon, roleColors, isRole, large = false, cosmetic, name }: { icon: string | null; roleColors: string[]; isRole: boolean; large?: boolean; cosmetic?: StoreItem["cosmetic"]; name?: string }) {
  if (cosmetic) return <CosmeticThumb cosmetic={cosmetic} name={name ?? "Aa"} large={large} />;
  if (isRole) {
    return <span className={`store-swatch${large ? " store-swatch--large" : ""}`} style={swatchStyle(roleColors)} aria-hidden="true" />;
  }
  return (
    <span className={`store-icon${large ? " store-icon--large" : ""}`} aria-hidden="true">
      <StoreItemIcon icon={icon} size={large ? 30 : 22} />
    </span>
  );
}

// ==========================================
// MAIN
// ==========================================
export function StoreClient({ initialState, inventoryOnly = false }: { initialState: StoreState; inventoryOnly?: boolean }) {
  const [state, setState] = useState(initialState);
  const [tab, setTab] = useState<"shop" | "locker" | "trades" | "inventory">(inventoryOnly ? "inventory" : "shop");
  // Trade offers waiting for them (the Trades tab keeps it current while open)
  const [tradeOffers, setTradeOffers] = useState(0);
  useEffect(() => {
    if (inventoryOnly) return;
    const load = () =>
      fetch("/api/store/trades", { cache: "no-store" })
        .then((x) => x.json())
        .then((r) => r?.ok && setTradeOffers(r.incoming.length))
        .catch(() => undefined);
    void load();
    const t = window.setInterval(() => document.visibilityState === "visible" && void load(), 60_000);
    return () => window.clearInterval(t);
  }, [inventoryOnly]);
  const [celebrate, setCelebrate] = useState(0);
  // Store → Cosmetics: which kind is shown
  const [cosSlot, setCosSlot] = useState<CosmeticSlot | "all">("all");
  const [category, setCategory] = useState("All");
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const now = useNow();
  // The cart (remembered in this browser between visits)
  const [cart, setCart] = useState<Cart>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("featured");
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "{}") as Cart;
      if (saved && typeof saved === "object") setCart(saved);
    } catch {
      // no saved cart
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // storage unavailable: the cart just isn't remembered
    }
  }, [cart]);

  const toast = useCallback((tone: Toast["tone"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, tone, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setState(data.state);
    } catch {
      // keep showing the last known state
    }
  }, []);

  // Auto-refresh while the tab is visible, and right after a daily/weekly rotation
  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const rotationPassed = [state.nextDaily, state.nextWeekly].some((t) => t && new Date(t).getTime() <= now);
  useEffect(() => {
    if (!rotationPassed) return;
    const t = window.setTimeout(() => void refresh(), 3000);
    return () => window.clearTimeout(t);
  }, [rotationPassed, refresh]);

  async function act(path: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({ ok: false, error: "Something went wrong." }));
      if (data.state) setState(data.state);
      if (data.ok) {
        toast("success", data.message ?? "Done!");
        setModal(null);
        if (/\/(buy|checkout)$/.test(path)) setCelebrate((n) => n + 1);
        return true;
      }
      toast("error", data.error ?? "Something went wrong.");
      if (res.status === 401 || res.status === 403) window.setTimeout(() => window.location.reload(), 1500);
      return false;
    } catch {
      toast("error", "Couldn't reach the store. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Links like /store?item=sunbeam (from My Account's color roles) open that item straight away
  useEffect(() => {
    if (inventoryOnly) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "locker" || params.get("tab") === "trades") {
      setTab(params.get("tab") as "locker" | "trades");
      window.history.replaceState(null, "", "/store");
      return;
    }
    const wanted = params.get("item");
    const item = wanted ? state.items.find((i) => i.itemId === wanted) : null;
    if (!item) return;
    setTab("shop");
    setModal({ kind: item.cosmetic ? "preview" : "buy", item });
    window.history.replaceState(null, "", "/store");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDrop = (i: StoreItem) => Boolean(i.availableUntil);
  const categories = useMemo(() => {
    const have = new Set(state.items.map((i) => i.category));
    const list = ["All"];
    if (state.items.some(isDrop)) list.push("Drops");
    for (const c of CATEGORY_ORDER) if (have.has(c)) list.push(c);
    for (const c of Array.from(have).sort()) if (!list.includes(c)) list.push(c);
    return list;
  }, [state.items]);
  const q = query.trim().toLowerCase();
  const inCategory = (i: StoreItem) => category === "All" || (category === "Drops" ? isDrop(i) : i.category === category);
  const visible = state.items.filter((i) => inCategory(i) && (!q || `${i.name} ${i.description} ${i.category} ${RARITY[i.rarity].label}`.toLowerCase().includes(q)));
  const sorted =
    sort === "price-asc" ? [...visible].sort((a, b) => a.price - b.price) : sort === "price-desc" ? [...visible].sort((a, b) => b.price - a.price) : sort === "name" ? [...visible].sort((a, b) => a.name.localeCompare(b.name)) : sort === "rarity" ? [...visible].sort((a, b) => RARITY[b.rarity].order - RARITY[a.rarity].order || b.price - a.price) : visible;
  const drops = state.items.filter(isDrop).sort((a, b) => b.price - a.price);

  // Cart lines with their item (anything no longer in the store drops out)
  const itemById = useMemo(() => new Map(state.items.map((i) => [i.itemId, i])), [state.items]);
  const cartLines = Object.entries(cart)
    .map(([itemId, amount]) => ({ item: itemById.get(itemId), amount }))
    .filter((l): l is { item: StoreItem; amount: number } => Boolean(l.item) && l.amount > 0);
  const cartCount = cartLines.reduce((n, l) => n + l.amount, 0);
  const cartTotal = cartLines.reduce((n, l) => n + l.item.price * l.amount, 0);
  const setQty = (item: StoreItem, amount: number) =>
    setCart((c) => {
      const next = { ...c };
      const clamped = Math.min(maxFor(item), Math.max(0, Math.floor(amount)));
      if (clamped <= 0) delete next[item.itemId];
      else next[item.itemId] = clamped;
      return next;
    });
  const addToCart = (item: StoreItem, amount = 1) => {
    const room = maxFor(item) - (cart[item.itemId] ?? 0);
    if (room <= 0) return toast("error", item.stackable ? `You can't add more ${item.name}.` : `${item.name} is already in your cart.`);
    setQty(item, (cart[item.itemId] ?? 0) + Math.min(room, amount));
    toast("success", `Added ${amount > 1 ? `${amount}× ` : ""}${item.name} to your cart.`);
  };
  const checkoutCart = async () => {
    const ok = await act("/api/store/checkout", { items: cartLines.map((l) => ({ itemId: l.item.itemId, amount: l.amount })) });
    if (ok) {
      setCart({});
      setCartOpen(false);
    }
  };
  const slotOrder = (i: StoreItem) => (i.cosmetic ? SLOTS.indexOf(i.cosmetic.slot) : 9);
  const allCosmetics = visible.filter((i) => !isDrop(i) && i.rotation === "permanent" && i.category === "Cosmetics");
  const cosmeticsTotal = state.items.filter((i) => i.category === "Cosmetics").length;
  // On the front page: the two rarest of each kind, then a link to all of them
  const cosmeticPicks = SLOTS.flatMap((slot) =>
    allCosmetics
      .filter((i) => i.cosmetic?.slot === slot && !i.owned)
      .sort((a, b) => RARITY[b.rarity].order - RARITY[a.rarity].order || b.price - a.price)
      .slice(0, 2),
  );
  const sections: { key: string; title: string; sub?: string; icon: ReactNode; ends: string | null; items: StoreItem[] }[] = [
    { key: "drops", title: "Limited & seasonal", sub: "Here for a short time only. Once they're gone, they're gone.", icon: <Crown size={18} />, ends: drops.map((i) => i.availableUntil!).sort()[0] ?? null, items: visible.filter(isDrop) },
    { key: "daily", title: "Daily deals", icon: <Flame size={18} />, ends: state.nextDaily, items: visible.filter((i) => !isDrop(i) && i.rotation === "daily") },
    { key: "weekly", title: "Weekly deals", icon: <Hourglass size={18} />, ends: state.nextWeekly, items: visible.filter((i) => !isDrop(i) && i.rotation === "weekly") },
    {
      key: "cosmetics",
      title: "Profile cosmetics",
      sub: `${cosmeticsTotal} banners, frames, name effects, profile effects and themes for your Social profile. Equip them in your Locker.`,
      icon: <Wand2 size={18} />,
      ends: null,
      items: category === "Cosmetics" ? [] : cosmeticPicks.sort((a, b) => slotOrder(a) - slotOrder(b)),
    },
    { key: "social", title: "Social boosts", sub: "Stand out on Social.", icon: <Heart size={18} />, ends: null, items: visible.filter((i) => !isDrop(i) && i.rotation === "permanent" && i.category === "Social") },
    { key: "perks", title: "Perks", sub: "Protect your streak and make your profile truly yours.", icon: <Star size={18} />, ends: null, items: visible.filter((i) => !isDrop(i) && i.rotation === "permanent" && i.category === "Perks") },
    {
      key: "permanent",
      title: "Always in stock",
      icon: <ShoppingBag size={18} />,
      ends: null,
      items: visible.filter((i) => !isDrop(i) && i.rotation === "permanent" && !["Cosmetics", "Social", "Perks"].includes(i.category)),
    },
  ];
  const inventoryCount = state.inventory.reduce((n, e) => n + e.count, 0);

  return (
    <div className={`store-app${inventoryOnly ? " store-app--embedded" : ""}`}>
      {!inventoryOnly ? <StoreBackdrop /> : null}
      <Celebrate fire={celebrate} />
      {/* ---------- Header ---------- */}
      {inventoryOnly ? (
        <div className="store-embedded-head">
          <span className="store-wallet-amount">
            <Leaf size={22} />
            {state.balance.toLocaleString()}
          </span>
          <a className="store-ghost-button" href="/store">
            <ShoppingBag size={15} aria-hidden="true" /> Open the Store
          </a>
        </div>
      ) : (
        <header className="store-hero">
          <div className="store-hero-copy">
            <p className="eyebrow">Kitty Kingdom</p>
            <h1>
              The <span className="store-hero-shine">Kingdom</span> Store
            </h1>
            <p className="store-sub">Cosmetics, perks, Social boosts, roles and gifts. Spend your leaves and make your profile yours.</p>
          </div>
          <div className="store-wallet" aria-live="polite">
            <span className="store-wallet-label">Your balance</span>
            <span className="store-wallet-amount">
              <Leaf size={30} />
              <CountUp value={state.balance} />
            </span>
            <span className="store-wallet-stats">
              <span title="Streak Shields">
                <ShieldCheck size={13} aria-hidden="true" /> {state.shields}
              </span>
              <span title="Super Likes">
                <Star size={13} aria-hidden="true" /> {state.superLikes}
              </span>
              <span title="Items you own">
                <Backpack size={13} aria-hidden="true" /> {inventoryCount}
              </span>
            </span>
            {state.nextDaily ? <span className="store-wallet-note">New daily deals in {formatCountdown(new Date(state.nextDaily).getTime() - now)}</span> : null}
          </div>
        </header>
      )}

      {/* ---------- Tabs ---------- */}
      {!inventoryOnly ? (
        <div className="store-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "shop"} className={tab === "shop" ? "active" : ""} onClick={() => setTab("shop")}>
            <ShoppingBag size={16} aria-hidden="true" /> Shop
          </button>
          <button role="tab" aria-selected={tab === "locker"} className={tab === "locker" ? "active" : ""} onClick={() => setTab("locker")}>
            <Paintbrush size={16} aria-hidden="true" /> Locker
          </button>
          <button role="tab" aria-selected={tab === "trades"} className={tab === "trades" ? "active" : ""} onClick={() => setTab("trades")}>
            <Repeat size={16} aria-hidden="true" /> Trades {tradeOffers ? <span className="store-tab-count is-hot">{tradeOffers}</span> : null}
          </button>
          <button role="tab" aria-selected={tab === "inventory"} className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}>
            <Backpack size={16} aria-hidden="true" /> Inventory {inventoryCount ? <span className="store-tab-count">{inventoryCount}</span> : null}
          </button>
        </div>
      ) : null}

      {tab === "shop" ? (
        <>
          {drops.length && !q && (category === "All" || category === "Drops") ? (
            <FeaturedDrops items={drops} now={now} me={state.me} flair={state.flair} onOpen={(item) => setModal({ kind: item.cosmetic ? "preview" : "buy", item })} />
          ) : null}

          {/* Search, sort and the cart */}
          <div className="store-shopbar">
            <label className="store-search">
              <Search size={16} aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the store…" aria-label="Search the store" />
            </label>
            <select className="store-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
              <option value="featured">Featured</option>
              <option value="rarity">Rarity</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">A–Z</option>
            </select>
            <button type="button" className={`store-cart-button${cartCount ? " has-items" : ""}`} onClick={() => setCartOpen(true)} aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}>
              <ShoppingCart size={18} aria-hidden="true" />
              <span>Cart</span>
              {cartCount ? (
                <>
                  <b className="store-cart-count">{cartCount}</b>
                  <span className="store-cart-total">
                    <Leaf size={15} /> {cartTotal.toLocaleString()}
                  </span>
                </>
              ) : null}
            </button>
          </div>
          <div className="store-chips" role="group" aria-label="Filter by category">
            {categories.map((c) => (
              <button key={c} className={c === category ? "active" : ""} onClick={() => setCategory(c)}>
                {CATEGORY_ICONS[c] ?? <Package size={15} />} {c === "Drops" ? "Limited" : c}
              </button>
            ))}
          </div>

          {/* Searching or sorting shows one list; otherwise everything is grouped */}
          {q || sort !== "featured" ? (
            sorted.length ? (
              <section className="store-section">
                <div className="store-section-head store-section-head--stacked">
                  <h2>{q ? `Results for “${query.trim()}”` : "All items"}</h2>
                </div>
                <div className="store-grid">
                  {sorted.map((item) => (
                    <ShopCard key={item.itemId} item={item} me={state.me} balance={state.balance} now={item.availableUntil ? Math.floor(now / 60_000) * 60_000 : 0} inCart={cart[item.itemId] ?? 0} onAdd={() => addToCart(item)} onOpen={() => setModal({ kind: item.cosmetic ? "preview" : "buy", item })} onCart={() => setCartOpen(true)} />
                  ))}
                </div>
              </section>
            ) : null
          ) : (
            sections.map((section) =>
              section.items.length ? (
                <section className={`store-section store-section--${section.key}`} key={section.key}>
                  <div className="store-section-head store-section-head--stacked">
                    <h2>
                      <span className="store-section-icon" aria-hidden="true">
                        {section.icon}
                      </span>
                      {section.title}
                    </h2>
                    {section.ends ? (
                      <span className="store-timer">
                        <Hourglass size={13} aria-hidden="true" /> Ends in {formatCountdown(new Date(section.ends).getTime() - now)}
                      </span>
                    ) : section.sub ? (
                      <span className="store-hint">{section.sub}</span>
                    ) : null}
                  </div>
                  <div className="store-grid">
                    {section.items.map((item) => (
                      <ShopCard key={item.itemId} item={item} me={state.me} balance={state.balance} now={item.availableUntil ? Math.floor(now / 60_000) * 60_000 : 0} inCart={cart[item.itemId] ?? 0} onAdd={() => addToCart(item)} onOpen={() => setModal({ kind: item.cosmetic ? "preview" : "buy", item })} onCart={() => setCartOpen(true)} />
                    ))}
                  </div>
                  {section.key === "cosmetics" ? (
                    <button type="button" className="store-seeall" onClick={() => setCategory("Cosmetics")}>
                      <Wand2 size={16} aria-hidden="true" /> See all {cosmeticsTotal} cosmetics
                    </button>
                  ) : null}
                </section>
              ) : null,
            )
          )}
          {category === "Cosmetics" && !q && sort === "featured" ? (
            <>
              <div className="store-slotbar" role="group" aria-label="Kind of cosmetic">
                <button type="button" className={cosSlot === "all" ? "active" : ""} onClick={() => setCosSlot("all")}>
                  Everything <small>{allCosmetics.length}</small>
                </button>
                {SLOTS.map((slot) => (
                  <button key={slot} type="button" className={cosSlot === slot ? "active" : ""} onClick={() => setCosSlot(slot)}>
                    {SLOT_PLURAL[slot]} <small>{allCosmetics.filter((i) => i.cosmetic?.slot === slot).length}</small>
                  </button>
                ))}
              </div>
              {SLOTS.filter((slot) => cosSlot === "all" || cosSlot === slot).map((slot) => {
                const list = allCosmetics.filter((i) => i.cosmetic?.slot === slot).sort((a, b) => RARITY[a.rarity].order - RARITY[b.rarity].order || a.price - b.price);
                if (!list.length) return null;
                return (
                  <section className="store-section" key={slot}>
                    <div className="store-section-head store-section-head--stacked">
                      <h2>{SLOT_PLURAL[slot]}</h2>
                      <span className="store-hint">{SLOT_HINT[slot]}</span>
                    </div>
                    <div className="store-grid">
                      {list.map((item) => (
                        <ShopCard key={item.itemId} item={item} me={state.me} balance={state.balance} now={item.availableUntil ? Math.floor(now / 60_000) * 60_000 : 0} inCart={cart[item.itemId] ?? 0} onAdd={() => addToCart(item)} onOpen={() => setModal({ kind: "preview", item })} onCart={() => setCartOpen(true)} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </>
          ) : null}
          {!visible.length ? <p className="store-empty">{q ? "Nothing matches that search." : "Nothing in this category right now. Check back after the next rotation!"}</p> : null}
        </>
      ) : tab === "trades" ? (
        <TradesView state={state} onState={setState} toast={toast} onCount={setTradeOffers} />
      ) : tab === "locker" ? (
        <Locker
          state={state}
          busy={busy}
          act={act}
          onShop={(c) => {
            setTab("shop");
            if (c) setCategory(c);
          }}
        />
      ) : (
        <InventoryView
          state={state}
          now={now}
          busy={busy}
          onEquip={(entry, action) => act("/api/store/equip", { itemId: entry.itemId, action })}
          onUse={(entry) => setModal({ kind: "use", entry })}
          onGift={(entry) => setModal({ kind: "gift", entry })}
          onShop={() => setTab("shop")}
          onLocker={inventoryOnly ? () => window.location.assign("/store?tab=locker") : () => setTab("locker")}
        />
      )}

      {/* ---------- Modals ---------- */}
      {modal?.kind === "buy" ? (
        <BuyModal item={modal.item} balance={state.balance} busy={busy} onClose={() => setModal(null)}
          onConfirm={(amount) => act("/api/store/buy", { itemId: modal.item.itemId, amount })}
          onAddToCart={(amount) => {
            addToCart(modal.item, amount);
            setModal(null);
          }} />
      ) : null}
      {modal?.kind === "preview" && modal.item.cosmetic ? (
        <PreviewModal
          item={modal.item}
          state={state}
          busy={busy}
          onClose={() => setModal(null)}
          onBuy={() => void act("/api/store/buy", { itemId: modal.item.itemId, amount: 1 })}
          onAddToCart={() => {
            addToCart(modal.item, 1);
            setModal(null);
          }}
        />
      ) : null}
      {modal?.kind === "use" ? (
        <ModalShell title={`Use ${modal.entry.name}?`} onClose={() => setModal(null)}>
          <div className="store-modal-item">
            <ItemVisual icon={modal.entry.icon} roleColors={[]} isRole={false} large />
            <div>
              <strong>{modal.entry.name}</strong>
              <p>{modal.entry.description}</p>
            </div>
          </div>
          {state.boosters.some((b) => b.itemId === modal.entry.itemId) ? (
            <p className="store-modal-note">This booster is already active — using another one adds {formatDuration(modal.entry.durationSeconds) ?? "more time"} to it.</p>
          ) : (
            <p className="store-modal-note">It&apos;ll be active for {formatDuration(modal.entry.durationSeconds) ?? "a while"} starting now.</p>
          )}
          <div className="store-modal-actions">
            <button className="store-ghost-button" onClick={() => setModal(null)}>Cancel</button>
            <button className="store-primary" disabled={busy} onClick={() => act("/api/store/use", { itemId: modal.entry.itemId })}>
              {busy ? "Activating..." : "Activate"}
            </button>
          </div>
        </ModalShell>
      ) : null}
      {modal?.kind === "gift" ? (
        <GiftModal entry={modal.entry} cooldownEndsAt={state.giftCooldownEndsAt} now={now} busy={busy} onClose={() => setModal(null)}
          onSend={(recipientId, message) => act("/api/store/gift", { itemId: modal.entry.itemId, recipientId, message })} />
      ) : null}

      {cartOpen ? (
        <CartDrawer lines={cartLines} balance={state.balance} total={cartTotal} busy={busy} onClose={() => setCartOpen(false)} onQty={setQty} onCheckout={() => void checkoutCart()} />
      ) : null}

      <div className="store-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`store-toast store-toast--${t.tone}`}>
            <span aria-hidden="true">{t.tone === "success" ? <Check size={16} /> : <CircleAlert size={16} />}</span> {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// SHOP CARD
// ==========================================
function ShopCardInner({ item, me, balance, now, inCart, onAdd, onOpen, onCart }: { item: StoreItem; me: StoreState["me"]; balance: number; now: number; inCart: number; onAdd: () => void; onOpen: () => void; onCart: () => void }) {
  const isRole = Boolean(item.roleId) || item.category === "Roles";
  const ownedRole = isRole && item.owned > 0;
  const ownedOne = !item.stackable && item.owned > 0;
  const soldOut = item.stock === 0;
  const limitReached = Boolean(item.dailyLimit && item.boughtToday >= item.dailyLimit);
  const capped = item.maxOwned !== null && item.owned >= item.maxOwned;
  const short = item.price - balance;
  const rarity = RARITY[item.rarity];
  const endsIn = item.availableUntil ? new Date(item.availableUntil).getTime() - now : null;
  const tilt = tiltHandlers();

  let button: ReactNode;
  if (ownedRole || ownedOne) button = <button className="store-buy store-buy--owned" disabled><Check size={14} aria-hidden="true" /> {item.equipped ? "Equipped" : "Owned"}</button>;
  else if (soldOut) button = <button className="store-buy" disabled>Sold out</button>;
  else if (capped) button = <button className="store-buy store-buy--owned" disabled><Check size={14} aria-hidden="true" /> Max owned</button>;
  else if (limitReached) button = <button className="store-buy" disabled>Daily limit reached</button>;
  else if (short > 0) button = <button className="store-buy" disabled>Need {short.toLocaleString()} more</button>;
  else if (inCart && (!item.stackable || inCart >= maxFor(item)))
    button = (
      <button className="store-buy store-buy--incart" onClick={onCart}>
        <Check size={14} aria-hidden="true" /> In cart{item.stackable ? ` ×${inCart}` : ""}
      </button>
    );
  else
    button = (
      <button className="store-buy store-buy--ready" onClick={onAdd}>
        <ShoppingCart size={14} aria-hidden="true" /> {inCart ? `Add another (${inCart})` : "Add to cart"}
      </button>
    );

  return (
    <article
      className={`store-card rarity-${item.rarity}${ownedRole || ownedOne ? " store-card--owned" : ""}${item.cosmetic ? " store-card--cosmetic" : ""}`}
      style={{ ...(isRole ? swatchStyle(item.roleColors) : {}), "--rarity": rarity.color } as CSSProperties}
      {...tilt}
    >
      <span className="store-card-shine" aria-hidden="true" />
      {item.edition ? (
        <span className="store-ribbon store-ribbon--limited">Limited · {item.stock ?? 0}/{item.edition} left</span>
      ) : item.season ? (
        <span className="store-ribbon store-ribbon--season">{item.season}</span>
      ) : item.isNew ? (
        <span className="store-ribbon store-ribbon--new">New</span>
      ) : null}
      {item.cosmetic ? (
        <button type="button" className="store-card-preview" onClick={onOpen} aria-label={`Try on ${item.name}`}>
          <CosmeticPreview slot={item.cosmetic.slot} cosKey={item.cosmetic.key} me={me} />
          <span className="store-tryon">
            <Eye size={12} aria-hidden="true" /> Try it on
          </span>
        </button>
      ) : null}
      <div className={`store-card-top${item.cosmetic ? " is-cosmetic" : ""}`}>
        {!item.cosmetic ? (
          <button type="button" className="store-card-visual" onClick={onOpen} aria-label={`View ${item.name}`}>
            <ItemVisual icon={item.icon} roleColors={item.roleColors} isRole={isRole} />
          </button>
        ) : null}
        <div className="store-badges">
          <span className="store-rarity" style={{ "--rarity": rarity.color } as CSSProperties}>
            {rarity.label}
          </span>
          {item.cosmetic ? <span className="store-badge">{SLOT_LABELS[item.cosmetic.slot]}</span> : null}
          {item.equipped ? <span className="store-badge store-badge--equipped">Equipped</span> : null}
          {item.stackable && item.owned > 0 ? <span className="store-badge">You have {item.owned}</span> : null}
          {!item.edition && item.stock !== null && item.stock > 0 ? <span className="store-badge store-badge--warn">{item.stock} left</span> : null}
          {item.dailyLimit ? <span className="store-badge">{item.dailyLimit}/day</span> : null}
        </div>
      </div>
      <h3>
        <button type="button" className="store-card-open" onClick={onOpen}>
          {item.name}
        </button>
      </h3>
      <p className="store-card-desc">{item.description}</p>
      {item.edition ? (
        <div className="store-stockbar" aria-label={`${item.stock ?? 0} of ${item.edition} left`}>
          <span style={{ width: `${Math.max(2, ((item.stock ?? 0) / item.edition) * 100)}%` }} />
        </div>
      ) : null}
      {endsIn !== null && endsIn > 0 ? (
        <span className="store-card-ends">
          <Hourglass size={12} aria-hidden="true" /> Leaves the store in {formatCountdown(endsIn)}
        </span>
      ) : null}
      <div className="store-card-foot">
        <span className="store-price">
          <Leaf size={20} />
          {item.price.toLocaleString()}
        </span>
        {button}
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

/** The big rotating banner for limited and seasonal items. */
function FeaturedDrops({ items, now, me, flair, onOpen }: { items: StoreItem[]; now: number; me: StoreState["me"]; flair: Flair; onOpen: (item: StoreItem) => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % items.length), 6500);
    return () => window.clearInterval(t);
  }, [paused, items.length]);
  const item = items[Math.min(index, items.length - 1)];
  if (!item) return null;
  const rarity = RARITY[item.rarity];
  const endsIn = item.availableUntil ? new Date(item.availableUntil).getTime() - now : null;
  const tryFlair: Flair = item.cosmetic ? { ...flair, [item.cosmetic.slot]: item.cosmetic.key } : flair;
  const go = (d: number) => setIndex((i) => (i + d + items.length) % items.length);

  return (
    <section
      className={`store-drop rarity-${item.rarity}`}
      style={{ "--rarity": rarity.color } as CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Limited and seasonal items"
    >
      <span className="store-drop-glow" aria-hidden="true" />
      <div className="store-drop-copy" key={item.itemId}>
        <span className="store-drop-kicker">
          <Crown size={14} aria-hidden="true" /> {item.edition ? "Limited drop" : item.season ?? "Seasonal"}
        </span>
        <h2>{item.name}</h2>
        <p>{item.description}</p>
        <div className="store-drop-meta">
          <span className="store-rarity" style={{ "--rarity": rarity.color } as CSSProperties}>
            {rarity.label}
          </span>
          {endsIn !== null && endsIn > 0 ? (
            <span className="store-timer">
              <Hourglass size={13} aria-hidden="true" /> {formatCountdown(endsIn)} left
            </span>
          ) : null}
          {item.edition ? (
            <span className="store-drop-stock">
              <b>{item.stock ?? 0}</b> of {item.edition} left
            </span>
          ) : null}
        </div>
        {item.edition ? (
          <div className="store-stockbar store-stockbar--big">
            <span style={{ width: `${Math.max(2, ((item.stock ?? 0) / item.edition) * 100)}%` }} />
          </div>
        ) : null}
        <div className="store-drop-actions">
          <button type="button" className="store-primary store-drop-cta" onClick={() => onOpen(item)}>
            {item.cosmetic ? (
              <>
                <Eye size={16} aria-hidden="true" /> Try it on
              </>
            ) : (
              "View"
            )}
          </button>
          <span className="store-price store-price--big">
            <Leaf size={24} />
            {item.price.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="store-drop-stage" key={`stage-${item.itemId}`}>
        {item.cosmetic ? <SocialMini me={me} flair={tryFlair} compact /> : <ItemVisual icon={item.icon} roleColors={item.roleColors} isRole={false} large />}
      </div>
      {items.length > 1 ? (
        <div className="store-drop-nav">
          <button type="button" onClick={() => go(-1)} aria-label="Previous">
            <ChevronLeft size={16} />
          </button>
          {items.map((d, i) => (
            <button key={d.itemId} type="button" className={`store-drop-dot${i === index ? " is-on" : ""}`} onClick={() => setIndex(i)} aria-label={d.name} aria-current={i === index} />
          ))}
          <button type="button" onClick={() => go(1)} aria-label="Next">
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** "Try it on": the cosmetic on your own mini profile, next to what you're wearing now. */
function PreviewModal({ item, state, busy, onClose, onBuy, onAddToCart }: { item: StoreItem; state: StoreState; busy: boolean; onClose: () => void; onBuy: () => void; onAddToCart: () => void }) {
  const cos = item.cosmetic!;
  const [showNow, setShowNow] = useState(false);
  const wearing = state.flair;
  const trying: Flair = { ...wearing, [cos.slot]: cos.key };
  const owned = item.owned > 0;
  const short = item.price - state.balance;
  const rarity = RARITY[item.rarity];
  return (
    <ModalShell title="Try it on" onClose={onClose}>
      <div className="store-tryon-head">
        <span className="store-rarity" style={{ "--rarity": rarity.color } as CSSProperties}>
          {rarity.label}
        </span>
        <strong>{item.name}</strong>
        <span className="store-muted">{SLOT_LABELS[cos.slot]}</span>
      </div>
      <div className="store-tryon-stage">
        <SocialMini me={state.me} flair={showNow ? wearing : trying} title={state.customTitle} />
        <div className="store-tryon-toggle" role="group" aria-label="Compare">
          <button type="button" className={!showNow ? "active" : ""} onClick={() => setShowNow(false)}>
            With {item.name}
          </button>
          <button type="button" className={showNow ? "active" : ""} onClick={() => setShowNow(true)}>
            What you have now
          </button>
        </div>
      </div>
      <p className="store-modal-note">{item.description}</p>
      <div className="store-modal-actions">
        {owned ? (
          <span className="store-muted">
            <Check size={14} aria-hidden="true" /> You own this. Equip it in your Locker.
          </span>
        ) : (
          <>
            <button className="store-ghost-button" onClick={onAddToCart} disabled={maxFor(item) <= 0 || item.stock === 0}>
              <ShoppingCart size={15} aria-hidden="true" /> Add to cart
            </button>
            <button className="store-primary" disabled={busy || short > 0 || item.stock === 0} onClick={onBuy}>
              {item.stock === 0 ? "Sold out" : short > 0 ? `Need ${short.toLocaleString()} more` : busy ? "Buying..." : `Buy for ${item.price.toLocaleString()}`}
            </button>
          </>
        )}
      </div>
    </ModalShell>
  );
}

// ==========================================
// INVENTORY
// ==========================================
function InventoryView({ state, now, busy, onEquip, onUse, onGift, onShop, onLocker }: {
  state: StoreState; now: number; busy: boolean;
  onEquip: (entry: InventoryEntry, action: "equip" | "unequip") => void;
  onUse: (entry: InventoryEntry) => void; onGift: (entry: InventoryEntry) => void; onShop: () => void; onLocker?: () => void;
}) {
  const roles = state.inventory.filter((e) => e.type === "role");
  const boosters = state.inventory.filter((e) => e.type === "booster");
  const gifts = state.inventory.filter((e) => e.type === "gift");
  const looks = state.inventory.filter((e) => e.cosmetic || e.type === "perk" || e.type === "consumable");
  const other = state.inventory.filter((e) => !["role", "booster", "gift"].includes(e.type) && !looks.includes(e));
  const activeBoosters = state.boosters.filter((b) => new Date(b.endsAt).getTime() > now);

  if (!state.inventory.length && !activeBoosters.length) {
    return (
      <div className="store-empty-card">
        <span aria-hidden="true"><Backpack size={28} /></span>
        <h2>Your inventory is empty</h2>
        <p>Roles, boosters and gifts you buy (or receive) show up here.</p>
        <button className="store-primary" onClick={onShop}>Browse the shop</button>
      </div>
    );
  }

  return (
    <div className="store-inventory">
      {activeBoosters.length ? (
        <section className="store-active">
          <h2><Flame size={20} aria-hidden="true" /> Active boosters</h2>
          <div className="store-active-row">
            {activeBoosters.map((b) => (
              <div className="store-active-pill" key={b.itemId}>
                <span aria-hidden="true"><StoreItemIcon icon={b.icon} size={16} /></span>
                <strong>{b.name}</strong>
                <span className="store-timer">{formatCountdown(new Date(b.endsAt).getTime() - now)} left</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {roles.length ? (
        <InventorySection title="Roles" icon={<Sparkles size={18} />} hint="Only one shop role can be equipped at a time.">
          {roles.map((e) => (
            <article className={`store-inv-card${e.equipped ? " store-inv-card--equipped" : ""}`} key={e.itemId} style={swatchStyle(e.roleColors)}>
              <ItemVisual icon={null} roleColors={e.roleColors} isRole />
              <div className="store-inv-body">
                <strong>{e.name}</strong>
                <span>{e.equipped ? "Equipped" : "Not equipped"}</span>
              </div>
              <button className={e.equipped ? "store-ghost-button" : "store-primary"} disabled={busy}
                onClick={() => onEquip(e, e.equipped ? "unequip" : "equip")}>
                {e.equipped ? "Unequip" : "Equip"}
              </button>
            </article>
          ))}
        </InventorySection>
      ) : null}

      {boosters.length ? (
        <InventorySection title="Boosters" icon={<Rocket size={18} />}>
          {boosters.map((e) => (
            <article className="store-inv-card" key={e.itemId}>
              <ItemVisual icon={e.icon} roleColors={[]} isRole={false} />
              <div className="store-inv-body">
                <strong>{e.name} <span className="store-count">×{e.count}</span></strong>
                <span>{formatDuration(e.durationSeconds) ?? e.description}</span>
              </div>
              <button className="store-primary" disabled={busy} onClick={() => onUse(e)}>Use</button>
            </article>
          ))}
        </InventorySection>
      ) : null}

      {gifts.length ? (
        <InventorySection title="Gifts" icon={<Gift size={18} />} hint={state.giftCooldownEndsAt && new Date(state.giftCooldownEndsAt).getTime() > now
          ? `Next gift in ${formatCountdown(new Date(state.giftCooldownEndsAt).getTime() - now)}` : "Send them to anyone in the server."}>
          {gifts.map((e) => (
            <article className="store-inv-card" key={e.itemId}>
              <ItemVisual icon={e.icon} roleColors={[]} isRole={false} />
              <div className="store-inv-body">
                <strong>{e.name} <span className="store-count">×{e.count}</span></strong>
                <span>{e.giftedCount ? `${e.giftedCount} received as a gift` : e.description}</span>
              </div>
              <button className="store-primary" disabled={busy} onClick={() => onGift(e)}>Send gift</button>
            </article>
          ))}
        </InventorySection>
      ) : null}

      {looks.length ? (
        <InventorySection title="Cosmetics & perks" icon={<Wand2 size={18} />} hint="Equip and set these up in your Locker.">
          {looks.map((e) => (
            <article className={`store-inv-card rarity-${e.rarity}`} key={e.itemId}>
              <ItemVisual icon={e.icon} roleColors={[]} isRole={false} cosmetic={e.cosmetic} name={e.name} />
              <div className="store-inv-body">
                <strong>
                  {e.name} {e.count > 1 ? <span className="store-count">×{e.count}</span> : null}
                </strong>
                <span>{e.cosmetic ? SLOT_LABELS[e.cosmetic.slot] : e.itemId === "streak_shield" ? "Used automatically if you miss a day" : e.itemId === "super_like" ? "Use one from someone's Social profile" : e.description}</span>
              </div>
              {onLocker && (e.cosmetic || e.type === "perk") ? (
                <button className="store-primary" onClick={onLocker}>
                  <Paintbrush size={14} aria-hidden="true" /> Locker
                </button>
              ) : null}
            </article>
          ))}
        </InventorySection>
      ) : null}

      {other.length ? (
        <InventorySection title="Other items" icon={<Package size={18} />}>
          {other.map((e) => (
            <article className="store-inv-card" key={e.itemId}>
              <ItemVisual icon={e.icon} roleColors={[]} isRole={false} />
              <div className="store-inv-body">
                <strong>{e.name} <span className="store-count">×{e.count}</span></strong>
                <span>{e.description}</span>
              </div>
            </article>
          ))}
        </InventorySection>
      ) : null}
    </div>
  );
}

function InventorySection({ title, icon, hint, children }: { title: string; icon?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <section className="store-section">
      <div className="store-section-head">
        <h2>
          {icon ? <span className="store-section-icon" aria-hidden="true">{icon}</span> : null}
          {title}
        </h2>
        {hint ? <span className="store-hint">{hint}</span> : null}
      </div>
      <div className="store-inv-grid">{children}</div>
    </section>
  );
}

// ==========================================
// MODALS
// ==========================================
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="store-modal-backdrop" onClick={onClose}>
      <div className="store-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="store-modal-head">
          <h2>{title}</h2>
          <button className="store-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BuyModal({ item, balance, busy, onClose, onConfirm, onAddToCart }: {
  item: StoreItem; balance: number; busy: boolean; onClose: () => void; onConfirm: (amount: number) => void; onAddToCart: (amount: number) => void;
}) {
  const dailyLeft = item.dailyLimit ? Math.max(item.dailyLimit - item.boughtToday, 0) : MAX_BUY;
  const maxAmount = item.stackable
    ? Math.max(1, Math.min(MAX_BUY, item.stock ?? MAX_BUY, dailyLeft, Math.floor(balance / Math.max(item.price, 1))))
    : 1;
  const [amount, setAmount] = useState(1);
  const total = item.price * amount;
  const isRole = Boolean(item.roleId) || item.category === "Roles";

  return (
    <ModalShell title="Confirm purchase" onClose={onClose}>
      <div className="store-modal-item">
        <ItemVisual icon={item.icon} roleColors={item.roleColors} isRole={isRole} large cosmetic={item.cosmetic} name={item.name} />
        <div>
          <strong>
            {item.name} <span className="store-rarity" style={{ "--rarity": RARITY[item.rarity].color } as CSSProperties}>{RARITY[item.rarity].label}</span>
          </strong>
          <p>{item.description}</p>
        </div>
      </div>

      {item.stackable ? (
        <div className="store-qty">
          <span>Quantity</span>
          <div className="store-qty-control">
            <button onClick={() => setAmount((a) => Math.max(1, a - 1))} disabled={amount <= 1} aria-label="Less">−</button>
            <input type="number" min={1} max={maxAmount} value={amount}
              onChange={(e) => setAmount(Math.min(maxAmount, Math.max(1, Math.floor(Number(e.target.value) || 1))))} />
            <button onClick={() => setAmount((a) => Math.min(maxAmount, a + 1))} disabled={amount >= maxAmount} aria-label="More">+</button>
          </div>
        </div>
      ) : null}

      <dl className="store-receipt">
        <div><dt>Current balance</dt><dd>{balance.toLocaleString()} <Leaf size={16} /></dd></div>
        <div className="store-receipt-price"><dt>Price</dt><dd>− {amount > 1 ? `${amount} × ${item.price.toLocaleString()}` : item.price.toLocaleString()} <Leaf size={16} /></dd></div>
        <div className="store-receipt-total"><dt>Balance after</dt><dd>{(balance - total).toLocaleString()} <Leaf size={16} /></dd></div>
      </dl>
      {isRole ? <p className="store-modal-note">After buying, equip it from your Inventory — it&apos;ll show on your Discord profile.</p> : null}

      <div className="store-modal-actions">
        <button className="store-ghost-button" onClick={() => onAddToCart(amount)} disabled={maxFor(item) <= 0}>
          <ShoppingCart size={15} aria-hidden="true" /> Add to cart
        </button>
        <button className="store-primary" disabled={busy || total > balance} onClick={() => onConfirm(amount)}>
          {busy ? "Buying..." : `Buy now for ${total.toLocaleString()}`}
        </button>
      </div>
    </ModalShell>
  );
}

function GiftModal({ entry, cooldownEndsAt, now, busy, onClose, onSend }: {
  entry: InventoryEntry; cooldownEndsAt: string | null; now: number; busy: boolean;
  onClose: () => void; onSend: (recipientId: string, message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [picked, setPicked] = useState<Member | null>(null);
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const limit = entry.requiresMessage ? 1000 : 200;
  const cooldownLeft = cooldownEndsAt ? new Date(cooldownEndsAt).getTime() - now : 0;

  // Debounced member search
  useEffect(() => {
    if (picked || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/store/members?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.ok ? data.members : []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [query, picked]);

  return (
    <ModalShell title={`Send ${entry.name}`} onClose={onClose}>
      <div className="store-modal-item">
        <ItemVisual icon={entry.icon} roleColors={[]} isRole={false} large />
        <div>
          <strong>{entry.name}</strong>
          <p>They&apos;ll get a DM from the bot and it goes into their inventory.</p>
        </div>
      </div>

      <label className="store-field">
        <span>Send to</span>
        {picked ? (
          <div className="store-picked">
            {picked.avatar ? <img src={picked.avatar} alt="" width={28} height={28} /> : <span className="store-avatar-fallback">{picked.displayName[0]}</span>}
            <strong>{picked.displayName}</strong>
            <span className="store-muted">@{picked.username}</span>
            <button className="store-link-button" onClick={() => { setPicked(null); setQuery(""); }}>Change</button>
          </div>
        ) : (
          <>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username or nickname..." autoFocus />
            {searching ? <span className="store-muted">Searching...</span> : null}
            {results.length ? (
              <ul className="store-results">
                {results.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => setPicked(m)}>
                      {m.avatar ? <img src={m.avatar} alt="" width={28} height={28} /> : <span className="store-avatar-fallback">{m.displayName[0]}</span>}
                      <strong>{m.displayName}</strong>
                      <span className="store-muted">@{m.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : query.trim().length >= 2 && !searching ? <span className="store-muted">No members found.</span> : null}
          </>
        )}
      </label>

      <label className="store-field">
        <span>{entry.requiresMessage ? "Your letter" : "Note (optional)"}</span>
        <textarea value={message} maxLength={limit} rows={entry.requiresMessage ? 5 : 2}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={entry.requiresMessage ? "Pour your heart out..." : "Add a little note..."} />
        <span className="store-muted">{message.length}/{limit}</span>
      </label>

      {cooldownLeft > 0 ? <p className="store-modal-note"><Hourglass size={14} aria-hidden="true" /> You can send another gift in {formatCountdown(cooldownLeft)}.</p> : null}

      <div className="store-modal-actions">
        <button className="store-ghost-button" onClick={onClose}>Cancel</button>
        <button className="store-primary" disabled={busy || !picked || cooldownLeft > 0 || (entry.requiresMessage && !message.trim())}
          onClick={() => picked && onSend(picked.id, message)}>
          {busy ? "Sending..." : <><Gift size={16} aria-hidden="true" /> Send gift</>}
        </button>
      </div>
    </ModalShell>
  );
}

// ==========================================
// CART
// ==========================================
function CartDrawer({ lines, balance, total, busy, onClose, onQty, onCheckout }: {
  lines: { item: StoreItem; amount: number }[];
  balance: number;
  total: number;
  busy: boolean;
  onClose: () => void;
  onQty: (item: StoreItem, amount: number) => void;
  onCheckout: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const short = total - balance;
  const count = lines.reduce((n, l) => n + l.amount, 0);

  return (
    <div className="store-modal-backdrop store-cart-backdrop" onClick={onClose}>
      <aside className="store-cart" role="dialog" aria-modal="true" aria-label="Your cart" onClick={(e) => e.stopPropagation()}>
        <header className="store-cart-head">
          <h2>
            <ShoppingCart size={20} aria-hidden="true" /> Your cart
          </h2>
          <button type="button" className="store-modal-close" onClick={onClose} aria-label="Close cart">
            <X size={18} />
          </button>
        </header>

        {!lines.length ? (
          <div className="store-cart-empty">
            <ShoppingBag size={32} aria-hidden="true" />
            <p>Your cart is empty.</p>
            <button type="button" className="store-ghost-button" onClick={onClose}>
              Keep shopping
            </button>
          </div>
        ) : (
          <>
            <ul className="store-cart-lines">
              {lines.map(({ item, amount }) => {
                const isRole = Boolean(item.roleId) || item.category === "Roles";
                const max = maxFor(item);
                return (
                  <li key={item.itemId}>
                    <ItemVisual icon={item.icon} roleColors={item.roleColors} isRole={isRole} cosmetic={item.cosmetic} name={item.name} />
                    <div className="store-cart-info">
                      <strong>{item.name}</strong>
                      <span className="store-cart-each">
                        <Leaf size={14} /> {item.price.toLocaleString()} {item.stackable ? "each" : ""}
                      </span>
                      {item.stackable ? (
                        <div className="store-qty-control store-qty-control--small">
                          <button onClick={() => onQty(item, amount - 1)} aria-label={`One less ${item.name}`}>
                            <Minus size={13} />
                          </button>
                          <input type="number" min={1} max={max} value={amount} onChange={(e) => onQty(item, Number(e.target.value) || 1)} aria-label={`How many ${item.name}`} />
                          <button onClick={() => onQty(item, amount + 1)} disabled={amount >= max} aria-label={`One more ${item.name}`}>
                            <Plus size={13} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="store-cart-side">
                      <b>
                        <Leaf size={15} /> {(item.price * amount).toLocaleString()}
                      </b>
                      <button type="button" className="store-cart-remove" onClick={() => onQty(item, 0)} aria-label={`Remove ${item.name}`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <dl className="store-receipt store-cart-receipt">
              <div>
                <dt>
                  Subtotal ({count} item{count === 1 ? "" : "s"})
                </dt>
                <dd>
                  {total.toLocaleString()} <Leaf size={16} />
                </dd>
              </div>
              <div>
                <dt>Your balance</dt>
                <dd>
                  {balance.toLocaleString()} <Leaf size={16} />
                </dd>
              </div>
              <div className="store-receipt-total">
                <dt>Balance after</dt>
                <dd className={short > 0 ? "is-short" : undefined}>
                  {(balance - total).toLocaleString()} <Leaf size={16} />
                </dd>
              </div>
            </dl>
            {short > 0 ? (
              <p className="store-cart-warn">
                <CircleAlert size={15} aria-hidden="true" /> You need {short.toLocaleString()} more leaves. Remove something or come back later.
              </p>
            ) : null}
            <button type="button" className="store-primary store-checkout" disabled={busy || short > 0} onClick={onCheckout}>
              {busy ? "Checking out…" : `Checkout · ${total.toLocaleString()}`}
            </button>
            <p className="store-cart-note">Everything is bought together: if anything can&apos;t be bought, nothing is charged.</p>
          </>
        )}
      </aside>
    </div>
  );
}
