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

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "balance", label: "Leafs" },
  { value: "level", label: "Level" },
  { value: "messages", label: "Messages" },
  { value: "bumps", label: "Total Bumps" },
  { value: "monthly_bumps", label: "Monthly Bumps" },
  { value: "total_vc_time", label: "Total VC Time" },
  { value: "monthly_vc_time", label: "Monthly VC Time" },
];

const pageSizes = [10, 25, 50, 100];

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function formatDuration(value: number) {
  const minutes = Math.max(0, Math.round(value));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function LeaderboardsClient() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("balance");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({
        search,
        sort,
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
  }, [search, sort, page, pageSize]);

  return (
    <section className="leaderboard-panel" aria-label="Leaderboards">
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
              <th>Leafs</th>
              <th>Level</th>
              <th>Messages</th>
              <th>Total Bumps</th>
              <th>Monthly Bumps</th>
              <th>Total VC Time</th>
              <th>Monthly VC Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row._id} className={row.isCurrentUser ? "current-user-row" : undefined}>
                <td>{(page - 1) * pageSize + index + 1}</td>
                <td>
                  <strong>{row.name}</strong>
                  {row.username ? <span>@{row.username}</span> : null}
                </td>
                <td className="leafs-cell">
                  <img src="/leaf.png" alt="" width="18" height="18" />
                  {formatNumber(row.balance)}
                </td>
                <td>{formatNumber(row.level)}</td>
                <td>{formatNumber(row.messages)}</td>
                <td>{formatNumber(row.bumps)}</td>
                <td>{formatNumber(row.monthly_bumps)}</td>
                <td>{formatDuration(row.total_vc_time)}</td>
                <td>{formatDuration(row.monthly_vc_time)}</td>
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
      </div>
    </section>
  );
}
