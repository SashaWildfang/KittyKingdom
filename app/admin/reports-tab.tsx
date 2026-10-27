"use client";

// Admin → Moderation → Reports: messages members reported with right-click → Apps → Report message.
// Look at the message, see who reported it and why, check the author's history, then mark it handled
// (optionally deleting the message) or dismiss it.

import "./reports-tab.css";
import { Check, ExternalLink, MessageSquareWarning, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { PersonLink, formatDate, timeAgo, useLive, type People } from "./admin-shared";

type Report = {
  id: string;
  messageId: string;
  jump: string | null;
  authorId: string;
  authorName: string;
  content: string;
  attachments: string[];
  messageAt: string | null;
  reporters: { id: string; name: string; reason: string; at: string }[];
  count: number;
  status: "open" | "handled" | "dismissed";
  createdAt: string;
  lastReportAt: string;
  outcome: { by: string; byName: string; at: string; note: string; messageDeleted: boolean } | null;
};
type Status = "open" | "handled" | "dismissed" | "all";

export function ReportsTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [status, setStatus] = useState<Status>("open");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useLive<{ reports: Report[]; total: number; pageSize: number; counts: Record<string, number>; people: People }>(`/api/admin/reports?status=${status}&page=${page}`, 20_000);
  const counts = data?.counts ?? {};
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="rp">
      <header className="rp-head">
        <div>
          <h2>
            <MessageSquareWarning size={20} aria-hidden="true" /> Reports
          </h2>
          <p className="adm-muted">Messages members reported in Discord (right-click a message → Apps → Report message). Reporters stay anonymous to the person they reported.</p>
        </div>
        <div className="rp-tabs" role="tablist" aria-label="Show">
          {(
            [
              ["open", "Open"],
              ["handled", "Handled"],
              ["dismissed", "Dismissed"],
              ["all", "All"],
            ] as [Status, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={status === k} className={status === k ? "is-on" : undefined} onClick={() => (setStatus(k), setPage(1))}>
              {l} <small>{k === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[k] ?? 0}</small>
            </button>
          ))}
        </div>
      </header>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data && loading ? <div className="adm-skeleton" style={{ height: 220 }} /> : null}
      {data && !data.reports.length ? <p className="adm-empty">{status === "open" ? "No open reports. 🎉" : "Nothing here."}</p> : null}
      <ul className="rp-list">
        {data?.reports.map((r) => (
          <ReportCard key={r.id} r={r} people={data.people} onOpenMember={onOpenMember} onDone={reload} />
        ))}
      </ul>
      {pages > 1 ? (
        <div className="rp-pages">
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Newer
          </button>
          <span className="adm-muted">
            Page {page} of {pages}
          </span>
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Older
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReportCard({ r, people, onOpenMember, onDone }: { r: Report; people: People; onOpenMember: (id: string) => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [history, setHistory] = useState<Report[] | null>(null);

  async function resolve(status: "handled" | "dismissed" | "open") {
    setBusy(true);
    setProblem(null);
    const res = await fetch("/api/admin/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status, note, deleteMessage: status === "handled" && del }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!res?.ok) return setProblem(res?.error ?? "That didn't work.");
    onDone();
  }
  async function loadHistory() {
    const res = await fetch(`/api/admin/reports?about=${r.authorId}&except=${r.id}`, { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    setHistory(res?.reports ?? []);
  }

  return (
    <li className={`rp-card is-${r.status}${r.count >= 3 ? " is-hot" : ""}`}>
      <div className="rp-card-head">
        <PersonLink id={r.authorId} people={people} onOpen={onOpenMember} />
        <span className="adm-tag">{r.count === 1 ? "1 report" : `${r.count} reports`}</span>
        <span className="adm-muted" title={formatDate(r.lastReportAt)}>
          {timeAgo(r.lastReportAt)}
        </span>
        {r.jump ? (
          <a className="adm-btn adm-btn--ghost adm-btn--tiny rp-jump" href={r.jump} target="_blank" rel="noreferrer">
            <ExternalLink size={12} aria-hidden="true" /> Open in Discord
          </a>
        ) : null}
      </div>
      <blockquote className="rp-msg">
        {r.content || <i className="adm-muted">No text</i>}
        {r.attachments.length ? (
          <span className="rp-files">
            {r.attachments.map((a, i) => (
              <a key={i} href={a} target="_blank" rel="noreferrer">
                Attachment {i + 1}
              </a>
            ))}
          </span>
        ) : null}
        {r.messageAt ? <small className="adm-muted">Sent {formatDate(r.messageAt)}</small> : null}
      </blockquote>
      <ul className="rp-reporters">
        {r.reporters.map((x) => (
          <li key={x.id + x.at}>
            <PersonLink id={x.id} people={people} onOpen={onOpenMember} compact />
            <span>“{x.reason}”</span>
            <small className="adm-muted">{timeAgo(x.at)}</small>
          </li>
        ))}
      </ul>
      {history === null ? (
        <button type="button" className="adm-link rp-hist-btn" onClick={() => void loadHistory()}>
          Other reports about {people[r.authorId]?.name ?? r.authorName} →
        </button>
      ) : history.length ? (
        <ul className="rp-hist">
          {history.map((h) => (
            <li key={h.id}>
              <span className={`rp-dot is-${h.status}`} aria-hidden="true" /> {timeAgo(h.createdAt)} · {h.count} report{h.count === 1 ? "" : "s"} · {h.status}
              {h.outcome?.note ? ` · ${h.outcome.note}` : ""} <span className="adm-muted">“{h.content.slice(0, 80)}”</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-muted rp-hist-none">No other reports about them.</p>
      )}

      {r.status === "open" ? (
        <div className="rp-actions">
          <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="What did you do? (e.g. warned them, talked it out)" aria-label="Outcome note" />
          <label className="rp-del">
            <input type="checkbox" checked={del} onChange={(e) => setDel(e.target.checked)} /> Delete the message
          </label>
          <div className="rp-btns">
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy} onClick={() => void resolve("dismissed")}>
              <X size={13} aria-hidden="true" /> Dismiss
            </button>
            <button type="button" className="adm-btn adm-btn--small" disabled={busy} onClick={() => void resolve("handled")}>
              {del ? <Trash2 size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />} {del ? "Delete & mark handled" : "Mark handled"}
            </button>
          </div>
          <small className="adm-muted">To warn, mute or ban, open their profile or use the commands in Discord. Then mark this handled.</small>
        </div>
      ) : (
        <div className="rp-outcome">
          <span>
            <b>{r.status === "handled" ? "Handled" : "Dismissed"}</b> by {r.outcome?.byName ?? "staff"}
            {r.outcome?.at ? ` · ${timeAgo(r.outcome.at)}` : ""}
            {r.outcome?.messageDeleted ? " · message deleted" : ""}
          </span>
          {r.outcome?.note ? <p>{r.outcome.note}</p> : null}
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" disabled={busy} onClick={() => void resolve("open")}>
            <RotateCcw size={12} aria-hidden="true" /> Reopen
          </button>
        </div>
      )}
      {problem ? <p className="adm-error">{problem}</p> : null}
    </li>
  );
}
