"use client";

import { useEffect, useMemo, useState } from "react";

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
  const seconds = Math.max(0, Math.round(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
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
          setRows(data.rows ?? []);
          setTotal(data.total ?? 0);
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
                  >
                    {column.label}
                    {sort === column.key ? <span>{order === "desc" ? "↓" : "↑"}</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row._id} className={row.isCurrentUser ? "current-user-row" : undefined}>
                <td>{(page - 1) * pageSize + index + 1}</td>
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
            ))}
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
