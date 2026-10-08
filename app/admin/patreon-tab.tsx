"use client";

import "./patreon-admin.css";
import { AlertTriangle, CheckCircle2, Link2Off, Palette, RefreshCw, Search, Trash2, UserPlus, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import type { PatreonOverview, PatronRow } from "../../lib/patreon-admin";
import { TIERS, type TierKey } from "../../lib/perks";
import { TierIcon } from "../tier-icon";
import { MemberSearch, PersonLink, timeAgo, useLive, type People } from "./admin-shared";

type Filter = "active" | "manual" | "unlinked" | "former" | "roles" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "manual", label: "Manual grants" },
  { key: "roles", label: "Custom roles" },
  { key: "unlinked", label: "Not linked" },
  { key: "former", label: "Former" },
  { key: "all", label: "Everyone" },
];

const STATUS: Record<string, string> = { active_patron: "Active", declined_patron: "Payment declined", former_patron: "Former", manual: "Manual grant" };
const isActive = (r: PatronRow) => r.source === "manual" || r.status === "active_patron";
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");
const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

/** Admin → Patreon: patrons from the main bot's Patreon sync, manual grants, titles and custom roles. */
export function PatreonTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const { data, reload } = useLive<{ ok: boolean; error?: string } & PatreonOverview>("/api/admin/patreon", 30_000);
  const [filter, setFilter] = useState<Filter>("active");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [grantText, setGrantText] = useState("");
  const [grantId, setGrantId] = useState<string | null>(null);
  const [grantTier, setGrantTier] = useState<TierKey>("knight");

  const act = async (key: string, body: Record<string, string>, done: string) => {
    setBusy(key);
    setErr(null);
    setNote(null);
    const r = await fetch("/api/admin/patreon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(null);
    if (!r?.ok) return setErr(r?.error ?? "That didn't work."), false;
    setNote(done);
    await reload();
    return true;
  };

  const people: People = useMemo(() => {
    const out: People = {};
    for (const r of data?.rows ?? []) if (r.discordId) out[r.discordId] = { name: r.name, username: null, avatar: r.avatar, inServer: r.inServer };
    return out;
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (needle && !r.name.toLowerCase().includes(needle) && !(r.discordId ?? "").includes(needle) && !(r.customRole?.name.toLowerCase().includes(needle) ?? false)) return false;
      if (filter === "active") return isActive(r) && r.tier;
      if (filter === "manual") return r.source === "manual";
      if (filter === "roles") return Boolean(r.customRole);
      if (filter === "unlinked") return r.source === "patreon" && !r.discordId;
      if (filter === "former") return r.source === "patreon" && !isActive(r);
      return true;
    });
  }, [data, filter, q]);

  if (!data) return <div className="adm-skeleton" style={{ height: 420 }} />;
  if (!data.ok) return <p className="adm-error">{data.error ?? "Couldn't load Patreon."}</p>;
  const { sync } = data;

  return (
    <section className="adm-panel pa">
      {/* Sync status */}
      <div className={`adm-card pa-sync${sync.ok === false ? " is-bad" : ""}`}>
        <div className="pa-sync-text">
          {sync.ok === false ? <AlertTriangle size={20} aria-hidden="true" /> : <CheckCircle2 size={20} aria-hidden="true" />}
          <div>
            <b>
              {!sync.configured
                ? "The Patreon sync hasn't run yet"
                : sync.ok === false
                  ? "The last Patreon sync failed"
                  : `Synced with Patreon ${timeAgo(sync.at)}`}
            </b>
            <small className="adm-muted">
              {sync.error
                ? sync.error
                : sync.configured
                  ? `${sync.members} on Patreon · ${sync.active} paying · ${sync.linked} linked to Discord. The bot syncs every 5 minutes.`
                  : "The main bot needs PATREON_ACCESS_TOKEN in its .env. Manual grants also apply on the next sync."}
            </small>
          </div>
        </div>
        <button type="button" className="adm-btn" disabled={busy === "sync" || sync.requested} onClick={() => act("sync", { action: "sync" }, "Sync requested. The bot picks it up within about 10 seconds.")}>
          <RefreshCw size={15} aria-hidden="true" className={sync.requested ? "pa-spin" : undefined} /> {sync.requested ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {/* Numbers */}
      <div className="adm-kpis">
        <div className="adm-kpi adm-kpi--green">
          <small>Active supporters</small>
          <strong>{data.active.toLocaleString()}</strong>
          <span>{data.manual ? `${data.manual} by manual grant` : "all from Patreon"}</span>
        </div>
        <div className="adm-kpi">
          <small>Monthly pledges</small>
          <strong>{money(data.monthlyUsd)}</strong>
          <span>before Patreon's fees</span>
        </div>
        {[...TIERS].reverse().map((t) => (
          <div key={t.key} className="adm-kpi pa-kpi-tier" style={{ "--tone": t.color } as React.CSSProperties}>
            <small>
              <TierIcon tier={t.key} size={13} /> {t.name}
            </small>
            <strong>{data.counts[t.key].toLocaleString()}</strong>
            <span>${t.price}/month</span>
          </div>
        ))}
        <button type="button" className={`adm-kpi is-link${data.unlinked ? " adm-kpi--yellow" : ""}`} onClick={() => setFilter("unlinked")}>
          <small>Paying, not linked</small>
          <strong>{data.unlinked}</strong>
          <span>no Discord connected on Patreon</span>
        </button>
      </div>

      {/* Manual grant */}
      <div className="adm-card pa-grant">
        <h3>
          <UserPlus size={17} aria-hidden="true" /> Give a tier manually
        </h3>
        <p className="adm-muted">For giveaways, staff, or someone whose Patreon won't link. It stays until you revoke it, even without a pledge.</p>
        <div className="pa-grant-row">
          <MemberSearch
            value={grantText}
            onChange={(v) => {
              setGrantText(v);
              setGrantId(/^\d{15,25}$/.test(v.trim()) ? v.trim() : null);
            }}
            onPick={(m) => {
              setGrantText(m.name);
              setGrantId(m.id);
            }}
            placeholder="Search a member or paste a Discord ID"
            className="pa-grant-search"
          />
          <select className="adm-select" value={grantTier} onChange={(e) => setGrantTier(e.target.value as TierKey)} aria-label="Tier">
            {[...TIERS].reverse().map((t) => (
              <option key={t.key} value={t.key}>
                {t.name} (${t.price})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="adm-btn"
            disabled={!grantId || busy === "grant"}
            onClick={async () => {
              if (await act("grant", { action: "grant", discordId: grantId!, tier: grantTier }, `Granted ${TIERS.find((t) => t.key === grantTier)?.name}. Their role arrives on the next sync (started now).`)) {
                setGrantText("");
                setGrantId(null);
              }
            }}
          >
            Grant
          </button>
        </div>
      </div>

      {err ? <p className="adm-error">{err}</p> : null}
      {note ? <p className="pa-note">{note}</p> : null}

      {/* List */}
      <div className="adm-filters pa-filters">
        <div className="adm-seg pa-seg" role="tablist" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={filter === f.key ? "is-active" : undefined} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="adm-search pa-search">
          <Search size={15} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, ID or role name" aria-label="Search patrons" />
        </label>
      </div>

      {!rows.length ? (
        <div className="adm-empty">
          <UserX size={22} aria-hidden="true" /> Nobody here{q ? " matches that search" : ""}.
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table pa-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Tier</th>
                <th>Pledge</th>
                <th>Status</th>
                <th>Custom role</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tier = TIERS.find((t) => t.key === r.tier);
                const charge = r.lastChargeStatus && r.lastChargeStatus !== "Paid" ? r.lastChargeStatus : null;
                return (
                  <tr key={r.key}>
                    <td data-label="Member"><div className="pa-cell">
                      {r.discordId ? (
                        <PersonLink id={r.discordId} people={people} onOpen={onOpenMember} />
                      ) : (
                        <span className="pa-unlinked">
                          <Link2Off size={15} aria-hidden="true" /> Not linked to Discord
                        </span>
                      )}
                    </div></td>
                    <td data-label="Tier"><div className="pa-cell">
                      {tier ? (
                        <span className="pa-tier" style={{ "--tier": tier.color } as React.CSSProperties}>
                          <TierIcon tier={tier.key} size={14} /> {r.title}
                        </span>
                      ) : (
                        <span className="adm-muted">None</span>
                      )}
                    </div></td>
                    <td data-label="Pledge"><div className="pa-cell">
                      {r.source === "manual" ? (
                        <span className="adm-muted" title={r.grantedBy ? `Granted by ${r.grantedBy}` : undefined}>
                          Free{r.grantedBy ? ` · by ${r.grantedBy}` : ""}
                        </span>
                      ) : (
                        <>
                          <b>{money(r.pledge)}</b>
                          {r.nextChargeDate && isActive(r) ? <small className="pa-sub">next {day(r.nextChargeDate)}</small> : null}
                        </>
                      )}
                    </div></td>
                    <td data-label="Status"><div className="pa-cell">
                      <span className={`adm-status${isActive(r) ? " adm-status--active" : r.status === "declined_patron" ? " adm-status--banned" : ""}`}>
                        {STATUS[r.status ?? ""] ?? r.status ?? "Unknown"}
                      </span>
                      {charge ? <small className="pa-sub pa-warn">last charge: {charge}</small> : null}
                      {r.since ? <small className="pa-sub">since {day(r.since)}</small> : null}
                    </div></td>
                    <td data-label="Custom role"><div className="pa-cell">
                      {r.customRole ? (
                        <span className="pa-role" title={r.customRole.error ?? undefined}>
                          <span
                            className="pa-swatch"
                            aria-hidden="true"
                            style={{
                              background:
                                r.customRole.style === "holographic"
                                  ? "linear-gradient(135deg, #a9c9ff, #ffbbec, #ffc3a0)"
                                  : r.customRole.style === "gradient" && r.customRole.color2
                                    ? `linear-gradient(135deg, ${r.customRole.color}, ${r.customRole.color2})`
                                    : r.customRole.color,
                            }}
                          />
                          <span>
                            {r.customRole.icon ? `${r.customRole.icon} ` : ""}
                            {r.customRole.name || <em>unnamed</em>}
                            <small className={`pa-sub${r.customRole.status === "error" ? " pa-warn" : ""}`}>
                              {r.customRole.status === "error" ? r.customRole.error ?? "error" : r.customRole.status}
                              {r.customRole.style !== "solid" ? ` · ${r.customRole.style}` : ""}
                            </small>
                          </span>
                        </span>
                      ) : (
                        <span className="adm-muted">{tier?.customRole ? "Not made yet" : "—"}</span>
                      )}
                    </div></td>
                    <td className="pa-actions">
                      {r.customRole && r.discordId ? (
                        <button
                          type="button"
                          className="adm-btn adm-btn--ghost adm-btn--small"
                          disabled={busy === `role:${r.discordId}`}
                          onClick={() =>
                            window.confirm(`Delete ${r.name}'s custom role "${r.customRole!.name}"? They'll get a DM and can make a new one.`) &&
                            act(`role:${r.discordId}`, { action: "remove-role", discordId: r.discordId! }, "Custom role removed. The bot deletes it in Discord within a few seconds.")
                          }
                        >
                          <Palette size={14} aria-hidden="true" /> Remove role
                        </button>
                      ) : null}
                      {r.source === "manual" && r.discordId ? (
                        <button
                          type="button"
                          className="adm-btn adm-btn--ghost adm-btn--small pa-danger"
                          disabled={busy === `revoke:${r.discordId}`}
                          onClick={() =>
                            window.confirm(`Revoke ${r.name}'s manual ${tier?.name ?? "tier"}? If they don't pledge on Patreon, they lose the role on the next sync.`) &&
                            act(`revoke:${r.discordId}`, { action: "revoke", discordId: r.discordId! }, "Grant revoked. The next sync (started now) removes the role.")
                          }
                        >
                          <Trash2 size={14} aria-hidden="true" /> Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="adm-muted pa-foot">
        Titles (King or Queen and so on) are each member's choice on My Account or with <code>/title</code>. Pledges and charges come from Patreon; refunds and cancellations are handled on Patreon itself.
      </p>
    </section>
  );
}
