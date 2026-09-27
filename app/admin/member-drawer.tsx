"use client";

import { useEffect } from "react";
import {
  ActionBadge,
  Avatar,
  CopyId,
  PersonLink,
  TICKET_COLORS,
  formatDate,
  prettyAction,
  timeAgo,
  useLive,
  type People,
  type Punishment,
  type Ticket,
} from "./admin-shared";

type Result = {
  userId: string;
  inServer: boolean;
  banned: boolean | null;
  roles: { id: string; name: string; colors: string[] }[];
  stats: { level: number; balance: number; messages: number; xp: number } | null;
  punishments: Punishment[];
  punishmentTotal: number;
  tickets: Ticket[];
  ticketTotal: number;
  people: People;
};

export function MemberDrawer({
  userId,
  onClose,
  onOpenMember,
  onOpenTranscript,
}: {
  userId: string;
  onClose: () => void;
  onOpenMember: (id: string) => void;
  onOpenTranscript: (ticketId: number) => void;
}) {
  const { data, error, loading } = useLive<Result>(`/api/admin/user/${userId}`, 20_000);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const person = data?.people[userId];
  const counts = new Map<string, number>();
  for (const p of data?.punishments ?? []) counts.set(p.action, (counts.get(p.action) ?? 0) + 1);

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <aside className="adm-drawer" onClick={(e) => e.stopPropagation()} aria-label="Member profile">
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <header className="adm-drawer-head">
          <Avatar person={person} id={userId} size={64} />
          <div>
            <h2>{person?.name ?? (loading ? "Loading…" : "Unknown user")}</h2>
            {person?.username ? <p>@{person.username}</p> : null}
            <CopyId id={userId} />
          </div>
        </header>

        {error ? <p className="adm-error">{error}</p> : null}

        {data ? (
          <>
            <div className="adm-drawer-flags">
              {data.banned ? <span className="adm-status adm-status--banned">⛔ Banned</span> : null}
              {data.inServer ? <span className="adm-status adm-status--active">● In server</span> : <span className="adm-status">Not in server</span>}
              {data.stats ? (
                <>
                  <span className="adm-tag">⭐ Level {data.stats.level}</span>
                  <span className="adm-tag">🍃 {data.stats.balance.toLocaleString()}</span>
                  <span className="adm-tag">💬 {data.stats.messages.toLocaleString()} msgs</span>
                </>
              ) : null}
            </div>

            <section className="adm-drawer-section">
              <h3>
                Punishments <small>{data.punishmentTotal}</small>
              </h3>
              {counts.size ? (
                <div className="adm-drawer-counts">
                  {Array.from(counts).map(([action, n]) => (
                    <span key={action}>
                      <ActionBadge action={action} /> ×{n}
                    </span>
                  ))}
                </div>
              ) : null}
              {data.punishments.length ? (
                <ol className="adm-timeline">
                  {data.punishments.map((p) => (
                    <li key={p.id}>
                      <div className="adm-timeline-head">
                        <ActionBadge action={p.action} />
                        <span className="adm-muted" title={formatDate(p.timestamp)}>
                          {timeAgo(p.timestamp)}
                        </span>
                        <span className="adm-timeline-by">
                          by <PersonLink id={p.issuerId} people={data.people} onOpen={onOpenMember} automodId={p.source === "automod"} compact />
                        </span>
                      </div>
                      <p>{p.reason || "No reason given."}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="adm-empty">Clean record. No punishments on file.</p>
              )}
            </section>

            <section className="adm-drawer-section">
              <h3>
                Tickets <small>{data.ticketTotal}</small>
              </h3>
              {data.tickets.length ? (
                <ul className="adm-drawer-tickets">
                  {data.tickets.map((t) => (
                    <li key={t.ticketId}>
                      <strong>#{t.ticketId}</strong>
                      <span className="adm-action" style={{ "--c": TICKET_COLORS[t.type] ?? "#8b8d98" } as React.CSSProperties}>
                        {prettyAction(t.type)}
                      </span>
                      <span className="adm-muted">{timeAgo(t.created)}</span>
                      {t.transcriptId ? (
                        <button type="button" className="adm-btn adm-btn--small" onClick={() => onOpenTranscript(t.ticketId)}>
                          📄 View
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="adm-empty">No tickets opened.</p>
              )}
            </section>

            <section className="adm-drawer-section">
              <h3>
                Roles <small>{data.roles.length}</small>
              </h3>
              <div className="adm-roles">
                {data.roles.map((r) => (
                  <span key={r.id} className="adm-role" style={{ "--c": r.colors[0] ?? "#8b8d98" } as React.CSSProperties}>
                    {r.name}
                  </span>
                ))}
                {!data.roles.length ? <p className="adm-empty">{data.inServer ? "No roles." : "Not in the server."}</p> : null}
              </div>
            </section>
          </>
        ) : loading ? (
          <div className="adm-skeleton" style={{ height: 240 }} />
        ) : null}
      </aside>
    </div>
  );
}
