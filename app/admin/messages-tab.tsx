"use client";

import { ArrowLeft, ChevronUp, Eye, MessagesSquare, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Avatar, LiveBadge, MemberSearch, formatDate, timeAgo, useLive, type People } from "./admin-shared";

export type Chat = { a: string; b: string };
type Conversation = { id: string; users: [string, string]; state: string; requestFrom: string | null; lastAt: string | null; lastText: string; lastFrom: string | null; messages: number };
type Message = { id: string; from: string; text: string; deleted: boolean; deletedAt?: string | null; hiddenFor?: string[]; at: string };
type ThreadData = { id: string; state: string; requestFrom: string | null; readAt: Record<string, string | null>; messages: Message[]; more: boolean; people: People };

const STATE: Record<string, { label: string; tone: string }> = {
  request: { label: "Message request", tone: "pending" },
  declined: { label: "Request declined", tone: "muted" },
};

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function Pair({ users, people, size = 30 }: { users: [string, string]; people: People; size?: number }) {
  return (
    <span className="amx-pair" style={{ width: size * 1.6, height: size }}>
      <Avatar person={people[users[0]]} id={users[0]} size={size} />
      <Avatar person={people[users[1]]} id={users[1]} size={size} />
    </span>
  );
}

/** One conversation as a live chat (read only; new messages appear as they're sent). */
function ChatView({ chat, onBack, onOpenMember }: { chat: Chat; onBack: () => void; onOpenMember: (id: string) => void }) {
  const [data, setData] = useState<ThreadData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [live, setLive] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const base = `/api/admin/dating/messages?member=${chat.a}&with=${chat.b}`;

  // Opening it (logged once on the server)
  useEffect(() => {
    let stop = false;
    setData(null);
    setError(null);
    stick.current = true;
    void fetch(base, { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => {
        if (stop) return;
        if (!r?.ok) setError(r?.error ?? "Couldn't load this chat.");
        else {
          setData(r);
          setLive(Date.now());
        }
      })
      .catch(() => !stop && setError("Couldn't load this chat."));
    return () => {
      stop = true;
    };
  }, [base]);

  // Live: only the new messages, every few seconds
  const lastId = data?.messages[data.messages.length - 1]?.id ?? null;
  const poll = useCallback(async () => {
    if (!data || document.visibilityState !== "visible") return;
    const r = await fetch(`${base}${lastId ? `&after=${lastId}` : ""}`, { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) return;
    setLive(Date.now());
    setData((d) => {
      if (!d) return d;
      const known = new Set(d.messages.map((m) => m.id));
      const fresh = lastId ? (r.messages as Message[]).filter((m) => !known.has(m.id)) : [];
      // Unsent since we loaded it: blank it out here too
      return { ...d, state: r.state, readAt: r.readAt, people: { ...d.people, ...r.people }, messages: lastId ? [...d.messages, ...fresh] : r.messages };
    });
  }, [base, data, lastId]);
  useEffect(() => {
    const t = window.setInterval(() => void poll(), 4000);
    return () => window.clearInterval(t);
  }, [poll]);

  // Stay at the bottom while they're reading the newest messages
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [data?.messages.length]);

  async function older() {
    if (!data?.messages.length) return;
    setLoadingOlder(true);
    const el = scroller.current;
    const fromBottom = el ? el.scrollHeight - el.scrollTop : 0;
    const r = await fetch(`${base}&before=${data.messages[0].id}`, { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    setLoadingOlder(false);
    if (!r?.ok) return;
    stick.current = false;
    setData((d) => (d ? { ...d, more: r.more, messages: [...r.messages, ...d.messages] } : d));
    // Keep the view where it was
    window.requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - fromBottom;
    });
  }

  const people = data?.people ?? {};
  const name = (id: string) => people[id]?.name ?? "Unknown";
  const state = data ? STATE[data.state] : null;
  // The last message each of them has seen (from read times)
  const seenBy = (id: string) => {
    const at = data?.readAt[id];
    if (!at || !data) return null;
    const mine = data.messages.filter((m) => m.from !== id && m.at <= at);
    return mine.length ? mine[mine.length - 1].id : null;
  };
  const seenA = seenBy(chat.a);
  const seenB = seenBy(chat.b);

  return (
    <section className="amx-chat" aria-label="Conversation">
      <header className="amx-chat-head">
        <button type="button" className="amx-back" onClick={onBack} aria-label="Back to conversations">
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        {[chat.a, chat.b].map((id, i) => (
          <Fragment key={id}>
            {i === 1 ? <span className="amx-and" aria-hidden="true">↔</span> : null}
            <button type="button" className="amx-who" onClick={() => onOpenMember(id)} title="Open their full profile">
              <Avatar person={people[id]} id={id} size={30} />
              <span>
                <strong>{name(id)}</strong>
                <small>{people[id]?.username ? `@${people[id]!.username}` : id}</small>
              </span>
            </button>
          </Fragment>
        ))}
        <span className="amx-chat-meta">
          {state ? <span className={`ja-status ja-status--${state.tone}`}>{state.label}</span> : null}
          <LiveBadge updatedAt={live} loading={!data} />
        </span>
      </header>
      <p className="amx-note">
        <Eye size={13} aria-hidden="true" /> Read only. Opening this chat is logged; nothing is marked as read for them.
      </p>
      <div
        className="amx-scroll"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {error ? <p className="adm-error">{error}</p> : null}
        {!data && !error ? <div className="adm-skeleton" style={{ height: 200 }} /> : null}
        {data?.more ? (
          <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost amx-older" disabled={loadingOlder} onClick={() => void older()}>
            <ChevronUp size={13} aria-hidden="true" /> {loadingOlder ? "Loading…" : "Older messages"}
          </button>
        ) : null}
        {data && !data.messages.length ? <p className="adm-empty">No messages yet.</p> : null}
        {data?.messages.map((m, i) => {
          const prev = data.messages[i - 1];
          const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
          const grouped = !newDay && prev?.from === m.from && Date.parse(m.at) - Date.parse(prev.at) < 5 * 60_000;
          const side = m.from === chat.a ? "left" : "right";
          return (
            <Fragment key={m.id}>
              {newDay ? <div className="amx-day">{dayLabel(m.at)}</div> : null}
              <div className={`amx-msg amx-msg--${side}${grouped ? " is-grouped" : ""}`}>
                {!grouped ? <Avatar person={people[m.from]} id={m.from} size={28} /> : <span className="amx-gap" />}
                <div className="amx-bubble-wrap">
                  {!grouped ? (
                    <span className="amx-msg-head">
                      <b>{name(m.from)}</b> <small title={formatDate(m.at)}>{clock(m.at)}</small>
                    </span>
                  ) : null}
                  <p className={`amx-bubble${m.deleted ? " is-deleted" : ""}`} title={grouped ? clock(m.at) : undefined}>
                    {m.deleted && !m.text ? "Message unsent (its text was erased before unsent messages were kept)" : m.text}
                  </p>
                  {m.deleted || m.hiddenFor?.length ? (
                    <span className="amx-msg-flags">
                      {m.deleted ? <small className="amx-flag amx-flag--unsent" title={m.deletedAt ? `Unsent ${formatDate(m.deletedAt)}` : undefined}>Unsent by {name(m.from)} · only admins can see this</small> : null}
                      {m.hiddenFor?.map((u) => (
                        <small key={u} className="amx-flag">Deleted for {name(u)}</small>
                      ))}
                    </span>
                  ) : null}
                  {(m.id === seenA && m.from === chat.b) || (m.id === seenB && m.from === chat.a) ? <small className="amx-seen">Seen</small> : null}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

/** Admin → Members → Messages: every Social conversation, live, with the open chat beside the list (admins only). */
export type ChatFilter = { id: string; name: string } | null;

export function MessagesTab({
  chat,
  onChat,
  filter,
  onFilter: setFilter,
  onOpenMember,
}: {
  chat: Chat | null;
  onChat: (c: Chat | null) => void;
  filter: ChatFilter;
  onFilter: (f: ChatFilter) => void;
  onOpenMember: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(40);
  const url = `/api/admin/dating/messages?limit=${limit}${filter ? `&member=${filter.id}` : ""}`;
  const { data, error, updatedAt, loading } = useLive<{ conversations: Conversation[]; more: boolean; people: People }>(url, 8_000);
  const people = data?.people ?? {};

  return (
    <div className={`amx${chat ? " has-chat" : ""}`}>
      <aside className="amx-side">
        <div className="amx-side-head">
          <h3>
            <MessagesSquare size={16} aria-hidden="true" /> Conversations
          </h3>
          <LiveBadge updatedAt={updatedAt} loading={loading} />
        </div>
        {filter ? (
          <p className="amx-filter">
            Only <b>{filter.name}</b>&apos;s chats
            <button type="button" aria-label="Show everyone's chats" onClick={() => setFilter(null)}>
              <X size={14} aria-hidden="true" />
            </button>
          </p>
        ) : (
          <MemberSearch
            className="amx-search"
            value={search}
            onChange={setSearch}
            onPick={(m) => {
              setSearch("");
              setFilter({ id: m.id, name: m.name });
              setLimit(40);
            }}
            placeholder="Filter by member…"
          />
        )}
        {error ? <p className="adm-error">{error}</p> : null}
        <ul className="amx-list">
          {data?.conversations.map((c) => {
            const on = chat && ((chat.a === c.users[0] && chat.b === c.users[1]) || (chat.a === c.users[1] && chat.b === c.users[0]));
            const state = STATE[c.state];
            return (
              <li key={c.id}>
                <button type="button" className={on ? "is-on" : undefined} onClick={() => onChat({ a: c.users[0], b: c.users[1] })}>
                  <Pair users={c.users} people={people} />
                  <span className="amx-item-main">
                    <strong>
                      {people[c.users[0]]?.name ?? "Unknown"} <span className="amx-and">↔</span> {people[c.users[1]]?.name ?? "Unknown"}
                    </strong>
                    <small>
                      {c.lastFrom ? `${people[c.lastFrom]?.name ?? "Unknown"}: ` : ""}
                      {c.lastText || "—"}
                    </small>
                  </span>
                  <span className="amx-item-meta">
                    <small>{c.lastAt ? timeAgo(c.lastAt) : ""}</small>
                    {state ? <span className={`amx-dot amx-dot--${state.tone}`} title={state.label} /> : <small>{c.messages}</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {data && !data.conversations.length ? <p className="adm-empty">{filter ? `${filter.name} has no Social chats.` : "No Social conversations yet."}</p> : null}
        {!data && !error ? <div className="adm-skeleton" style={{ height: 200 }} /> : null}
        {data?.more && limit < 100 ? (
          <button type="button" className="adm-btn adm-btn--ghost amx-more" onClick={() => setLimit((l) => Math.min(100, l + 30))}>
            Show more
          </button>
        ) : null}
      </aside>
      {chat ? (
        <ChatView key={`${chat.a}-${chat.b}`} chat={chat} onBack={() => onChat(null)} onOpenMember={onOpenMember} />
      ) : (
        <section className="amx-chat amx-chat--empty">
          <MessagesSquare size={34} aria-hidden="true" />
          <p>Pick a conversation to read it live.</p>
          <small>Opening a chat is logged. Nothing is marked as read for the members.</small>
        </section>
      )}
    </div>
  );
}
