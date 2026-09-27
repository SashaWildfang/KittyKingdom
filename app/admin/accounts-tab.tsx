"use client";

import { BadgeCheck, ShieldCheck, ShieldOff, Unlink, KeyRound, Trash2, TriangleAlert, Laptop, LogOut, Mail, MailCheck, MessageCircle, Search, Smartphone, Tablet, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { StackedBars } from "./admin-charts";
import { CopyId, LiveBadge, Pager, formatDate, timeAgo, useLive, useStored } from "./admin-shared";

type AccountRow = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  name: string;
  emailVerified: boolean;
  discordId: string | null;
  discordName: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  avatar: string | null;
  lastActiveAt?: string | null;
  online?: boolean;
};

/** Discord profile picture when linked, otherwise their initial. */
function AccountAvatar({ account, size }: { account: { avatar: string | null; name?: string; displayName: string | null; username: string | null; email: string; online?: boolean }; size: number }) {
  const [failed, setFailed] = useState(false);
  const letter = (account.name ?? account.displayName ?? account.username ?? account.email).charAt(0).toUpperCase();
  const face =
    account.avatar && !failed ? (
      <img className="adm-avatar" src={account.avatar} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />
    ) : (
      <span className="adm-avatar adm-avatar--letter" style={{ width: size, height: size, fontSize: size > 40 ? "1.6rem" : undefined }} aria-hidden="true">
        {letter}
      </span>
    );
  return (
    <span className="adm-avatar-wrap" style={{ "--s": `${size}px` } as React.CSSProperties}>
      {face}
      {account.online ? <i className="adm-online-badge" title="Online now" aria-label="Online now" /> : null}
    </span>
  );
}

type Account = AccountRow & {
  phone: string | null;
  socials: Record<string, { handle: string; url: string }>;
  dateOfBirth: string | null;
  age: string | null;
  updatedAt: string | null;
  passwordChangedAt: string | null;
  acceptedPoliciesAt: string | null;
  applicationStatus: string | null;
  isStaff?: boolean;
  twoFactor?: boolean;
  audit: { at: string | null; action: string; adminName: string; adminDiscordId: string }[];
};

type Result = {
  rows: AccountRow[];
  total: number;
  page: number;
  pageSize: number;
  totals: { all: number; verified: number; linked: number; newThisWeek: number };
};

type SortKey = "created" | "email" | "username" | "lastLogin" | "online";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "verified", label: "Email verified" },
  { key: "unverified", label: "Not verified" },
  { key: "linked", label: "Discord linked" },
  { key: "unlinked", label: "Not linked" },
  { key: "temp", label: "Temporary password" },
];

type OnlineUser = { id: string; name: string; username: string | null; discordId: string | null; avatar: string | null; lastSeenAt: string; devices: { type: string; label: string }[] };

type DeviceSession = {
  id: string;
  device: { browser: string; os: string; type: string };
  ip: string | null;
  location: { city: string | null; region: string | null; country: string | null };
  createdAt: string;
  lastSeenAt: string;
  online: boolean;
  active: boolean;
  revokedAt: string | null;
  revokedBy: string | null;
  current: boolean;
  userAgent: string | null;
};

const DEVICE_ICONS: Record<string, LucideIcon> = { mobile: Smartphone, tablet: Tablet, desktop: Laptop };

function DeviceIcon({ type, size = 16 }: { type: string; size?: number }) {
  const Icon = DEVICE_ICONS[type] ?? Laptop;
  return <Icon size={size} aria-hidden="true" />;
}

/** "🇺🇸" from "US" */
function flag(country: string | null) {
  if (!country || !/^[A-Z]{2}$/.test(country)) return "";
  return String.fromCodePoint(...country.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function OnlineNow({ onOpen }: { onOpen: (id: string) => void }) {
  const { data } = useLive<{ users: OnlineUser[]; visitors: number }>("/api/admin/online", 15_000);
  return (
    <section className="adm-online">
      <div className="adm-online-head">
        <h3>
          <i className="adm-online-dot" aria-hidden="true" /> Online now
        </h3>
        <span className="adm-muted">
          {data ? `${data.users.length} signed in · ${data.visitors} on the site in total` : "…"}
        </span>
      </div>
      <div className="adm-online-list">
        {data?.users.map((u) => (
          <button key={u.id} type="button" className="adm-online-user" onClick={() => onOpen(u.id)} title={u.devices.map((d) => d.label).join("\n")}>
            {u.avatar ? (
              <img className="adm-avatar" src={u.avatar} alt="" width={28} height={28} />
            ) : (
              <span className="adm-avatar adm-avatar--letter" style={{ width: 28, height: 28 }} aria-hidden="true">
                {u.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="adm-person-text">
              <strong>{u.name}</strong>
              <small>
                <span className="adm-device-icons">
                  {u.devices.map((d, i) => (
                    <DeviceIcon key={i} type={d.type} size={12} />
                  ))}
                </span>{" "}
                · {timeAgo(u.lastSeenAt)}
              </small>
            </span>
          </button>
        ))}
        {data && !data.users.length ? <p className="adm-muted">Nobody signed in is active right now.</p> : null}
      </div>
    </section>
  );
}

function Devices({ accountId }: { accountId: string }) {
  const { data, reload } = useLive<{ sessions: DeviceSession[] }>(`/api/admin/accounts/${accountId}/sessions`, 15_000);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [showEnded, setShowEnded] = useState(false);

  async function disconnect(id: string) {
    setBusy(id);
    setConfirming(null);
    try {
      const r = await fetch(`/api/admin/accounts/${accountId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      const body = await r.json();
      if (!r.ok || !body.ok) throw new Error(body.error ?? "Couldn't disconnect that device.");
      setMessage({ text: body.message, tone: "ok" });
      await reload();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Couldn't disconnect that device.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const sessions = data?.sessions ?? [];
  const live = sessions.filter((s) => !s.revokedAt && s.active);
  const ended = sessions.filter((s) => s.revokedAt || !s.active);

  const row = (s: DeviceSession) => {
    const place = [s.location.city, s.location.region, s.location.country].filter(Boolean).join(", ");
    return (
      <li key={s.id} className={`adm-device${s.revokedAt ? " is-ended" : ""}`}>
        <span className="adm-device-icon" aria-hidden="true">
          <DeviceIcon type={s.device.type} size={22} />
        </span>
        <div className="adm-device-main">
          <strong>
            {s.device.browser} on {s.device.os}
            {s.current ? <span className="adm-tag">this is you</span> : null}
          </strong>
          <small>
            {s.online ? <span className="adm-status adm-status--active">● Online now</span> : s.revokedAt ? `Disconnected ${timeAgo(s.revokedAt)}${s.revokedBy?.startsWith("admin") ? " by staff" : s.revokedBy === "logout" ? " (logged out)" : ""}` : `Active ${timeAgo(s.lastSeenAt)}`}
            {" · "}signed in {formatDate(s.createdAt)}
          </small>
          <small className="adm-device-ip">
            {s.ip ? (
              <>
                IP <code>{s.ip}</code>{" "}
                <a href={`https://ipinfo.io/${encodeURIComponent(s.ip)}`} target="_blank" rel="noopener noreferrer nofollow">
                  lookup ↗
                </a>
              </>
            ) : (
              "IP unknown"
            )}
            {place ? ` · ${flag(s.location.country)} ${place}` : ""}
          </small>
        </div>
        {!s.revokedAt ? (
          confirming === s.id ? (
            <div className="adm-confirm">
              <button type="button" className="adm-btn adm-btn--small" onClick={() => void disconnect(s.id)}>
                Disconnect
              </button>
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirming(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={Boolean(busy)} onClick={() => setConfirming(s.id)}>
              {busy === s.id ? "…" : "Disconnect"}
            </button>
          )
        ) : null}
      </li>
    );
  };

  return (
    <section className="adm-drawer-section">
      <h3>
        Devices &amp; sessions <small>{live.length} active</small>
      </h3>
      {message ? <p className={message.tone === "ok" ? "adm-notice" : "adm-error"}>{message.text}</p> : null}
      {!data ? <div className="adm-skeleton adm-skeleton--short" /> : null}
      <ul className="adm-devices">{live.map(row)}</ul>
      {data && !live.length ? <p className="adm-empty">No active sessions. Logins from before device tracking only show up once they sign in again.</p> : null}
      {ended.length ? (
        <>
          <button type="button" className="adm-link" onClick={() => setShowEnded((v) => !v)}>
            {showEnded ? "Hide" : "Show"} {ended.length} past session{ended.length === 1 ? "" : "s"}
          </button>
          {showEnded ? <ul className="adm-devices">{ended.map(row)}</ul> : null}
        </>
      ) : null}
    </section>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "disconnect-device": "Disconnected a device",
  delete: "Deleted the account",
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
  const [segment, setSegment] = useState<Segment | null>(null);

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
      <OnlineNow onOpen={setOpen} />
      <div className="adm-kpis adm-kpis--4">
        {(
          [
            { key: "all", label: "Accounts", tone: "", value: t?.all, hint: t ? `${t.newThisWeek} new this week` : "" },
            { key: "verified", label: "Email verified", tone: "green", value: t?.verified, hint: t && t.all ? `${Math.round((t.verified / t.all) * 100)}%` : "" },
            { key: "linked", label: "Discord linked", tone: "blue", value: t?.linked, hint: t && t.all ? `${Math.round((t.linked / t.all) * 100)}%` : "" },
            { key: "unverified", label: "Not verified", tone: "yellow", value: t ? t.all - t.verified : undefined, hint: "can't log in yet" },
          ] as const
        ).map((k) => (
          <button key={k.key} type="button" className={`adm-kpi is-link${k.tone ? ` adm-kpi--${k.tone}` : ""}`} onClick={() => setSegment(k.key)}>
            <small>{k.label}</small>
            <strong>{k.value === undefined ? "…" : k.value.toLocaleString()}</strong>
            <span>{k.hint}</span>
          </button>
        ))}
      </div>

      <div className="adm-filters">
        <label className="adm-search">
          <Search size={16} aria-hidden="true" />
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
                <button type="button" onClick={() => sortBy("online")}>Last active{arrow("online")}</button>
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
                    <AccountAvatar account={a} size={30} />
                    <span className="adm-person-text">
                      <strong>{a.name}</strong>
                      <small>{a.username ? `@${a.username}` : "no username"}</small>
                    </span>
                    {a.mustChangePassword ? <span className="adm-tag">temp password</span> : null}
                  </span>
                </td>
                <td>
                  <span className="adm-email-cell">
                    <span className="adm-email">{a.email}</span>
                    {a.emailVerified ? <BadgeCheck className="adm-verified" size={15} aria-label="Verified" /> : <span className="adm-tag">unverified</span>}
                  </span>
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
                <td title={formatDate(a.lastActiveAt ?? null)}>
                  {a.online ? (
                    <span className="adm-status adm-status--active">● Online now</span>
                  ) : a.lastActiveAt ? (
                    timeAgo(a.lastActiveAt)
                  ) : (
                    <span className="adm-muted">—</span>
                  )}
                </td>
                <td title={formatDate(a.lastLoginAt)}>{a.lastLoginAt ? timeAgo(a.lastLoginAt) : <span className="adm-muted">—</span>}</td>
              </tr>
            ))}
            {!loading && data && !data.rows.length ? (
              <tr>
                <td colSpan={6} className="adm-empty">
                  No accounts match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {data ? <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} /> : null}

      {segment
        ? createPortal(
            <SegmentDrawer
              segment={segment}
              onClose={() => setSegment(null)}
              onOpenAccount={(id) => {
                setSegment(null);
                setOpen(id);
              }}
              onShowInTable={() => {
                setFilter(segment === "linked" ? "linked" : segment === "verified" ? "verified" : segment === "unverified" ? "unverified" : "all");
                setPage(1);
                setSegment(null);
              }}
            />,
            document.body,
          )
        : null}
      {open ? createPortal(<AccountDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} onOpenMember={onOpenMember} />, document.body) : null}
    </div>
  );
}

type Segment = "all" | "verified" | "linked" | "unverified";
const SEGMENT_INFO: Record<Segment, { title: string; blurb: string; color: string }> = {
  all: { title: "All accounts", blurb: "Every website account.", color: "#f59b2a" },
  verified: { title: "Email verified", blurb: "Accounts that confirmed their email and can log in.", color: "#46a758" },
  linked: { title: "Discord linked", blurb: "Accounts connected to a Discord member (Store, Leaderboards and roles unlocked).", color: "#3e63dd" },
  unverified: { title: "Not verified", blurb: "Accounts that haven't confirmed their email yet, so they can't log in.", color: "#e2b203" },
};

function SegmentDrawer({ segment, onClose, onOpenAccount, onShowInTable }: { segment: Segment; onClose: () => void; onOpenAccount: (id: string) => void; onShowInTable: () => void }) {
  const { data } = useLive<{ total: number; percent: number; week: number; month: number; timeline: { bucket: string; action: string; count: number }[]; newest: AccountRow[] }>(
    `/api/admin/accounts/insights?segment=${segment}`,
    30_000,
  );
  const info = SEGMENT_INFO[segment];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <aside className="adm-drawer" onClick={(e) => e.stopPropagation()} aria-label={info.title}>
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <header className="adm-drawer-head adm-segment-head" style={{ "--c": info.color } as React.CSSProperties}>
          <div>
            <p className="adm-drill-kicker">Website accounts</p>
            <h2>{info.title}</h2>
            <p>{info.blurb}</p>
          </div>
        </header>
        <div className="adm-segment-stats">
          <div>
            <strong>{data ? data.total.toLocaleString() : "…"}</strong>
            <small>{segment === "all" ? "accounts" : `${data?.percent ?? "…"}% of all accounts`}</small>
          </div>
          <div>
            <strong>+{data?.week ?? "…"}</strong>
            <small>this week</small>
          </div>
          <div>
            <strong>+{data?.month ?? "…"}</strong>
            <small>last 30 days</small>
          </div>
        </div>
        <section className="adm-drawer-section">
          <h3>New accounts per week</h3>
          {data ? <StackedBars points={data.timeline} unit="week" series={[{ key: segment, label: info.title, color: info.color }]} height={150} /> : <div className="adm-skeleton" />}
        </section>
        <section className="adm-drawer-section">
          <h3>
            Newest <small>{data?.newest.length ?? 0}</small>
            <button type="button" className="adm-link adm-h3-link" onClick={onShowInTable}>
              Show all in the table →
            </button>
          </h3>
          <ul className="adm-segment-list">
            {data?.newest.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onOpenAccount(a.id)}>
                  <AccountAvatar account={a} size={30} />
                  <span className="adm-person-text">
                    <strong>{a.name}</strong>
                    <small>{a.email}</small>
                  </span>
                  <span className="adm-muted">{timeAgo(a.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>
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

  // Deleting takes three steps: Delete… → type CONFIRM → one last click
  const [deleteText, setDeleteText] = useState("");
  async function run(action: string) {
    setConfirming(null);
    setDeleteText("");
    setBusy(action);
    setNotice(null);
    try {
      const r = await fetch(`/api/admin/accounts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "delete" ? { confirm: "CONFIRM" } : {}) }),
      });
      const body = await r.json();
      if (!r.ok || !body.ok) throw new Error(body.error ?? "That didn't work.");
      if (body.deleted) {
        onChanged();
        onClose();
        return;
      }
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
    { key: "send-reset", label: "Email a reset link", icon: Mail, help: "They get a one-time link (1 hour) to choose a new password. Safest option.", confirm: "Email a password reset link to this member?", button: "Send link" },
    {
      key: "temp-password",
      label: "Set a temporary password",
      icon: KeyRound,
      help: "Replaces their password with one you give them, signs them out everywhere and asks them to change it.",
      confirm: "Replace their password with a temporary one? Their current password stops working immediately.",
      button: "Set password",
      danger: true,
    },
    { key: "sign-out", label: "Sign out everywhere", icon: LogOut, help: "Ends every website session on every device.", confirm: "Sign this account out on every device?", button: "Sign out" },
    ...(account && !account.emailVerified
      ? [{ key: "verify-email", label: "Mark email verified", icon: MailCheck, help: "Lets them log in without clicking the verification email.", confirm: "Mark this email as verified?", button: "Mark verified" }]
      : []),
    ...(account?.discordId
      ? [
          {
            key: "unlink-discord",
            label: "Unlink Discord",
            icon: Unlink,
            help: "Disconnects their Discord account from this website account. They lose Store, Leaderboards and roles on the site until they link again.",
            confirm: "Unlink their Discord account? They'll need a new code to link again.",
            button: "Unlink",
            danger: true,
          },
        ]
      : []),
    ...(account?.twoFactor
      ? [
          {
            key: "reset-2fa",
            label: "Turn off two-factor",
            icon: ShieldOff,
            help: "For members locked out of their authenticator app and backup codes. Also signs them out everywhere.",
            confirm: "Turn off two-factor authentication for this account? Only do this after confirming it's really them.",
            button: "Turn off 2FA",
            danger: true,
          },
        ]
      : []),
  ];

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <aside className="adm-drawer" onClick={(e) => e.stopPropagation()} aria-label="Website account">
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        {error ? <p className="adm-error">{error}</p> : null}
        {!account && !error ? <div className="adm-skeleton" style={{ height: 260 }} /> : null}
        {account ? (
          <>
            <header className="adm-drawer-head">
              <AccountAvatar account={account} size={64} />
              <div>
                <h2>{account.name}</h2>
                <p>{account.username ? `@${account.username}` : "No username yet"}</p>
                <CopyId id={account.id} />
              </div>
            </header>

            <div className="adm-drawer-flags">
              {account.emailVerified ? <span className="adm-status adm-status--active"><BadgeCheck size={13} aria-hidden="true" /> Email verified</span> : <span className="adm-tag">Email not verified</span>}
              {account.twoFactor ? <span className="adm-status adm-status--active"><ShieldCheck size={13} aria-hidden="true" /> 2FA on</span> : <span className="adm-tag">2FA off</span>}
              {account.discordId ? <span className="adm-tag"><MessageCircle size={12} aria-hidden="true" /> Discord linked</span> : <span className="adm-tag">Discord not linked</span>}
              {account.mustChangePassword ? <span className="adm-tag"><KeyRound size={12} aria-hidden="true" /> Temporary password</span> : null}
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
                  <dd>
                    {[account.dateOfBirth, account.age ? `${account.age} years old` : null].filter(Boolean).join(" · ") ||
                      (account.discordId ? "Not on their join application" : "Link Discord to see it")}
                  </dd>
                </div>
                <div>
                  <dt>Join application</dt>
                  <dd>{account.applicationStatus ? account.applicationStatus.charAt(0).toUpperCase() + account.applicationStatus.slice(1) : "—"}</dd>
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

            <Devices accountId={account.id} />

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
                      <strong className="adm-inline-icon">
                        <a.icon size={15} aria-hidden="true" /> {a.label}
                      </strong>
                      <small>{a.help}</small>
                    </div>
                    {confirming === a.key ? (
                      <div className="adm-confirm">
                        <span>{a.confirm}</span>
                        <button type="button" className="adm-btn adm-btn--small" onClick={() => void run(a.key)}>
                          Yes, {a.button.toLowerCase()}
                        </button>
                        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirming(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={Boolean(busy)} onClick={() => setConfirming(a.key)}>
                        {busy === a.key ? "Working…" : a.button}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="adm-drawer-section adm-danger">
              <h3>
                <TriangleAlert size={16} aria-hidden="true" /> Danger zone
              </h3>
              {account.isStaff ? (
                <div className="adm-action-row adm-protected">
                  <div>
                    <strong className="adm-inline-icon">
                      <ShieldCheck size={15} aria-hidden="true" /> Staff account: protected
                    </strong>
                    <small>Staff accounts can&apos;t be deleted, not even by the owner. Remove their staff role in Discord first.</small>
                  </div>
                </div>
              ) : confirming === "delete" ? (
                <div className="adm-danger-confirm">
                  <p>
                    <strong>Step 2 of 3.</strong> You&apos;re about to permanently delete the website account <strong>{account.email}</strong>. Their login, devices and
                    settings are removed. Their Discord and bot data (leafs, levels, punishments) are not touched.
                  </p>
                  <label className="adm-danger-type">
                    <span>
                      Type <b>CONFIRM</b> to continue
                    </span>
                    <input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="CONFIRM" autoComplete="off" autoFocus />
                  </label>
                  <div>
                    <button type="button" className="adm-btn adm-btn--danger" disabled={deleteText !== "CONFIRM"} onClick={() => setConfirming("delete-final")}>
                      Continue
                    </button>
                    <button
                      type="button"
                      className="adm-btn adm-btn--ghost"
                      onClick={() => {
                        setConfirming(null);
                        setDeleteText("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : confirming === "delete-final" ? (
                <div className="adm-danger-confirm is-final">
                  <p>
                    <strong>Last step.</strong> Delete <strong>{account.email}</strong> forever? This can&apos;t be undone.
                  </p>
                  <div>
                    <button type="button" className="adm-btn adm-btn--danger" disabled={Boolean(busy)} onClick={() => void run("delete")}>
                      {busy === "delete" ? "Deleting…" : "Delete account forever"}
                    </button>
                    <button
                      type="button"
                      className="adm-btn adm-btn--ghost"
                      onClick={() => {
                        setConfirming(null);
                        setDeleteText("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="adm-action-row is-danger">
                  <div>
                    <strong className="adm-inline-icon">
                      <Trash2 size={15} aria-hidden="true" /> Delete account
                    </strong>
                    <small>Removes the website account for good. Can&apos;t be undone.</small>
                  </div>
                  <button type="button" className="adm-btn adm-btn--danger adm-btn--small" onClick={() => setConfirming("delete")}>
                    Delete…
                  </button>
                </div>
              )}
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
