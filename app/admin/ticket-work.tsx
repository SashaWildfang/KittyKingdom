"use client";

// Admin → Tickets: private notes and assigning on a live ticket, the saved replies used by /reply, and
// how fast staff answer and close tickets.

import "./ticket-work.css";
import {
  Clock3,
  MessageSquareReply,
  NotebookPen,
  Pencil,
  Plus,
  Timer,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  PersonLink,
  formatDate,
  prettyAction,
  timeAgo,
  useLive,
  type People,
} from "./admin-shared";

const post = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Couldn't reach the server." }));

type Work = {
  notes: { id: string; text: string; by: string; byName: string; at: string }[];
  assignment: {
    to: string;
    toName: string;
    byName: string;
    status: string;
    error: string | null;
    at: string | null;
  } | null;
  staff: { id: string; name: string; role: string; status: string | null }[];
  people: People;
  me: string;
  isAdmin: boolean;
};

/** Notes and Assign for one open ticket (shown with its live view). */
export function TicketWorkPanel({
  ticketKey,
  type,
  claimedBy,
  onOpenMember,
}: {
  ticketKey: string;
  type: string;
  claimedBy: string | null;
  onOpenMember: (id: string) => void;
}) {
  const url = `/api/admin/tickets/work/${ticketKey}${/nsfw/i.test(type) ? "?adult=1" : ""}`;
  const { data, reload } = useLive<Work>(url, 8_000);
  const [text, setText] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const base = `/api/admin/tickets/work/${ticketKey}`;

  async function run(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setProblem(null);
    const r = await post(base, body);
    setBusy(false);
    if (!r?.ok) return setProblem(r?.error ?? "That didn't work.");
    after?.();
    reload();
  }

  const a = data?.assignment;
  const assignee = a && a.status !== "failed" ? a : null;

  return (
    <div className="tw-panel">
      {data?.isAdmin ? (
        <div className="tw-assign">
          <UserPlus size={15} aria-hidden="true" />
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Assign to"
            disabled={!data || busy}
          >
            <option value="">
              {claimedBy ? "Reassign to…" : "Assign to…"}
            </option>
            {data?.staff.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === claimedBy}>
                {s.name} · {s.role}
                {s.status && s.status !== "offline" ? " ●" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="adm-btn adm-btn--small"
            disabled={!to || busy}
            onClick={() => void run({ op: "assign", to }, () => setTo(""))}
          >
            Assign
          </button>
          {assignee ? (
            <small className="adm-muted">
              {assignee.status === "done"
                ? `Assigned to ${assignee.toName}`
                : `Assigning to ${assignee.toName}…`}{" "}
              by {assignee.byName}
              {assignee.at ? ` · ${timeAgo(assignee.at)}` : ""}
            </small>
          ) : a?.status === "failed" ? (
            <small className="adm-error">
              Couldn&apos;t assign to {a.toName}:{" "}
              {a.error ?? "the Ticket Bot didn't manage it"}
            </small>
          ) : (
            <small className="adm-muted">
              The Ticket Bot claims it for them and pings them in the ticket.
            </small>
          )}
        </div>
      ) : null}

      <div className="tw-notes">
        <b>
          <NotebookPen size={14} aria-hidden="true" /> Staff notes{" "}
          <small className="adm-muted">
            only staff see these, never the member
          </small>
        </b>
        {data?.notes.length ? (
          <ul>
            {data.notes.map((n) => (
              <li key={n.id}>
                <p>{n.text}</p>
                <span className="tw-note-meta">
                  <PersonLink
                    id={n.by}
                    people={data.people}
                    onOpen={onOpenMember}
                    compact
                  />
                  <span className="adm-muted" title={formatDate(n.at)}>
                    {timeAgo(n.at)}
                  </span>
                  {n.by === data.me || data.isAdmin ? (
                    <button
                      type="button"
                      aria-label="Delete note"
                      title="Delete"
                      disabled={busy}
                      onClick={() =>
                        window.confirm("Delete this note?") &&
                        void run({ op: "delete-note", id: n.id })
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run({ op: "note", text }, () => setText(""));
          }}
        >
          <input
            value={text}
            maxLength={1500}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a note for whoever picks this up next…"
            aria-label="New ticket note"
          />
          <button
            type="submit"
            className="adm-btn adm-btn--small"
            disabled={busy || !text.trim()}
          >
            Add
          </button>
        </form>
      </div>
      {problem ? <p className="adm-error">{problem}</p> : null}
    </div>
  );
}

type Template = {
  id: string;
  name: string;
  text: string;
  types: string[];
  uses: number;
  lastUsedAt: string | null;
};
const TYPES = [
  "support",
  "nsfw",
  "staff-application",
  "report",
  "partnership",
  "manual",
];
const typeName = (t: string) =>
  prettyAction(t.replace(/-/g, " ")).replace(/^Nsfw$/, "18+ verification");

/** The saved replies staff post with /reply in a ticket. Admins write them. */
export function SavedReplies({ onClose }: { onClose: () => void }) {
  const { data, reload } = useLive<{ templates: Template[]; canEdit: boolean }>(
    "/api/admin/reply-templates",
    60_000,
  );
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function save() {
    if (!editing) return;
    setBusy(true);
    setProblem(null);
    const r = await post("/api/admin/reply-templates", {
      op: "save",
      id: editing.id,
      name: editing.name,
      text: editing.text,
      types: editing.types ?? [],
    });
    setBusy(false);
    if (!r?.ok) return setProblem(r?.error ?? "Couldn't save that.");
    setEditing(null);
    reload();
  }
  async function remove(t: Template) {
    if (!window.confirm(`Delete the saved reply “${t.name}”?`)) return;
    const r = await post("/api/admin/reply-templates", {
      op: "delete",
      id: t.id,
    });
    if (!r?.ok) setProblem(r?.error ?? "Couldn't delete that.");
    reload();
  }

  return (
    <section className="tw-replies" aria-label="Saved replies">
      <header>
        <h3>
          <MessageSquareReply size={17} aria-hidden="true" /> Saved replies
        </h3>
        <p className="adm-muted">
          Staff post these in a ticket with <code>/reply</code>. Use{" "}
          <code>{"{member}"}</code> for the person who opened it,{" "}
          <code>{"{staff}"}</code> for you and <code>{"{ticket}"}</code> for the
          ticket number.
        </p>
        <button
          type="button"
          className="adm-btn adm-btn--ghost adm-btn--small tw-close"
          onClick={onClose}
          aria-label="Close saved replies"
        >
          <X size={14} />
        </button>
      </header>
      {data?.canEdit && !editing ? (
        <button
          type="button"
          className="adm-btn adm-btn--small"
          onClick={() => setEditing({ name: "", text: "", types: [] })}
        >
          <Plus size={14} aria-hidden="true" /> New saved reply
        </button>
      ) : null}
      {editing ? (
        <form
          className="tw-edit"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            Name{" "}
            <small className="adm-muted">(what staff pick in /reply)</small>
            <input
              value={editing.name ?? ""}
              maxLength={80}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. Need a clearer ID photo"
              autoFocus
            />
          </label>
          <label>
            Reply
            <textarea
              value={editing.text ?? ""}
              maxLength={1900}
              rows={5}
              onChange={(e) => setEditing({ ...editing, text: e.target.value })}
              placeholder="Hi {member}! …"
            />
            <small className="adm-muted">
              {(editing.text ?? "").length}/1900
            </small>
          </label>
          <fieldset>
            <legend>Show it for</legend>
            <div className="tw-types">
              {TYPES.map((t) => {
                const on = (editing.types ?? []).includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    className={on ? "is-on" : undefined}
                    aria-pressed={on}
                    onClick={() =>
                      setEditing({
                        ...editing,
                        types: on
                          ? (editing.types ?? []).filter((x) => x !== t)
                          : [...(editing.types ?? []), t],
                      })
                    }
                  >
                    {typeName(t)}
                  </button>
                );
              })}
            </div>
            <small className="adm-muted">
              {editing.types?.length
                ? "Only offered in these kinds of tickets."
                : "Nothing picked: offered in every ticket."}
            </small>
          </fieldset>
          <div className="tw-edit-row">
            <button
              type="button"
              className="adm-btn adm-btn--ghost adm-btn--small"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="adm-btn adm-btn--small"
              disabled={busy || !editing.name?.trim() || !editing.text?.trim()}
            >
              Save
            </button>
          </div>
        </form>
      ) : null}
      {problem ? <p className="adm-error">{problem}</p> : null}
      {!data ? <p className="adm-muted">Loading…</p> : null}
      {data && !data.templates.length && !editing ? (
        <p className="adm-empty">No saved replies yet.</p>
      ) : null}
      <ul className="tw-list">
        {data?.templates.map((t) => (
          <li key={t.id}>
            <div className="tw-list-head">
              <b>{t.name}</b>
              <span className="adm-muted">
                used {t.uses}×{" "}
                {t.lastUsedAt ? `· last ${timeAgo(t.lastUsedAt)}` : ""}
              </span>
              {data.canEdit ? (
                <span className="tw-list-actions">
                  <button
                    type="button"
                    aria-label={`Edit ${t.name}`}
                    onClick={() => setEditing(t)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${t.name}`}
                    onClick={() => void remove(t)}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              ) : null}
            </div>
            <p>{t.text}</p>
            {t.types.length ? (
              <small className="adm-muted">
                Only in: {t.types.map(typeName).join(", ")}
              </small>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

type Stats = {
  days: number;
  tracked: number;
  firstReply: {
    median: number | null;
    within1h: number | null;
    noReply: number;
  };
  close: { median: number | null };
  byType: {
    type: string;
    count: number;
    firstReply: number | null;
    close: number | null;
  }[];
  byStaff: {
    id: string;
    firstReplies: number;
    median: number | null;
    closed: number;
  }[];
  since: string | null;
};

const dur = (m: number | null) =>
  m === null
    ? "—"
    : m < 1
      ? "<1m"
      : m < 60
        ? `${Math.round(m)}m`
        : m < 48 * 60
          ? `${(m / 60).toFixed(m < 600 ? 1 : 0)}h`
          : `${Math.round(m / 1440)}d`;

/** How fast tickets get a first staff reply and get closed. */
export function ResponseTimes({
  onOpenMember,
}: {
  onOpenMember: (id: string) => void;
}) {
  const [days, setDays] = useState(30);
  const [open, setOpen] = useState(false);
  const { data, error } = useLive<{ stats: Stats; people: People }>(
    `/api/admin/tickets/response-stats?days=${days}`,
    120_000,
  );
  const s = data?.stats;
  return (
    <section className="tw-stats" aria-label="Response times">
      <header>
        <h3>
          <Timer size={16} aria-hidden="true" /> Response times
        </h3>
        <div className="tw-range" role="group" aria-label="Period">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              className={days === d ? "is-on" : undefined}
              aria-pressed={days === d}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </header>
      {error ? <p className="adm-error">{error}</p> : null}
      <div className="tw-kpis">
        <div>
          <b>{s ? dur(s.firstReply.median) : "…"}</b>
          <span>typical first reply</span>
        </div>
        <div>
          <b>
            {s?.firstReply.within1h != null
              ? `${Math.round(s.firstReply.within1h * 100)}%`
              : s
                ? "—"
                : "…"}
          </b>
          <span>answered within an hour</span>
        </div>
        <div>
          <b>{s ? dur(s.close.median) : "…"}</b>
          <span>typical time to close</span>
        </div>
        <div>
          <b>{s ? s.firstReply.noReply : "…"}</b>
          <span>closed with no staff reply</span>
        </div>
      </div>
      {s && !s.since ? (
        <p className="adm-muted tw-note">
          <Clock3 size={13} aria-hidden="true" /> First-reply times start once
          the updated Ticket Bot is running. Time to close works for every
          ticket already.
        </p>
      ) : s?.since ? (
        <p className="adm-muted tw-note">
          First-reply times are recorded from {formatDate(s.since)}. Tickets
          staff opened themselves aren&apos;t counted.
        </p>
      ) : null}
      {s && (s.byStaff.length || s.byType.length) ? (
        <button
          type="button"
          className="adm-link"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "Hide the breakdown" : "By staff member and ticket type →"}
        </button>
      ) : null}
      {open && s ? (
        <div className="tw-break">
          {s.byStaff.length ? (
            <table>
              <caption>By staff member</caption>
              <thead>
                <tr>
                  <th scope="col">Staff</th>
                  <th scope="col">First replies</th>
                  <th scope="col">Typical reply</th>
                  <th scope="col">Closed</th>
                </tr>
              </thead>
              <tbody>
                {s.byStaff.slice(0, 15).map((r) => (
                  <tr key={r.id}>
                    <td>
                      <PersonLink
                        id={r.id}
                        people={data!.people}
                        onOpen={onOpenMember}
                        compact
                      />
                    </td>
                    <td>{r.firstReplies}</td>
                    <td>{dur(r.median)}</td>
                    <td>{r.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <table>
            <caption>By ticket type</caption>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Tickets</th>
                <th scope="col">Typical reply</th>
                <th scope="col">Typical close</th>
              </tr>
            </thead>
            <tbody>
              {s.byType.map((r) => (
                <tr key={r.type}>
                  <td>{typeName(r.type)}</td>
                  <td>{r.count}</td>
                  <td>{dur(r.firstReply)}</td>
                  <td>{dur(r.close)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
