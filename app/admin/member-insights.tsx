"use client";

// Member profile extras: staff notes, the watchlist, "might be an alt of…" hints and the full timeline.

import "./member-insights.css";
import { AlertTriangle, CalendarClock, Clock3, Eye, EyeOff, FileText, Gavel, Globe, History, LogIn, NotebookPen, Pencil, Pin, PinOff, ScrollText, ShieldAlert, Ticket, Trash2, UserCog, UserRoundSearch } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { PersonLink, formatDate, timeAgo, useLive, type People } from "./admin-shared";

type Note = { id: string; text: string; by: string; byName: string; at: string; pinned: boolean; source: string };
type Watch = { reason: string; by: string; byName: string; at: string } | null;
type NotesData = { notes: Note[]; watch: Watch; people: People; me: string; isAdmin: boolean };

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Couldn't reach the server." }));

/** The watch banner and staff notes, at the top of a member's profile. */
export function MemberNotes({ userId, onOpenMember }: { userId: string; onOpenMember: (id: string) => void }) {
  const url = `/api/admin/user/${userId}/notes`;
  const { data, reload } = useLive<NotesData>(url, 30_000);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [watching, setWatching] = useState<string | null>(null);

  async function run(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setProblem(null);
    const r = await post(url, body);
    setBusy(false);
    if (!r?.ok) return setProblem(r?.error ?? "That didn't work.");
    after?.();
    reload();
  }

  const notes = data?.notes ?? [];
  const watch = data?.watch ?? null;
  const canChange = (n: Note) => n.by === data?.me || data?.isAdmin;

  return (
    <>
      {watch ? (
        <div className="mi-watch" role="status">
          <Eye size={16} aria-hidden="true" />
          <div>
            <b>On the watchlist</b>
            <span>{watch.reason}</span>
            <small>
              Added by {watch.byName} · <span title={formatDate(watch.at)}>{timeAgo(watch.at)}</span>
            </small>
          </div>
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" disabled={busy} onClick={() => void run({ op: "unwatch" })}>
            <EyeOff size={13} aria-hidden="true" /> Stop watching
          </button>
        </div>
      ) : null}

      <section className="adm-drawer-section mi-notes">
        <h3>
          <NotebookPen size={16} aria-hidden="true" /> Staff notes <small>{notes.length}</small>
          {data && !watch && watching === null ? (
            <button type="button" className="adm-link adm-h3-link" onClick={() => setWatching("")}>
              <Eye size={13} aria-hidden="true" /> Watch
            </button>
          ) : null}
        </h3>

        {watching !== null && !watch ? (
          <form
            className="mi-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run({ op: "watch", reason: watching }, () => setWatching(null));
            }}
          >
            <label htmlFor={`watch-${userId}`}>Why are you watching them? Staff get a heads-up in Needs attention when they rejoin, get punished, trip AutoMod or open a ticket.</label>
            <input id={`watch-${userId}`} autoFocus value={watching} maxLength={300} onChange={(e) => setWatching(e.target.value)} placeholder="e.g. Suspected alt of a banned member" />
            <div className="mi-form-row">
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setWatching(null)}>
                Cancel
              </button>
              <button type="submit" className="adm-btn adm-btn--small" disabled={busy || !watching.trim()}>
                <Eye size={13} aria-hidden="true" /> Add to watchlist
              </button>
            </div>
          </form>
        ) : null}

        <form
          className="mi-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ op: "add", text }, () => setText(""));
          }}
        >
          <textarea
            value={text}
            maxLength={1500}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) (e.preventDefault(), void run({ op: "add", text }, () => setText("")));
            }}
            placeholder="Add a note other staff should know (only staff can see these)…"
            aria-label="New staff note"
          />
          {text.trim() ? (
            <div className="mi-form-row">
              <small className="adm-muted">Ctrl+Enter to save</small>
              <button type="submit" className="adm-btn adm-btn--small" disabled={busy}>
                Save note
              </button>
            </div>
          ) : null}
        </form>
        {problem ? <p className="adm-error">{problem}</p> : null}

        {notes.length ? (
          <ul className="mi-note-list">
            {notes.map((n) => (
              <li key={n.id} className={n.pinned ? "is-pinned" : undefined}>
                {editing?.id === n.id ? (
                  <form
                    className="mi-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run({ op: "edit", id: n.id, text: editing.text }, () => setEditing(null));
                    }}
                  >
                    <textarea autoFocus value={editing.text} maxLength={1500} rows={3} onChange={(e) => setEditing({ id: n.id, text: e.target.value })} aria-label="Edit note" />
                    <div className="mi-form-row">
                      <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                      <button type="submit" className="adm-btn adm-btn--small" disabled={busy || !editing.text.trim()}>
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <p>{n.text}</p>
                )}
                <div className="mi-note-meta">
                  {n.pinned ? <Pin size={12} aria-label="Pinned" /> : null}
                  <PersonLink id={n.by} people={data?.people ?? {}} onOpen={onOpenMember} compact />
                  <span className="adm-muted" title={formatDate(n.at)}>
                    {timeAgo(n.at)}
                    {n.source === "discord" ? " · from Discord" : ""}
                  </span>
                  <span className="mi-note-actions">
                    <button type="button" title={n.pinned ? "Unpin" : "Pin to the top"} aria-label={n.pinned ? "Unpin" : "Pin"} disabled={busy} onClick={() => void run({ op: "pin", id: n.id, pinned: !n.pinned })}>
                      {n.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                    {canChange(n) ? (
                      <>
                        <button type="button" title="Edit" aria-label="Edit" disabled={busy} onClick={() => setEditing({ id: n.id, text: n.text })}>
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          aria-label="Delete"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm("Delete this note?")) void run({ op: "delete", id: n.id });
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : null}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : data ? (
          <p className="adm-empty">No notes yet. Staff can also add them in Discord with /note.</p>
        ) : null}
      </section>
    </>
  );
}

type Hint = { discordId: string; banned: boolean; signals: { kind: string; label: string; strength: "strong" | "medium" }[] };

/** "Might be the same person as…" (only shows when there's something). */
export function MemberAlts({ userId, onOpenMember }: { userId: string; onOpenMember: (id: string) => void }) {
  const { data } = useLive<{ hints: Hint[]; people: People; networkChecked: boolean }>(`/api/admin/user/${userId}/alts`, 300_000);
  if (!data?.hints?.length) return null;
  return (
    <section className="adm-drawer-section mi-alts">
      <h3>
        <UserRoundSearch size={16} aria-hidden="true" /> Possible alts <small>{data.hints.length}</small>
      </h3>
      <p className="adm-muted mi-hint">Leads to look into, not proof. Check before acting on them.</p>
      <ul>
        {data.hints.map((h) => (
          <li key={h.discordId}>
            <div className="mi-alt-head">
              <PersonLink id={h.discordId} people={data.people} onOpen={onOpenMember} compact />
              {h.banned ? <span className="adm-tag mi-banned">Banned</span> : null}
            </div>
            <ul className="mi-signals">
              {h.signals.map((s) => (
                <li key={s.kind} className={s.strength === "strong" ? "is-strong" : undefined}>
                  {s.kind === "network" ? <Globe size={12} aria-hidden="true" /> : s.kind === "birthday" ? <CalendarClock size={12} aria-hidden="true" /> : <UserCog size={12} aria-hidden="true" />}
                  {s.label}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Event = { id: string; at: string; kind: string; title: string; detail: string | null; by: string | null; tone: "neutral" | "good" | "bad" | "warn"; ticket?: { id: number; key: string; transcript: boolean } | null };

const KINDS: Record<string, { label: string; icon: LucideIcon }> = {
  server: { label: "Joins & leaves", icon: LogIn },
  "join-app": { label: "Join app", icon: FileText },
  ticket: { label: "Tickets", icon: Ticket },
  punishment: { label: "Punishments", icon: Gavel },
  automod: { label: "AutoMod", icon: ShieldAlert },
  appeal: { label: "Appeals", icon: ScrollText },
  note: { label: "Notes", icon: NotebookPen },
  watch: { label: "Notes", icon: Eye },
  member: { label: "Profile changes", icon: UserCog },
  account: { label: "Accounts", icon: Clock3 },
  website: { label: "Accounts", icon: Globe },
};

/** Everything that happened with this member, newest first. */
export function MemberTimeline({ userId, onOpenMember, onOpenTranscript }: { userId: string; onOpenMember: (id: string) => void; onOpenTranscript: (id: number, key?: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(20);
  const { data, error, loading } = useLive<{ events: Event[]; people: People }>(open ? `/api/admin/user/${userId}/timeline` : null, 60_000);
  const events = data?.events ?? [];
  const labels = Array.from(new Set(events.map((e) => KINDS[e.kind]?.label ?? e.kind)));
  const shown = events.filter((e) => filter === "all" || (KINDS[e.kind]?.label ?? e.kind) === filter);

  return (
    <section className="adm-drawer-section mi-timeline">
      <h3>
        <History size={16} aria-hidden="true" /> Timeline {data ? <small>{events.length}</small> : null}
        <button type="button" className="adm-link adm-h3-link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Hide" : "Show everything →"}
        </button>
      </h3>
      {!open ? <p className="adm-muted mi-hint">Joins, leaves, tickets, punishments, AutoMod, appeals, notes and name changes in one list.</p> : null}
      {open && error ? <p className="adm-error">{error}</p> : null}
      {open && !data && loading ? <div className="adm-skeleton" style={{ height: 120 }} /> : null}
      {open && data ? (
        <>
          {labels.length > 1 ? (
            <div className="mi-chips">
              {["all", ...labels].map((l) => (
                <button key={l} type="button" className={filter === l ? "is-on" : undefined} onClick={() => (setFilter(l), setLimit(20))}>
                  {l === "all" ? "Everything" : l}
                </button>
              ))}
            </div>
          ) : null}
          <ol className="mi-events">
            {shown.slice(0, limit).map((e) => {
              const K = KINDS[e.kind] ?? { icon: AlertTriangle };
              return (
                <li key={e.id} className={`is-${e.tone}`}>
                  <span className="mi-dot" aria-hidden="true">
                    <K.icon size={13} />
                  </span>
                  <div>
                    <div className="mi-event-head">
                      <b>{e.title}</b>
                      <span className="adm-muted" title={formatDate(e.at)}>
                        {timeAgo(e.at)}
                      </span>
                    </div>
                    {e.detail ? <p>{e.detail}</p> : null}
                    <div className="mi-event-foot">
                      {e.by ? (
                        <span className="mi-by">
                          by <PersonLink id={e.by} people={data.people} onOpen={onOpenMember} compact />
                        </span>
                      ) : null}
                      {e.ticket?.transcript ? (
                        <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost" onClick={() => onOpenTranscript(e.ticket!.id, e.ticket!.key)}>
                          <FileText size={12} aria-hidden="true" /> Transcript
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {shown.length > limit ? (
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setLimit((n) => n + 40)}>
              Show older ({shown.length - limit} more)
            </button>
          ) : null}
          {!shown.length ? <p className="adm-empty">Nothing on record.</p> : null}
        </>
      ) : null}
    </section>
  );
}
