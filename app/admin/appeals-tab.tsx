"use client";

import { Check, Clock, Gavel, History, Mail, MailX, MessageSquareText, Send, ShieldOff, X } from "lucide-react";
import { useState } from "react";
import type { AdminAppeal } from "../../lib/appeals";
import { ActionBadge, Avatar, Pager, formatDate, timeAgo, useLive } from "./admin-shared";

type ListResult = { rows: AdminAppeal[]; total: number; page: number; counts: Record<string, number> };

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "denied", label: "Denied" },
  { key: "all", label: "All" },
];

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "pending" },
  accepted: { label: "Accepted", tone: "ok" },
  denied: { label: "Denied", tone: "bad" },
};

const HISTORY_LABEL: Record<string, string> = {
  submitted: "Appeal submitted",
  accepted: "Accepted",
  denied: "Denied",
  lifted: "Discord ban",
  note: "Note",
};

/** Accept / deny with a reply (emailed to them if they left an address). */
function Decide({ appeal, onDone }: { appeal: AdminAppeal; onDone: () => void }) {
  const [mode, setMode] = useState<"idle" | "accept" | "deny">("idle");
  const [response, setResponse] = useState("");
  const [lift, setLift] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBan = appeal.punishment.action === "ban";

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/appeals/${appeal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: mode, response, liftBan: mode === "accept" && isBan && appeal.stillBanned && lift }),
      });
      const body = await res.json().catch(() => ({ ok: false, error: "That didn't work." }));
      if (!res.ok || !body.ok) {
        setError(body.error ?? "That didn't work.");
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  if (mode === "idle") {
    return (
      <div className="ja-buttons">
        <button type="button" className="ja-btn ja-btn--accept" onClick={() => setMode("accept")}>
          <Check size={15} aria-hidden="true" /> Accept
        </button>
        <button type="button" className="ja-btn ja-btn--ban" onClick={() => setMode("deny")}>
          <X size={15} aria-hidden="true" /> Deny
        </button>
      </div>
    );
  }
  return (
    <div className={`ja-confirm${mode === "deny" ? " ja-confirm--ban" : ""}`}>
      <label>
        <span>
          Reply to {appeal.name}
          {appeal.hasEmail ? " (emailed to them)" : " (saved here; they didn't leave an email)"}
        </span>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          maxLength={2000}
          rows={4}
          autoFocus
          placeholder={mode === "accept" ? "e.g. Thanks for explaining. We've lifted the ban; please re-read the rules before rejoining." : "e.g. We reviewed the logs and the ban stands. You can appeal again in 30 days."}
        />
      </label>
      {mode === "accept" && isBan && appeal.stillBanned ? (
        <label className="ap-check">
          <input type="checkbox" checked={lift} onChange={(e) => setLift(e.target.checked)} />
          <span>Also lift their ban in Discord now</span>
        </label>
      ) : null}
      <div className="ja-buttons">
        <button type="button" className={`ja-btn ${mode === "accept" ? "ja-btn--accept" : "ja-btn--ban"}`} disabled={busy || (mode === "deny" && response.trim().length < 3)} onClick={() => void send()}>
          <Send size={14} aria-hidden="true" /> {busy ? "Saving…" : mode === "accept" ? "Accept appeal" : "Deny appeal"}
        </button>
        <button type="button" className="ja-btn" onClick={() => setMode("idle")}>
          Cancel
        </button>
      </div>
      {mode === "deny" ? <small className="adm-muted">A reply is required when denying. They can appeal again in 30 days.</small> : null}
      {error ? <p className="ja-result is-bad">{error}</p> : null}
    </div>
  );
}

function AppealCard({ appeal, onDone, onOpenMember }: { appeal: AdminAppeal; onDone: () => void; onOpenMember: (id: string) => void }) {
  const s = STATUS[appeal.status] ?? STATUS.pending;
  const person = { name: appeal.name, username: appeal.username, avatar: appeal.avatar, inServer: false };
  return (
    <article className={`ja-card ap-card ja-card--${appeal.status === "accepted" ? "approved" : appeal.status}`}>
      <header className="ja-head">
        <button type="button" className="ja-who" onClick={() => onOpenMember(appeal.discordId)} title="Open their full profile">
          <Avatar person={person} id={appeal.discordId} size={46} />
          <span>
            <strong>{appeal.name}</strong>
            <small>
              @{appeal.username} · {appeal.discordId}
            </small>
          </span>
        </button>
        <span className="ap-head-right">
          <code className="ap-ref">{appeal.reference}</code>
          <span className={`ja-status ja-status--${s.tone}`}>{s.label}</span>
        </span>
      </header>

      <div className="ap-cols">
        <div className="ap-main">
          <div className="ja-facts">
            <span title={formatDate(appeal.createdAt)}>
              <Clock size={13} aria-hidden="true" /> Appealed {timeAgo(appeal.createdAt)}
            </span>
            <span>{appeal.hasEmail ? <Mail size={13} aria-hidden="true" /> : <MailX size={13} aria-hidden="true" />} {appeal.hasEmail ? "Wants an email reply" : "No email"}</span>
            {appeal.punishment.action === "ban" ? <span className={appeal.stillBanned ? "is-bad" : undefined}>{appeal.stillBanned ? "Still banned" : "Not banned now"}</span> : null}
            {appeal.otherAppeals ? <span className="is-warn">{appeal.otherAppeals} other appeal{appeal.otherAppeals === 1 ? "" : "s"}</span> : null}
          </div>
          <dl className="ja-answers">
            <div className="ja-wide">
              <dt>
                <Gavel size={13} aria-hidden="true" /> Punishment
              </dt>
              <dd>
                <span className="ap-pun">
                  <ActionBadge action={appeal.punishment.action} />
                  <span className="adm-muted">{appeal.punishment.at ? formatDate(appeal.punishment.at) : "Date unknown"}</span>
                </span>
                {appeal.punishment.reason || "No reason recorded"}
              </dd>
            </div>
            <div className="ja-wide">
              <dt>
                <MessageSquareText size={13} aria-hidden="true" /> Their appeal
              </dt>
              <dd>{appeal.message}</dd>
            </div>
          </dl>
        </div>

        <aside className="ap-side">
          <h4>
            <History size={14} aria-hidden="true" /> History
          </h4>
          <ol className="ap-history">
            {appeal.history.map((h, i) => (
              <li key={i} className={`ap-h ap-h--${h.action}`}>
                <strong>
                  {HISTORY_LABEL[h.action] ?? h.action}
                  {h.byName ? <span className="adm-muted"> · {h.byName}</span> : null}
                </strong>
                <small title={formatDate(h.at)}>{timeAgo(h.at)}</small>
                {h.note ? <p>{h.note}</p> : null}
              </li>
            ))}
          </ol>
          {appeal.status === "pending" ? <Decide appeal={appeal} onDone={onDone} /> : null}
          {appeal.status !== "pending" && appeal.punishment.action === "ban" && appeal.stillBanned && appeal.status === "accepted" ? (
            <p className="ja-result is-bad">
              <ShieldOff size={14} aria-hidden="true" /> Accepted, but they're still banned in Discord.
            </p>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

/** Admin → Moderation → Appeals: punishment appeals sent from kittykingdom.net/appeals (admins only). */
export function AppealsTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLive<ListResult>(`/api/admin/appeals?status=${status}&page=${page}`, 15_000);
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
      </div>
      {error ? <p className="adm-error">{error}</p> : null}
      <div className="ja-list">
        {data?.rows.map((a) => (
          <AppealCard key={a.id} appeal={a} onDone={() => void reload()} onOpenMember={onOpenMember} />
        ))}
        {data && !data.rows.length ? <p className="adm-empty">{status === "pending" ? "No appeals waiting. You're all caught up!" : "Nothing here."}</p> : null}
        {!data && !error ? <div className="adm-skeleton" /> : null}
      </div>
      {data && data.total > 20 ? <Pager page={page} total={data.total} pageSize={20} onPage={setPage} /> : null}
    </div>
  );
}
