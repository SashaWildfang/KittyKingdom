"use client";

import { BarChart3, ExternalLink, Plus, Square, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { EventPoll } from "../../lib/event-polls";
import type { ServerEvent } from "../../lib/events-shared";
import { useLive, type People } from "./admin-shared";

type Data = { ok: boolean; polls: EventPoll[]; people: People };

const LENGTHS = [
  { hours: 1, label: "1 hour" },
  { hours: 4, label: "4 hours" },
  { hours: 8, label: "8 hours" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
  { hours: 336, label: "2 weeks" },
];
const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    .then((x) => x.json())
    .catch(() => null);
  if (!r?.ok) throw new Error(r?.error ?? "Something went wrong.");
  return r;
}

/** Polls for #event-polls, posted by the Main Bot as native Discord polls. */
export function EventPolls({ events }: { events: ServerEvent[] }) {
  const { data, error, reload } = useLive<Data>("/api/admin/event-polls", 20_000);
  const [creating, setCreating] = useState(false);
  return (
    <div className="evpoll">
      <div className="ev-top">
        <div>
          <h3 className="ev-h">
            <BarChart3 size={16} aria-hidden="true" /> Polls
          </h3>
          <p className="adm-muted">Posted in #event-polls as a Discord poll. Votes show up here as they come in.</p>
        </div>
        <button type="button" className="adm-btn adm-btn--small" onClick={() => setCreating(true)}>
          <Plus size={15} aria-hidden="true" /> New poll
        </button>
      </div>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data ? (
        error ? null : <div className="adm-skeleton" style={{ height: 90 }} />
      ) : data.polls.length ? (
        <ul className="evpoll-list">
          {data.polls.map((p) => (
            <PollRow key={p.id} p={p} by={p.createdBy ? data.people[p.createdBy]?.name : undefined} event={events.find((e) => e.id === p.eventId)} onChanged={reload} />
          ))}
        </ul>
      ) : (
        <div className="adm-empty">No polls yet. Ask the server what game to play next!</div>
      )}
      {creating ? (
        <PollEditor
          events={events}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function PollRow({ p, by, event, onChanged }: { p: EventPoll; by?: string; event?: ServerEvent; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const top = Math.max(1, ...p.answers.map((a) => a.votes));
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onChanged();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const status =
    p.status === "pending" ? "Posting…" : p.status === "failed" ? "Couldn't post" : p.status === "ended" ? "Ended" : p.endRequested ? "Ending…" : p.expiresAt ? `Open until ${when(p.expiresAt)}` : "Open";
  return (
    <li className={`evpoll-row is-${p.status}`}>
      <div className="evpoll-head">
        <b>{p.question}</b>
        <span className="evpoll-actions">
          {p.messageUrl ? (
            <a className="adm-btn adm-btn--ghost adm-btn--small" href={p.messageUrl} target="_blank" rel="noopener noreferrer" title="Open in Discord">
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          ) : null}
          {p.status === "posted" && !p.endRequested ? (
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy} onClick={() => run(() => send(`/api/admin/event-polls/${p.id}`, "PATCH", { action: "end" }))}>
              <Square size={13} aria-hidden="true" /> End now
            </button>
          ) : null}
          {confirm ? (
            <button type="button" className="adm-btn adm-btn--danger adm-btn--small" disabled={busy} onClick={() => run(() => send(`/api/admin/event-polls/${p.id}`, "DELETE"))}>
              Delete{p.messageUrl ? " from Discord too" : ""}?
            </button>
          ) : (
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirm(true)} title="Delete">
              <Trash2 size={13} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      <small className="evpoll-meta">
        <span className={`ev-sync${p.status === "failed" ? " is-bad" : p.status === "posted" ? " is-ok" : ""}`} title={p.error ?? undefined}>
          {status}
          {p.status === "failed" && p.error ? `: ${p.error}` : ""}
        </span>
        <span>
          {p.totalVotes} {p.totalVotes === 1 ? "vote" : "votes"}
        </span>
        {p.multiple ? <span>Multiple choice</span> : null}
        {event ? <span>For {event.title}</span> : null}
        {by ? <span>by {by}</span> : null}
      </small>
      <ul className="evpoll-answers">
        {p.answers.map((a, i) => (
          <li key={i} className={p.status === "ended" && a.votes === top && a.votes > 0 ? "is-win" : undefined}>
            <span className="evpoll-bar" style={{ width: `${p.totalVotes ? (a.votes / top) * 100 : 0}%` }} aria-hidden="true" />
            <span className="evpoll-text">
              {a.emoji ? <span aria-hidden="true">{a.emoji}</span> : null} {a.text}
            </span>
            <b>{a.votes}</b>
          </li>
        ))}
      </ul>
      {err ? <p className="adm-error">{err}</p> : null}
    </li>
  );
}

function PollEditor({ events, onClose, onSaved }: { events: ServerEvent[]; onClose: () => void; onSaved: () => void }) {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState([
    { text: "", emoji: "" },
    { text: "", emoji: "" },
  ]);
  const [hours, setHours] = useState(24);
  const [multiple, setMultiple] = useState(false);
  const [eventId, setEventId] = useState("");
  const [ping, setPing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const setAnswer = (i: number, p: Partial<{ text: string; emoji: string }>) => setAnswers((list) => list.map((a, j) => (j === i ? { ...a, ...p } : a)));

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await send("/api/admin/event-polls", "POST", { question, answers, hours, multiple, eventId: eventId || null, ping });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return createPortal(
    <div className="adm-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="adm-drawer ev-editor" role="dialog" aria-label="New poll">
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <h2>New poll</h2>
        <label className="ev-field">
          <span>
            Question <small>{question.length}/300</small>
          </span>
          <input value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} placeholder="What should we play on Friday?" />
        </label>
        <div className="ev-field">
          <span>
            Answers <small>2 to 10, emoji optional</small>
          </span>
          <div className="evpoll-edit-answers">
            {answers.map((a, i) => (
              <div key={i} className="evpoll-edit-answer">
                <input className="evpoll-emoji" value={a.emoji} maxLength={16} onChange={(e) => setAnswer(i, { emoji: e.target.value })} placeholder="🎮" aria-label={`Answer ${i + 1} emoji`} />
                <input value={a.text} maxLength={55} onChange={(e) => setAnswer(i, { text: e.target.value })} placeholder={`Answer ${i + 1}`} aria-label={`Answer ${i + 1}`} />
                {answers.length > 2 ? (
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setAnswers((list) => list.filter((_, j) => j !== i))} aria-label={`Remove answer ${i + 1}`}>
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            ))}
            {answers.length < 10 ? (
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setAnswers((list) => [...list, { text: "", emoji: "" }])}>
                <Plus size={13} aria-hidden="true" /> Add answer
              </button>
            ) : null}
          </div>
        </div>
        <div className="ev-row2">
          <label className="ev-field">
            <span>Runs for</span>
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {LENGTHS.map((l) => (
                <option key={l.hours} value={l.hours}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ev-field">
            <span>
              For an event <small>optional</small>
            </span>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">None</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({new Date(e.startAt).toLocaleDateString([], { month: "short", day: "numeric" })})
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="ev-check">
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
          <span>
            <b>Let people pick more than one</b>
          </span>
        </label>
        <label className="ev-check">
          <input type="checkbox" checked={ping} onChange={(e) => setPing(e.target.checked)} />
          <span>
            <b>Ping the events role</b>
            <small>Uses the ping role from Admin → Bots → Main Bot → Events.</small>
          </span>
        </label>
        <p className="adm-muted evpoll-note">Discord polls can&apos;t be edited after they&apos;re posted, only ended early or deleted.</p>
        {err ? <p className="adm-error">{err}</p> : null}
        <div className="ev-editor-foot">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="adm-btn" disabled={busy} onClick={save}>
            <BarChart3 size={14} aria-hidden="true" /> {busy ? "Posting…" : "Post poll"}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
