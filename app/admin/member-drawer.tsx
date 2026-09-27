"use client";

import { useEffect, useRef, useState } from "react";
import type { Drill } from "./drill-panel";
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
  RichText,
  type Mentions,
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
  tickets: Ticket[] | null;
  ticketTotal: number | null;
  mentions: Mentions;
  people: People;
};

export function MemberDrawer({
  userId,
  canEditRoles,
  onDrill,
  onClose,
  onOpenMember,
  onOpenTranscript,
}: {
  userId: string;
  canEditRoles: boolean;
  onDrill: (drill: Drill) => void;
  onClose: () => void;
  onOpenMember: (id: string) => void;
  onOpenTranscript: (ticketId: number) => void;
}) {
  const { data, error, loading, reload } = useLive<Result>(`/api/admin/user/${userId}`, 20_000);
  // Anything this member did as staff (punishments they issued)
  const issued = useLive<{ rows: Punishment[]; total: number; people: People; mentions: Mentions }>(
    `/api/admin/punishments?issuerId=${userId}&pageSize=10`,
    20_000,
  );

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

            {issued.data && issued.data.total > 0 ? (
              <section className="adm-drawer-section adm-staff-actions">
                <h3>
                  🛡️ Staff actions <small>{issued.data.total}</small>
                  <button type="button" className="adm-link adm-h3-link" onClick={() => onDrill({ kind: "staff", id: userId })}>
                    View all →
                  </button>
                </h3>
                <ol className="adm-timeline">
                  {issued.data.rows.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <div className="adm-timeline-head">
                        <ActionBadge action={p.action} />
                        <span className="adm-muted" title={formatDate(p.timestamp)}>
                          {timeAgo(p.timestamp)}
                        </span>
                        <span className="adm-timeline-by">
                          on <PersonLink id={p.userId} people={issued.data!.people} onOpen={onOpenMember} compact />
                        </span>
                      </div>
                      <p>{p.reason ? <RichText text={p.reason} mentions={issued.data!.mentions} people={issued.data!.people} onOpenMember={onOpenMember} /> : "No reason given."}</p>
                    </li>
                  ))}
                </ol>
                {issued.data.total > 5 ? (
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => onDrill({ kind: "staff", id: userId })}>
                    View all {issued.data.total} actions
                  </button>
                ) : null}
              </section>
            ) : null}

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
                      <p>{p.reason ? <RichText text={p.reason} mentions={data.mentions} people={data.people} onOpenMember={onOpenMember} /> : "No reason given."}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="adm-empty">Clean record. No punishments on file.</p>
              )}
            </section>

            {data.tickets ? (
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
            ) : null}

            <section className="adm-drawer-section">
              <h3>
                Roles <small>{data.roles.length}</small>
              </h3>
              <RoleEditor userId={userId} roles={data.roles} inServer={data.inServer} editable={canEditRoles} onChanged={reload} />
            </section>
          </>
        ) : loading ? (
          <div className="adm-skeleton" style={{ height: 240 }} />
        ) : null}
      </aside>
    </div>
  );
}

type Role = { id: string; name: string; colors: string[] };

/** A member's roles; admins can hover a role to remove it or add one from a searchable list. */
function RoleEditor({ userId, roles, inServer, editable, onChanged }: { userId: string; roles: Role[]; inServer: boolean; editable: boolean; onChanged: () => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [available, setAvailable] = useState<Role[] | null>(null);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [localRoles, setLocalRoles] = useState(roles);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => setLocalRoles(roles), [roles]);

  useEffect(() => {
    if (picking) search.current?.focus();
  }, [picking]);

  const manageable = new Set((available ?? []).map((r) => r.id));

  async function change(role: Role, add: boolean) {
    setBusy(role.id);
    setConfirm(null);
    setMessage(null);
    // Show the change straight away; the live refresh confirms it
    setLocalRoles((list) => (add ? [...list, role] : list.filter((r) => r.id !== role.id)));
    try {
      const res = await fetch(`/api/admin/user/${userId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: role.id, add }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "That didn't work.");
      setMessage({ text: body.message, tone: "ok" });
      onChanged();
    } catch (e) {
      setLocalRoles(roles);
      setMessage({ text: e instanceof Error ? e.message : "That didn't work.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  // Load the manageable list once so hover-to-remove only shows on roles the admin can manage
  useEffect(() => {
    if (!editable || available) return;
    fetch("/api/admin/roles", { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => setAvailable(body.roles ?? []))
      .catch(() => setAvailable([]));
  }, [editable, available]);

  const has = new Set(localRoles.map((r) => r.id));
  const options = (available ?? []).filter((r) => !has.has(r.id) && r.name.toLowerCase().includes(filter.trim().toLowerCase()));

  if (!inServer) return <p className="adm-empty">Not in the server.</p>;

  return (
    <div className="adm-role-editor">
      <div className="adm-roles">
        {localRoles.map((r) => {
          const canRemove = editable && manageable.has(r.id);
          const armed = confirm === r.id;
          return (
            <span
              key={r.id}
              className={`adm-role${canRemove ? " is-editable" : ""}${armed ? " is-armed" : ""}${busy === r.id ? " is-busy" : ""}`}
              style={{ "--c": r.colors[0] ?? "#8b8d98" } as React.CSSProperties}
            >
              <i className="adm-role-dot" aria-hidden="true" />
              {armed ? `Remove ${r.name}?` : r.name}
              {canRemove ? (
                <button
                  type="button"
                  className="adm-role-x"
                  aria-label={armed ? `Confirm removing ${r.name}` : `Remove ${r.name}`}
                  title={armed ? "Click again to remove" : "Remove role"}
                  disabled={Boolean(busy)}
                  onClick={() => (armed ? void change(r, false) : setConfirm(r.id))}
                  onBlur={() => armed && window.setTimeout(() => setConfirm((c) => (c === r.id ? null : c)), 150)}
                >
                  {armed ? "✓" : "×"}
                </button>
              ) : null}
            </span>
          );
        })}
        {!localRoles.length ? <span className="adm-muted">No roles.</span> : null}
        {editable ? (
          <button type="button" className="adm-role-add" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
            {picking ? "Done" : "+ Add role"}
          </button>
        ) : null}
      </div>

      {picking ? (
        <div className="adm-role-picker">
          <input ref={search} type="search" placeholder="Search roles…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <ul>
            {available === null ? <li className="adm-muted">Loading roles…</li> : null}
            {options.map((r) => (
              <li key={r.id}>
                <button type="button" disabled={Boolean(busy)} onClick={() => void change(r, true)} style={{ "--c": r.colors[0] ?? "#8b8d98" } as React.CSSProperties}>
                  <i className="adm-role-dot" aria-hidden="true" />
                  {r.name}
                  <span>{busy === r.id ? "Adding…" : "Add"}</span>
                </button>
              </li>
            ))}
            {available && !options.length ? <li className="adm-muted">No other roles you can add.</li> : null}
          </ul>
        </div>
      ) : null}

      {message ? <p className={message.tone === "ok" ? "adm-notice" : "adm-error"}>{message.text}</p> : null}
    </div>
  );
}
