"use client";

import { CalendarDays, CalendarRange, Crown, Medal, Megaphone, MessageCircle, Mic, Search, Star, type LucideIcon } from "lucide-react";
import { LeafEmote } from "../ui-icons";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type SortKey =
  | "balance"
  | "level"
  | "messages"
  | "bumps"
  | "monthly_bumps"
  | "total_vc_time"
  | "monthly_vc_time";

type SortOrder = "asc" | "desc";

type LeaderboardRow = {
  _id: string;
  discordId: string | null;
  name: string;
  username: string | null;
  avatar: string | null;
  inServer: boolean;
  balance: number;
  level: number;
  messages: number;
  bumps: number;
  monthly_bumps: number;
  total_vc_time: number;
  monthly_vc_time: number;
  isCurrentUser: boolean;
};

type LeaderboardResponse = {
  rows: LeaderboardRow[];
  total: number;
  currentRank: number;
  currentValue: number | null;
  above: { name: string; value: number } | null;
  error?: string;
};

type Stat = { key: SortKey; label: string; short: string; icon: LucideIcon | "leaf"; type: "leafs" | "number" | "duration" };

/** A stat's icon: the leaf emote for leafs, otherwise a Lucide icon. */
function StatIcon({ stat, size = 15 }: { stat: Stat; size?: number }) {
  if (stat.icon === "leaf") return <LeafEmote size={size + 3} />;
  const Icon = stat.icon;
  return <Icon size={size} aria-hidden="true" />;
}

const MEDAL_CLASSES = ["lb-medal lb-medal--gold", "lb-medal lb-medal--silver", "lb-medal lb-medal--bronze"];
function MedalIcon({ place, size = 18 }: { place: number; size?: number }) {
  return (
    <span className={MEDAL_CLASSES[place]} aria-label={`Rank ${place + 1}`}>
      <Medal size={size} strokeWidth={2.2} />
    </span>
  );
}

const stats: Stat[] = [
  { key: "balance", label: "Leafs", short: "Leafs", icon: "leaf", type: "leafs" },
  { key: "level", label: "Level", short: "Level", icon: Star, type: "number" },
  { key: "messages", label: "Messages", short: "Msgs", icon: MessageCircle, type: "number" },
  { key: "bumps", label: "Bumps", short: "Bumps", icon: Megaphone, type: "number" },
  { key: "monthly_bumps", label: "Monthly Bumps", short: "Bumps/mo", icon: CalendarDays, type: "number" },
  { key: "total_vc_time", label: "VC Time", short: "VC", icon: Mic, type: "duration" },
  { key: "monthly_vc_time", label: "Monthly VC", short: "VC/mo", icon: CalendarRange, type: "duration" },
];

const pageSizes = [10, 25, 50, 100];
const POLL_MS = 10_000;
const DELTA_SHOW_MS = 4_000;
const MOVE_SHOW_MS = 15_000;

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function formatDuration(seconds: number) {
  let minutes = Math.max(0, Math.round(seconds / 60));
  const days = Math.floor(minutes / 1440);
  minutes -= days * 1440;
  const hours = Math.floor(minutes / 60);
  minutes -= hours * 60;
  const parts = [days ? `${days.toLocaleString()}d` : null, hours ? `${hours}h` : null, minutes ? `${minutes}m` : null].filter(Boolean);
  return parts.length ? parts.slice(0, 2).join(" ") : "0m";
}

function formatStat(stat: Stat, value: number, short = false) {
  if (stat.type === "duration") return formatDuration(value);
  const rounded = Math.round(value);
  return short && Math.abs(rounded) >= 10_000 ? compact.format(rounded) : rounded.toLocaleString();
}

function formatDelta(stat: Stat, delta: number) {
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${formatStat(stat, Math.abs(delta), true)}`;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Counts from the last shown value to the new one. */
function AnimatedValue({ value, stat, short }: { value: number; stat: Stat; short?: boolean }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value || prefersReducedMotion()) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (value - from) * eased;
      fromRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{formatStat(stat, shown, short)}</>;
}

function Avatar({ row, size }: { row: LeaderboardRow; size: number }) {
  const [failed, setFailed] = useState(false);
  const src = row.avatar ?? (row.discordId ? `/api/discord/avatar/${row.discordId}` : null);
  if (!src || failed) {
    return (
      <span className="lb-avatar lb-avatar--letter" style={{ width: size, height: size }} aria-hidden="true">
        {row.name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img className="lb-avatar" src={src} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />
  );
}

function timeAgo(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export function LeaderboardsClient() {
  const [sort, setSort] = useState<SortKey>("balance");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deltas, setDeltas] = useState<Record<string, { amount: number; at: number }>>({});
  const [moves, setMoves] = useState<Record<string, { by: number; at: number }>>({});

  // Previous values/ranks for the same view, so polls can show what changed
  const viewKey = `${sort}|${order}|${search.trim().toLowerCase()}`;
  const lastView = useRef<{ key: string; values: Map<string, number>; ranks: Map<string, number> } | null>(null);
  const requestId = useRef(0);

  const stat = stats.find((s) => s.key === sort) ?? stats[0];

  const load = useCallback(
    async (quiet: boolean) => {
      const id = ++requestId.current;
      if (!quiet) setLoading(true);
      try {
        const params = new URLSearchParams({ search, sort, order, page: String(page), pageSize: String(pageSize) });
        const response = await fetch(`/api/leaderboards?${params}`, { cache: "no-store" });
        const body = (await response.json()) as LeaderboardResponse;
        if (!response.ok) throw new Error(body.error ?? "Failed to load leaderboard.");
        if (id !== requestId.current) return;

        const stamp = Date.now();
        const values = new Map<string, number>();
        const ranks = new Map<string, number>();
        body.rows.forEach((row, index) => {
          if (!row.discordId) return;
          values.set(row.discordId, row[sort]);
          ranks.set(row.discordId, (page - 1) * pageSize + index + 1);
        });

        const previous = lastView.current;
        if (previous && previous.key === viewKey) {
          const newDeltas: Record<string, { amount: number; at: number }> = {};
          const newMoves: Record<string, { by: number; at: number }> = {};
          values.forEach((value, discordId) => {
            const before = previous.values.get(discordId);
            if (before !== undefined && before !== value) newDeltas[discordId] = { amount: value - before, at: stamp };
            const oldRank = previous.ranks.get(discordId);
            const newRank = ranks.get(discordId);
            if (oldRank && newRank && oldRank !== newRank) newMoves[discordId] = { by: oldRank - newRank, at: stamp };
          });
          if (Object.keys(newDeltas).length) setDeltas((d) => ({ ...d, ...newDeltas }));
          if (Object.keys(newMoves).length) setMoves((m) => ({ ...m, ...newMoves }));
        } else {
          setDeltas({});
          setMoves({});
        }
        // Keep old entries so members scrolling onto a new page still compare against what we saw
        const mergedValues = previous?.key === viewKey ? new Map([...Array.from(previous.values), ...Array.from(values)]) : values;
        const mergedRanks = previous?.key === viewKey ? new Map([...Array.from(previous.ranks), ...Array.from(ranks)]) : ranks;
        lastView.current = { key: viewKey, values: mergedValues, ranks: mergedRanks };

        setData(body);
        setError(null);
        setUpdatedAt(stamp);
      } catch (fetchError) {
        if (id === requestId.current && !quiet) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load leaderboard.");
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [search, sort, order, page, pageSize, viewKey],
  );

  // Load on changes (debounced for typing)
  useEffect(() => {
    const timer = window.setTimeout(() => void load(false), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Live polling while the tab is visible
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, load]);

  // Clock for "updated Xs ago" and expiring the change badges
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Slide rows to their new places when the order changes (FLIP)
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const lastTops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const tops = new Map<string, number>();
    rowRefs.current.forEach((el, key) => tops.set(key, el.getBoundingClientRect().top));
    if (!prefersReducedMotion()) {
      tops.forEach((top, key) => {
        const before = lastTops.current.get(key);
        const el = rowRefs.current.get(key);
        if (before === undefined || !el || before === top) return;
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], {
          duration: 600,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      });
    }
    lastTops.current = tops;
  }, [data]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const searching = search.trim().length > 0;
  const showPodium = !searching && order === "desc" && page === 1 && rows.length >= 3;
  const listRows = showPodium ? rows.slice(3) : rows;
  const rankOffset = (page - 1) * pageSize + (showPodium ? 3 : 0);

  const standing = useMemo(() => {
    if (!data || !data.currentRank || data.currentValue === null) return null;
    const percentile = Math.max(1, Math.ceil((data.currentRank / Math.max(1, total)) * 100));
    return {
      rank: data.currentRank,
      value: data.currentValue,
      percentile,
      gap: data.above && order === "desc" ? Math.max(0, data.above.value - data.currentValue) : null,
      aboveName: data.above?.name ?? null,
      page: Math.ceil(data.currentRank / pageSize),
    };
  }, [data, total, order, pageSize]);

  function chooseStat(key: SortKey) {
    setSort(key);
    setOrder("desc");
    setPage(1);
    setExpanded(null);
  }

  function registerRow(key: string) {
    return (el: HTMLElement | null) => {
      if (el) rowRefs.current.set(key, el);
      else rowRefs.current.delete(key);
    };
  }

  function deltaFor(row: LeaderboardRow) {
    const d = row.discordId ? deltas[row.discordId] : undefined;
    return d && now - d.at < DELTA_SHOW_MS ? d : null;
  }

  function moveFor(row: LeaderboardRow) {
    const m = row.discordId ? moves[row.discordId] : undefined;
    return m && now - m.at < MOVE_SHOW_MS ? m : null;
  }

  return (
    <section className="lb" aria-label="Leaderboards">
      {/* Stat picker */}
      <div className="lb-tabs" role="tablist" aria-label="Leaderboard stat">
        {stats.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={sort === s.key}
            className={sort === s.key ? "lb-tab is-active" : "lb-tab"}
            onClick={() => chooseStat(s.key)}
          >
            <StatIcon stat={s} /> {s.label}
          </button>
        ))}
      </div>

      <div className="lb-top">
        {/* Your standing */}
        <div className="lb-standing">
          {standing ? (
            <>
              <div className="lb-standing-rank">
                <small>Your rank</small>
                <strong>#{standing.rank.toLocaleString()}</strong>
                <span className="lb-pill">Top {standing.percentile}%</span>
              </div>
              <div className="lb-standing-body">
                <p className="lb-standing-value">
                  <StatIcon stat={stat} size={20} />
                  <AnimatedValue value={standing.value} stat={stat} /> <small>{stat.type === "leafs" ? "leafs" : stat.label.toLowerCase()}</small>
                </p>
                {standing.rank === 1 && order === "desc" ? (
                  <p className="lb-standing-note"><Crown size={15} className="lb-crown-inline" aria-hidden="true" /> You&apos;re in first place. Hold the crown!</p>
                ) : standing.gap !== null && standing.aboveName ? (
                  <p className="lb-standing-note">
                    <strong>{formatStat(stat, standing.gap + (stat.type === "duration" ? 60 : 1))}</strong> more to pass{" "}
                    <strong>{standing.aboveName}</strong> for #{(standing.rank - 1).toLocaleString()}
                  </p>
                ) : null}
                {standing.page !== page || searching ? (
                  <button
                    type="button"
                    className="lb-link-button"
                    onClick={() => {
                      setSearch("");
                      setPage(standing.page);
                    }}
                  >
                    Jump to my rank ↓
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="lb-standing-empty">
              {loading ? "Finding your rank…" : "Link your Discord account on My Account to see your rank here."}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="lb-controls">
          <label className="lb-search">
            <span className="sr-only">Search members</span>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search members…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="lb-control-row">
            <button
              type="button"
              className="lb-chip"
              onClick={() => {
                setOrder((o) => (o === "desc" ? "asc" : "desc"));
                setPage(1);
              }}
              title="Flip the order"
            >
              {order === "desc" ? "↓ Highest first" : "↑ Lowest first"}
            </button>
            <label className="lb-chip lb-chip--select">
              <span className="sr-only">Members per page</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {pageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={live ? "lb-live is-on" : "lb-live"}
              onClick={() => setLive((v) => !v)}
              aria-pressed={live}
              title={live ? "Pause live updates" : "Resume live updates"}
            >
              <i aria-hidden="true" />
              {live ? "Live" : "Paused"}
              {updatedAt ? <small>· {timeAgo(now - updatedAt)}</small> : null}
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="auth-status leaderboard-error">{error}</p> : null}

      {/* Podium */}
      {showPodium ? (
        <div className="lb-podium">
          {[1, 0, 2].map((i) => {
            const row = rows[i];
            const delta = deltaFor(row);
            return (
              <article
                key={row._id}
                ref={registerRow(row._id)}
                className={`lb-podium-card lb-place-${i + 1}${row.isCurrentUser ? " is-me" : ""}`}
              >
                <span className="lb-podium-medal" aria-label={`Rank ${i + 1}`}>
                  <MedalIcon place={i} />
                </span>
                <div className="lb-podium-avatar">
                  {i === 0 ? <Crown className="lb-crown" size={26} aria-hidden="true" /> : null}
                  <Avatar row={row} size={i === 0 ? 84 : 68} />
                </div>
                <strong className="lb-podium-name" title={row.name}>{row.name}</strong>
                {row.username && row.username !== row.name ? <small>@{row.username}</small> : <small>&nbsp;</small>}
                <p className={`lb-podium-value${delta ? (delta.amount > 0 ? " is-up" : " is-down") : ""}`}>
                  {stat.type === "leafs" ? <LeafEmote size={18} /> : null}
                  <AnimatedValue value={row[sort]} stat={stat} short />
                  {delta ? (
                    <span key={delta.at} className={delta.amount > 0 ? "lb-delta is-up" : "lb-delta is-down"}>
                      {formatDelta(stat, delta.amount)}
                    </span>
                  ) : null}
                </p>
              </article>
            );
          })}
        </div>
      ) : null}

      {/* Ranked list */}
      <ol className="lb-list" start={rankOffset + 1}>
        {listRows.map((row, index) => {
          const rank = rankOffset + index + 1;
          const delta = deltaFor(row);
          const move = moveFor(row);
          const open = expanded === row._id;
          const secondary = stats.filter((s) => s.key !== sort && ["balance", "level", "messages"].includes(s.key)).slice(0, 2);
          return (
            <li
              key={row._id}
              ref={registerRow(row._id)}
              className={`lb-row${row.isCurrentUser ? " is-me" : ""}${open ? " is-open" : ""}${delta ? (delta.amount > 0 ? " flash-up" : " flash-down") : ""}`}
            >
              <button type="button" className="lb-row-main" onClick={() => setExpanded(open ? null : row._id)} aria-expanded={open}>
                <span className="lb-rank">
                  {!searching && order === "desc" && rank <= 3 ? <MedalIcon place={rank - 1} size={17} /> : `#${rank.toLocaleString()}`}
                </span>
                <span className="lb-move" aria-label={move ? (move.by > 0 ? `Up ${move.by}` : `Down ${-move.by}`) : undefined}>
                  {move ? (move.by > 0 ? <em className="is-up">▲{move.by}</em> : <em className="is-down">▼{-move.by}</em>) : null}
                </span>
                <Avatar row={row} size={40} />
                <span className="lb-who">
                  <strong>
                    {row.name}
                    {row.isCurrentUser ? <span className="lb-you">You</span> : null}
                  </strong>
                  <small>
                    {row.username && row.username !== row.name ? `@${row.username}` : null}
                    {!row.inServer ? <span className="lb-left">left server</span> : null}
                  </small>
                </span>
                <span className="lb-secondary">
                  {secondary.map((s) => (
                    <span key={s.key} title={s.label}>
                      <StatIcon stat={s} size={13} /> {formatStat(s, row[s.key], true)}
                    </span>
                  ))}
                </span>
                <span className={`lb-value${delta ? (delta.amount > 0 ? " is-up" : " is-down") : ""}`}>
                  {delta ? (
                    <span key={delta.at} className={delta.amount > 0 ? "lb-delta is-up" : "lb-delta is-down"}>
                      {formatDelta(stat, delta.amount)}
                    </span>
                  ) : null}
                  {stat.type === "leafs" ? <LeafEmote size={18} /> : null}
                  <AnimatedValue value={row[sort]} stat={stat} short />
                </span>
              </button>
              {open ? (
                <div className="lb-details">
                  {stats.map((s) => (
                    <div key={s.key} className={s.key === sort ? "is-current" : undefined}>
                      <small>
                        <StatIcon stat={s} size={13} /> {s.label}
                      </small>
                      <strong>{formatStat(s, row[s.key])}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
        {loading && !data
          ? Array.from({ length: 6 }, (_, i) => <li key={i} className="lb-row lb-skeleton" aria-hidden="true" />)
          : null}
        {!loading && rows.length === 0 ? <li className="lb-empty">No members found{searching ? ` for “${search.trim()}”` : ""}.</li> : null}
      </ol>

      <div className="lb-footer">
        <p>{total.toLocaleString()} members ranked by {stat.label.toLowerCase()}</p>
        {totalPages > 1 ? (
          <div className="lb-pages">
            <button type="button" onClick={() => setPage(1)} disabled={page === 1} aria-label="First page">«</button>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              ← Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next →
            </button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={page >= totalPages} aria-label="Last page">»</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
