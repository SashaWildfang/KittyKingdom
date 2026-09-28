"use client";

import { ExternalLink, Eye, Radio, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OpenTicket, TicketLiveMessage } from "../../lib/ticket-live";
import { PersonLink, RichText, TICKET_COLORS, prettyAction, timeAgo, useLive, type Mentions, type People } from "./admin-shared";

const POLL_MS = 4000;

/** Tickets open right now, each with a read-only live view of its channel. */
export function OpenTickets({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const { data } = useLive<{ tickets: OpenTicket[]; people: People }>("/api/admin/tickets/open", 10_000);
  const [watching, setWatching] = useState<number | null>(null);
  const tickets = data?.tickets ?? [];
  const people = data?.people ?? {};
  const current = tickets.find((t) => t.ticketId === watching) ?? null;

  return (
    <section className="tk-open">
      <header className="tk-open-head">
        <h3>
          <Radio size={16} aria-hidden="true" /> Open now
          <span className={`adm-tab-bubble${tickets.length ? " is-hot" : ""}`}>{data ? tickets.length : "…"}</span>
        </h3>
        <span className="adm-muted">Click a ticket to watch it live (read only)</span>
      </header>
      {tickets.length ? (
        <div className="tk-open-list">
          {tickets.map((t) => (
            <button key={t.ticketId} type="button" className={`tk-open-card${watching === t.ticketId ? " is-on" : ""}`} onClick={() => setWatching(watching === t.ticketId ? null : t.ticketId)} style={{ "--c": TICKET_COLORS[t.type] ?? "#f59b2a" } as React.CSSProperties}>
              <span className="tk-open-top">
                <b>#{t.ticketId}</b>
                <span className="tk-type">{prettyAction(t.type)}</span>
                <Eye size={14} aria-hidden="true" className="tk-eye" />
              </span>
              <span className="tk-open-who">{t.openedBy ? people[t.openedBy]?.name ?? "Member" : "Member"}</span>
              <small>
                opened {timeAgo(t.created)}
                {t.claimedBy ? ` · claimed by ${people[t.claimedBy]?.name ?? "staff"}` : " · unclaimed"}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <p className="adm-muted tk-open-empty">{data ? "No tickets are open right now. 🎉" : "Loading…"}</p>
      )}
      {current ? <TicketLive ticket={current} people={people} onOpenMember={onOpenMember} onClose={() => setWatching(null)} /> : null}
    </section>
  );
}

function TicketLive({ ticket, people, onOpenMember, onClose }: { ticket: OpenTicket; people: People; onOpenMember: (id: string) => void; onClose: () => void }) {
  const [messages, setMessages] = useState<TicketLiveMessage[]>([]);
  const [mentions, setMentions] = useState<Mentions>({ channels: {}, roles: {} });
  const [guild, setGuild] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const feed = useRef<HTMLOListElement>(null);
  const stick = useRef(true);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    setMessages([]);
    lastId.current = null;
    stick.current = true;
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const q = lastId.current ? `?after=${lastId.current}` : "";
      const res = await fetch(`/api/admin/tickets/live/${ticket.ticketId}${q}`, { cache: "no-store" }).catch(() => null);
      const body = res ? await res.json().catch(() => null) : null;
      if (!alive) return;
      if (!body?.ok) {
        setError(body?.error ?? "Couldn't load the ticket.");
        return;
      }
      setError(null);
      setGone(Boolean(body.gone));
      setGuild(body.guildId ?? null);
      setMentions((m) => ({ channels: { ...m.channels, ...body.mentions.channels }, roles: { ...m.roles, ...body.mentions.roles } }));
      if (body.messages.length) {
        lastId.current = body.messages[body.messages.length - 1].id;
        setMessages((list) => [...list, ...body.messages.filter((m: TicketLiveMessage) => !list.some((x) => x.id === m.id))]);
      }
    };
    void load();
    const t = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [ticket.ticketId]);

  // Stay at the bottom as messages (and images) arrive, unless you scrolled up
  useEffect(() => {
    const el = feed.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="tk-live">
      <header>
        <span className="tk-live-dot" aria-hidden="true" />
        <b>Ticket #{ticket.ticketId}</b>
        <span className="adm-muted">
          {prettyAction(ticket.type)}
          {ticket.topic ? ` · ${ticket.topic}` : ""}
        </span>
        <span className="tk-live-actions">
          {ticket.openedBy ? <PersonLink id={ticket.openedBy} people={people} onOpen={onOpenMember} compact /> : null}
          {guild && ticket.channelId ? (
            <a className="adm-btn adm-btn--small" href={`https://discord.com/channels/${guild}/${ticket.channelId}`} target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> Open in Discord
            </a>
          ) : null}
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </span>
      </header>
      {error ? <p className="adm-error">{error}</p> : null}
      {gone ? <p className="adm-muted">This ticket&apos;s channel was just closed. Its transcript will show up in the list below.</p> : null}
      <ol
        className="tk-live-feed"
        ref={feed}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {messages.map((m) => (
          <li key={m.id} className={m.bot ? "is-bot" : undefined}>
            {m.avatar ? <img src={m.avatar} alt="" width={32} height={32} /> : <span className="tk-av">{m.author.charAt(0).toUpperCase()}</span>}
            <div>
              <p className="tk-live-who">
                <button type="button" onClick={() => onOpenMember(m.authorId)}>
                  {m.author}
                </button>
                {m.bot ? <span className="adm-tag">BOT</span> : null}
                <time dateTime={m.at}>{new Date(m.at).toLocaleString(undefined, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}</time>
                {m.edited ? <small>(edited)</small> : null}
              </p>
              {m.content ? (
                <div className="tk-live-text">
                  <RichText text={m.content} mentions={mentions} people={people} onOpenMember={onOpenMember} />
                </div>
              ) : null}
              {m.embeds.map((e, i) => (
                <div key={i} className="tk-embed" style={{ borderLeftColor: e.color ?? "var(--line)" }}>
                  {e.title ? <b>{e.title}</b> : null}
                  {e.description ? (
                    <div>
                      <RichText text={e.description} mentions={mentions} people={people} onOpenMember={onOpenMember} />
                    </div>
                  ) : null}
                  {e.fields.map((f, j) => (
                    <p key={j}>
                      <b>{f.name}</b> {f.value}
                    </p>
                  ))}
                  {e.image ? <img src={e.image} alt="" loading="lazy" /> : null}
                </div>
              ))}
              {m.attachments.map((a, i) =>
                a.image ? (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" className="tk-media">
                    <img src={a.url} alt={a.name} loading="lazy" />
                  </a>
                ) : a.video ? (
                  <video key={i} className="tk-media" src={a.url} controls preload="metadata" />
                ) : (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" className="adm-tag">
                    📎 {a.name}
                  </a>
                ),
              )}
              {m.reactions.length ? (
                <p className="tk-reactions">
                  {m.reactions.map((r, i) => (
                    <span key={i}>
                      {r.emoji} {r.count}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          </li>
        ))}
        {!messages.length && !error ? <li className="adm-muted">Loading the conversation…</li> : null}
      </ol>
      <p className="adm-muted tk-live-foot">Updates every few seconds · read only · reply in Discord</p>
    </div>
  );
}
