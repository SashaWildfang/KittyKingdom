"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CopyId, LiveBadge, Pager, formatDate, timeAgo, useLive, useStored } from "./admin-shared";

type AccountRow = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  emailVerified: boolean;
  discordId: string | null;
  discordName: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
};

type Account = AccountRow & {
  phone: string | null;
  socials: Record<string, { handle: string; url: string }>;
  dateOfBirth: string | null;
  age: string | null;
  updatedAt: string | null;
  passwordChangedAt: string | null;
  acceptedPoliciesAt: string | null;
  audit: { at: string | null; action: string; adminName: string; adminDiscordId: string }[];
};

type Result = {
  rows: AccountRow[];
  total: number;
  page: number;
  pageSize: number;
  totals: { all: number; verified: number; linked: number; newThisWeek: number };
};

type SortKey = "created" | "email" | "username" | "lastLogin";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "verified", label: "Email verified" },
  { key: "unverified", label: "Not verified" },
  { key: "linked", label: "Discord linked" },
  { key: "unlinked", label: "Not linked" },
  { key: "temp", label: "Temporary password" },
];

const ACTION_LABELS: Record<string, string> = {
  "send-reset": "Sent a password reset link",
  "temp-password": "Set a temporary password",
  "sign-out": "Signed out everywhere",
  "verify-email": "Marked email verified",
};

export function AccountsTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [filter, setFilter] = useStored("accounts-filter", "all");
  const [sort, setSort] = useStored<SortKey>("accounts-sort", "created");
  const [order, setOrder] = useStored<"asc" | "desc">("accounts-order", "desc");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ search: query, filter, sort, order, page: String(page), pageSize: "25" });
  const { data, error, loading, updatedAt, reload } = useLive<Result>(`/api/admin/accounts?${params}`, 20_000);

  const sortBy = (key: SortKey) => {
    setOrder(sort === key && order === "desc" ? "asc" : "desc");
    setSort(key);
    setPage(1);
  };
  const arrow = (key: SortKey) => (sort === key ? (order === "desc" ? " ↓" : " ↑") : "");
  const t = data?.totals;

  return (
    <div className="adm-panel">
      <div className="adm-kpis adm-kpis--4">
        <div className="adm-kpi">
          <small>Accounts</small>
          <strong>{t ? t.all.toLocaleString() : "…"}</strong>
          <span>{t ? `${t.newThisWeek} new this week` : ""}</span>
        </div>
        <div className="adm-kpi adm-kpi--green">
          <small>Email verified</small>
          <strong>{t ? t.verified.toLocaleString() : "…"}</strong>
          <span>{t && t.all ? `${Math.round((t.verified / t.all) * 100)}%` : ""}</span>
        </div>
        <div className="adm-kpi adm-kpi--blue">
          <small>Discord linked</small>
          <strong>{t ? t.linked.toLocaleString() : "…"}</strong>
          <span>{t && t.all ? `${Math.round((t.linked / t.all) * 100)}%` : ""}</span>
        </div>
        <div className="adm-kpi adm-kpi--yellow">
          <small>Not verified</small>
          <strong>{t ? (t.all - t.verified).toLocaleString() : "…"}</strong>
          <span>can&apos;t log in yet</span>
        </div>
      </div>

      <div className="adm-filters">
        <label className="adm-search">
          <span aria-hidden="true">🔍</span>
          <input type="search" placeholder="Search email, username, name, Discord…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <LiveBadge updatedAt={updatedAt} loading={loading} />
      </div>
      <div className="adm-chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`adm-chip${filter === f.key ? " is-on" : ""}`}
            style={{ "--c": "#f59b2a" } as React.CSSProperties}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? <p className="adm-error">{error}</p> : null}

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => sortBy("username")}>Account{arrow("username")}</button>
              </th>
              <th>
                <button type="button" onClick={() => sortBy("email")}>Email{arrow("email")}</button>
              </th>
              <th>Discord</th>
              <th>
                <button type="button" onClick={() => sortBy("created")}>Joined{arrow("created")}</button>
              </th>
              <th>
                <button type="button" onClick={() => sortBy("lastLogin")}>Last login{arrow("lastLogin")}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((a) => (
              <tr key={a.id} onClick={() => setOpen(a.id)}>
                <td>
                  <span className="adm-account">
                    <span className="adm-avatar adm-avatar--letter" style={{ width: 30, height: 30 }} aria-hidden="true">
                      {(a.displayName ?? a.username ?? a.email).charAt(0).toUpperCase()}
                    </span>
                    <span className="adm-person-text">
                      <strong>{a.displayName ?? a.username ?? "No name yet"}</strong>
                      <small>{a.username ? `@${a.username}` : "no username"}</small>
                    </span>
                    {a.mustChangePassword ? <span className="adm-tag">temp password</span> : null}
                  </span>
                </td>
                <td>
                  <span className="adm-email">{a.email}</span>
                  {a.emailVerified ? <span className="adm-status adm-status--active"> ✓</span> : <span className="adm-tag">unverified</span>}
                </td>
                <td>
                  {a.discordId ? (
                    <button
                      type="button"
                      className="adm-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMember(a.discordId!);
                      }}
                    >
                      {a.discordName ?? a.discordId}
                    </button>
                  ) : (
                    <span className="adm-muted">Not linked</span>
                  )}
                </td>
                <td title={formatDate(a.createdAt)}>{timeAgo(a.createdAt)}</td>
                <td title={formatDate(a.lastLoginAt)}>{a.lastLoginAt ? timeAgo(a.lastLoginAt) : <span className="adm-muted">—</span>}</td>
              </tr>
            ))}
            {!loading && data && !data.rows.length ? (
              <tr>
                <td colSpan={5} className="adm-empty">
                  No accounts match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {data ? <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} /> : null}

      {open ? createPortal(<AccountDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} onOpenMember={onOpenMember} />, document.body) : null}
    </div>
  );
}

function AccountDrawer({ id, onClose, onChanged, onOpenMember }: { id: string; onClose: () => void; onChanged: () => void; onOpenMember: (id: string) => void }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/accounts/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.ok) throw new Error(body.error ?? "Couldn't load that account.");
        if (!cancelled) setAccount(body.account);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load that account."));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(action: string) {
    setConfirming(null);
    setBusy(action);
    setNotice(null);
    try {
      const r = await fetch(`/api/admin/accounts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await r.json();
      if (!r.ok || !body.ok) throw new Error(body.error ?? "That didn't work.");
      setAccount(body.account);
      setNotice({ text: body.message, tone: "ok" });
      if (body.temporaryPassword) setTempPassword(body.temporaryPassword);
      onChanged();
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : "That didn't work.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const actions = [
    { key: "send-reset", label: "📧 Email a reset link", help: "They get a one-time link (1 hour) to choose a new password. Safest option.", confirm: "Email a password reset link to this member?" },
    {
      key: "temp-password",
      label: "🔑 Set a temporary password",
      help: "Replaces their password with one you give them, signs them out everywhere and asks them to change it.",
      confirm: "Replace their password with a temporary one? Their current password stops working immediately.",
      danger: true,
    },
    { key: "sign-out", label: "🚪 Sign out everywhere", help: "Ends every website session on every device.", confirm: "Sign this account out on every device?" },
    ...(account && !account.emailVerified
      ? [{ key: "verify-email", label: "✅ Mark email verified", help: "Lets them log in without clicking the verification email.", confirm: "Mark this email as verified?" }]
      : []),
  ];

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <aside className="adm-drawer" onClick={(e) => e.stopPropagation()} aria-label="Website account">
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {error ? <p className="adm-error">{error}</p> : null}
        {!account && !error ? <div className="adm-skeleton" style={{ height: 260 }} /> : null}
        {account ? (
          <>
            <header className="adm-drawer-head">
              <span className="adm-avatar adm-avatar--letter" style={{ width: 64, height: 64, fontSize: "1.6rem" }} aria-hidden="true">
                {(account.displayName ?? account.username ?? account.email).charAt(0).toUpperCase()}
              </span>
              <div>
                <h2>{account.displayName ?? account.username ?? "No name yet"}</h2>
                <p>{account.username ? `@${account.username}` : "No username yet"}</p>
                <CopyId id={account.id} />
              </div>
            </header>

            <div className="adm-drawer-flags">
              {account.emailVerified ? <span className="adm-status adm-status--active">✓ Email verified</span> : <span className="adm-tag">Email not verified</span>}
              {account.discordId ? <span className="adm-tag">💬 Discord linked</span> : <span className="adm-tag">Discord not linked</span>}
              {account.mustChangePassword ? <span className="adm-tag">🔑 Temporary password</span> : null}
            </div>

            <section className="adm-drawer-section">
              <h3>Details</h3>
              <dl className="adm-dl">
                <div>
                  <dt>Email</dt>
                  <dd>{account.email}</dd>
                </div>
                <div>
                  <dt>Discord</dt>
                  <dd>
                    {account.discordId ? (
                      <button type="button" className="adm-link" onClick={() => onOpenMember(account.discordId!)}>
                        {account.discordName ?? account.discordId} →
                      </button>
                    ) : (
                      "Not linked"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{account.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt>Birthday / age</dt>
                  <dd>{[account.dateOfBirth, account.age ? `${account.age} y/o` : null].filter(Boolean).join(" · ") || "—"}</dd>
                </div>
                <div>
                  <dt>Joined</dt>
                  <dd>{formatDate(account.createdAt)}</dd>
                </div>
                <div>
                  <dt>Last login</dt>
                  <dd>{account.lastLoginAt ? `${formatDate(account.lastLoginAt)} (${timeAgo(account.lastLoginAt)})` : "—"}</dd>
                </div>
                <div>
                  <dt>Password changed</dt>
                  <dd>{account.passwordChangedAt ? timeAgo(account.passwordChangedAt) : "Never"}</dd>
                </div>
                <div>
                  <dt>Accepted policies</dt>
                  <dd>{formatDate(account.acceptedPoliciesAt)}</dd>
                </div>
              </dl>
              {Object.keys(account.socials).length ? (
                <div className="adm-roles" style={{ marginTop: "0.7rem" }}>
                  {Object.entries(account.socials).map(([network, link]) => (
                    <a key={network} className="adm-role" style={{ "--c": "#8b8d98" } as React.CSSProperties} href={link.url} target="_blank" rel="noopener noreferrer nofollow">
                      {network}: {link.handle}
                    </a>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="adm-drawer-section">
              <h3>Password &amp; sign-in</h3>
              {notice ? <p className={notice.tone === "ok" ? "adm-notice" : "adm-error"}>{notice.text}</p> : null}
              {tempPassword ? (
                <div className="adm-temp">
                  <p>Give them this temporary password. It&apos;s shown once and isn&apos;t stored anywhere readable.</p>
                  <div>
                    <code>{tempPassword}</code>
                    <button type="button" className="adm-btn adm-btn--small" onClick={() => void navigator.clipboard?.writeText(tempPassword)}>
                      Copy
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="adm-actions">
                {actions.map((a) => (
                  <div key={a.key} className={`adm-action-row${a.danger ? " is-danger" : ""}`}>
                    <div>
                      <strong>{a.label}</strong>
                      <small>{a.help}</small>
                    </div>
                    {confirming === a.key ? (
                      <div className="adm-confirm">
                        <span>{a.confirm}</span>
                        <button type="button" className="adm-btn adm-btn--small" onClick={() => void run(a.key)}>
                          Yes
                        </button>
                        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirming(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={Boolean(busy)} onClick={() => setConfirming(a.key)}>
                        {busy === a.key ? "Working…" : "Do it"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="adm-drawer-section">
              <h3>Admin history</h3>
              {account.audit.length ? (
                <ol className="adm-timeline">
                  {account.audit.map((entry, i) => (
                    <li key={i}>
                      <div className="adm-timeline-head">
                        <strong>{ACTION_LABELS[entry.action] ?? entry.action}</strong>
                        <span className="adm-timeline-by">
                          by {entry.adminName} · {timeAgo(entry.at)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="adm-empty">No admin actions on this account yet.</p>
              )}
            </section>
          </>
        ) : null}
      </aside>
    </div>
  );
}
