"use client";

import { Backpack, Ban, Check, ClipboardCheck, Minus, Plus, Trash2, FileText, MessageCircle, Shield, Star, X } from "lucide-react";
import { LeafEmote, StoreItemIcon } from "../ui-icons";
import { useEffect, useRef, useState } from "react";
import type { Drill } from "./drill-panel";
import { MemberJoinApp } from "./join-apps";
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
  stats: { level: number; balance: number | null; messages: number; xp: number } | null;
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
          <X size={16} />
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
              {data.banned ? <span className="adm-status adm-status--banned"><Ban size={13} aria-hidden="true" /> Banned</span> : null}
              {data.inServer ? <span className="adm-status adm-status--active">● In server</span> : <span className="adm-status">Not in server</span>}
              {data.stats ? (
                <>
                  <span className="adm-tag"><Star size={12} aria-hidden="true" /> Level {data.stats.level}</span>
                  {data.stats.balance !== null ? <span className="adm-tag"><LeafEmote size={13} /> {data.stats.balance.toLocaleString()}</span> : null}
                  <span className="adm-tag"><MessageCircle size={12} aria-hidden="true" /> {data.stats.messages.toLocaleString()} msgs</span>
                </>
              ) : null}
            </div>

            {issued.data && issued.data.total > 0 ? (
              <section className="adm-drawer-section adm-staff-actions">
                <h3>
                  <Shield size={16} aria-hidden="true" /> Staff actions <small>{issued.data.total}</small>
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
                <ClipboardCheck size={16} aria-hidden="true" /> Join application
              </h3>
              <MemberJoinApp discordId={userId} onOpenMember={onOpenMember} />
            </section>

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

            <section className="adm-drawer-section">
              <h3>
                Roles <small>{data.roles.length}</small>
              </h3>
              <RoleEditor userId={userId} roles={data.roles} inServer={data.inServer} editable={canEditRoles} onChanged={reload} />
            </section>

            {canEditRoles ? (
              <section className="adm-drawer-section">
                <h3>
                  <Backpack size={16} aria-hidden="true" /> Inventory
                </h3>
                <InventoryEditor userId={userId} />
              </section>
            ) : null}

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
                          <FileText size={14} aria-hidden="true" /> View
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
          </>
        ) : loading ? (
          <div className="adm-skeleton" style={{ height: 240 }} />
        ) : null}
      </aside>
    </div>
  );
}

type Role = { id: string; name: string; colors: string[]; position?: number };

const byRank = (list: Role[]) => [...list].sort((a, b) => (b.position ?? 0) - (a.position ?? 0));

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
    setLocalRoles((list) => (add ? byRank([...list, role]) : list.filter((r) => r.id !== role.id)));
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
                  {armed ? <Check size={11} /> : <X size={11} />}
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

type InvItem = { itemId: string; name: string; type: string; icon: string | null; count: number; gifted: number; equipped: boolean };
type CatalogItem = { itemId: string; name: string; type: string; icon: string | null; stackable: boolean };

/** Admins: see and change what a member owns. */
function InventoryEditor({ userId }: { userId: string }) {
  const { data, reload } = useLive<{ items: InvItem[]; catalog: CatalogItem[] }>(`/api/admin/user/${userId}/inventory`, 20_000);
  const [items, setItems] = useState<InvItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => {
    if (data) setItems(data.items);
  }, [data]);

  async function setCount(itemId: string, count: number) {
    setBusy(itemId);
    setMessage(null);
    setConfirmRemove(null);
    try {
      const res = await fetch(`/api/admin/user/${userId}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, count }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "That didn't work.");
      setItems(body.items);
      setMessage({ text: body.message, tone: "ok" });
      void reload();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "That didn't work.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const owned = new Set((items ?? []).map((i) => i.itemId));
  const options = (data?.catalog ?? []).filter((c) => (!owned.has(c.itemId) || c.stackable) && c.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <div className="adm-inv">
      {!items ? <div className="adm-skeleton adm-skeleton--short" /> : null}
      {items && !items.length ? <p className="adm-empty">Their inventory is empty.</p> : null}
      <ul className="adm-inv-list">
        {(items ?? []).map((i) => (
          <li key={i.itemId}>
            <span className="adm-inv-icon" aria-hidden="true">
              <StoreItemIcon icon={i.type === "role" ? "package" : i.icon} size={18} />
            </span>
            <span className="adm-inv-text">
              <strong>{i.name}</strong>
              <small>
                {i.type}
                {i.gifted ? ` · ${i.gifted} gifted` : ""}
                {i.equipped ? " · equipped" : ""}
              </small>
            </span>
            {confirmRemove === i.itemId ? (
              <span className="adm-inv-confirm">
                <button type="button" className="adm-btn adm-btn--danger adm-btn--small" disabled={busy === i.itemId} onClick={() => void setCount(i.itemId, 0)}>
                  Remove all
                </button>
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirmRemove(null)}>
                  Cancel
                </button>
              </span>
            ) : (
              <span className="adm-inv-stepper">
                <button type="button" aria-label={`One less ${i.name}`} disabled={busy === i.itemId} onClick={() => (i.count <= 1 ? setConfirmRemove(i.itemId) : void setCount(i.itemId, i.count - 1))}>
                  <Minus size={14} />
                </button>
                <strong>{busy === i.itemId ? "…" : i.count}</strong>
                <button type="button" aria-label={`One more ${i.name}`} disabled={busy === i.itemId || (i.type === "role" && i.count >= 1)} onClick={() => void setCount(i.itemId, i.count + 1)}>
                  <Plus size={14} />
                </button>
                <button type="button" className="adm-inv-trash" aria-label={`Remove all ${i.name}`} onClick={() => setConfirmRemove(i.itemId)}>
                  <Trash2 size={14} />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="adm-role-add" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
        {adding ? "Done" : "+ Add item"}
      </button>
      {adding ? (
        <div className="adm-role-picker">
          <input type="search" placeholder="Search items…" value={filter} onChange={(e) => setFilter(e.target.value)} autoFocus />
          <ul>
            {options.map((c) => (
              <li key={c.itemId}>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void setCount(c.itemId, ((items ?? []).find((i) => i.itemId === c.itemId)?.count ?? 0) + 1)}
                >
                  <StoreItemIcon icon={c.type === "role" ? "package" : c.icon} size={15} />
                  {c.name}
                  <small className="adm-muted">{c.type}</small>
                  <span>{busy === c.itemId ? "Adding…" : "Give 1"}</span>
                </button>
              </li>
            ))}
            {data && !options.length ? <li className="adm-muted">No items match.</li> : null}
          </ul>
        </div>
      ) : null}
      {message ? <p className={message.tone === "ok" ? "adm-notice" : "adm-error"}>{message.text}</p> : null}
    </div>
  );
}
