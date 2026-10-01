"use client";

import { ArrowLeft, ChevronDown, Eye, Loader2, MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, formatDate, timeAgo, useLive, type People } from "./admin-shared";

type Conversation = { id: string; other: string; state: string; lastAt: string | null; lastText: string; lastFromMember: boolean; messages: number };
type Message = { id: string; from: string; text: string; deleted: boolean; at: string };

const STATE: Record<string, string> = { request: "Request", declined: "Declined" };

/** One conversation, read only (opening it is logged; nothing is marked read for them). */
function Thread({ member, other, people, onBack }: { member: string; other: string; people: People; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (before?: string) => {
    setBusy(true);
    const r = await fetch(`/api/admin/dating/messages?member=${member}&with=${other}${before ? `&before=${before}` : ""}`, { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return setError(r?.error ?? "Couldn't load messages.");
    setMessages((m) => (before ? [...r.messages, ...(m ?? [])] : r.messages));
    setMore(r.more);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, other]);

  const name = (id: string) => people[id]?.name ?? id;
  return (
    <div className="adm-msgs-thread">
      <header>
        <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost" onClick={onBack}>
          <ArrowLeft size={13} aria-hidden="true" /> All conversations
        </button>
        <span>
          {name(member)} ↔ {name(other)}
        </span>
      </header>
      <p className="adm-msgs-note">
        <Eye size={13} aria-hidden="true" /> Read only. Opening this was logged; nothing is marked as read for them.
      </p>
      {error ? <p className="adm-error">{error}</p> : null}
      {more ? (
        <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost adm-msgs-older" disabled={busy} onClick={() => messages?.length && void load(messages[0].id)}>
          <ChevronDown size={13} aria-hidden="true" style={{ transform: "rotate(180deg)" }} /> Older messages
        </button>
      ) : null}
      {!messages ? (
        <div className="adm-skeleton adm-skeleton--short" />
      ) : messages.length ? (
        <ol className="adm-msgs-list">
          {messages.map((m) => (
            <li key={m.id} className={m.from === member ? "is-member" : "is-other"}>
              <Avatar person={people[m.from]} id={m.from} size={24} />
              <div>
                <b>{name(m.from)}</b> <small title={formatDate(m.at)}>{formatDate(m.at)}</small>
                <p className={m.deleted ? "is-deleted" : undefined}>{m.deleted ? "Message unsent" : m.text}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="adm-empty">No messages in this conversation.</p>
      )}
      {busy && messages ? <Loader2 size={14} className="set-spin" aria-hidden="true" /> : null}
    </div>
  );
}

/** Admins only: a member's Social conversations. */
export function MemberMessages({ userId, onOpenMember }: { userId: string; onOpenMember: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState<string | null>(null);
  const { data, error } = useLive<{ conversations: Conversation[]; people: People }>(open ? `/api/admin/dating/messages?member=${userId}` : null, 30_000);

  return (
    <section className="adm-drawer-section adm-msgs">
      <h3>
        <MessagesSquare size={16} aria-hidden="true" /> Social messages {data ? <small>{data.conversations.length}</small> : null}
      </h3>
      {!open ? (
        <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setOpen(true)}>
          <Eye size={14} aria-hidden="true" /> View their conversations
        </button>
      ) : other && data ? (
        <Thread member={userId} other={other} people={data.people} onBack={() => setOther(null)} />
      ) : error ? (
        <p className="adm-error">{error}</p>
      ) : !data ? (
        <div className="adm-skeleton adm-skeleton--short" />
      ) : data.conversations.length ? (
        <ul className="adm-msgs-convs">
          {data.conversations.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setOther(c.other)}>
                <Avatar person={data.people[c.other]} id={c.other} size={30} />
                <span className="adm-msgs-conv-main">
                  <strong>
                    {data.people[c.other]?.name ?? c.other}
                    {STATE[c.state] ? <span className="adm-tag adm-tag--muted">{STATE[c.state]}</span> : null}
                  </strong>
                  <small>
                    {c.lastText ? `${c.lastFromMember ? data.people[userId]?.name ?? "Them" : data.people[c.other]?.name ?? "Other"}: ` : ""}
                    {c.lastText || "—"}
                  </small>
                </span>
                <span className="adm-msgs-conv-meta">
                  <small>{c.lastAt ? timeAgo(c.lastAt) : ""}</small>
                  <small>{c.messages} msg{c.messages === 1 ? "" : "s"}</small>
                </span>
              </button>
              <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost" title="Open their profile" onClick={() => onOpenMember(c.other)}>
                Profile
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-empty">No Social conversations.</p>
      )}
    </section>
  );
}
