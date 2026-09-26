"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { InventoryEntry, StoreItem, StoreState } from "../../lib/store";

const MAX_BUY = 50;
const POLL_MS = 15000;

type Toast = { id: number; tone: "success" | "error"; text: string };
type Modal =
  | { kind: "buy"; item: StoreItem }
  | { kind: "use"; entry: InventoryEntry }
  | { kind: "gift"; entry: InventoryEntry }
  | null;
type Member = { id: string; username: string; displayName: string; avatar: string | null };

// ---------- small helpers ----------
function Leaf({ size = 18 }: { size?: number }) {
  return <img className="store-leaf" src="/leaf.png" alt="leaves" width={size} height={size} />;
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

function ItemVisual({ icon, roleColors, isRole, large = false }: { icon: string | null; roleColors: string[]; isRole: boolean; large?: boolean }) {
  if (isRole) {
    return <span className={`store-swatch${large ? " store-swatch--large" : ""}`} style={swatchStyle(roleColors)} aria-hidden="true" />;
  }
  return <span className={`store-icon${large ? " store-icon--large" : ""}`} aria-hidden="true">{icon ?? "📦"}</span>;
}

// ==========================================
// MAIN
// ==========================================
export function StoreClient({ initialState }: { initialState: StoreState }) {
  const [state, setState] = useState(initialState);
  const [tab, setTab] = useState<"shop" | "inventory">("shop");
  const [category, setCategory] = useState("All");
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const now = useNow();

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

  const categories = useMemo(() => ["All", ...Array.from(new Set(state.items.map((i) => i.category))).sort()], [state.items]);
  const visible = state.items.filter((i) => category === "All" || i.category === category);
  const sections: { key: StoreItem["rotation"]; title: string; ends: string | null }[] = [
    { key: "daily", title: "Daily deals", ends: state.nextDaily },
    { key: "weekly", title: "Weekly deals", ends: state.nextWeekly },
    { key: "permanent", title: "Always in stock", ends: null },
  ];
  const inventoryCount = state.inventory.reduce((n, e) => n + e.count, 0);

  return (
    <div className="store-app">
      {/* ---------- Header ---------- */}
      <header className="store-header">
        <div>
          <p className="eyebrow">Kitty Kingdom Store</p>
          <h1>Leaf Shop</h1>
          <p className="store-sub">Spend your leaves on roles, boosters and gifts — everything syncs with Discord instantly.</p>
        </div>
        <div className="store-wallet" aria-live="polite">
          <span className="store-wallet-label">Your balance</span>
          <span className="store-wallet-amount">
            <Leaf size={30} />
            {state.balance.toLocaleString()}
          </span>
          {state.nextDaily ? (
            <span className="store-wallet-note">New daily deals in {formatCountdown(new Date(state.nextDaily).getTime() - now)}</span>
          ) : null}
        </div>
      </header>

      {/* ---------- Tabs ---------- */}
      <div className="store-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "shop"} className={tab === "shop" ? "active" : ""} onClick={() => setTab("shop")}>
          🛍️ Shop
        </button>
        <button role="tab" aria-selected={tab === "inventory"} className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}>
          🎒 Inventory {inventoryCount ? <span className="store-tab-count">{inventoryCount}</span> : null}
        </button>
      </div>

      {tab === "shop" ? (
        <>
          <div className="store-chips" role="group" aria-label="Filter by category">
            {categories.map((c) => (
              <button key={c} className={c === category ? "active" : ""} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>

          {sections.map((section) => {
            const items = visible.filter((i) => i.rotation === section.key);
            if (!items.length) return null;
            return (
              <section className="store-section" key={section.key}>
                <div className="store-section-head">
                  <h2>{section.title}</h2>
                  {section.ends ? (
                    <span className="store-timer">⏳ Ends in {formatCountdown(new Date(section.ends).getTime() - now)}</span>
                  ) : null}
                </div>
                <div className="store-grid">
                  {items.map((item) => (
                    <ShopCard key={item.itemId} item={item} balance={state.balance} onBuy={() => setModal({ kind: "buy", item })} />
                  ))}
                </div>
              </section>
            );
          })}
          {!visible.length ? <p className="store-empty">Nothing in this category right now — check back after the next rotation!</p> : null}
        </>
      ) : (
        <InventoryView
          state={state}
          now={now}
          busy={busy}
          onEquip={(entry, action) => act("/api/store/equip", { itemId: entry.itemId, action })}
          onUse={(entry) => setModal({ kind: "use", entry })}
          onGift={(entry) => setModal({ kind: "gift", entry })}
          onShop={() => setTab("shop")}
        />
      )}

      {/* ---------- Modals ---------- */}
      {modal?.kind === "buy" ? (
        <BuyModal item={modal.item} balance={state.balance} busy={busy} onClose={() => setModal(null)}
          onConfirm={(amount) => act("/api/store/buy", { itemId: modal.item.itemId, amount })} />
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

      <div className="store-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`store-toast store-toast--${t.tone}`}>
            <span aria-hidden="true">{t.tone === "success" ? "✓" : "!"}</span> {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// SHOP CARD
// ==========================================
function ShopCard({ item, balance, onBuy }: { item: StoreItem; balance: number; onBuy: () => void }) {
  const isRole = Boolean(item.roleId) || item.category === "Roles";
  const ownedRole = !item.stackable && item.owned > 0;
  const soldOut = item.stock === 0;
  const limitReached = item.dailyLimit !== null && item.boughtToday >= item.dailyLimit;
  const short = item.price - balance;

  let button: ReactNode;
  if (ownedRole) button = <button className="store-buy store-buy--owned" disabled>{item.equipped ? "✓ Equipped" : "✓ Owned"}</button>;
  else if (soldOut) button = <button className="store-buy" disabled>Sold out</button>;
  else if (limitReached) button = <button className="store-buy" disabled>Daily limit reached</button>;
  else if (short > 0) button = <button className="store-buy" disabled>Need {short.toLocaleString()} more</button>;
  else button = <button className="store-buy store-buy--ready" onClick={onBuy}>Buy</button>;

  return (
    <article className={`store-card${ownedRole ? " store-card--owned" : ""}`} style={isRole ? swatchStyle(item.roleColors) : undefined}>
      <div className="store-card-top">
        <ItemVisual icon={item.icon} roleColors={item.roleColors} isRole={isRole} />
        <div className="store-badges">
          {item.equipped ? <span className="store-badge store-badge--equipped">Equipped</span> : ownedRole ? <span className="store-badge store-badge--owned">Owned</span> : null}
          {item.stackable && item.owned > 0 ? <span className="store-badge">You have {item.owned}</span> : null}
          {item.stock !== null && item.stock > 0 ? <span className="store-badge store-badge--warn">{item.stock} left</span> : null}
          {item.dailyLimit ? <span className="store-badge">{item.dailyLimit}/day</span> : null}
        </div>
      </div>
      <h3>{item.name}</h3>
      <p className="store-card-desc">{item.description}</p>
      <div className="store-card-foot">
        <span className="store-price"><Leaf size={20} />{item.price.toLocaleString()}</span>
        {button}
      </div>
    </article>
  );
}

// ==========================================
// INVENTORY
// ==========================================
function InventoryView({ state, now, busy, onEquip, onUse, onGift, onShop }: {
  state: StoreState; now: number; busy: boolean;
  onEquip: (entry: InventoryEntry, action: "equip" | "unequip") => void;
  onUse: (entry: InventoryEntry) => void; onGift: (entry: InventoryEntry) => void; onShop: () => void;
}) {
  const roles = state.inventory.filter((e) => e.type === "role");
  const boosters = state.inventory.filter((e) => e.type === "booster");
  const gifts = state.inventory.filter((e) => e.type === "gift");
  const other = state.inventory.filter((e) => !["role", "booster", "gift"].includes(e.type));
  const activeBoosters = state.boosters.filter((b) => new Date(b.endsAt).getTime() > now);

  if (!state.inventory.length && !activeBoosters.length) {
    return (
      <div className="store-empty-card">
        <span aria-hidden="true">🎒</span>
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
          <h2>🔥 Active boosters</h2>
          <div className="store-active-row">
            {activeBoosters.map((b) => (
              <div className="store-active-pill" key={b.itemId}>
                <span aria-hidden="true">{b.icon}</span>
                <strong>{b.name}</strong>
                <span className="store-timer">{formatCountdown(new Date(b.endsAt).getTime() - now)} left</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {roles.length ? (
        <InventorySection title="🎭 Roles" hint="Only one shop role can be equipped at a time.">
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
        <InventorySection title="🚀 Boosters">
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
        <InventorySection title="🎁 Gifts" hint={state.giftCooldownEndsAt && new Date(state.giftCooldownEndsAt).getTime() > now
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

      {other.length ? (
        <InventorySection title="📦 Other items">
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

function InventorySection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="store-section">
      <div className="store-section-head">
        <h2>{title}</h2>
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

function BuyModal({ item, balance, busy, onClose, onConfirm }: {
  item: StoreItem; balance: number; busy: boolean; onClose: () => void; onConfirm: (amount: number) => void;
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
        <ItemVisual icon={item.icon} roleColors={item.roleColors} isRole={isRole} large />
        <div>
          <strong>{item.name}</strong>
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
        <div><dt>Price</dt><dd>{amount > 1 ? `${amount} × ${item.price.toLocaleString()}` : item.price.toLocaleString()} <Leaf size={16} /></dd></div>
        <div><dt>Current balance</dt><dd>{balance.toLocaleString()} <Leaf size={16} /></dd></div>
        <div className="store-receipt-total"><dt>Balance after</dt><dd>{(balance - total).toLocaleString()} <Leaf size={16} /></dd></div>
      </dl>
      {isRole ? <p className="store-modal-note">After buying, equip it from your Inventory — it&apos;ll show on your Discord profile.</p> : null}

      <div className="store-modal-actions">
        <button className="store-ghost-button" onClick={onClose}>Cancel</button>
        <button className="store-primary" disabled={busy || total > balance} onClick={() => onConfirm(amount)}>
          {busy ? "Buying..." : `Buy for ${total.toLocaleString()}`}
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

      {cooldownLeft > 0 ? <p className="store-modal-note">⏳ You can send another gift in {formatCountdown(cooldownLeft)}.</p> : null}

      <div className="store-modal-actions">
        <button className="store-ghost-button" onClick={onClose}>Cancel</button>
        <button className="store-primary" disabled={busy || !picked || cooldownLeft > 0 || (entry.requiresMessage && !message.trim())}
          onClick={() => picked && onSend(picked.id, message)}>
          {busy ? "Sending..." : "Send gift 🎁"}
        </button>
      </div>
    </ModalShell>
  );
}
