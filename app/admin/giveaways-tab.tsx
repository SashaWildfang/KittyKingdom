"use client";

import "./bots/bots.css";
import "./giveaways-tab.css";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Copy,
  Crown,
  Gift,
  Hash,
  Leaf,
  Package,
  Pencil,
  Play,
  Plus,
  Repeat,
  Search,
  Settings,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Square,
  Trash2,
  Trophy,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RARITY } from "../../lib/cosmetics";
import { compact } from "../../lib/compact";
import type { CmLimits } from "../../lib/giveaway-access";
import type { Giveaway, GiveawayInput, GiveawayList, Prize, Recurring, StoreItem } from "../../lib/giveaways";
import { Pager, formatDate, timeAgo, useLive, type People } from "./admin-shared";
import { Picker, channelOptions, roleOptions, type Meta } from "./bots/pickers";
import { useCurrency } from "../season-context";
import { CurrencyAmount, LeafEmote, XpAmount, XpText } from "../ui-icons";

type Filter = "review" | "running" | "scheduled" | "ended" | "cancelled" | "all";
type ListData = GiveawayList & { ok: boolean; isAdmin: boolean; limits: CmLimits };
type Detail = { ok: boolean; error?: string; isAdmin: boolean; giveaway: Giveaway; handed: string[]; entrants: { userId: string; at: string | null }[]; total: number; page: number; pageSize: number; people: People };

const FILTERS: [Filter, string][] = [
  ["review", "Needs approval"],
  ["running", "Running"],
  ["scheduled", "Upcoming"],
  ["ended", "Ended"],
  ["cancelled", "Cancelled"],
  ["all", "All"],
];
const STATUS: Record<string, string> = { review: "Needs approval", running: "Running", scheduled: "Upcoming", ended: "Ended", cancelled: "Cancelled" };
const RECUR: Record<Recurring, string> = { none: "Once", daily: "Every day", weekly: "Every week", monthly: "Every month" };
const PERIOD: Record<Recurring, number> = { none: Infinity, daily: 86400, weekly: 7 * 86400, monthly: 30 * 86400 };
const UNIT: Record<Recurring, string> = { none: "", daily: "day", weekly: "week", monthly: "month" };
const DURATIONS: [string, number][] = [
  ["1 hour", 3600],
  ["3 hours", 3 * 3600],
  ["6 hours", 6 * 3600],
  ["12 hours", 12 * 3600],
  ["1 day", 86400],
  ["2 days", 2 * 86400],
  ["3 days", 3 * 86400],
  ["5 days", 5 * 86400],
  ["1 week", 7 * 86400],
  ["2 weeks", 14 * 86400],
];

/** "in 3h" / "2d ago" for a date, rounded to the biggest unit. */
function relative(iso: string | null, now: number) {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff) / 1000;
  const text = abs < 60 ? `${Math.round(abs)}s` : abs < 3600 ? `${Math.round(abs / 60)}m` : abs < 86400 ? `${Math.floor(abs / 3600)}h ${Math.floor((abs % 3600) / 60)}m` : `${Math.floor(abs / 86400)}d ${Math.floor((abs % 86400) / 3600)}h`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

const when = (d: Date) => d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function prizeLabel(p: Prize) {
  if (p.type === "leaves") return `${(p.amount ?? 0).toLocaleString()} Leaves`;
  if (p.type === "xp") return `${(p.amount ?? 0).toLocaleString()} XP`;
  if (p.type === "item") return `${(p.quantity ?? 1) > 1 ? `${p.quantity}× ` : ""}${p.itemName ?? p.itemId}`;
  return p.text || "Custom prize";
}

function PrizeIcon({ prize, size = 18 }: { prize: Prize; size?: number }) {
  if (prize.type === "leaves") return <Leaf size={size} aria-hidden="true" />;
  if (prize.type === "xp") return <Sparkles size={size} aria-hidden="true" />;
  if (prize.type === "item") return <Package size={size} aria-hidden="true" />;
  return <Gift size={size} aria-hidden="true" />;
}

/** The prize's picture: the store item's image, or an icon. */
function PrizeArt({ prize, big = false }: { prize: Prize; big?: boolean }) {
  if (prize.type === "item" && prize.itemImage)
    return (
      <span className={`gw-prize-icon is-item has-img${big ? " is-big" : ""}`} style={prize.itemRarity ? ({ "--rar": RARITY[prize.itemRarity].color } as React.CSSProperties) : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={prize.itemImage} alt="" loading="lazy" />
      </span>
    );
  return (
    <span className={`gw-prize-icon is-${prize.type}${big ? " is-big" : ""}`}>
      <PrizeIcon prize={prize} size={big ? 26 : 20} />
    </span>
  );
}

export function RarityChip({ rarity }: { rarity?: Prize["itemRarity"] }) {
  if (!rarity) return null;
  const r = RARITY[rarity];
  return (
    <span className="gw-rarity" style={{ "--rar": r.color } as React.CSSProperties}>
      {r.label}
    </span>
  );
}

/** "worth 22.4k 🍁" for store items (what one winner gets, at the shop price). */
function Worth({ prize }: { prize: Prize; many?: string }) {
  if (prize.type !== "item" || prize.itemPrice === undefined) return null;
  const each = prize.itemPrice * (prize.quantity ?? 1);
  return (
    <span className="gw-worth" title={`${each.toLocaleString()} at the shop price`}>
      worth {compact(each)} <LeafEmote size={12} />
    </span>
  );
}

async function call(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    .then((x) => x.json())
    .catch(() => null);
  if (!r?.ok) throw new Error(r?.error ?? "Something went wrong.");
  return r;
}

function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    fetch("/api/admin/bots/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setMeta(r))
      .catch(() => undefined);
  }, []);
  return meta;
}

/** Overlays go on <body> so the page (and its footer) can't sit on top of them or scroll under them. */
function Overlay({ children }: { children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return createPortal(children, document.body);
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/** Admin → Giveaways: set up, schedule and run giveaways for Leaves, XP, store items or anything else. The Main Bot runs them. */
export function GiveawaysTab() {
  const cur = useCurrency();
  const [filter, setFilter] = useState<Filter>("running");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Giveaway | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const meta = useMeta();
  const now = useNow();
  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, reload } = useLive<ListData>(`/api/admin/giveaways?${new URLSearchParams({ status: filter, search })}`, 10_000);
  const channelName = (id: string | null) => (id ? (meta?.channels.find((c) => c.id === id)?.name ?? "unknown channel") : null);
  const isAdmin = Boolean(data?.isAdmin);

  // Land on what needs attention: approvals for admins, then running, then upcoming
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!data || landed) return;
    setLanded(true);
    if (filter !== "running") return;
    if (data.isAdmin && data.counts.review) setFilter("review");
    else if (!data.counts.running && data.counts.scheduled) setFilter("scheduled");
  }, [data, landed, filter]);

  const filters = FILTERS.filter(([k]) => k !== "review" || (data?.counts.review ?? 0) > 0 || filter === "review");

  return (
    <section className="adm-panel gw">
      <div className="adm-kpis gw-kpis">
        <button type="button" className="adm-kpi is-link adm-kpi--orange" onClick={() => setFilter("running")}>
          <small>Running now</small>
          <strong>{data?.counts.running ?? "…"}</strong>
          <span>{data ? `${data.counts.scheduled} upcoming` : "…"}</span>
        </button>
        {data?.counts.review ? (
          <button type="button" className="adm-kpi is-link adm-kpi--red" onClick={() => setFilter("review")}>
            <small>Needs approval</small>
            <strong>{data.counts.review}</strong>
            <span>{isAdmin ? "from Community Managers" : "waiting for an admin"}</span>
          </button>
        ) : null}
        <div className="adm-kpi">
          <small>Winners</small>
          <strong>{data?.stats.winners.toLocaleString() ?? "…"}</strong>
          <span>{data ? `${data.stats.entries.toLocaleString()} entries in total` : "…"}</span>
        </div>
        <div className="adm-kpi adm-kpi--green">
          <small>{cur.many} given</small>
          <strong>{data?.stats.leaves.toLocaleString() ?? "…"}</strong>
          <span>{data ? <>{data.stats.items.toLocaleString()} store items · <XpAmount n={data.stats.xp} size={14} /></> : "…"}</span>
        </div>
        <button type="button" className={`adm-kpi is-link${data?.stats.manualToDo ? " adm-kpi--red" : " adm-kpi--blue"}`} onClick={() => setFilter("ended")}>
          <small>To hand out</small>
          <strong>{data?.stats.manualToDo ?? "…"}</strong>
          <span>custom prizes waiting on staff</span>
        </button>
      </div>

      {data && !isAdmin ? (
        <p className="gw-limits">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>
            You can run giveaways up to <b>{data.limits.maxLeaves.toLocaleString()} {cur.many}</b>, <b><XpAmount n={data.limits.maxXp} size={15} /></b> or a store item worth up to{" "}
            <b>{data.limits.maxItemPrice.toLocaleString()} {cur.many}</b> each, for up to <b>{data.limits.maxWinners} winners</b> ({data.limits.maxTotal.toLocaleString()} {cur.many} in total, {data.limits.weeklyBudget.toLocaleString()} a week across Community Managers).
            Anything bigger{data.limits.customNeedsApproval ? ", and custom prizes," : ""} goes to an admin to approve first.
          </span>
        </p>
      ) : null}

      <div className="gw-toolbar">
        <div className="adm-seg" role="tablist" aria-label="Status">
          {filters.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={`${filter === k ? "is-active" : ""}${k === "review" ? " is-review" : ""}`} onClick={() => setFilter(k)}>
              {label}
              {k !== "all" && data ? <small className="gw-count">{data.counts[k]}</small> : null}
            </button>
          ))}
        </div>
        <label className="adm-search">
          <Search size={15} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search giveaways" aria-label="Search giveaways" />
        </label>
        {isAdmin ? (
          <a className="adm-btn adm-btn--ghost adm-btn--small" href="/admin?tab=bot-main#giveaways" title="Default channel, ping, DMs, cleanup and Community Manager limits (Admin → Bots → Main Bot)">
            <Settings size={14} aria-hidden="true" /> Settings
          </a>
        ) : null}
        <a className="adm-btn adm-btn--ghost adm-btn--small" href="/giveaways" target="_blank" rel="noreferrer" title="The public giveaways page">
          <Gift size={14} aria-hidden="true" /> Public page
        </a>
        <button type="button" className="adm-btn adm-btn--small" onClick={() => setEditing("new")}>
          <Plus size={14} aria-hidden="true" /> New giveaway
        </button>
      </div>

      {error ? (
        <p className="adm-error">
          {error}{" "}
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={reload}>
            Retry
          </button>
        </p>
      ) : null}
      {!data ? (
        error ? null : <div className="adm-skeleton" style={{ height: 320 }} />
      ) : !data.rows.length ? (
        <div className="adm-empty gw-empty">
          <Gift size={26} aria-hidden="true" />
          <p>{search ? "No giveaways match." : filter === "running" ? "Nothing is running right now." : filter === "scheduled" ? "Nothing is scheduled." : filter === "review" ? "Nothing is waiting for approval." : "None yet."}</p>
          <button type="button" className="adm-btn adm-btn--small" onClick={() => setEditing("new")}>
            <Plus size={14} aria-hidden="true" /> Set one up
          </button>
        </div>
      ) : (
        <ul className="gw-list">
          {data.rows.map((g) => {
            const start = new Date(g.startAt ?? g.endAt).getTime();
            const end = new Date(g.endAt).getTime();
            const progress = g.status === "running" ? Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start))) : 0;
            return (
              <li key={g.id}>
                <button type="button" className={`gw-card is-${g.status}`} onClick={() => setOpen(g.id)} style={g.color ? ({ "--gw-accent": g.color } as React.CSSProperties) : undefined}>
                  <PrizeArt prize={g.prize} />
                  <span className="gw-card-main">
                    <span className="gw-card-title">
                      <b>{g.title}</b>
                      <span className={`gw-status is-${g.status}`}>{STATUS[g.status]}</span>
                    </span>
                    <span className="gw-card-prize">
                      <span>
                        <CurrencyAmount text={cur.text(prizeLabel(g.prize))} size={15} /> × {g.winners} winner{g.winners === 1 ? "" : "s"}
                      </span>
                      <RarityChip rarity={g.prize.itemRarity} />
                      <Worth prize={g.prize} many={cur.many} />
                    </span>
                    <span className="gw-card-meta">
                      {channelName(g.postedChannelId ?? g.channelId) ? (
                        <span>
                          <Hash size={11} aria-hidden="true" />
                          {channelName(g.postedChannelId ?? g.channelId)}
                        </span>
                      ) : null}
                      {g.recurring !== "none" ? (
                        <span className="gw-tag" title={RECUR[g.recurring]}>
                          <Repeat size={11} aria-hidden="true" /> {RECUR[g.recurring]} · round {g.round}
                          {g.rounds ? ` of ${g.rounds}` : ""}
                        </span>
                      ) : null}
                      {g.createdByRole === "cm" && data.people[g.createdBy ?? ""] ? <span>by {data.people[g.createdBy ?? ""]?.name}</span> : null}
                      {g.lastError ? (
                        <span className="gw-tag is-warn" title={g.lastError}>
                          <AlertTriangle size={11} aria-hidden="true" /> problem
                        </span>
                      ) : null}
                    </span>
                    {g.status === "review" && g.review?.reasons.length ? <span className="gw-card-review">{g.review.reasons[0]}{g.review.reasons.length > 1 ? ` (+${g.review.reasons.length - 1} more)` : ""}</span> : null}
                    {g.status === "ended" && g.results.length ? (
                      <span className="gw-card-winners">
                        <Trophy size={13} aria-hidden="true" /> {g.results.map((r) => data.people[r.userId]?.name ?? r.userId).join(", ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="gw-card-side">
                    <span className="gw-card-stat">
                      <Users size={13} aria-hidden="true" /> {g.entries.toLocaleString()}
                    </span>
                    <span className="gw-card-time" title={formatDate(g.status === "scheduled" || g.status === "review" ? g.startAt : g.endAt)}>
                      {g.status === "scheduled" || g.status === "review" ? `Starts ${relative(g.startAt, now)}` : g.status === "running" ? `Ends ${relative(g.endAt, now)}` : g.endedAt ? `Ended ${timeAgo(g.endedAt)}` : ""}
                    </span>
                  </span>
                  {g.status === "running" ? (
                    <span className="gw-card-bar" aria-hidden="true">
                      <i style={{ width: `${progress * 100}%` }} />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <Overlay>
          <Editor
            initial={editing === "new" ? null : editing}
            meta={meta}
            isAdmin={isAdmin}
            limits={data?.limits ?? null}
            onClose={() => setEditing(null)}
            onSaved={(id) => {
              setEditing(null);
              reload();
              if (id) setOpen(id);
            }}
          />
        </Overlay>
      ) : null}
      {open && !editing ? (
        <Overlay>
          <DetailDrawer
            id={open}
            meta={meta}
            now={now}
            onClose={() => setOpen(null)}
            onEdit={(g) => setEditing(g)}
            onChanged={reload}
            onOpen={(id) => setOpen(id)}
          />
        </Overlay>
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------------ detail
function DetailDrawer({
  id,
  meta,
  now,
  onClose,
  onEdit,
  onChanged,
  onOpen,
}: {
  id: string;
  meta: Meta | null;
  now: number;
  onClose: () => void;
  onEdit: (g: Giveaway) => void;
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const cur = useCurrency();
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLive<Detail>(`/api/admin/giveaways/${id}?page=${page}`, 5_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | "end" | "reject" | null>(null);
  const [rerollCount, setRerollCount] = useState(1);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setErr(null);
    try {
      const r = await call(`/api/admin/giveaways/${id}/action`, "POST", { action, ...extra });
      setConfirm(null);
      onChanged();
      reload();
      if (action === "duplicate" && r.id) onOpen(r.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    setBusy("delete");
    setErr(null);
    try {
      await call(`/api/admin/giveaways/${id}`, "DELETE");
      onChanged();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  };

  const g = data?.giveaway;
  const isAdmin = Boolean(data?.isAdmin);
  const people = data?.people ?? {};
  const name = (uid: string | null) => (uid ? (uid === "bot" ? "Main Bot" : (people[uid]?.name ?? uid)) : "Someone");
  const channel = g ? (meta?.channels.find((c) => c.id === (g.postedChannelId ?? g.channelId))?.name ?? null) : null;
  const handed = new Set(data?.handed ?? []);
  const canDelete = g && g.status !== "running" && (isAdmin || g.status === "review");

  return (
    <div className="adm-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="adm-drawer gw-drawer" role="dialog" aria-label="Giveaway">
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        {!g ? (
          error ? <p className="adm-error">{error}</p> : <div className="adm-skeleton" style={{ height: 300 }} />
        ) : (
          <>
            <header className="gw-drawer-head" style={g.color ? ({ "--gw-accent": g.color } as React.CSSProperties) : undefined}>
              <PrizeArt prize={g.prize} big />
              <div>
                <span className={`gw-status is-${g.status}`}>{STATUS[g.status]}</span>
                <h2>{g.title}</h2>
                <p className="gw-drawer-prize">
                  <span>
                    <CurrencyAmount text={cur.text(prizeLabel(g.prize))} size={15} /> × {g.winners} winner{g.winners === 1 ? "" : "s"}
                  </span>
                  <RarityChip rarity={g.prize.itemRarity} />
                  <Worth prize={g.prize} many={cur.many} />
                </p>
                <p className="adm-muted">
                  {RECUR[g.recurring]}
                  {g.recurring !== "none" ? ` · round ${g.round}${g.rounds ? ` of ${g.rounds}` : ""}` : ""}
                  {g.value ? ` · ${g.value.toLocaleString()} ${cur.many} in total` : ""}
                </p>
              </div>
            </header>

            {g.status === "review" ? (
              <div className="gw-approval">
                <p>
                  <ShieldCheck size={15} aria-hidden="true" /> <b>{name(g.review?.by ?? g.createdBy)}</b> set this up, but it&apos;s over the Community Manager limits:
                </p>
                <ul>
                  {(g.review?.reasons ?? []).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {isAdmin ? (
                  confirm === "reject" ? (
                    <div className="gw-reject">
                      <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Why (optional, shown in its history)" aria-label="Why" />
                      <button type="button" className="adm-btn adm-btn--danger adm-btn--small" disabled={!!busy} onClick={() => act("reject", { reason })}>
                        Turn it down
                      </button>
                      <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirm(null)}>
                        Back
                      </button>
                    </div>
                  ) : (
                    <div className="gw-approval-actions">
                      <button type="button" className="adm-btn adm-btn--small" disabled={!!busy} onClick={() => act("approve")}>
                        <Check size={14} aria-hidden="true" /> Approve
                      </button>
                      <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => onEdit(g)}>
                        <Pencil size={14} aria-hidden="true" /> Change it first
                      </button>
                      <button type="button" className="adm-btn adm-btn--ghost adm-btn--small gw-danger" onClick={() => setConfirm("reject")}>
                        <XCircle size={14} aria-hidden="true" /> Turn down
                      </button>
                    </div>
                  )
                ) : (
                  <p className="adm-muted gw-note">An admin needs to approve it before it starts. Edit it to bring it within the limits and it can run straight away.</p>
                )}
              </div>
            ) : null}

            {g.lastError ? (
              <p className="adm-error gw-problem">
                <AlertTriangle size={14} aria-hidden="true" /> The bot hit a problem {g.status === "scheduled" ? "starting" : "with"} this giveaway: {g.lastError}
              </p>
            ) : null}
            {g.pending.end || g.pending.cancel || g.pending.reroll || g.pending.edit ? (
              <p className="gw-pending">
                <span className="gw-spinner" aria-hidden="true" />
                {g.pending.cancel ? "Cancelling…" : g.pending.end ? "Ending and picking winners…" : g.pending.reroll ? "Rerolling…" : "Updating the post in Discord…"} The Main Bot does this within a few seconds.
              </p>
            ) : null}

            <div className="gw-facts">
              <div>
                <small>{g.status === "scheduled" || g.status === "review" ? "Starts" : "Started"}</small>
                <b>{formatDate(g.startAt)}</b>
                <span>{relative(g.startAt, now)}</span>
              </div>
              <div>
                <small>{g.status === "ended" || g.status === "cancelled" ? "Ended" : "Winners picked"}</small>
                <b>{formatDate(g.endedAt ?? g.endAt)}</b>
                <span>{relative(g.endedAt ?? g.endAt, now)}</span>
              </div>
              <div>
                <small>Entries</small>
                <b>{g.entries.toLocaleString()}</b>
                <span>{g.status === "running" ? "live" : g.status === "scheduled" || g.status === "review" ? "opens at the start" : "final"}</span>
              </div>
              <div>
                <small>Channel</small>
                <b>{channel ? `#${channel}` : g.channelId ? "Unknown channel" : "Default channel"}</b>
                <span>{g.messageId && g.postedChannelId ? <a href={`https://discord.com/channels/1358452494128250940/${g.postedChannelId}/${g.messageId}`} target="_blank" rel="noreferrer">Open the post</a> : "not posted yet"}</span>
              </div>
            </div>

            <div className="gw-actions">
              {g.status === "scheduled" || g.status === "running" || g.status === "review" ? (
                <button type="button" className="adm-btn adm-btn--small" onClick={() => onEdit(g)}>
                  <Pencil size={14} aria-hidden="true" /> Edit
                </button>
              ) : null}
              {g.status === "scheduled" ? (
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={!!busy} onClick={() => act("start")}>
                  <Play size={14} aria-hidden="true" /> Start now
                </button>
              ) : null}
              {g.status === "running" ? (
                confirm === "end" ? (
                  <span className="gw-confirm">
                    End now and pick winners?
                    <button type="button" className="adm-btn adm-btn--small" disabled={!!busy} onClick={() => act("end")}>Yes, end it</button>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirm(null)}>No</button>
                  </span>
                ) : (
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={!!busy || g.pending.end} onClick={() => setConfirm("end")}>
                    <Square size={14} aria-hidden="true" /> End now
                  </button>
                )
              ) : null}
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={!!busy} onClick={() => act("duplicate")} title="Copy it as a new upcoming giveaway (starts in an hour; edit it to change that)">
                <Copy size={14} aria-hidden="true" /> Duplicate
              </button>
              {g.status === "scheduled" || g.status === "running" ? (
                confirm === "cancel" ? (
                  <span className="gw-confirm">
                    Cancel it? Nobody wins.
                    <button type="button" className="adm-btn adm-btn--danger adm-btn--small" disabled={!!busy} onClick={() => act("cancel")}>Yes, cancel</button>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirm(null)}>No</button>
                  </span>
                ) : (
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={!!busy || g.pending.cancel} onClick={() => setConfirm("cancel")}>
                    <XCircle size={14} aria-hidden="true" /> Cancel
                  </button>
                )
              ) : null}
              {canDelete ? (
                confirm === "delete" ? (
                  <span className="gw-confirm">
                    Delete it and its entries for good?
                    <button type="button" className="adm-btn adm-btn--danger adm-btn--small" disabled={!!busy} onClick={remove}>Delete</button>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirm(null)}>No</button>
                  </span>
                ) : (
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--small gw-danger" disabled={!!busy} onClick={() => setConfirm("delete")}>
                    <Trash2 size={14} aria-hidden="true" /> Delete
                  </button>
                )
              ) : null}
            </div>
            {err ? <p className="adm-error">{err}</p> : null}

            {g.description ? (
              <div className="adm-drawer-section">
                <h3>Description</h3>
                <p className="gw-desc">{g.description}</p>
              </div>
            ) : null}

            <div className="adm-drawer-section">
              <h3>Who can enter</h3>
              <ul className="gw-reqs">
                <li>{g.requirements.minLevel ? `Level ${g.requirements.minLevel}+` : "Any level"}</li>
                <li>{g.requirements.minDaysInServer ? `In the server ${g.requirements.minDaysInServer}+ days` : "No time-in-server limit"}</li>
                {g.requirements.requiredRoles.length ? <li>Needs: {g.requirements.requiredRoles.map((r) => `@${meta?.roles.find((x) => x.id === r)?.name ?? r}`).join(" or ")}</li> : null}
                {g.requirements.blockedRoles.length ? <li>Not: {g.requirements.blockedRoles.map((r) => `@${meta?.roles.find((x) => x.id === r)?.name ?? r}`).join(", ")}</li> : null}
              </ul>
            </div>

            {g.status === "ended" ? (
              <div className="adm-drawer-section">
                <h3>
                  <Trophy size={15} aria-hidden="true" /> Winners
                </h3>
                {g.results.length ? (
                  <ul className="gw-winners">
                    {g.results.map((r) => (
                      <li key={r.userId}>
                        <Crown size={14} aria-hidden="true" />
                        <span className="gw-winner-name">
                          <b>{name(r.userId)}</b>
                          <small>{r.userId}</small>
                        </span>
                        {r.awarded ? (
                          <span className="gw-paid">
                            <Check size={12} aria-hidden="true" /> {r.note}
                          </span>
                        ) : handed.has(r.userId) ? (
                          <span className="gw-paid">
                            <Check size={12} aria-hidden="true" /> handed out
                          </span>
                        ) : (
                          <button type="button" className="adm-btn adm-btn--tiny" disabled={!!busy} onClick={() => act("handed", { userId: r.userId })}>
                            Mark handed out
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="adm-muted">Nobody qualified.</p>
                )}
                <div className="gw-reroll">
                  <span>Reroll</span>
                  <input type="number" min={1} max={50} value={rerollCount} onChange={(e) => setRerollCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} aria-label="How many new winners" />
                  <span>new winner{rerollCount === 1 ? "" : "s"}</span>
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={!!busy || !!g.pending.reroll} onClick={() => act("reroll", { count: rerollCount })}>
                    <Shuffle size={14} aria-hidden="true" /> Reroll
                  </button>
                </div>
                <p className="adm-muted gw-note">Rerolling adds new winners from the remaining entries (previous winners keep their prize) and pays them too.</p>
              </div>
            ) : null}

            <div className="adm-drawer-section">
              <h3>
                <Users size={15} aria-hidden="true" /> Entries <small className="adm-muted">{data.total.toLocaleString()}</small>
              </h3>
              {data.entrants.length ? (
                <>
                  <ul className="gw-entrants">
                    {data.entrants.map((e) => (
                      <li key={e.userId}>
                        <b>{name(e.userId)}</b>
                        <time title={formatDate(e.at)}>{timeAgo(e.at)}</time>
                      </li>
                    ))}
                  </ul>
                  <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
                </>
              ) : (
                <p className="adm-muted">{g.status === "scheduled" || g.status === "review" ? "Entries open when it starts." : "No entries."}</p>
              )}
            </div>

            <div className="adm-drawer-section">
              <h3>History</h3>
              <ul className="gw-history">
                {g.history
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <li key={i}>
                      <b>{name(h.by)}</b>{" "}
                      {h.action === "handed"
                        ? "handed out a prize"
                        : h.action === "reroll"
                          ? `rerolled ${h.detail ?? ""} winner(s)`
                          : h.action === "end"
                            ? "ended it early"
                            : h.action === "start"
                              ? "started it early"
                              : h.action === "duplicate"
                                ? "duplicated it"
                                : h.action === "approve"
                                  ? "approved it"
                                  : h.action === "reject"
                                    ? `turned it down${h.detail ? `: ${h.detail}` : ""}`
                                    : h.action === "sent for approval"
                                      ? "sent it for approval"
                                      : h.action === "created" && h.detail
                                        ? `created it (${h.detail})`
                                        : `${h.action} it`}
                      <time title={formatDate(h.at)}> · {timeAgo(h.at)}</time>
                    </li>
                  ))}
                {g.previousId ? (
                  <li>
                    Round {g.round} of a repeating giveaway ·{" "}
                    <button type="button" className="adm-link" onClick={() => onOpen(g.previousId!)}>
                      see the last round
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ editor
type Draft = Omit<GiveawayInput, "startAt" | "endAt"> & { startMode: "now" | "at"; start: string; endMode: "duration" | "at"; duration: number; end: string };

const pad = (n: number) => String(n).padStart(2, "0");
/** A Date as the value of a datetime-local input (the admin's own time zone). */
function localInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDraft(g: Giveaway | null): Draft {
  const inAnHour = new Date(Date.now() + 3600_000);
  inAnHour.setMinutes(0, 0, 0);
  if (!g)
    return {
      title: "",
      description: "",
      prize: { type: "leaves", amount: 1000 },
      winners: 1,
      channelId: null,
      pingRoleId: null,
      color: null,
      image: null,
      requirements: { minLevel: 0, minDaysInServer: 0, requiredRoles: [], blockedRoles: [] },
      recurring: "none",
      rounds: 0,
      startMode: "now",
      start: localInput(inAnHour),
      endMode: "duration",
      duration: 86400,
      end: localInput(new Date(inAnHour.getTime() + 86400_000)),
    };
  const start = g.startAt ? new Date(g.startAt) : new Date();
  const end = new Date(g.endAt);
  return {
    title: g.title,
    description: g.description,
    prize: g.prize,
    winners: g.winners,
    channelId: g.channelId,
    pingRoleId: g.pingRoleId,
    color: g.color,
    image: g.image,
    requirements: g.requirements,
    recurring: g.recurring,
    rounds: g.rounds,
    startMode: (g.status === "scheduled" || g.status === "review") && start.getTime() > Date.now() ? "at" : "now",
    start: localInput(start),
    endMode: g.recurring === "none" ? "at" : "duration",
    duration: Math.max(3600, Math.round((end.getTime() - start.getTime()) / 1000)),
    end: localInput(end),
  };
}

// Unsaved work is kept in this browser, so closing the editor (or pressing Escape) never loses it
const draftKey = (id: string | null) => `gw-draft:${id ?? "new"}`;
function loadDraft(id: string | null): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function storeDraft(id: string | null, d: Draft | null) {
  try {
    if (d) window.localStorage.setItem(draftKey(id), JSON.stringify(d));
    else window.localStorage.removeItem(draftKey(id));
  } catch {
    /* storage can be full or blocked: the editor still works */
  }
}

/** Why a Community Manager's giveaway would go to an admin (the server also counts the weekly budget). */
function overLimits(d: Draft, limits: CmLimits | null, item: StoreItem | null, many: string) {
  if (!limits) return [];
  const out: string[] = [];
  const p = d.prize;
  const each = p.type === "leaves" ? (p.amount ?? 0) : p.type === "item" ? (item?.price ?? 0) * (p.quantity ?? 1) : 0;
  if (p.type === "leaves" && each > limits.maxLeaves) out.push(`${each.toLocaleString()} ${many} each (limit ${limits.maxLeaves.toLocaleString()})`);
  if (p.type === "item" && item && item.price > limits.maxItemPrice) out.push(`${item.name} costs ${item.price.toLocaleString()} ${many} (limit ${limits.maxItemPrice.toLocaleString()})`);
  if (p.type === "xp" && (p.amount ?? 0) > limits.maxXp) out.push(`${(p.amount ?? 0).toLocaleString()} XP each (limit ${limits.maxXp.toLocaleString()})`);
  if (p.type === "custom" && limits.customNeedsApproval) out.push("Custom prizes need an admin");
  if (d.winners > limits.maxWinners) out.push(`${d.winners} winners (limit ${limits.maxWinners})`);
  if (each * d.winners > limits.maxTotal) out.push(`${(each * d.winners).toLocaleString()} ${many} in total (limit ${limits.maxTotal.toLocaleString()})`);
  return out;
}

function Editor({
  initial,
  meta,
  isAdmin,
  limits,
  onClose,
  onSaved,
}: {
  initial: Giveaway | null;
  meta: Meta | null;
  isAdmin: boolean;
  limits: CmLimits | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const cur = useCurrency();
  const id = initial?.id ?? null;
  const fresh = useMemo(() => toDraft(initial), [initial]);
  const [d, setD] = useState<Draft>(() => {
    const saved = loadDraft(id);
    return saved ? { ...fresh, ...saved, prize: { ...fresh.prize, ...saved.prize }, requirements: { ...fresh.requirements, ...saved.requirements } } : fresh;
  });
  const [restored, setRestored] = useState(() => {
    const saved = loadDraft(id);
    return Boolean(saved && JSON.stringify(saved) !== JSON.stringify(fresh));
  });
  const [items, setItems] = useState<StoreItem[] | null>(null);
  const [itemQ, setItemQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const running = initial?.status === "running";
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setPrize = (p: Partial<Prize>) => setD((x) => ({ ...x, prize: { ...x.prize, ...p } }));
  const setReq = (r: Partial<Draft["requirements"]>) => setD((x) => ({ ...x, requirements: { ...x.requirements, ...r } }));

  // Keep the draft as it's typed (skipped until something changes)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    storeDraft(id, JSON.stringify(d) === JSON.stringify(fresh) ? null : d);
  }, [d, id, fresh]);

  useEffect(() => {
    fetch("/api/admin/giveaways/items", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => setItems(r?.ok ? r.items : []))
      .catch(() => setItems([]));
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const repeating = d.recurring !== "none";
  const startDate = running ? new Date(initial?.startAt ?? Date.now()) : d.startMode === "now" ? new Date() : new Date(d.start);
  const endDate = repeating || d.endMode === "duration" ? new Date(startDate.getTime() + d.duration * 1000) : new Date(d.end);
  const lengths = DURATIONS.filter(([, s]) => s <= PERIOD[d.recurring]);
  const picked = items?.find((i) => i.id === d.prize.itemId) ?? null;
  const itemList = useMemo(
    () => (items ?? []).filter((i) => !itemQ || i.name.toLowerCase().includes(itemQ.toLowerCase()) || (i.category ?? "").toLowerCase().includes(itemQ.toLowerCase())).slice(0, 60),
    [items, itemQ],
  );
  const problems = isAdmin ? [] : overLimits(d, limits, picked, cur.many);

  // Picking a repeat: each round has to finish before the next one starts
  const setRecurring = (r: Recurring) =>
    setD((x) => ({ ...x, recurring: r, endMode: r === "none" ? x.endMode : "duration", duration: r === "none" ? x.duration : Math.min(x.duration, PERIOD[r]), rounds: r === "none" ? 0 : x.rounds }));

  // The next few rounds, in the admin's own time
  const schedule = useMemo(() => {
    if (!repeating || Number.isNaN(startDate.getTime())) return [];
    const step = PERIOD[d.recurring] * 1000;
    const count = d.rounds ? Math.min(d.rounds, 4) : 4;
    return Array.from({ length: count }, (_, i) => ({ start: new Date(startDate.getTime() + i * step), end: new Date(startDate.getTime() + i * step + d.duration * 1000) }));
  }, [repeating, startDate, d.recurring, d.rounds, d.duration]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    const body: GiveawayInput = {
      title: d.title,
      description: d.description,
      prize:
        d.prize.type === "item"
          ? { type: "item", itemId: d.prize.itemId, quantity: d.prize.quantity ?? 1 }
          : d.prize.type === "leaves" || d.prize.type === "xp"
            ? { type: d.prize.type, amount: d.prize.amount }
            : { type: "custom", text: d.prize.text },
      winners: d.winners,
      channelId: d.channelId,
      pingRoleId: d.pingRoleId,
      color: d.color,
      image: d.image,
      requirements: d.requirements,
      recurring: d.recurring,
      rounds: repeating ? d.rounds : 0,
      startAt: running || d.startMode === "now" ? null : startDate.toISOString(),
      endAt: Number.isNaN(endDate.getTime()) ? "" : endDate.toISOString(),
    };
    try {
      const r = initial ? await call(`/api/admin/giveaways/${initial.id}`, "PATCH", body) : await call("/api/admin/giveaways", "POST", body);
      storeDraft(id, null);
      onSaved(initial ? initial.id : r.id);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const prizeText =
    d.prize.type === "leaves"
      ? `${(d.prize.amount ?? 0).toLocaleString()} ${cur.many}`
      : d.prize.type === "xp"
        ? `${(d.prize.amount ?? 0).toLocaleString()} XP`
        : d.prize.type === "item"
          ? `${(d.prize.quantity ?? 1) > 1 ? `${d.prize.quantity}× ` : ""}${picked?.name ?? "a store item"}`
          : d.prize.text || "a surprise prize";
  const chan = meta?.channels.find((c) => c.id === d.channelId)?.name;
  const roleName = (rid: string) => meta?.roles.find((r) => r.id === rid)?.name ?? "role";
  const saveLabel = busy ? "Saving…" : problems.length && !running ? "Send for approval" : initial ? "Save changes" : d.startMode === "now" ? "Start giveaway" : "Schedule giveaway";

  return (
    <div className="adm-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gw-editor" role="dialog" aria-label={initial ? "Edit giveaway" : "New giveaway"}>
        <header className="gw-editor-head">
          <h2>{initial ? "Edit giveaway" : "New giveaway"}</h2>
          {running ? <span className="gw-status is-running">Running: changes update the post</span> : null}
          <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close (your draft is kept)">
            <X size={16} />
          </button>
        </header>
        <div className="gw-editor-body">
          <div className="gw-form">
            {restored ? (
              <p className="gw-restored">
                <span>We kept your unsaved changes from last time.</span>
                <button
                  type="button"
                  className="adm-btn adm-btn--ghost adm-btn--tiny"
                  onClick={() => {
                    storeDraft(id, null);
                    setD(fresh);
                    setRestored(false);
                  }}
                >
                  Start over
                </button>
              </p>
            ) : null}
            <fieldset>
              <legend>Basics</legend>
              <label className="gw-field">
                <span>Title</span>
                <input value={d.title} maxLength={100} onChange={(e) => set("title", e.target.value)} placeholder={`Weekend ${cur.many} drop`} />
              </label>
              <label className="gw-field">
                <span>
                  Description <small>optional, shown in the post. Press Enter for a new line.</small>
                </span>
                <textarea value={d.description} maxLength={1500} rows={4} onChange={(e) => set("description", e.target.value)} placeholder="Thanks for being here! Press Enter for a chance to win." />
              </label>
            </fieldset>

            <fieldset>
              <legend>Prize</legend>
              <div className="adm-seg gw-seg" role="tablist" aria-label="Prize type">
                {(
                  [
                    ["leaves", cur.many, Leaf],
                    ["xp", "XP", Sparkles],
                    ["item", "Store item", Package],
                    ["custom", "Something else", Gift],
                  ] as const
                ).map(([k, label, Icon]) => (
                  <button
                    key={k}
                    type="button"
                    className={d.prize.type === k ? "is-active" : undefined}
                    onClick={() => setPrize(k === "xp" && d.prize.type !== "xp" ? { type: k, amount: 500 } : k === "leaves" && d.prize.type !== "leaves" ? { type: k, amount: 1000 } : { type: k })}
                  >
                    <Icon size={14} aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
              {d.prize.type === "leaves" || d.prize.type === "xp" ? (
                <>
                  <label className="gw-field">
                    <span>{d.prize.type === "xp" ? "XP" : cur.many} for each winner</span>
                    <input type="number" min={1} max={d.prize.type === "xp" ? 1_000_000 : 10_000_000} value={d.prize.amount ?? 0} onChange={(e) => setPrize({ amount: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                  </label>
                  <div className="gw-quick">
                    {(d.prize.type === "xp" ? [100, 250, 500, 1000, 2500, 5000] : [500, 1000, 2500, 5000, 10000, 25000]).map((n) => (
                      <button key={n} type="button" className={d.prize.amount === n ? "is-on" : undefined} onClick={() => setPrize({ amount: n })}>
                        {n.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <p className="adm-muted gw-note">
                    {d.prize.type === "xp" ? "Added to the winner's XP automatically. If it's enough to level up, they get their new level role." : "Added to the winner's balance automatically."}
                  </p>
                </>
              ) : d.prize.type === "item" ? (
                <>
                  <label className="adm-search gw-item-search">
                    <Search size={15} aria-hidden="true" />
                    <input value={itemQ} onChange={(e) => setItemQ(e.target.value)} placeholder="Search the store" aria-label="Search store items" />
                  </label>
                  {!items ? (
                    <div className="adm-skeleton" style={{ height: 120 }} />
                  ) : !items.length ? (
                    <p className="adm-muted">No store items found.</p>
                  ) : (
                    <ul className="gw-items">
                      {itemList.map((i) => (
                        <li key={i.id}>
                          <button type="button" className={d.prize.itemId === i.id ? "is-on" : undefined} onClick={() => setPrize({ itemId: i.id, itemName: i.name })} style={{ "--rar": RARITY[i.rarity].color } as React.CSSProperties}>
                            {i.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={i.image} alt="" loading="lazy" />
                            ) : (
                              <span className="gw-item-ph">
                                <Package size={16} aria-hidden="true" />
                              </span>
                            )}
                            <span>
                              <b>{i.name}</b>
                              <small>
                                <span className="gw-rar-dot">{RARITY[i.rarity].label}</span> · {compact(i.price)} <LeafEmote size={11} />
                                {i.category ? ` · ${i.category}` : ""}
                                {i.active ? "" : " · not in the shop"}
                              </small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <label className="gw-field gw-field--short">
                    <span>How many each</span>
                    <input type="number" min={1} max={25} value={d.prize.quantity ?? 1} onChange={(e) => setPrize({ quantity: Math.max(1, Math.min(25, Math.floor(Number(e.target.value) || 1))) })} />
                  </label>
                  {picked ? (
                    <p className="gw-value">
                      <RarityChip rarity={picked.rarity} />
                      <span>
                        Worth {compact(picked.price * (d.prize.quantity ?? 1))} <LeafEmote size={13} /> each · {compact(picked.price * (d.prize.quantity ?? 1) * d.winners)} <LeafEmote size={13} /> in total
                      </span>
                    </p>
                  ) : null}
                  <p className="adm-muted gw-note">Goes straight into the winner&apos;s inventory, like a purchase. It doesn&apos;t use shop stock.</p>
                </>
              ) : (
                <>
                  <label className="gw-field">
                    <span>What they win</span>
                    <input value={d.prize.text ?? ""} maxLength={200} onChange={(e) => setPrize({ text: e.target.value })} placeholder="1 month of Nitro, a custom emoji, an art commission…" />
                  </label>
                  <p className="adm-muted gw-note">Staff hand this out. Winners show under &quot;To hand out&quot; until someone marks them done.</p>
                </>
              )}
              <label className="gw-field gw-field--short">
                <span>Winners</span>
                <input type="number" min={1} max={50} value={d.winners} onChange={(e) => set("winners", Math.max(1, Math.min(50, Math.floor(Number(e.target.value) || 1))))} />
              </label>
            </fieldset>

            <fieldset>
              <legend>When</legend>
              <div className="gw-field">
                <span>How often</span>
                <div className="adm-seg gw-seg" role="tablist" aria-label="How often">
                  {(Object.keys(RECUR) as Recurring[]).map((k) => (
                    <button key={k} type="button" className={d.recurring === k ? "is-active" : undefined} onClick={() => setRecurring(k)}>
                      {k !== "none" ? <Repeat size={13} aria-hidden="true" /> : null} {RECUR[k]}
                    </button>
                  ))}
                </div>
              </div>

              {running ? (
                <p className="adm-muted gw-note">Started {formatDate(initial?.startAt ?? null)}. You can still move the end.</p>
              ) : (
                <div className="gw-field">
                  <span>{repeating ? "First round starts" : "Starts"}</span>
                  <div className="gw-row">
                    <div className="adm-seg gw-seg" role="tablist" aria-label="Start">
                      <button type="button" className={d.startMode === "now" ? "is-active" : undefined} onClick={() => set("startMode", "now")}>
                        Right away
                      </button>
                      <button type="button" className={d.startMode === "at" ? "is-active" : undefined} onClick={() => set("startMode", "at")}>
                        <CalendarClock size={14} aria-hidden="true" /> At a time
                      </button>
                    </div>
                    {d.startMode === "at" ? <input type="datetime-local" className="gw-date" value={d.start} onChange={(e) => set("start", e.target.value)} aria-label="Start" /> : null}
                  </div>
                </div>
              )}

              <div className="gw-field">
                <span>{repeating ? "Each round runs for" : "Runs until"}</span>
                <div className="gw-row">
                  {!repeating ? (
                    <div className="adm-seg gw-seg" role="tablist" aria-label="End">
                      <button type="button" className={d.endMode === "duration" ? "is-active" : undefined} onClick={() => set("endMode", "duration")}>
                        A length of time
                      </button>
                      <button type="button" className={d.endMode === "at" ? "is-active" : undefined} onClick={() => (set("endMode", "at"), set("end", localInput(endDate)))}>
                        A date and time
                      </button>
                    </div>
                  ) : null}
                  {repeating || d.endMode === "duration" ? (
                    <select className="adm-select" value={lengths.some(([, s]) => s === d.duration) ? d.duration : "custom"} onChange={(e) => e.target.value !== "custom" && set("duration", Number(e.target.value))} aria-label="How long">
                      {lengths.map(([label, s]) => (
                        <option key={s} value={s}>
                          {label}
                        </option>
                      ))}
                      {!lengths.some(([, s]) => s === d.duration) ? <option value="custom">{Math.round(d.duration / 3600)} hours</option> : null}
                    </select>
                  ) : (
                    <input type="datetime-local" className="gw-date" value={d.end} onChange={(e) => set("end", e.target.value)} aria-label="End" />
                  )}
                </div>
              </div>

              {repeating ? (
                <label className="gw-field gw-field--short">
                  <span>Stop after</span>
                  <select className="adm-select" value={d.rounds} onChange={(e) => set("rounds", Number(e.target.value))}>
                    <option value={0}>Keep going until cancelled</option>
                    {[2, 3, 4, 5, 6, 8, 10, 12, 26, 52].map((n) => (
                      <option key={n} value={n}>
                        {n} rounds
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {repeating ? (
                <div className="gw-schedule">
                  <p>
                    <Repeat size={14} aria-hidden="true" /> A new round starts every {UNIT[d.recurring]}, runs for {DURATIONS.find(([, s]) => s === d.duration)?.[0] ?? `${Math.round(d.duration / 3600)} hours`}, and picks its winners when it ends.{" "}
                    {d.rounds ? `It stops after ${d.rounds} rounds.` : "It keeps going until you cancel it."} Each round is its own giveaway with the same prize and settings.
                  </p>
                  <ol>
                    {schedule.map((r, i) => (
                      <li key={i}>
                        <b>Round {(initial?.round ?? 1) + i}</b>
                        <span>
                          {when(r.start)} → winners {when(r.end)}
                        </span>
                      </li>
                    ))}
                    {!d.rounds || d.rounds > 4 ? <li className="gw-schedule-more">…and so on{d.rounds ? ` until round ${d.rounds}` : ""}</li> : null}
                  </ol>
                </div>
              ) : (
                <p className="adm-muted gw-note">{Number.isNaN(endDate.getTime()) ? "Pick an end." : `Winners are picked ${when(endDate)} (your time).`}</p>
              )}
            </fieldset>

            <fieldset>
              <legend>Where</legend>
              {running ? (
                <p className="adm-muted gw-note">It&apos;s already posted, so the channel and ping can&apos;t change.</p>
              ) : (
                <>
                  <div className="gw-field">
                    <span>
                      Channel <small>empty: the default from Settings</small>
                    </span>
                    <Picker kind="channel" value={d.channelId} onChange={(v) => set("channelId", (v as string) || null)} options={channelOptions(meta, "text")} allowEmpty placeholder="Default giveaway channel" />
                  </div>
                  <div className="gw-field">
                    <span>
                      Ping <small>empty: the default from Settings</small>
                    </span>
                    <Picker kind="role" value={d.pingRoleId} onChange={(v) => set("pingRoleId", (v as string) || null)} options={roleOptions(meta)} allowEmpty placeholder="Default ping (or none)" />
                  </div>
                </>
              )}
              <div className="gw-row">
                <label className="gw-field gw-color">
                  <span>Color</span>
                  <span className="gw-color-row">
                    <input type="color" value={d.color ?? "#d56300"} onChange={(e) => set("color", e.target.value)} />
                    {d.color ? (
                      <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => set("color", null)}>
                        Default
                      </button>
                    ) : (
                      <small className="adm-muted">default</small>
                    )}
                  </span>
                </label>
                <label className="gw-field gw-grow">
                  <span>
                    Image <small>optional https:// link</small>
                  </span>
                  <input value={d.image ?? ""} onChange={(e) => set("image", e.target.value || null)} placeholder="https://…" />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Who can enter</legend>
              <div className="gw-row">
                <label className="gw-field gw-field--short">
                  <span>Minimum level</span>
                  <input type="number" min={0} max={500} value={d.requirements.minLevel} onChange={(e) => setReq({ minLevel: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                </label>
                <label className="gw-field gw-field--short">
                  <span>Days in the server</span>
                  <input type="number" min={0} max={3650} value={d.requirements.minDaysInServer} onChange={(e) => setReq({ minDaysInServer: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                </label>
              </div>
              <div className="gw-field">
                <span>
                  Needs one of these roles <small>empty: anyone</small>
                </span>
                <Picker kind="role" multiple value={d.requirements.requiredRoles} onChange={(v) => setReq({ requiredRoles: (v as string[]) ?? [] })} options={roleOptions(meta)} placeholder="Anyone" />
              </div>
              <div className="gw-field">
                <span>Can&apos;t enter with these roles</span>
                <Picker kind="role" multiple value={d.requirements.blockedRoles} onChange={(v) => setReq({ blockedRoles: (v as string[]) ?? [] })} options={roleOptions(meta)} placeholder="No one blocked" />
              </div>
              <p className="adm-muted gw-note">Checked when someone enters and again when winners are picked, so people who leave or lose a role can&apos;t win.</p>
            </fieldset>
          </div>

          <aside className="gw-preview" aria-label="Preview">
            <small className="gw-preview-label">Preview in {chan ? `#${chan}` : "the giveaway channel"}</small>
            <div className="gw-discord">
              <div className="gw-embed" style={{ borderColor: d.color ?? "#d56300" }}>
                <b className="gw-embed-title">🎉 {d.title || "Giveaway"}</b>
                {d.description ? <p className="gw-embed-desc">{d.description}</p> : null}
                <p>
                  🎁 Prize: <b><CurrencyAmount text={prizeText} size={15} /></b>
                  {d.prize.type === "item" && picked ? (
                    <>
                      {" "}
                      ({RARITY[picked.rarity].label}, worth {compact(picked.price * (d.prize.quantity ?? 1))} <LeafEmote size={14} />)
                    </>
                  ) : null}
                </p>
                <p>🏆 Winners: <b>{d.winners}</b></p>
                <p>
                  ⏱️ Ends <u>{Number.isNaN(endDate.getTime()) ? "…" : relative(endDate.toISOString(), startDate.getTime())}</u>
                </p>
                {repeating ? <p>🔁 {RECUR[d.recurring]}{d.rounds ? ` · ${d.rounds} rounds` : ""}</p> : null}
                {d.requirements.minLevel || d.requirements.minDaysInServer || d.requirements.requiredRoles.length || d.requirements.blockedRoles.length ? (
                  <p>
                    📋 To enter:{" "}
                    {[
                      d.requirements.minLevel ? `Level ${d.requirements.minLevel}+` : null,
                      d.requirements.minDaysInServer ? `in the server ${d.requirements.minDaysInServer}+ days` : null,
                      d.requirements.requiredRoles.length ? `one of ${d.requirements.requiredRoles.map((r) => `@${roleName(r)}`).join(", ")}` : null,
                      d.requirements.blockedRoles.length ? `not ${d.requirements.blockedRoles.map((r) => `@${roleName(r)}`).join(", ")}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                <p className="gw-embed-dim">Press Enter to join (0 entered). Press again to leave.</p>
                {d.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.image} alt="" className="gw-embed-img" />
                ) : null}
              </div>
              <span className="gw-embed-button">🎉 Enter</span>
            </div>
            <ul className="gw-summary">
              <li>
                <Play size={13} aria-hidden="true" /> {running ? "Already running" : d.startMode === "now" ? "Starts within seconds of saving" : `Starts ${when(startDate)}`}
              </li>
              <li>
                <Hash size={13} aria-hidden="true" /> {chan ? `#${chan}` : "Default channel"}
              </li>
              <li>
                <Repeat size={13} aria-hidden="true" /> {RECUR[d.recurring]}
                {repeating && d.rounds ? `, ${d.rounds} rounds` : ""}
              </li>
            </ul>
            {problems.length && !running ? (
              <div className="gw-overlimit">
                <p>
                  <ShieldCheck size={14} aria-hidden="true" /> <b>An admin will need to approve this</b> because it&apos;s over the Community Manager limits:
                </p>
                <ul>
                  {problems.map((p) => (
                    <li key={p}>
                      <XpText text={p} size={14} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
        <footer className="gw-editor-foot">
          {err ? <p className="adm-error">{err}</p> : <small className="adm-muted">Your changes are kept as a draft if you close this.</small>}
          <div>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>
              Close
            </button>
            <button type="button" className="adm-btn" disabled={busy} onClick={save}>
              {saveLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
