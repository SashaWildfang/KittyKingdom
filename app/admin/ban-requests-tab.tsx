"use client";

import "./ban-requests.css";
import { Ban, Check, Clock, Gavel, Inbox, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { BanRequest } from "../../lib/ban-requests";
import { formatDate, timeAgo, useLive } from "./admin-shared";

type Data = { requests: BanRequest[]; pending: number; canReview: boolean; me: string };

const STATUS: Record<BanRequest["status"], { label: string; tone: string }> = {
  pending: { label: "Waiting for a Mod+", tone: "warn" },
  approved: { label: "Approved, banning…", tone: "busy" },
  executing: { label: "Approved, banning…", tone: "busy" },
  executed: { label: "Banned", tone: "bad" },
  denied: { label: "Denied", tone: "muted" },
  failed: { label: "Approved, ban failed", tone: "bad" },
  cancelled: { label: "Closed", tone: "muted" },
};

function Avatar({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="br-avatar" src={src} alt="" onError={() => setFailed(true)} />
  ) : (
    <span className="br-avatar is-letter">{name.charAt(0).toUpperCase()}</span>
  );
}

/** Approve (type CONFIRM) or deny (with a reason) one request. */
function Decide({ req, mode, onClose, onDone }: { req: BanRequest; mode: "approve" | "deny"; onClose: () => void; onDone: (msg: string) => void }) {
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/ban-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: req.id, decision: mode, note, confirm }) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "That didn't work. Try again." }));
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "That didn't work.");
    onDone(mode === "approve" ? `Approved. The bot is banning ${req.user.name} now.` : `Denied. ${req.requester.name} has been told why.`);
  };

  const ready = mode === "approve" ? confirm.trim() === "CONFIRM" : note.trim().length > 2;
  return (
    <div className="br-modal" role="dialog" aria-modal="true" aria-labelledby="br-modal-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="br-modal-card">
        <h2 id="br-modal-title">{mode === "approve" ? "Approve this ban?" : "Deny this ban request?"}</h2>
        <dl className="br-facts">
          <div>
            <dt>Member</dt>
            <dd>
              <b>{req.user.name}</b> <code>{req.user.id}</code>
            </dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{req.reason || "No reason given"}</dd>
          </div>
          <div>
            <dt>Appealable</dt>
            <dd>{req.appealable ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Requested by</dt>
            <dd>
              {req.requester.name} · {timeAgo(req.createdAt)}
            </dd>
          </div>
        </dl>
        {mode === "approve" ? (
          <>
            <p className="br-warn">
              This is a <b>permanent ban</b>. {req.user.name} gets a DM with the reason{req.appealable ? " and how to appeal" : ""}, and their website account is closed. Check everything above is right.
            </p>
            <label className="br-field">
              <span>Type CONFIRM to approve</span>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="CONFIRM" autoFocus autoComplete="off" spellCheck={false} />
            </label>
            <label className="br-field">
              <span>Note (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to add for the requester" maxLength={500} />
            </label>
          </>
        ) : (
          <label className="br-field">
            <span>Why are you denying it? (the requester sees this)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} autoFocus />
          </label>
        )}
        {error ? <p className="br-error">{error}</p> : null}
        <div className="br-actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`br-go is-${mode}`} onClick={submit} disabled={!ready || busy}>
            {busy ? <Loader2 size={15} className="br-spin" aria-hidden="true" /> : mode === "approve" ? <Gavel size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
            {mode === "approve" ? "Approve & ban" : "Deny request"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Admin panel → Ban Requests: bans Jr Mods asked for, waiting for a Mod+. */
export function BanRequestsTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const live = useLive<Data>(`/api/admin/ban-requests?filter=${filter}`, 10_000);
  const [deciding, setDeciding] = useState<{ req: BanRequest; mode: "approve" | "deny" } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const data = live.data;

  return (
    <section className="br">
      <header className="br-head">
        <div>
          <h2>
            <Gavel size={20} aria-hidden="true" /> Ban requests
          </h2>
          <p>
            Jr Mods can&apos;t ban on their own: <code>/ban</code> sends a request here (and to the staff alerts channel in Discord). A Mod or higher approves it, and the bot bans, or denies it with a reason.
          </p>
        </div>
        <div className="br-filter" role="tablist">
          <button type="button" className={filter === "pending" ? "is-on" : ""} onClick={() => setFilter("pending")}>
            Waiting {data?.pending ? <span className="br-count">{data.pending}</span> : null}
          </button>
          <button type="button" className={filter === "all" ? "is-on" : ""} onClick={() => setFilter("all")}>
            All
          </button>
        </div>
      </header>

      {data && !data.canReview ? <p className="br-note">Only Mods and up can approve or deny. You can see where requests stand here.</p> : null}
      {flash ? (
        <p className="br-flash" role="status">
          <Check size={15} aria-hidden="true" /> {flash}
        </p>
      ) : null}
      {live.error ? <p className="adm-error">{live.error}</p> : null}

      {!data ? (
        <div className="br-loading" aria-busy="true" />
      ) : !data.requests.length ? (
        <div className="br-empty">
          <Inbox size={28} aria-hidden="true" />
          <p>{filter === "pending" ? "No ban requests waiting." : "No ban requests yet."}</p>
        </div>
      ) : (
        <ul className="br-list">
          {data.requests.map((r) => {
            const s = STATUS[r.status];
            const pending = r.status === "pending";
            const mine = r.requester.id === data.me;
            return (
              <li key={r.id} className={`br-item is-${s.tone}`}>
                <div className="br-who">
                  <Avatar src={r.user.avatar} name={r.user.name} />
                  <span>
                    <button type="button" className="br-name" onClick={() => onOpenMember(r.user.id)}>
                      {r.user.name}
                    </button>
                    <code>{r.user.id}</code>
                  </span>
                  <span className={`br-status is-${s.tone}`}>
                    {r.status === "pending" ? <Clock size={13} aria-hidden="true" /> : r.status === "executed" ? <Ban size={13} aria-hidden="true" /> : null} {s.label}
                  </span>
                </div>
                <p className="br-reason">{r.reason || "No reason given"}</p>
                <p className="br-meta">
                  Requested by <b>{r.requester.name}</b> · <span title={formatDate(r.createdAt)}>{timeAgo(r.createdAt)}</span> · Appealable: {r.appealable ? "Yes" : "No"}
                  {r.reviewer ? (
                    <>
                      {" "}
                      · {r.status === "denied" ? "Denied" : "Reviewed"} by <b>{r.reviewer.name}</b>
                      {r.reviewedVia === "discord" ? " in Discord" : r.reviewedVia === "website" ? " here" : ""}
                    </>
                  ) : null}
                </p>
                {r.reviewNote ? <p className="br-review-note">“{r.reviewNote}”</p> : null}
                {r.result && r.status !== "executed" ? <p className="br-review-note">{r.result}</p> : null}
                {pending && r.alreadyBanned ? <p className="br-warn">They&apos;re already banned. Approving will just close this request.</p> : null}
                {pending && data.canReview ? (
                  mine ? (
                    <p className="br-note">This is your own request: another Mod+ has to review it.</p>
                  ) : (
                    <div className="br-actions">
                      <button type="button" className="br-go is-deny" onClick={() => setDeciding({ req: r, mode: "deny" })}>
                        <X size={15} aria-hidden="true" /> Deny
                      </button>
                      <button type="button" className="br-go is-approve" onClick={() => setDeciding({ req: r, mode: "approve" })}>
                        <Gavel size={15} aria-hidden="true" /> Approve & ban
                      </button>
                    </div>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {deciding ? (
        <Decide
          req={deciding.req}
          mode={deciding.mode}
          onClose={() => setDeciding(null)}
          onDone={(msg) => {
            setDeciding(null);
            setFlash(msg);
            void live.reload();
            setTimeout(() => setFlash(null), 6000);
          }}
        />
      ) : null}
    </section>
  );
}
