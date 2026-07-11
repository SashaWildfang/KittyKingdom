"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  balance: number;
  level: number;
  messages: number;
  bumps: number;
  monthly_bumps: number;
  total_vc_time: number;
  monthly_vc_time: number;
  isCurrentUser: boolean;
};

type LeaderboardColumn = {
  key: SortKey;
  label: string;
  type?: "number" | "duration" | "leafs";
};

const columns: LeaderboardColumn[] = [
  { key: "balance", label: "Leafs", type: "leafs" },
  { key: "level", label: "Level", type: "number" },
  { key: "messages", label: "Messages", type: "number" },
  { key: "bumps", label: "Total Bumps", type: "number" },
  { key: "monthly_bumps", label: "Monthly Bumps", type: "number" },
  { key: "total_vc_time", label: "Total VC Time", type: "duration" },
  { key: "monthly_vc_time", label: "Monthly VC Time", type: "duration" },
];

const sortOptions = columns.map(({ key, label }) => ({ value: key, label }));
const pageSizes = [10, 25, 50, 100];
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatInteger(value: number) {
  return Math.round(value).toLocaleString();
}

function formatCompact(value: number) {
  const rounded = Math.round(value);
  const compact = compactFormatter.format(rounded);
  const full = rounded.toLocaleString();
  return { compact, full, needsTitle: compact !== full };
}

function StatValue({ value, leaf }: { value: number; leaf?: boolean }) {
  const formatted = formatCompact(value);
  const content = (
    <>
      {leaf ? <img src="/leaf.png" alt="" width="18" height="18" /> : null}
      {formatted.compact}
    </>
  );

  return formatted.needsTitle ? (
    <span className={leaf ? "leafs-cell" : undefined} title={formatted.full}>
      {content}
    </span>
  ) : (
    <span className={leaf ? "leafs-cell" : undefined}>{content}</span>
  );
}

function formatDuration(value: number) {
  let minutes = Math.max(0, Math.round(value / 60));
  const months = Math.floor(minutes / (60 * 24 * 30));
  minutes -= months * 60 * 24 * 30;
  const weeks = Math.floor(minutes / (60 * 24 * 7));
  minutes -= weeks * 60 * 24 * 7;
  const days = Math.floor(minutes / (60 * 24));
  minutes -= days * 60 * 24;
  const hours = Math.floor(minutes / 60);
  minutes -= hours * 60;

  const parts = [
    months ? `${months}mo` : null,
    weeks ? `${weeks}w` : null,
    days ? `${days}d` : null,
    hours ? `${hours}h` : null,
    minutes ? `${minutes}m` : null,
  ].filter(Boolean);

  return parts.length ? parts.slice(0, 3).join(" ") : "0m";
}


function isDiscordId(value: string | null) {
  return Boolean(value && /^\d{15,25}$/.test(value));
}

function mergeRowsForCache(incoming: LeaderboardRow, cached?: LeaderboardRow) {
  if (!cached) return incoming;

  return {
    ...cached,
    ...incoming,
    name: incoming.name && !isDiscordId(incoming.name) ? incoming.name : cached.name,
    username: incoming.username ?? cached.username,
    balance: Math.max(cached.balance, incoming.balance),
    level: Math.max(cached.level, incoming.level),
    messages: Math.max(cached.messages, incoming.messages),
    bumps: Math.max(cached.bumps, incoming.bumps),
    monthly_bumps: Math.max(cached.monthly_bumps, incoming.monthly_bumps),
    total_vc_time: Math.max(cached.total_vc_time, incoming.total_vc_time),
    monthly_vc_time: Math.max(cached.monthly_vc_time, incoming.monthly_vc_time),
    isCurrentUser: cached.isCurrentUser || incoming.isCurrentUser,
  };
}

function rowMatchesSearch(row: LeaderboardRow, search: string) {
  if (!search.trim()) return true;
  const query = search.trim().toLowerCase();
  return [row.name, row.username, row.discordId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function sortRows(rows: LeaderboardRow[], sort: SortKey, order: SortOrder) {
  return [...rows].sort((a, b) => {
    const comparison = a[sort] - b[sort];
    return order === "asc" ? comparison : -comparison;
  });
}

function rememberResolvedRows(rows: LeaderboardRow[], cache: Map<string, LeaderboardRow>) {
  return rows.map((row) => {
    if (!row.discordId) return row;
    const merged = mergeRowsForCache(row, cache.get(row.discordId));
    cache.set(row.discordId, merged);
    return merged;
  });
}
export function LeaderboardsClient() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("balance");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [currentRank, setCurrentRank] = useState(0);
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rowCacheRef = useRef(new Map<string, LeaderboardRow>());

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const selectedSortLabel =
    sortOptions.find((option) => option.value === sort)?.label ?? "Leafs";

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({
        search,
        sort,
        order,
        page: String(page),
        pageSize: String(pageSize),
      });

      setLoading(true);
      setError(null);

      fetch(`/api/leaderboards?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Failed to load leaderboard.");
          const incomingRows = rememberResolvedRows(
            (data.rows ?? []) as LeaderboardRow[],
            rowCacheRef.current,
          );
          const cachedMatches = search.trim() && incomingRows.length === 0
            ? sortRows(
                Array.from(rowCacheRef.current.values()).filter((row) => rowMatchesSearch(row, search)),
                sort,
                order,
              )
            : [];
          const fallbackRows = cachedMatches.length
            ? cachedMatches.slice((page - 1) * pageSize, page * pageSize)
            : incomingRows;
          setRows(fallbackRows);
          setTotal(cachedMatches.length || data.total || 0);
          setCurrentRank(data.currentRank ?? 0);
          setCurrentValue(data.currentValue ?? null);
        })
        .catch((fetchError) => {
          if (fetchError.name !== "AbortError") {
            setRows([]);
            setError(fetchError.message ?? "Failed to load leaderboard.");
          }
        })
        .finally(() => setLoading(false));
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search, sort, order, page, pageSize]);

  function setColumnSort(column: SortKey) {
    setPage(1);
    if (column === sort) {
      setOrder((value) => (value === "desc" ? "asc" : "desc"));
      return;
    }
    setSort(column);
    setOrder("desc");
  }

  return (
    <section className="leaderboard-panel" aria-label="Leaderboards">
      {currentRank > 0 && currentValue !== null ? (
        <div className="leaderboard-rank-summary">
          You are Rank #{currentRank.toLocaleString()} - {formatInteger(currentValue)} {selectedSortLabel}
        </div>
      ) : null}

      <div className="leaderboard-controls">
        <label className="leaderboard-search">
          <span>Search members</span>
          <input
            type="search"
            placeholder="Search by Discord name or username"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <label>
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortKey);
              setOrder("desc");
              setPage(1);
            }}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Entries per page</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="auth-status leaderboard-error">{error}</p> : null}

      <div className="leaderboard-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Member</th>
              {columns.map((column) => (
                <th key={column.key}>
                  <button
                    className="leaderboard-sort-button"
                    type="button"
                    onClick={() => setColumnSort(column.key)}
                    aria-sort={sort === column.key ? (order === "desc" ? "descending" : "ascending") : undefined}
                    data-active={sort === column.key ? "true" : undefined}
                    data-order={sort === column.key ? order : undefined}
                  >
                    {column.label}
                    {sort === column.key ? (
                      <span className="sort-indicator">{order === "desc" ? "desc" : "asc"}</span>
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rank = (page - 1) * pageSize + index + 1;
              return (
              <tr key={row._id} className={row.isCurrentUser ? "current-user-row" : undefined}>
                <td>
                  {rank <= 3 ? (
                    <span className={`rank-medal rank-medal-${rank}`} aria-label={`Rank ${rank}`}>
                      {rank}
                    </span>
                  ) : (
                    rank
                  )}
                </td>
                <td>
                  <strong>{row.name}</strong>
                </td>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.type === "duration" ? (
                      formatDuration(row[column.key])
                    ) : (
                      <StatValue value={row[column.key]} leaf={column.type === "leafs"} />
                    )}
                  </td>
                ))}
              </tr>
              );
            })}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={9}>No members found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="leaderboard-footer">
        <p>{loading ? "Refreshing leaderboard…" : `${total.toLocaleString()} members`}</p>
        {totalPages > 1 ? (
          <div className="leaderboard-pagination">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
