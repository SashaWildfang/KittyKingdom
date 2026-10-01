"use client";

import { ArrowRight, MessagesSquare } from "lucide-react";
import { Avatar, timeAgo, useLive, type People } from "./admin-shared";
import type { Chat } from "./messages-tab";

type Conversation = { id: string; users: [string, string]; state: string; lastAt: string | null; lastText: string; lastFrom: string | null; messages: number };

/** Admins only: a member's latest Social chats on their full profile; each one opens live in Admin → Messages. */
export function MemberMessages({ userId, onOpenChat, onOpenAll }: { userId: string; onOpenChat: (c: Chat) => void; onOpenAll: (name: string) => void }) {
  const { data, error } = useLive<{ conversations: Conversation[]; more: boolean; people: People }>(`/api/admin/dating/messages?member=${userId}&limit=5`, 20_000);
  const people = data?.people ?? {};
  const name = people[userId]?.name ?? "them";

  return (
    <section className="adm-drawer-section amx-card">
      <h3>
        <MessagesSquare size={16} aria-hidden="true" /> Social messages
        {data?.conversations.length ? (
          <button type="button" className="adm-btn adm-btn--tiny adm-btn--ghost amx-card-all" onClick={() => onOpenAll(name)}>
            Open in Messages <ArrowRight size={13} aria-hidden="true" />
          </button>
        ) : null}
      </h3>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data && !error ? <div className="adm-skeleton adm-skeleton--short" /> : null}
      {data && !data.conversations.length ? <p className="adm-empty">No Social chats.</p> : null}
      {data?.conversations.length ? (
        <ul className="amx-card-list">
          {data.conversations.map((c) => {
            const other = c.users[1];
            return (
              <li key={c.id}>
                <button type="button" onClick={() => onOpenChat({ a: userId, b: other })} title="Read this chat live">
                  <Avatar person={people[other]} id={other} size={30} />
                  <span className="amx-item-main">
                    <strong>
                      {people[other]?.name ?? "Unknown"}
                      {c.state === "request" ? <span className="adm-tag adm-tag--muted">Request</span> : null}
                    </strong>
                    <small>
                      {c.lastFrom ? `${c.lastFrom === userId ? name : people[other]?.name ?? "Them"}: ` : ""}
                      {c.lastText || "—"}
                    </small>
                  </span>
                  <span className="amx-item-meta">
                    <small>{c.lastAt ? timeAgo(c.lastAt) : ""}</small>
                    <small>{c.messages} msg{c.messages === 1 ? "" : "s"}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {data?.more ? (
        <button type="button" className="adm-btn adm-btn--ghost amx-card-more" onClick={() => onOpenAll(name)}>
          See all of {name}&apos;s chats
        </button>
      ) : null}
    </section>
  );
}
