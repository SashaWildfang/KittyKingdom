"use client";

// Admin → Team: staff activity (with time in rank and promotion flags), the staff applications pipeline, and
// the shared task list.

import "./team.css";
import { ArrowUpCircle, CalendarClock, Check, ClipboardList, FileText, HeartHandshake, ListTodo, Plus, ThumbsDown, ThumbsUp, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { PersonLink, formatDate, timeAgo, useLive, type People } from "./admin-shared";

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Couldn't reach the server." }));

const since = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days < 1 ? "today" : days < 60 ? `${days} day${days === 1 ? "" : "s"}` : `${Math.round(days / 30)} months`;
};

// ── Staff activity + promotions ──────────────────────────────────────────────

type Row = {
  id: string;
  name: string;
  role: string;
  rank: number;
  status: string | null;
  lastOnline: string | null;
  messages: number;
  ticketsClaimed: number;
  ticketsClosed: number;
  firstReplies: number;
  punishments: number;
  joinApps: number;
  reports: number;
  websiteLastSeen: string | null;
  score: number;
  rankSince: string | null;
  rankKnown: boolean;
  previousRole: string | null;
  review: { flag: string | null; note: string; byName: string; at: string } | null;
};

export function StaffActivityTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [days, setDays] = useState(30);
  const [sort, setSort] = useState<"rank" | "score" | "quiet">("rank");
  const { data, error, loading, reload } = useLive<{ rows: Row[]; people: People }>(`/api/admin/staff-activity?days=${days}`, 120_000);
  const [flagging, setFlagging] = useState<{ id: string; flag: string; note: string } | null>(null);
  const rows = [...(data?.rows ?? [])].sort((a, b) => (sort === "score" ? b.score - a.score : sort === "quiet" ? a.score - b.score : a.rank - b.rank || b.score - a.score));
  const median = (() => {
    const s = (data?.rows ?? []).map((r) => r.score).sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  })();

  async function saveFlag(id: string, flag: string | null, note = "") {
    const r = await post("/api/admin/staff-activity", { discordId: id, flag, note });
    if (r?.ok) {
      setFlagging(null);
      reload();
    }
  }

  return (
    <div className="tm">
      <header className="tm-head">
        <div>
          <h2>
            <UsersRound size={20} aria-hidden="true" /> Staff activity
          </h2>
          <p className="adm-muted">What each staff member has handled, how long they&apos;ve held their rank, and who&apos;s up for a promotion conversation or could use some support. Numbers are a guide, not a grade: some work (DMs, voice, events) doesn&apos;t show up here.</p>
        </div>
        <div className="tm-controls">
          <div className="tm-seg" role="group" aria-label="Period">
            {[7, 30, 90].map((d) => (
              <button key={d} type="button" className={days === d ? "is-on" : undefined} aria-pressed={days === d} onClick={() => setDays(d)}>
                {d}d
              </button>
            ))}
          </div>
          <select className="adm-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
            <option value="rank">By rank</option>
            <option value="score">Most active</option>
            <option value="quiet">Least active</option>
          </select>
        </div>
      </header>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data && loading ? <div className="adm-skeleton" style={{ height: 260 }} /> : null}
      <ul className="tm-staff">
        {rows.map((r) => {
          const quiet = r.score < median / 3;
          return (
            <li key={r.id} className={`${r.review?.flag ? `is-${r.review.flag}` : ""}${quiet ? " is-quiet" : ""}`}>
              <div className="tm-staff-head">
                <PersonLink id={r.id} people={data?.people ?? {}} onOpen={onOpenMember} />
                <span className="adm-tag">{r.role}</span>
                <span className="adm-muted tm-rank" title={r.rankSince ? formatDate(r.rankSince) : undefined}>
                  {r.rankKnown ? `${r.role} for ${since(r.rankSince)}` : "Time in rank: tracking started recently"}
                  {r.previousRole ? ` · was ${r.previousRole}` : ""}
                </span>
                <span className="tm-score" title="A rough total: tickets, replies, punishments, join apps and reports count most; chat a little">
                  {r.score}
                </span>
              </div>
              <dl className="tm-stats">
                <div>
                  <dt>Messages</dt>
                  <dd>{r.messages.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Tickets claimed</dt>
                  <dd>{r.ticketsClaimed}</dd>
                </div>
                <div>
                  <dt>Closed</dt>
                  <dd>{r.ticketsClosed}</dd>
                </div>
                <div>
                  <dt>First replies</dt>
                  <dd>{r.firstReplies}</dd>
                </div>
                <div>
                  <dt>Punishments</dt>
                  <dd>{r.punishments}</dd>
                </div>
                <div>
                  <dt>Join apps</dt>
                  <dd>{r.joinApps}</dd>
                </div>
                <div>
                  <dt>Reports</dt>
                  <dd>{r.reports}</dd>
                </div>
              </dl>
              <p className="adm-muted tm-seen">
                {r.status && r.status !== "offline" ? <b className="tm-online">● online</b> : r.lastOnline ? `Last online ${timeAgo(r.lastOnline)}` : null}
                {r.websiteLastSeen ? ` · on the website ${timeAgo(r.websiteLastSeen)}` : ""}
                {quiet ? " · quieter than usual for the team" : ""}
              </p>
              {r.review?.flag ? (
                <p className={`tm-flag is-${r.review.flag}`}>
                  {r.review.flag === "promote" ? <ArrowUpCircle size={14} aria-hidden="true" /> : <HeartHandshake size={14} aria-hidden="true" />}
                  <b>{r.review.flag === "promote" ? "Up for a promotion conversation" : "Could use some support"}</b>
                  {r.review.note ? ` · ${r.review.note}` : ""}
                  <small className="adm-muted">
                    {" "}
                    ({r.review.byName}, {timeAgo(r.review.at)})
                  </small>
                  <button type="button" className="adm-link" onClick={() => void saveFlag(r.id, null)}>
                    Clear
                  </button>
                </p>
              ) : flagging?.id === r.id ? (
                <form
                  className="tm-flag-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveFlag(r.id, flagging.flag, flagging.note);
                  }}
                >
                  <select className="adm-select" value={flagging.flag} onChange={(e) => setFlagging({ ...flagging, flag: e.target.value })} aria-label="Flag">
                    <option value="promote">Up for a promotion conversation</option>
                    <option value="support">Could use some support</option>
                  </select>
                  <input value={flagging.note} maxLength={500} onChange={(e) => setFlagging({ ...flagging, note: e.target.value })} placeholder="Why? (only admins see this)" aria-label="Note" />
                  <button type="submit" className="adm-btn adm-btn--small">
                    Save
                  </button>
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setFlagging(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <button type="button" className="adm-link tm-flag-btn" onClick={() => setFlagging({ id: r.id, flag: "promote", note: "" })}>
                  Flag for review…
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Staff applications ───────────────────────────────────────────────────────

type App = { key: string; ticketId: number; applicant: string | null; created: string | null; open: boolean; transcript: boolean; stage: string; stageAt: string | null; stageBy: string | null; votes: { yes: string[]; no: string[] }; myVote: "yes" | "no" | null };
const STAGE_LABEL: Record<string, string> = { new: "New", reviewing: "Reviewing", interview: "Interview", trial: "Trial", accepted: "Accepted", declined: "Declined" };

export function StaffAppsTab({ onOpenMember, onOpenTranscript }: { onOpenMember: (id: string) => void; onOpenTranscript: (id: number, key?: string | null) => void }) {
  const { data, error, loading, reload } = useLive<{ stages: string[]; apps: App[]; people: People }>("/api/admin/staff-apps", 30_000);
  const [problem, setProblem] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const stages = (data?.stages ?? Object.keys(STAGE_LABEL)).filter((s) => showDone || (s !== "accepted" && s !== "declined"));

  async function change(body: Record<string, unknown>) {
    setProblem(null);
    const r = await post("/api/admin/staff-apps", body);
    if (!r?.ok) setProblem(r?.error ?? "Couldn't save that.");
    reload();
  }

  return (
    <div className="tm">
      <header className="tm-head">
        <div>
          <h2>
            <ClipboardList size={20} aria-hidden="true" /> Staff applications
          </h2>
          <p className="adm-muted">Every staff-application ticket, moved through the stages. Vote, read the ticket, and move it along. Add notes in the ticket&apos;s live view or the transcript.</p>
        </div>
        <label className="tm-check">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show accepted and declined
        </label>
      </header>
      {error ? <p className="adm-error">{error}</p> : null}
      {problem ? <p className="adm-error">{problem}</p> : null}
      {!data && loading ? <div className="adm-skeleton" style={{ height: 240 }} /> : null}
      {data && !data.apps.length ? <p className="adm-empty">No staff applications in the last 4 months.</p> : null}
      {data?.apps.length ? (
        <div className="tm-board">
          {stages.map((s) => {
            const apps = data.apps.filter((a) => a.stage === s);
            return (
              <section key={s} className="tm-col" aria-label={STAGE_LABEL[s]}>
                <h3>
                  {STAGE_LABEL[s]} <small>{apps.length}</small>
                </h3>
                {apps.map((a) => (
                  <article key={a.key} className="tm-app">
                    <div className="tm-app-head">
                      {a.applicant ? <PersonLink id={a.applicant} people={data.people} onOpen={onOpenMember} compact /> : <b>Unknown</b>}
                      <small className="adm-muted">
                        #{a.ticketId} · {timeAgo(a.created)} {a.open ? "· open" : ""}
                      </small>
                    </div>
                    <div className="tm-votes">
                      <button type="button" className={a.myVote === "yes" ? "is-on" : undefined} aria-pressed={a.myVote === "yes"} onClick={() => void change({ key: a.key, vote: a.myVote === "yes" ? null : "yes" })} title={a.votes.yes.map((v) => data.people[v]?.name ?? "admin").join(", ") || "No yes votes"}>
                        <ThumbsUp size={13} aria-hidden="true" /> {a.votes.yes.length}
                      </button>
                      <button type="button" className={a.myVote === "no" ? "is-on is-no" : undefined} aria-pressed={a.myVote === "no"} onClick={() => void change({ key: a.key, vote: a.myVote === "no" ? null : "no" })} title={a.votes.no.map((v) => data.people[v]?.name ?? "admin").join(", ") || "No no votes"}>
                        <ThumbsDown size={13} aria-hidden="true" /> {a.votes.no.length}
                      </button>
                      {a.transcript ? (
                        <button type="button" onClick={() => onOpenTranscript(a.ticketId, a.key)}>
                          <FileText size={13} aria-hidden="true" /> Ticket
                        </button>
                      ) : null}
                    </div>
                    <select className="adm-select" value={a.stage} onChange={(e) => void change({ key: a.key, stage: e.target.value })} aria-label={`Stage for ticket #${a.ticketId}`}>
                      {data.stages.map((x) => (
                        <option key={x} value={x}>
                          {STAGE_LABEL[x] ?? x}
                        </option>
                      ))}
                    </select>
                    {a.stageBy ? (
                      <small className="adm-muted">
                        Moved by {a.stageBy} {timeAgo(a.stageAt)}
                      </small>
                    ) : null}
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ── Tasks ────────────────────────────────────────────────────────────────────

type Task = { id: string; title: string; details: string; assignee: string | null; due: string | null; status: "todo" | "doing" | "done"; createdBy: string; createdByName: string; createdAt: string; doneAt: string | null; doneByName: string | null };

const localInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function TasksTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [showDone, setShowDone] = useState(false);
  const [mine, setMine] = useState(false);
  const { data, error, loading, reload } = useLive<{ tasks: Task[]; staff: { id: string; name: string; role: string }[]; people: People; me: string; isAdmin: boolean }>(`/api/admin/tasks${showDone ? "?done=1" : ""}`, 30_000);
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const tasks = (data?.tasks ?? []).filter((t) => !mine || t.assignee === data?.me);

  async function run(body: Record<string, unknown>, after?: () => void) {
    setProblem(null);
    const r = await post("/api/admin/tasks", body);
    if (!r?.ok) return setProblem(r?.error ?? "That didn't work.");
    after?.();
    reload();
  }

  return (
    <div className="tm">
      <header className="tm-head">
        <div>
          <h2>
            <ListTodo size={20} aria-hidden="true" /> Tasks
          </h2>
          <p className="adm-muted">A shared to-do list for the team. Tasks assigned to you that are due soon show in your Needs attention.</p>
        </div>
        <div className="tm-controls">
          <label className="tm-check">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Just mine
          </label>
          <label className="tm-check">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done
          </label>
          <button type="button" className="adm-btn adm-btn--small" onClick={() => setEditing({ title: "", details: "", assignee: null, due: null })}>
            <Plus size={14} aria-hidden="true" /> New task
          </button>
        </div>
      </header>
      {editing ? (
        <form
          className="tm-task-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ op: "save", id: editing.id, title: editing.title, details: editing.details, assignee: editing.assignee, due: editing.due ? new Date(editing.due).toISOString() : null }, () => setEditing(null));
          }}
        >
          <input autoFocus value={editing.title ?? ""} maxLength={140} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="What needs doing?" aria-label="Task title" />
          <textarea value={editing.details ?? ""} maxLength={2000} rows={2} onChange={(e) => setEditing({ ...editing, details: e.target.value })} placeholder="Details (optional)" aria-label="Details" />
          <div className="tm-task-row">
            <select className="adm-select" value={editing.assignee ?? ""} onChange={(e) => setEditing({ ...editing, assignee: e.target.value || null })} aria-label="Assign to">
              <option value="">Anyone</option>
              {data?.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.role}
                </option>
              ))}
            </select>
            <input type="datetime-local" value={localInput(editing.due ?? null)} onChange={(e) => setEditing({ ...editing, due: e.target.value ? new Date(e.target.value).toISOString() : null })} aria-label="Due" />
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn--small" disabled={!editing.title?.trim()}>
              Save
            </button>
          </div>
        </form>
      ) : null}
      {error ? <p className="adm-error">{error}</p> : null}
      {problem ? <p className="adm-error">{problem}</p> : null}
      {!data && loading ? <div className="adm-skeleton" style={{ height: 160 }} /> : null}
      {data && !tasks.length ? <p className="adm-empty">{mine ? "Nothing assigned to you. 🎉" : "No tasks. 🎉"}</p> : null}
      <ul className="tm-tasks">
        {tasks.map((t) => {
          const overdue = t.status !== "done" && t.due && new Date(t.due).getTime() < Date.now();
          return (
            <li key={t.id} className={`is-${t.status}${overdue ? " is-overdue" : ""}`}>
              <button type="button" className="tm-tick" aria-label={t.status === "done" ? "Mark not done" : "Mark done"} onClick={() => void run({ op: "status", id: t.id, status: t.status === "done" ? "todo" : "done" })}>
                {t.status === "done" ? <Check size={14} /> : null}
              </button>
              <div className="tm-task-body">
                <b>{t.title}</b>
                {t.details ? <p>{t.details}</p> : null}
                <span className="tm-task-meta">
                  {t.assignee ? <PersonLink id={t.assignee} people={data!.people} onOpen={onOpenMember} compact /> : <span className="adm-muted">Anyone</span>}
                  {t.due ? (
                    <span className={overdue ? "tm-overdue" : "adm-muted"}>
                      <CalendarClock size={12} aria-hidden="true" /> {overdue ? "was due" : "due"} {formatDate(t.due)}
                    </span>
                  ) : null}
                  <span className="adm-muted">
                    added by {t.createdByName} {timeAgo(t.createdAt)}
                  </span>
                  {t.status === "done" && t.doneByName ? <span className="adm-muted">· done by {t.doneByName}</span> : null}
                </span>
              </div>
              <div className="tm-task-actions">
                {t.status === "todo" ? (
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => void run({ op: "status", id: t.id, status: "doing" })}>
                    Start
                  </button>
                ) : t.status === "doing" ? (
                  <span className="adm-tag">In progress</span>
                ) : null}
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => setEditing(t)}>
                  Edit
                </button>
                {t.createdBy === data?.me || data?.isAdmin ? (
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" aria-label="Delete task" onClick={() => window.confirm("Delete this task?") && void run({ op: "delete", id: t.id })}>
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
