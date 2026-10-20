"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Backpack, Check, CircleAlert, Crown, Flame, Gift, Hourglass, Minus, Package, Paintbrush, Plus, Repeat, Rocket, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Star, Trash2, Wand2, X } from "lucide-react";
import { SLOT_LABELS } from "../../lib/cosmetics";
import type { InventoryEntry, StoreItem, StoreState } from "../../lib/store";
import { LeafEmote, StoreItemIcon } from "../ui-icons";
import { Locker } from "./locker";
import { ItemDrawer, ShopView, type ShopViewKey } from "./shop-view";
import { ItemVisual, Leaf, formatCountdown, formatDuration, maxFor, priceFor, swatchStyle, useNow } from "./store-helpers";
import { TradesView } from "./trades";
import { Celebrate, CountUp } from "./store-fx";
import { CurrencyName } from "../season-context";

const POLL_MS = 30000;
const CART_KEY = "kk-cart";
type Cart = Record<string, number>;

type Toast = { id: number; tone: "success" | "error"; text: string };
type Modal =
  | { kind: "item"; item: StoreItem }
  | { kind: "use"; entry: InventoryEntry }
  | { kind: "gift"; entry: InventoryEntry }
  | null;
type Member = { id: string; username: string; displayName: string; avatar: string | null };

// ==========================================
// MAIN
// ==========================================
export function StoreClient({ initialState, inventoryOnly = false, discount = 0 }: { initialState: StoreState; inventoryOnly?: boolean; discount?: number }) {
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
  // Store → Shop: which section is open ("home", "drops", "daily", "weekly" or a category)
  const [view, setView] = useState<ShopViewKey>("home");
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const now = useNow();
  // The cart (remembered in this browser between visits)
  const [cart, setCart] = useState<Cart>({});
  const [cartOpen, setCartOpen] = useState(false);
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
    setModal({ kind: "item", item });
    window.history.replaceState(null, "", "/store");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cart lines with their item (anything no longer in the store drops out)
  const itemById = useMemo(() => new Map(state.items.map((i) => [i.itemId, i])), [state.items]);
  const cartLines = Object.entries(cart)
    .map(([itemId, amount]) => ({ item: itemById.get(itemId), amount }))
    .filter((l): l is { item: StoreItem; amount: number } => Boolean(l.item) && l.amount > 0);
  const cartCount = cartLines.reduce((n, l) => n + l.amount, 0);
  const cartTotal = cartLines.reduce((n, l) => n + priceFor(l.item.price, l.amount, discount), 0);
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
  const inventoryCount = state.inventory.reduce((n, e) => n + e.count, 0);

  return (
    <div className={`store-app${inventoryOnly ? " store-app--embedded" : ""}`}>
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
        <header className="sv3-head">
          <div className="sv3-head-title">
            <span className="sv3-head-icon" aria-hidden="true">
              <ShoppingBag size={22} />
            </span>
            <div>
              <h1>Store</h1>
              <p>
                Spend your <CurrencyName lower /> on cosmetics, perks, roles and gifts.
                {discount ? (
                  <span className="sv3-discount">
                    <Crown size={13} aria-hidden="true" /> Supporter: {Math.round(discount * 100)}% off everything
                  </span>
                ) : (
                  <a className="sv3-discount is-upsell" href="/patreon">
                    <Crown size={13} aria-hidden="true" /> Patreon supporters save 5–15%
                  </a>
                )}
              </p>
            </div>
          </div>
          <nav className="sv3-tabs" role="tablist" aria-label="Store">
            {(
              [
                ["shop", "Shop", <ShoppingBag key="i" size={16} aria-hidden="true" />, 0],
                ["locker", "Locker", <Paintbrush key="i" size={16} aria-hidden="true" />, 0],
                ["trades", "Trades", <Repeat key="i" size={16} aria-hidden="true" />, tradeOffers],
                ["inventory", "Inventory", <Backpack key="i" size={16} aria-hidden="true" />, inventoryCount],
              ] as const
            ).map(([key, label, icon, count]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-on" : undefined} onClick={() => setTab(key)}>
                {icon} {label}
                {count ? <em className={key === "trades" ? "is-hot" : undefined}>{count}</em> : null}
              </button>
            ))}
          </nav>
          <div className="sv3-wallet" aria-live="polite">
            <span className="sv3-wallet-amount">
              <Leaf size={24} />
              <CountUp value={state.balance} />
            </span>
            <span className="sv3-wallet-stats">
              <span title="Streak Shields">
                <ShieldCheck size={13} aria-hidden="true" /> {state.shields}
              </span>
              <span title="Super Likes">
                <Star size={13} aria-hidden="true" /> {state.superLikes}
              </span>
            </span>
          </div>
          <button type="button" className={`sv3-cart${cartCount ? " has-items" : ""}`} onClick={() => setCartOpen(true)} aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}>
            <ShoppingCart size={18} aria-hidden="true" />
            {cartCount ? (
              <>
                <b>{cartCount}</b>
                <span>
                  <Leaf size={14} /> {cartTotal.toLocaleString()}
                </span>
              </>
            ) : (
              <span>Cart</span>
            )}
          </button>
        </header>
      )}

      {tab === "shop" ? (
        <ShopView
          state={state}
          discount={discount}
          now={now}
          cart={cart}
          view={view}
          onView={setView}
          onOpen={(item) => setModal({ kind: "item", item })}
          onAdd={(item) => addToCart(item)}
        />
      ) : tab === "trades" ? (
        <TradesView state={state} onState={setState} toast={toast} onCount={setTradeOffers} />
      ) : tab === "locker" ? (
        <Locker
          state={state}
          busy={busy}
          act={act}
          onShop={(c) => {
            setTab("shop");
            setView(c || "home");
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
      {modal?.kind === "item" ? (
        <ItemDrawer
          key={modal.item.itemId}
          item={state.items.find((i) => i.itemId === modal.item.itemId) ?? modal.item}
          state={state}
          now={now}
          busy={busy}
          inCart={cart[modal.item.itemId] ?? 0}
          discount={discount}
          onClose={() => setModal(null)}
          onBuy={(amount) => void act("/api/store/buy", { itemId: modal.item.itemId, amount })}
          onAddToCart={(amount) => {
            addToCart(modal.item, amount);
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
        <CartDrawer lines={cartLines} balance={state.balance} total={cartTotal} discount={discount} busy={busy} onClose={() => setCartOpen(false)} onQty={setQty} onCheckout={() => void checkoutCart()} />
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
function CartDrawer({ lines, balance, total, discount, busy, onClose, onQty, onCheckout }: {
  lines: { item: StoreItem; amount: number }[];
  discount: number;
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
                        <Leaf size={14} /> {priceFor(item.price, 1, discount).toLocaleString()} {item.stackable ? "each" : ""}
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
                        <Leaf size={15} /> {priceFor(item.price, amount, discount).toLocaleString()}
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
                <CircleAlert size={15} aria-hidden="true" /> You need {short.toLocaleString()} more <LeafEmote size={14} />. Remove something or come back later.
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
