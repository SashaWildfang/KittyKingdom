import { Long } from "mongodb";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { getZeoUsersCollection } from "../../lib/mongodb";
import { SiteNav } from "../site-nav";

type SearchParams = {
  metric?: string;
  q?: string;
  page?: string;
};

const metrics: Record<
  string,
  { label: string; field: string; format?: "seconds" | "number" }
> = {
  balance: { label: "Balance", field: "balance", format: "number" },
  level: { label: "Level", field: "level", format: "number" },
  messages: { label: "Messages", field: "msgCount", format: "number" },
  bumps: { label: "Total Bumps", field: "bumpCount", format: "number" },
  vc_total: { label: "Total VC Time", field: "vc_time_total", format: "seconds" },
  vc_monthly: { label: "Monthly VC Time", field: "vc_time_monthly", format: "seconds" },
};

const pageSize = 25;

function valueFor(row: Record<string, unknown>, field: string) {
  const raw = row[field];
  return typeof raw === "number" ? raw : raw ? Number(raw) || 0 : 0;
}

function formatValue(value: number, format: "seconds" | "number" = "number") {
  if (format === "seconds") {
    const total = Math.max(0, Math.floor(value));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  return Math.round(value).toLocaleString();
}

function displayUser(row: Record<string, unknown>) {
  return String(
    row.username ?? row.name ?? row.displayName ?? row.discordName ?? row.discordId ?? "Unknown user",
  );
}

function searchFilter(query: string) {
  if (!query) return {};
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const clauses: Record<string, unknown>[] = [
    { username: regex },
    { name: regex },
    { displayName: regex },
    { discordName: regex },
    { discordTag: regex },
    { discordId: regex },
  ];
  if (/^\d+$/.test(query)) {
    clauses.push({ discordId: Number(query) }, { discordId: Long.fromString(query) });
  }
  return { $or: clauses };
}

function pageLink(metric: string, query: string, page: number) {
  const params = new URLSearchParams({ metric, page: String(page) });
  if (query) params.set("q", query);
  return `/leaderboards?${params.toString()}`;
}

export const dynamic = "force-dynamic";

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?account=login-required");

  const metricKey = metrics[searchParams.metric ?? ""]
    ? String(searchParams.metric)
    : "balance";
  const metric = metrics[metricKey];
  const query = String(searchParams.q ?? "").trim();
  const currentPage = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const skip = (currentPage - 1) * pageSize;
  const filter = searchFilter(query);

  const zeoUsers = await getZeoUsersCollection();
  const [rows, total] = await Promise.all([
    zeoUsers
      .find(filter)
      .sort({ [metric.field]: -1, _id: 1 })
      .skip(skip)
      .limit(pageSize)
      .toArray(),
    zeoUsers.countDocuments(filter),
  ]);

  const discordId = user.discordId ? String(user.discordId) : null;
  const discordClauses: Record<string, unknown>[] = discordId
    ? [{ discordId }, { discordId: Number(discordId) }]
    : [];
  if (discordId && /^\d+$/.test(discordId)) {
    discordClauses.push({ discordId: Long.fromString(discordId) });
  }
  const currentZeoUser = discordClauses.length
    ? ((await zeoUsers.findOne({ $or: discordClauses })) as Record<string, unknown> | null)
    : null;
  const currentValue = currentZeoUser ? valueFor(currentZeoUser, metric.field) : null;
  const currentRank =
    currentValue === null
      ? null
      : (await zeoUsers.countDocuments({ [metric.field]: { $gt: currentValue } })) + 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="site-shell leaderboard-shell">
      <SiteNav />
      <section className="leaderboard-hero">
        <p className="eyebrow">Member rankings</p>
        <h1>Leaderboards</h1>
        <p>Search members, sort by activity, and see where you rank.</p>
        {currentRank ? (
          <p className="leaderboard-rank-card">
            Your {metric.label} rank: <strong>#{currentRank.toLocaleString()}</strong>
            {currentValue !== null ? ` • ${formatValue(currentValue, metric.format)}` : ""}
          </p>
        ) : (
          <p className="leaderboard-rank-card muted-rank">
            Link Discord to show your personal leaderboard rank.
          </p>
        )}
      </section>

      <section className="leaderboard-panel">
        <form className="leaderboard-controls" action="/leaderboards" method="get">
          <label>
            Search
            <input name="q" placeholder="Username or Discord ID" defaultValue={query} />
          </label>
          <label>
            Sort by
            <select name="metric" defaultValue={metricKey}>
              {Object.entries(metrics).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Apply</button>
        </form>

        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Member</th>
                <th>Balance</th>
                <th>Level</th>
                <th>Messages</th>
                <th>Total Bumps</th>
                <th>Total VC</th>
                <th>Monthly VC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row._id)}>
                  <td>#{(skip + index + 1).toLocaleString()}</td>
                  <td>{displayUser(row as Record<string, unknown>)}</td>
                  <td>{formatValue(valueFor(row as Record<string, unknown>, "balance"))}</td>
                  <td>{formatValue(valueFor(row as Record<string, unknown>, "level"))}</td>
                  <td>{formatValue(valueFor(row as Record<string, unknown>, "msgCount"))}</td>
                  <td>{formatValue(valueFor(row as Record<string, unknown>, "bumpCount"))}</td>
                  <td>{formatValue(valueFor(row as Record<string, unknown>, "vc_time_total"), "seconds")}</td>
                  <td>{formatValue(valueFor(row as Record<string, unknown>, "vc_time_monthly"), "seconds")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="leaderboard-pagination">
          {currentPage > 1 ? <a href={pageLink(metricKey, query, currentPage - 1)}>Previous</a> : <span />}
          <span>
            Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
          </span>
          {currentPage < totalPages ? <a href={pageLink(metricKey, query, currentPage + 1)}>Next</a> : <span />}
        </div>
      </section>
    </main>
  );
}
