"use client";

import { ArrowLeftRight, Check, Clock, Minus, Plus, Repeat, Search, Send, X } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { RARITY } from "../../lib/cosmetics";
import type { StoreState } from "../../lib/store";
import type { TradableGroup, Trade, TradeSide } from "../../lib/trades";
import { LeafEmote } from "../ui-icons";
import { CurrencyName, useCurrency } from "../season-context";

type Person = { name: string; avatar: string | null };
type TradesData = { incoming: Trade[]; outgoing: Trade[]; history: Trade[]; people: Record<string, Person>; fee: number; mine: TradableGroup[]; me: string };
type Member = { id: string; username: string; displayName: string; avatar: string | null };
type Picks = Record<string, number>;
type Draft = { member: Member; give: Picks; want: Picks; giveLeaves: string; wantLeaves: string; message: string };

const STATUS_LABEL: Record<string, string> = { accepted: "Completed", declined: "Declined", cancelled: "Cancelled", expired: "Expired", failed: "Didn't go through" };

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m left`;
}

function Face({ person, size = 32 }: { person?: Person; size?: number }) {
  const [failed, setFailed] = useState(false);
  return person?.avatar && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="trade-face" src={person.avatar} alt="" width={size} height={size} onError={() => setFailed(true)} />
  ) : (
    <span className="trade-face trade-face--letter" style={{ width: size, height: size }}>
      {(person?.name ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}

/** Items and leaves on one side of a trade, as chips. */
function SideChips({ side }: { side: TradeSide }) {
  const groups = new Map<string, { name: string; rarity: string; n: number }>();
  for (const i of side.items) {
    const g = groups.get(i.itemId) ?? { name: i.name, rarity: i.rarity, n: 0 };
    g.n++;
    groups.set(i.itemId, g);
  }
  if (!groups.size && !side.leaves) return <span className="store-muted">Nothing</span>;
  return (
    <div className="trade-chips">
      {Array.from(groups.entries()).map(([id, g]) => (
        <span key={id} className="trade-chip" style={{ "--rarity": RARITY[g.rarity as keyof typeof RARITY]?.color ?? "#9aa3ad" } as CSSProperties}>
          {g.n > 1 ? <b>{g.n}×</b> : null} {g.name}
        </span>
      ))}
      {side.leaves ? (
        <span className="trade-chip trade-chip--leaves">
          <LeafEmote size={14} /> {side.leaves.toLocaleString()}
        </span>
      ) : null}
    </div>
  );
}

function TradeCard({ t, me, people, fee, busy, children }: { t: Trade; me: string; people: Record<string, Person>; fee: number; busy: boolean; children?: ReactNode }) {
  const mine = t.from === me;
  const other = mine ? t.to : t.from;
  const youGive = mine ? t.give : t.want;
  const youGet = mine ? t.want : t.give;
  const feeOnGet = youGet.leaves ? Math.ceil(youGet.leaves * fee) : 0;
  return (
    <article className={`trade-card trade-card--${t.status}${busy ? " is-busy" : ""}`}>
      <header>
        <Face person={people[other]} />
        <span className="trade-who">
          <strong>{people[other]?.name ?? "Member"}</strong>
          <small>
            {t.status === "pending" ? (
              <>
                <Clock size={11} aria-hidden="true" /> {mine ? "Waiting for them" : "Wants to trade"} · {timeLeft(t.expiresAt)}
              </>
            ) : (
              <>
                {STATUS_LABEL[t.status] ?? t.status}
                {t.failReason ? `: ${t.failReason}` : ""} · {new Date(t.decidedAt ?? t.createdAt).toLocaleDateString()}
              </>
            )}
          </small>
        </span>
      </header>
      <div className="trade-sides">
        <div>
          <span className="trade-side-label">You give</span>
          <SideChips side={youGive} />
        </div>
        <ArrowLeftRight size={18} aria-hidden="true" className="trade-swap" />
        <div>
          <span className="trade-side-label">You get</span>
          <SideChips side={youGet} />
          {feeOnGet && t.status === "pending" ? <small className="store-muted">You receive {(youGet.leaves - feeOnGet).toLocaleString()} after the {Math.round(fee * 100)}% fee</small> : null}
        </div>
      </div>
      {t.message ? <p className="trade-note">“{t.message}”</p> : null}
      {children ? <div className="trade-actions">{children}</div> : null}
    </article>
  );
}

/** Pick items (with how many) from one side's tradable inventory. */
function ItemPicker({ groups, picks, onChange, empty }: { groups: TradableGroup[]; picks: Picks; onChange: (p: Picks) => void; empty: string }) {
  if (!groups.length) return <p className="store-muted trade-empty">{empty}</p>;
  const set = (id: string, n: number) => {
    const next = { ...picks };
    if (n <= 0) delete next[id];
    else next[id] = n;
    onChange(next);
  };
  return (
    <ul className="trade-pick">
      {groups.map((g) => {
        const n = picks[g.itemId] ?? 0;
        return (
          <li key={g.itemId} className={n ? "is-on" : undefined} style={{ "--rarity": RARITY[g.rarity].color } as CSSProperties}>
            <button type="button" className="trade-pick-name" onClick={() => set(g.itemId, n ? 0 : 1)} aria-pressed={n > 0}>
              <span className="trade-pick-dot" aria-hidden="true">
                {n ? <Check size={11} /> : null}
              </span>
              <span>
                {g.name}
                <small>
                  {RARITY[g.rarity].label}
                  {g.docIds.length > 1 ? ` · you have ${g.docIds.length}` : ""}
                </small>
              </span>
            </button>
            {g.docIds.length > 1 && n ? (
              <span className="store-qty-control store-qty-control--small">
                <button type="button" onClick={() => set(g.itemId, n - 1)} aria-label="One less">
                  <Minus size={12} />
                </button>
                <b>{n}</b>
                <button type="button" onClick={() => set(g.itemId, Math.min(g.docIds.length, n + 1))} disabled={n >= g.docIds.length} aria-label="One more">
                  <Plus size={12} />
                </button>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function TradeBuilder({ start, mine, balance, fee, busy, onClose, onSend }: { start: Draft | null; mine: TradableGroup[]; balance: number; fee: number; busy: boolean; onClose: () => void; onSend: (d: Draft) => void }) {
  const cur = useCurrency();
  const [draft, setDraft] = useState<Draft | null>(start);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [theirs, setTheirs] = useState<TradableGroup[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (draft || query.trim().length < 2) return setResults([]);
    const t = window.setTimeout(async () => {
      const r = await fetch(`/api/store/members?q=${encodeURIComponent(query.trim())}`).then((x) => x.json()).catch(() => null);
      setResults(r?.ok ? r.members : []);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query, draft]);
  const memberId = draft?.member.id;
  useEffect(() => {
    if (!memberId) return;
    setTheirs(null);
    void fetch(`/api/store/trades/inventory?member=${memberId}`)
      .then((x) => x.json())
      .then((r) => setTheirs(r?.ok ? r.items : []))
      .catch(() => setTheirs([]));
  }, [memberId]);

  const giveCount = draft ? Object.values(draft.give).reduce((a, b) => a + b, 0) : 0;
  const wantCount = draft ? Object.values(draft.want).reduce((a, b) => a + b, 0) : 0;
  const giveLeaves = Math.max(0, Math.floor(Number(draft?.giveLeaves) || 0));
  const wantLeaves = Math.max(0, Math.floor(Number(draft?.wantLeaves) || 0));
  const valid = Boolean(draft) && (giveCount || giveLeaves) && (wantCount || wantLeaves) && giveCount <= 8 && wantCount <= 8 && giveLeaves <= balance;

  return (
    <div className="store-modal-backdrop" onClick={onClose}>
      <div className="store-modal trade-builder" role="dialog" aria-modal="true" aria-label="New trade" onClick={(e) => e.stopPropagation()}>
        <div className="store-modal-head">
          <h2>{draft ? `Trade with ${draft.member.displayName}` : "New trade"}</h2>
          <button className="store-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {!draft ? (
          <label className="store-field">
            <span>Who do you want to trade with?</span>
            <span className="trade-search">
              <Search size={15} aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username or nickname…" autoFocus />
            </span>
            {results.length ? (
              <ul className="store-results">
                {results.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => setDraft({ member: m, give: {}, want: {}, giveLeaves: "", wantLeaves: "", message: "" })}>
                      {m.avatar ? <img src={m.avatar} alt="" width={28} height={28} /> : <span className="store-avatar-fallback">{m.displayName[0]}</span>}
                      <strong>{m.displayName}</strong>
                      <span className="store-muted">@{m.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
        ) : (
          <>
            <div className="trade-builder-cols">
              <section>
                <h3>You give</h3>
                <ItemPicker groups={mine} picks={draft.give} onChange={(give) => setDraft({ ...draft, give })} empty="You don't have anything you can trade yet." />
                <label className="trade-leaves">
                  <LeafEmote size={16} />
                  <input type="number" min={0} max={balance} value={draft.giveLeaves} onChange={(e) => setDraft({ ...draft, giveLeaves: e.target.value })} placeholder={`${cur.many} (optional)`} />
                </label>
                {giveLeaves > balance ? <small className="trade-warn">You only have {balance.toLocaleString()}.</small> : null}
              </section>
              <ArrowLeftRight size={20} aria-hidden="true" className="trade-swap" />
              <section>
                <h3>You want</h3>
                {theirs === null ? (
                  <div className="adm-skeleton adm-skeleton--short" />
                ) : (
                  <ItemPicker groups={theirs} picks={draft.want} onChange={(want) => setDraft({ ...draft, want })} empty={`They don't have anything tradable. You can still ask for ${cur.lower}.`} />
                )}
                <label className="trade-leaves">
                  <LeafEmote size={16} />
                  <input type="number" min={0} value={draft.wantLeaves} onChange={(e) => setDraft({ ...draft, wantLeaves: e.target.value })} placeholder={`${cur.many} (optional)`} />
                </label>
                {wantLeaves ? <small className="store-muted">You&apos;d receive {(wantLeaves - Math.ceil(wantLeaves * fee)).toLocaleString()} after the {Math.round(fee * 100)}% fee.</small> : null}
              </section>
            </div>
            <label className="store-field">
              <span>Note (optional)</span>
              <input value={draft.message} maxLength={200} onChange={(e) => setDraft({ ...draft, message: e.target.value })} placeholder="Say something about the offer…" />
            </label>
            <p className="store-modal-note">
              Nothing changes hands until they accept. If either of you no longer has something by then, the trade simply doesn&apos;t go through. Custom Titles and Custom Badges are personal and can&apos;t be traded.
            </p>
            <div className="store-modal-actions">
              <button className="store-ghost-button" onClick={() => setDraft(null)}>
                Change person
              </button>
              <button className="store-primary" disabled={busy || !valid} onClick={() => onSend(draft)}>
                <Send size={14} aria-hidden="true" /> {busy ? "Sending…" : "Send offer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Store → Trades: offers to you, offers you sent, and how past trades went. */
export function TradesView({ state, onState, toast, onCount }: { state: StoreState; onState: (s: StoreState) => void; toast: (tone: "success" | "error", text: string) => void; onCount: (n: number) => void }) {
  const [data, setData] = useState<TradesData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [builder, setBuilder] = useState<{ start: Draft | null } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/store/trades", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) {
      setData(r);
      onCount(r.incoming.length);
    }
  }, [onCount]);
  useEffect(() => {
    void load();
    const t = window.setInterval(() => document.visibilityState === "visible" && void load(), 20_000);
    return () => window.clearInterval(t);
  }, [load]);

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      const r = await fetch("/api/store/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => null);
      if (!r?.ok) {
        toast("error", r?.error ?? "That didn't work.");
        void load();
        return false;
      }
      toast("success", r.message ?? "Done!");
      setData(r.trades);
      onCount(r.trades.incoming.length);
      if (r.state) onState(r.state);
      return true;
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <div className="adm-skeleton" style={{ height: 200 }} />;
  const counter = (t: Trade) => {
    // Swap the sides of their offer into a new one from you
    const other = t.from;
    const person = data.people[other];
    const count = (side: TradeSide) => side.items.reduce<Picks>((p, i) => ({ ...p, [i.itemId]: (p[i.itemId] ?? 0) + 1 }), {});
    setBuilder({
      start: {
        member: { id: other, username: person?.name ?? "", displayName: person?.name ?? "Member", avatar: person?.avatar ?? null },
        give: count(t.want),
        want: count(t.give),
        giveLeaves: t.want.leaves ? String(t.want.leaves) : "",
        wantLeaves: t.give.leaves ? String(t.give.leaves) : "",
        message: "",
      },
    });
  };

  return (
    <div className="trades">
      <div className="trades-head">
        <div>
          <h2>
            <Repeat size={20} aria-hidden="true" /> Trades
          </h2>
          <p className="store-muted">Swap items and <CurrencyName lower /> with other members. Both of you confirm, and there&apos;s a {Math.round(data.fee * 100)}% fee on <CurrencyName lower /> that change hands.</p>
        </div>
        <button type="button" className="store-primary" onClick={() => setBuilder({ start: null })}>
          <Plus size={15} aria-hidden="true" /> New trade
        </button>
      </div>

      <section className="trades-section">
        <h3>
          Offers for you {data.incoming.length ? <span className="store-tab-count">{data.incoming.length}</span> : null}
        </h3>
        {data.incoming.length ? (
          data.incoming.map((t) => (
            <TradeCard key={t.id} t={t} me={data.me} people={data.people} fee={data.fee} busy={busy === t.id}>
              {confirm === t.id ? (
                <>
                  <span className="store-muted">Swap everything now?</span>
                  <button className="store-primary" disabled={Boolean(busy)} onClick={() => void post({ action: "accept", id: t.id }, t.id).then(() => setConfirm(null))}>
                    {busy === t.id ? "Trading…" : "Yes, trade"}
                  </button>
                  <button className="store-ghost-button" onClick={() => setConfirm(null)}>
                    Not yet
                  </button>
                </>
              ) : (
                <>
                  <button className="store-primary" disabled={Boolean(busy)} onClick={() => setConfirm(t.id)}>
                    <Check size={14} aria-hidden="true" /> Accept
                  </button>
                  <button className="store-ghost-button" disabled={Boolean(busy)} onClick={() => counter(t)}>
                    <Repeat size={14} aria-hidden="true" /> Counter
                  </button>
                  <button className="store-ghost-button" disabled={Boolean(busy)} onClick={() => void post({ action: "decline", id: t.id }, t.id)}>
                    <X size={14} aria-hidden="true" /> Decline
                  </button>
                </>
              )}
            </TradeCard>
          ))
        ) : (
          <p className="store-muted trade-empty">No offers waiting for you.</p>
        )}
      </section>

      <section className="trades-section">
        <h3>Your offers</h3>
        {data.outgoing.length ? (
          data.outgoing.map((t) => (
            <TradeCard key={t.id} t={t} me={data.me} people={data.people} fee={data.fee} busy={busy === t.id}>
              <button className="store-ghost-button" disabled={Boolean(busy)} onClick={() => void post({ action: "cancel", id: t.id }, t.id)}>
                <X size={14} aria-hidden="true" /> Cancel offer
              </button>
            </TradeCard>
          ))
        ) : (
          <p className="store-muted trade-empty">You haven&apos;t sent any offers.</p>
        )}
      </section>

      {data.history.length ? (
        <section className="trades-section">
          <h3>History</h3>
          {data.history.map((t) => (
            <TradeCard key={t.id} t={t} me={data.me} people={data.people} fee={data.fee} busy={false} />
          ))}
        </section>
      ) : null}

      {builder ? (
        <TradeBuilder
          start={builder.start}
          mine={data.mine}
          balance={state.balance}
          fee={data.fee}
          busy={busy === "new"}
          onClose={() => setBuilder(null)}
          onSend={(d) =>
            void post(
              {
                action: "create",
                to: d.member.id,
                giveItems: Object.entries(d.give).map(([itemId, count]) => ({ itemId, count })),
                wantItems: Object.entries(d.want).map(([itemId, count]) => ({ itemId, count })),
                giveLeaves: Number(d.giveLeaves) || 0,
                wantLeaves: Number(d.wantLeaves) || 0,
                message: d.message,
              },
              "new",
            ).then((ok) => ok && setBuilder(null))
          }
        />
      ) : null}
    </div>
  );
}
