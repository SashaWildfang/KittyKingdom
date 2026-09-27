"use client";

import { AlertTriangle, Ban, Cake, ChevronDown, Check, Clock, Compass, Heart, Loader2, Search, ShieldAlert, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { JoinApp } from "../../lib/join-apps";
import { Avatar, Pager, timeAgo, formatDate, useLive, type People } from "./admin-shared";

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "pending" },
  approved: { label: "Accepted", tone: "ok" },
  denied: { label: "Denied", tone: "bad" },
  banned: { label: "Banned", tone: "bad" },
  left: { label: "Left the server", tone: "muted" },
  auto_denied: { label: "Auto-denied", tone: "muted" },
  underage_kick: { label: "Underage (kicked)", tone: "bad" },
};

const BAN_REASONS = ["Suspected bot / spam account", "Raider / Troller", "Underage"];

function ageOf(iso: string | null) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 30) return { text: `${days} day${days === 1 ? "" : "s"}`, fresh: true };
  if (days < 365) return { text: `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? "" : "s"}`, fresh: false };
  return { text: `${Math.floor(days / 365)} year${Math.floor(days / 365) === 1 ? "" : "s"}`, fresh: false };
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, tone: "muted" };
  return <span className={`ja-status ja-status--${s.tone}`}>{s.label}</span>;
}

/** Accept / deny / ban, queued for the bot; follows the request until the bot has done it. */
function Decide({ app, name, queueOnline, onDone }: { app: JoinApp; name: string; queueOnline: boolean; onDone: () => void }) {
  const [mode, setMode] = useState<"idle" | "accept" | "deny" | "ban">("idle");
  const [reason, setReason] = useState("");
  const [preset, setPreset] = useState(BAN_REASONS[0]);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<{ id: string; label: string } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // A request that's still in the queue (e.g. after a refresh) keeps showing as in progress
  const inFlight = app.request && (app.request.status === "queued" || app.request.status === "processing") ? app.request : null;

  useEffect(() => {
    if (!tracking) return;
    let stop = false;
    const tick = async () => {
      const res = await fetch(`/api/admin/join-apps/action/${tracking.id}`, { cache: "no-store" }).catch(() => null);
      const body = res ? await res.json().catch(() => null) : null;
      if (stop || !body?.ok) return;
      if (body.status === "done" || body.status === "failed") {
        setResult({ ok: body.status === "done", text: body.result ?? (body.status === "done" ? "Done." : "That didn't work.") });
        setTracking(null);
        onDone();
      }
    };
    const t = window.setInterval(() => void tick(), 1500);
    void tick();
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [tracking, onDone]);

  async function send(action: "accept" | "deny" | "ban") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/join-apps/${app.discordId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: action === "ban" ? (preset === "custom" ? reason : `${preset}${reason.trim() ? ` - ${reason.trim()}` : ""}`) : reason, confirm: confirmText }),
      });
      const body = await res.json().catch(() => ({ ok: false, error: "That didn't work." }));
      if (!res.ok || !body.ok) {
        setError(body.error ?? "That didn't work.");
        return;
      }
      setMode("idle");
      setReason("");
      setConfirmText("");
      setTracking({ id: body.id, label: body.message });
    } finally {
      setBusy(false);
    }
  }

  if (tracking || inFlight) {
    return (
      <div className="ja-progress" role="status">
        <Loader2 size={15} className="ja-spin" aria-hidden="true" />
        {tracking?.label ?? `${inFlight!.action === "accept" ? "Accepting" : inFlight!.action === "deny" ? "Denying" : "Banning"} (by ${inFlight!.byName})…`}
        {!queueOnline ? <small> The bot looks offline; it'll run when it's back.</small> : null}
      </div>
    );
  }

  if (result) {
    return (
      <p className={`ja-result ${result.ok ? "is-ok" : "is-bad"}`} role="status">
        {result.ok ? <Check size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />} {result.text}
      </p>
    );
  }

  // Only applications still waiting for a decision get buttons
  if (app.status !== "pending") return null;
  return (
    <div className="ja-decide">
      {mode === "idle" ? (
        <div className="ja-buttons">
          <button type="button" className="ja-btn ja-btn--accept" onClick={() => setMode("accept")}>
            <Check size={15} aria-hidden="true" /> Accept
          </button>
          <button type="button" className="ja-btn ja-btn--deny" onClick={() => setMode("deny")}>
            <X size={15} aria-hidden="true" /> Deny
          </button>
          <button type="button" className="ja-btn ja-btn--ban" onClick={() => setMode("ban")}>
            <Ban size={15} aria-hidden="true" /> Ban
          </button>
        </div>
      ) : mode === "accept" ? (
        <div className="ja-confirm">
          <p>
            Accept <strong>{name}</strong>? They get the Member and level roles and a welcome post in general.
          </p>
          <div className="ja-buttons">
            <button type="button" className="ja-btn ja-btn--accept" disabled={busy} onClick={() => void send("accept")}>
              {busy ? "Sending…" : "Yes, accept"}
            </button>
            <button type="button" className="ja-btn" onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </div>
      ) : mode === "deny" ? (
        <div className="ja-confirm">
          <label>
            <span>Reason (they&apos;ll see this; they can re-apply in 1 day)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} placeholder="e.g. Please answer every question in more detail." autoFocus />
          </label>
          <div className="ja-buttons">
            <button type="button" className="ja-btn ja-btn--deny" disabled={busy || reason.trim().length < 3} onClick={() => void send("deny")}>
              {busy ? "Sending…" : "Deny application"}
            </button>
            <button type="button" className="ja-btn" onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="ja-confirm ja-confirm--ban">
          <p className="ja-ban-warn">
            <ShieldAlert size={16} aria-hidden="true" /> This <strong>permanently bans</strong> {name} from the server and logs a punishment.
          </p>
          <label>
            <span>Reason</span>
            <select className="adm-select" value={preset} onChange={(e) => setPreset(e.target.value)}>
              {BAN_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
              <option value="custom">Other (write it below)</option>
            </select>
          </label>
          <label>
            <span>{preset === "custom" ? "Reason" : "Extra details (optional)"}</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={preset === "custom" ? "Why are they being banned?" : "Anything staff should know"} />
          </label>
          <label>
            <span>
              Type <b>BAN</b> to confirm
            </span>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="BAN" autoComplete="off" />
          </label>
          <div className="ja-buttons">
            <button
              type="button"
              className="ja-btn ja-btn--ban"
              disabled={busy || confirmText.trim().toUpperCase() !== "BAN" || (preset === "custom" && reason.trim().length < 3)}
              onClick={() => void send("ban")}
            >
              {busy ? "Sending…" : "Ban permanently"}
            </button>
            <button type="button" className="ja-btn" onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error ? <p className="ja-result is-bad">{error}</p> : null}
    </div>
  );
}

/** One application: who, what they answered, where it stands, and the decision buttons. */
export function JoinAppCard({
  app,
  people,
  queueOnline,
  onDone,
  onOpenMember,
  compact,
}: {
  app: JoinApp;
  people: People;
  queueOnline: boolean;
  onDone: () => void;
  onOpenMember?: (id: string) => void;
  compact?: boolean;
}) {
  const person = people[app.discordId];
  const name = person?.name ?? app.discordId;
  const accountAge = ageOf(app.accountCreatedAt);
  const reviewer = app.reviewedBy ? people[app.reviewedBy]?.name ?? app.reviewedBy : null;
  const lastRequest = app.request && app.request.status === "failed" ? app.request : null;

  return (
    <article className={`ja-card ja-card--${app.status}${compact ? " is-compact" : ""}`}>
      {!compact ? (
        <header className="ja-head">
          <button type="button" className="ja-who" onClick={() => onOpenMember?.(app.discordId)} title="Open their full profile">
            <Avatar person={person} id={app.discordId} size={46} />
            <span>
              <strong>{name}</strong>
              <small>
                {person?.username ? `@${person.username} · ` : ""}
                {app.discordId}
              </small>
            </span>
          </button>
          <StatusBadge status={app.status} />
        </header>
      ) : null}

      <div className="ja-facts">
        {app.submittedAt ? (
          <span title={formatDate(app.submittedAt)}>
            <Clock size={13} aria-hidden="true" /> Applied {timeAgo(app.submittedAt)}
          </span>
        ) : null}
        {accountAge ? (
          <span className={accountAge.fresh ? "is-warn" : undefined} title={app.accountCreatedAt ? `Discord account created ${formatDate(app.accountCreatedAt)}` : undefined}>
            <UserRound size={13} aria-hidden="true" /> Account {accountAge.text} old{accountAge.fresh ? " · NEW ACCOUNT" : ""}
          </span>
        ) : null}
        {app.age !== null ? (
          <span className={app.age < 18 ? "is-bad" : undefined}>
            <Cake size={13} aria-hidden="true" /> {app.age} years old{app.birthday ? ` · ${app.birthday}` : ""}
          </span>
        ) : null}
        {person && !person.inServer && app.status === "pending" ? <span className="is-warn">Not in the server anymore</span> : null}
      </div>

      <dl className="ja-answers">
        <div>
          <dt>
            <Cake size={13} aria-hidden="true" /> Age / date of birth
          </dt>
          <dd>{app.ageAndDob ?? "—"}</dd>
        </div>
        <div>
          <dt>
            <Compass size={13} aria-hidden="true" /> How they found us
          </dt>
          <dd>{app.howFound ?? "—"}</dd>
        </div>
        <div className="ja-wide">
          <dt>
            <Heart size={13} aria-hidden="true" /> Fursona &amp; why they&apos;re joining
          </dt>
          <dd>{app.fursonaAndReason ?? "—"}</dd>
        </div>
        <div className="ja-wide">
          <dt>
            <UserRound size={13} aria-hidden="true" /> Bio
          </dt>
          <dd>{app.bio ?? "—"}</dd>
        </div>
      </dl>

      {app.status !== "pending" && (reviewer || app.reason || app.reviewedAt) ? (
        <p className="ja-review">
          <StatusBadge status={app.status} />
          {reviewer ? ` by ${reviewer}` : ""}
          {app.reviewedAt ? ` · ${timeAgo(app.reviewedAt)}` : ""}
          {app.reviewedVia === "website" ? " · from the website" : ""}
          {app.reason ? <em> — {app.reason}</em> : null}
        </p>
      ) : null}
      {lastRequest ? (
        <p className="ja-result is-bad">
          <AlertTriangle size={14} aria-hidden="true" /> Last try ({lastRequest.action} by {lastRequest.byName}) failed: {lastRequest.result}
        </p>
      ) : null}

      <Decide app={app} name={name} queueOnline={queueOnline} onDone={onDone} />
    </article>
  );
}

type ListResult = { apps: JoinApp[]; total: number; page: number; pageSize: number; counts: Record<string, number>; people: People; queueOnline: boolean };

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Accepted" },
  { key: "denied", label: "Denied" },
  { key: "banned", label: "Banned" },
  { key: "left", label: "Left" },
  { key: "all", label: "All" },
];

/** Admin -> Join Apps: review applications from the website. */
export function JoinAppsTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ status, search: query, page: String(page) });
  const { data, error, reload } = useLive<ListResult>(`/api/admin/join-apps?${params}`, 8_000);
  const counts = data?.counts ?? {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="ja">
      <div className="adm-filters">
        <div className="adm-seg" role="tablist" aria-label="Status">
          {FILTERS.map((f) => {
            const n = f.key === "all" ? all : counts[f.key] ?? 0;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={status === f.key}
                className={status === f.key ? "is-active" : undefined}
                onClick={() => {
                  setStatus(f.key);
                  setPage(1);
                }}
              >
                {f.label}
                {data ? <small className={f.key === "pending" && n > 0 ? "ja-count is-hot" : "ja-count"}>{n}</small> : null}
              </button>
            );
          })}
        </div>
        <label className="adm-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" placeholder="Search names, ids or answers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      {data && !data.queueOnline ? (
        <p className="adm-error">
          The bot isn&apos;t picking up website decisions right now. Make sure the updated <code>moderation/events/member_join.py</code> is uploaded and the bot is running. Decisions you make will run once it&apos;s back.
        </p>
      ) : null}
      {error ? <p className="adm-error">{error}</p> : null}

      <div className="ja-list">
        {data?.apps.map((app) => (
          <JoinAppCard key={app.discordId} app={app} people={data.people} queueOnline={data.queueOnline} onDone={() => void reload()} onOpenMember={onOpenMember} />
        ))}
        {data && !data.apps.length ? (
          <p className="adm-empty">{status === "pending" ? "No applications waiting. You're all caught up! 🎉" : "Nothing here."}</p>
        ) : null}
        {!data && !error ? <div className="adm-skeleton" /> : null}
      </div>
      {data && data.total > data.pageSize ? <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} /> : null}
    </div>
  );
}

/** A member's application inside their full profile: a one-line summary that opens into the full application. */
export function MemberJoinApp({ discordId, onOpenMember }: { discordId: string; onOpenMember?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const { data, reload } = useLive<{ app: JoinApp | null; people: People; queueOnline: boolean }>(`/api/admin/join-apps/${discordId}`, 15_000);
  if (!data) return <div className="adm-skeleton adm-skeleton--short" />;
  if (!data.app) return <p className="adm-empty">No join application on file.</p>;
  const app = data.app;
  return (
    <div className={`ja-member${open ? " is-open" : ""}`}>
      <div className="ja-member-summary">
        <StatusBadge status={app.status} />
        <span className="adm-muted">
          {app.submittedAt ? `Applied ${timeAgo(app.submittedAt)}` : "Applied"}
          {app.age !== null ? ` · ${app.age} years old` : ""}
        </span>
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small ja-member-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <ChevronDown size={14} aria-hidden="true" className={open ? "is-open" : undefined} /> {open ? "Hide application" : "View application"}
        </button>
      </div>
      {open ? <JoinAppCard app={app} people={data.people} queueOnline={data.queueOnline} onDone={() => void reload()} onOpenMember={onOpenMember} compact /> : null}
    </div>
  );
}
