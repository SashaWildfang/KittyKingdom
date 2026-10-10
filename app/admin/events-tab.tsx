"use client";

import "./bots/bots.css";
import "./events-tab.css";
import { AlertTriangle, Bell, CalendarPlus, Check, Copy, Hash, MapPin, Pencil, Repeat, Trash2, Undo2, Users, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EVENT_KINDS, type EventKind, type ServerEvent } from "../../lib/events-shared";
import { MemberSearch, useLive, type People } from "./admin-shared";
import { Picker, channelOptions, type Meta } from "./bots/pickers";
import { EventPolls } from "./event-polls";

type StaffEvent = ServerEvent & { discordEventId: string | null; lastError: string | null; posted: boolean; postError: string | null };
type Data = { ok: boolean; upcoming: StaffEvent[]; past: StaffEvent[]; people: People };

const KIND = Object.fromEntries(EVENT_KINDS.map((k) => [k.key, k]));
const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    .then((x) => x.json())
    .catch(() => null);
  if (!r?.ok) throw new Error(r?.error ?? "Something went wrong.");
  return r;
}

/** Admin → Members → Events (staff): plan events for /events and Discord's Events tab. */
export function EventsTab() {
  const { data, error, reload } = useLive<Data>("/api/admin/events", 30_000);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [editing, setEditing] = useState<StaffEvent | "new" | null>(null);
  const [copyFrom, setCopyFrom] = useState<StaffEvent | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    fetch("/api/admin/bots/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setMeta(r))
      .catch(() => undefined);
  }, []);
  const channelName = (id: string | null) => (id ? meta?.channels.find((c) => c.id === id)?.name ?? "a channel" : null);

  return (
    <section className="adm-panel ev">
      <div className="ev-top">
        <div>
          <h2>Events</h2>
          <p className="adm-muted">Shown on kittykingdom.net/events and in Discord&apos;s Events tab. Members can ask for a DM reminder 15 minutes before.</p>
        </div>
        <button type="button" className="adm-btn" onClick={() => (setCopyFrom(null), setEditing("new"))}>
          <CalendarPlus size={16} aria-hidden="true" /> New event
        </button>
      </div>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data ? (
        error ? null : <div className="adm-skeleton" style={{ height: 260 }} />
      ) : (
        <>
          <h3 className="ev-h">Upcoming ({data.upcoming.length})</h3>
          {data.upcoming.length ? (
            <ul className="ev-list">
              {data.upcoming.map((e) => (
                <EventRow
                  key={e.id}
                  e={e}
                  people={data.people}
                  channel={channelName(e.channelId)}
                  onEdit={() => (setCopyFrom(null), setEditing(e))}
                  onCopy={() => (setCopyFrom(e), setEditing("new"))}
                  onChanged={reload}
                />
              ))}
            </ul>
          ) : (
            <div className="adm-empty">Nothing planned yet. Press New event to add one.</div>
          )}
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small ev-past-toggle" onClick={() => setShowPast((v) => !v)}>
            {showPast ? "Hide" : "Show"} past events ({data.past.length})
          </button>
          {showPast ? (
            <ul className="ev-list is-past">
              {data.past.map((e) => (
                <EventRow key={e.id} e={e} people={data.people} channel={channelName(e.channelId)} onEdit={() => setEditing(e)} onCopy={() => (setCopyFrom(e), setEditing("new"))} onChanged={reload} past />
              ))}
            </ul>
          ) : null}
          <EventPolls events={data.upcoming.filter((e) => !e.cancelled)} />
        </>
      )}
      {editing ? (
        <EventEditor
          initial={editing === "new" ? copyFrom : editing}
          isNew={editing === "new"}
          meta={meta}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </section>
  );
}

function EventRow({ e, people, channel, onEdit, onCopy, onChanged, past }: { e: StaffEvent; people: People; channel: string | null; onEdit: () => void; onCopy: () => void; onChanged: () => void; past?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [guests, setGuests] = useState<{ ids: string[]; people: People } | null>(null);
  const start = new Date(e.startAt);
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
  const loadGuests = async () => {
    if (guests) return setGuests(null);
    const r = await send(`/api/admin/events/${e.id}`, "GET").catch(() => null);
    if (r) setGuests({ ids: r.guests, people: r.people });
  };
  return (
    <li className={`ev-row${e.cancelled ? " is-cancelled" : ""}`}>
      <div className="ev-date" aria-hidden="true">
        <small>{start.toLocaleDateString([], { month: "short" })}</small>
        <b>{start.getDate()}</b>
        <small>{start.toLocaleDateString([], { weekday: "short" })}</small>
      </div>
      <div className="ev-main">
        <b>
          <span aria-hidden="true">{KIND[e.kind]?.emoji}</span> {e.title}
          {e.cancelled ? <span className="ev-tag is-bad">Cancelled</span> : null}
          {e.weekly ? (
            <span className="ev-tag">
              <Repeat size={11} aria-hidden="true" /> Weekly
            </span>
          ) : null}
        </b>
        <small>
          {when(e.startAt)}
          {e.endAt ? ` – ${new Date(e.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""} ·{" "}
          {channel ? (
            <>
              <Hash size={11} aria-hidden="true" />
              {channel}
            </>
          ) : (
            <>
              <MapPin size={11} aria-hidden="true" /> {e.place}
            </>
          )}
          {e.hostId ? ` · hosted by ${people[e.hostId]?.name ?? e.hostName ?? "staff"}` : ""}
        </small>
        <span className="ev-meta">
          <button type="button" className="ev-going" onClick={loadGuests}>
            <Bell size={12} aria-hidden="true" /> {e.going} want a reminder
          </button>
          {e.discord ? (
            e.discordEventId ? (
              <span className="ev-sync is-ok">
                <Check size={12} aria-hidden="true" /> In Discord&apos;s Events
              </span>
            ) : e.lastError ? (
              <span className="ev-sync is-bad" title={e.lastError}>
                <AlertTriangle size={12} aria-hidden="true" /> Discord: {e.lastError}
              </span>
            ) : (
              <span className="ev-sync">Adding to Discord…</span>
            )
          ) : null}
          {e.post ? (
            e.posted ? (
              <span className="ev-sync is-ok">
                <Check size={12} aria-hidden="true" /> Posted in #events
              </span>
            ) : e.postError ? (
              <span className="ev-sync is-bad" title={e.postError}>
                <AlertTriangle size={12} aria-hidden="true" /> Post: {e.postError}
              </span>
            ) : !e.cancelled ? (
              <span className="ev-sync">Posting…</span>
            ) : null
          ) : null}
        </span>
        {guests ? (
          <div className="ev-guests">
            {guests.ids.length ? guests.ids.map((id) => <span key={id}>{guests.people[id]?.name ?? id}</span>) : <span className="adm-muted">Nobody yet.</span>}
          </div>
        ) : null}
        {err ? <p className="adm-error">{err}</p> : null}
      </div>
      <div className="ev-actions">
        {!past ? (
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={onEdit}>
            <Pencil size={13} aria-hidden="true" /> Edit
          </button>
        ) : null}
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={onCopy} title="Make a new event from this one">
          <Copy size={13} aria-hidden="true" /> Copy
        </button>
        {!past ? (
          e.cancelled ? (
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy} onClick={() => run(() => send(`/api/admin/events/${e.id}`, "PATCH", { action: "restore" }))}>
              <Undo2 size={13} aria-hidden="true" /> Restore
            </button>
          ) : (
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy} onClick={() => run(() => send(`/api/admin/events/${e.id}`, "PATCH", { action: "cancel" }))}>
              <XCircle size={13} aria-hidden="true" /> Cancel
            </button>
          )
        ) : null}
        {confirm ? (
          <button type="button" className="adm-btn adm-btn--danger adm-btn--small" disabled={busy} onClick={() => run(() => send(`/api/admin/events/${e.id}`, "DELETE"))}>
            Delete for good
          </button>
        ) : (
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" aria-label="Delete" onClick={() => setConfirm(true)}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </li>
  );
}

function EventEditor({ initial, isNew, meta, onClose, onSaved }: { initial: StaffEvent | null; isNew: boolean; meta: Meta | null; onClose: () => void; onSaved: () => void }) {
  const soon = new Date(Date.now() + 86_400_000);
  soon.setMinutes(0, 0, 0);
  const start = initial ? new Date(initial.startAt) : soon;
  // A copied event keeps its time of day, a week later
  if (initial && isNew) start.setTime(Math.max(start.getTime() + 7 * 86_400_000, soon.getTime()));
  const length = initial?.endAt ? new Date(initial.endAt).getTime() - new Date(initial.startAt).getTime() : 2 * 3600_000;
  const [f, setF] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    kind: (initial?.kind ?? "games") as EventKind,
    start: localInput(start),
    end: localInput(new Date(start.getTime() + length)),
    where: initial && !initial.channelId ? "place" : "channel",
    channelId: initial?.channelId ?? null,
    place: initial?.place ?? "",
    hostId: initial?.hostId ?? null,
    hostName: initial?.hostName ?? "",
    hostQuery: initial?.hostName ?? "",
    image: initial?.image ?? "",
    weekly: initial?.weekly ?? false,
    discord: initial?.discord ?? true,
    post: initial?.post ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    // On <body> with the page locked, so the site footer can't sit on top of it
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
    const body = {
      title: f.title,
      description: f.description,
      kind: f.kind,
      startAt: new Date(f.start).toISOString(),
      endAt: f.end ? new Date(f.end).toISOString() : null,
      channelId: f.where === "channel" ? f.channelId : null,
      place: f.where === "place" ? f.place : null,
      hostId: f.hostId,
      hostName: f.hostName || null,
      image: f.image || null,
      weekly: f.weekly,
      discord: f.discord,
      post: f.post,
    };
    try {
      if (isNew || !initial) await send("/api/admin/events", "POST", body);
      else await send(`/api/admin/events/${initial.id}`, "PATCH", body);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return createPortal(
    <div className="adm-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="adm-drawer ev-editor" role="dialog" aria-label={isNew ? "New event" : "Edit event"}>
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <h2>{isNew ? "New event" : "Edit event"}</h2>
        <label className="ev-field">
          <span>Title</span>
          <input value={f.title} maxLength={100} onChange={(e) => set({ title: e.target.value })} placeholder="Friday game night" />
        </label>
        <div className="ev-field">
          <span>Type</span>
          <div className="ev-kinds">
            {EVENT_KINDS.map((k) => (
              <button key={k.key} type="button" className={f.kind === k.key ? "is-on" : undefined} onClick={() => set({ kind: k.key })}>
                <span aria-hidden="true">{k.emoji}</span> {k.label}
              </button>
            ))}
          </div>
        </div>
        <label className="ev-field">
          <span>
            Description <small>{f.description.length}/1000</small>
          </span>
          <textarea rows={4} maxLength={1000} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="What's happening and how to join in." />
        </label>
        <div className="ev-row2">
          <label className="ev-field">
            <span>Starts</span>
            <input type="datetime-local" value={f.start} onChange={(e) => set({ start: e.target.value })} />
          </label>
          <label className="ev-field">
            <span>Ends</span>
            <input type="datetime-local" value={f.end} onChange={(e) => set({ end: e.target.value })} />
          </label>
        </div>
        <div className="ev-field">
          <span>Where</span>
          <div className="adm-seg" role="tablist" aria-label="Where">
            <button type="button" className={f.where === "channel" ? "is-active" : undefined} onClick={() => set({ where: "channel" })}>
              Discord channel
            </button>
            <button type="button" className={f.where === "place" ? "is-active" : undefined} onClick={() => set({ where: "place" })}>
              Somewhere else
            </button>
          </div>
          {f.where === "channel" ? (
            <Picker kind="channel" value={f.channelId} onChange={(v) => set({ channelId: (v as string) || null })} options={channelOptions(meta, "any")} allowEmpty placeholder="Pick a voice or text channel" />
          ) : (
            <input value={f.place} maxLength={100} onChange={(e) => set({ place: e.target.value })} placeholder="Minecraft server, Jackbox, on the website…" />
          )}
        </div>
        <div className="ev-field">
          <span>
            Host <small>optional</small>
          </span>
          {f.hostId ? (
            <span className="ev-host">
              {f.hostName || f.hostId}
              <button type="button" aria-label="Remove host" onClick={() => set({ hostId: null, hostName: "", hostQuery: "" })}>
                <X size={12} />
              </button>
            </span>
          ) : (
            <MemberSearch value={f.hostQuery} onChange={(v) => set({ hostQuery: v })} onPick={(m) => set({ hostId: m.id, hostName: m.name, hostQuery: m.name })} placeholder="Search a member" />
          )}
        </div>
        <label className="ev-field">
          <span>
            Image <small>optional https:// link, shown on the event</small>
          </span>
          <input value={f.image} onChange={(e) => set({ image: e.target.value })} placeholder="https://…" />
        </label>
        <label className="ev-check">
          <input type="checkbox" checked={f.weekly} onChange={(e) => set({ weekly: e.target.checked })} />
          <span>
            <b>Repeat every week</b>
            <small>When it ends, next week&apos;s is planned automatically.</small>
          </span>
        </label>
        <label className="ev-check">
          <input type="checkbox" checked={f.discord} onChange={(e) => set({ discord: e.target.checked })} />
          <span>
            <b>Show in Discord&apos;s Events tab</b>
            <small>The Main Bot adds it as a Discord event too.</small>
          </span>
        </label>
        <label className="ev-check">
          <input type="checkbox" checked={f.post} onChange={(e) => set({ post: e.target.checked })} />
          <span>
            <b>Post in the events announcement channel</b>
            <small>The Main Bot posts it as an embed and edits it whenever you change the event here.</small>
          </span>
        </label>
        {err ? <p className="adm-error">{err}</p> : null}
        <div className="ev-editor-foot">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="adm-btn" disabled={busy} onClick={save}>
            <Users size={14} aria-hidden="true" /> {busy ? "Saving…" : isNew ? "Add event" : "Save changes"}
          </button>
        </div>
        <p className="adm-muted ev-note">Times are in your time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}); members see them in theirs.</p>
      </aside>
    </div>,
    document.body,
  );
}
