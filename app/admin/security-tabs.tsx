"use client";

// Admin → Website → Admin log (every panel change, with Undo where it's safe) and Team → Security (staff
// two-factor and signed-in devices).

import "./security.css";
import { History, LogOut, MonitorSmartphone, ShieldAlert, ShieldCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { askConfirm } from "../confirm-dialog";
import { PersonLink, formatDate, timeAgo, useLive, type People } from "./admin-shared";

type Entry = { id: string; at: string; action: string; label: string; adminDiscordId: string; adminName: string; target: string | null; summary: string; undo: string | null; undone: { at: string; byName: string } | null };

export function AdminLogTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [admin, setAdmin] = useState("");
  const [action, setAction] = useState("");
  const [older, setOlder] = useState<Entry[]>([]);
  const q = new URLSearchParams();
  if (admin) q.set("admin", admin);
  if (action) q.set("action", action);
  const { data, error, reload } = useLive<{ entries: Entry[]; actions: { action: string; label: string; n: number }[]; admins: { id: string; name: string; n: number }[]; people: People }>(`/api/admin/admin-log?${q}`, 30_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [more, setMore] = useState<People>({});
  const entries = [...(data?.entries ?? []), ...older];
  const everyone = { ...more, ...(data?.people ?? {}) };

  async function undo(e: Entry) {
    if (!(await askConfirm(`${e.undo}.`, { title: `Undo “${e.label}”?`, confirmLabel: "Undo it" }))) return;
    setBusy(e.id);
    setProblem(null);
    const r = await fetch("/api/admin/admin-log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(null);
    if (!r?.ok) return setProblem(r?.error ?? "Undo didn't work.");
    setOlder([]);
    reload();
  }
  async function loadOlder() {
    const last = entries[entries.length - 1];
    if (!last) return;
    const p = new URLSearchParams(q);
    p.set("before", last.id);
    const r = await fetch(`/api/admin/admin-log?${p}`, { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    if (r?.ok) {
      setOlder((o) => [...o, ...r.entries]);
      setMore((m) => ({ ...m, ...r.people }));
    }
  }

  return (
    <div className="sec">
      <header className="sec-head">
        <div>
          <h2>
            <History size={20} aria-hidden="true" /> Admin log
          </h2>
          <p className="adm-muted">Every change made in the panel, newest first. Some can be undone here: role changes, watchlist adds, report decisions, AutoMod mistakes and maintenance mode.</p>
        </div>
        <div className="sec-filters">
          <select className="adm-select" value={admin} onChange={(e) => (setAdmin(e.target.value), setOlder([]))} aria-label="Who">
            <option value="">Everyone</option>
            {data?.admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.id} ({a.n})
              </option>
            ))}
          </select>
          <select className="adm-select" value={action} onChange={(e) => (setAction(e.target.value), setOlder([]))} aria-label="What">
            <option value="">Every kind of change</option>
            {data?.actions.map((a) => (
              <option key={a.action} value={a.action}>
                {a.label} ({a.n})
              </option>
            ))}
          </select>
        </div>
      </header>
      {error ? <p className="adm-error">{error}</p> : null}
      {problem ? <p className="adm-error">{problem}</p> : null}
      {!data ? <div className="adm-skeleton" style={{ height: 240 }} /> : null}
      <ol className="sec-log">
        {entries.map((e) => (
          <li key={e.id} className={e.undone ? "is-undone" : undefined}>
            <time title={formatDate(e.at)}>{timeAgo(e.at)}</time>
            <div className="sec-log-body">
              <span>
                <b>{e.adminName || "Someone"}</b> {e.label.toLowerCase()}
                {e.target ? (
                  <>
                    {" · "}
                    <PersonLink id={e.target} people={everyone} onOpen={onOpenMember} compact />
                  </>
                ) : null}
              </span>
              {e.summary ? <small className="adm-muted">{e.summary}</small> : null}
              {e.undone ? (
                <small className="sec-undone">
                  Undone by {e.undone.byName} {timeAgo(e.undone.at)}
                </small>
              ) : null}
            </div>
            {e.undo ? (
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" disabled={busy === e.id} onClick={() => void undo(e)} title={e.undo}>
                <Undo2 size={12} aria-hidden="true" /> Undo
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {data && entries.length >= 50 ? (
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small sec-more" onClick={() => void loadOlder()}>
          Show older
        </button>
      ) : null}
      {data && !entries.length ? <p className="adm-empty">Nothing logged with these filters.</p> : null}
    </div>
  );
}

type Sec = { id: string; name: string; role: string; account: boolean; emailVerified: boolean; twoFactor: boolean; sessions: { id: string; device: string; where: string; lastSeen: string; created: string }[] };

export function SecurityTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const { data, error, reload } = useLive<{ staff: Sec[] }>("/api/admin/staff-security", 60_000);
  const [problem, setProblem] = useState<string | null>(null);
  const staff = data?.staff ?? [];
  const missing2fa = staff.filter((s) => s.account && !s.twoFactor);
  const noAccount = staff.filter((s) => !s.account);
  const people: People = Object.fromEntries(staff.map((s) => [s.id, { name: s.name, username: null, avatar: null, inServer: true }]));

  async function signOut(s: Sec) {
    if (!(await askConfirm(`${s.name} will be signed out of the website on every device and has to sign in again.`, { title: "Sign out everywhere?", confirmLabel: "Sign them out", danger: true }))) return;
    setProblem(null);
    const r = await fetch("/api/admin/staff-security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ discordId: s.id }) })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) return setProblem(r?.error ?? "Couldn't do that.");
    reload();
  }

  return (
    <div className="sec">
      <header className="sec-head">
        <div>
          <h2>
            <ShieldCheck size={20} aria-hidden="true" /> Staff security
          </h2>
          <p className="adm-muted">Staff accounts can see member details, so each one should have two-factor turned on. Everyone also gets an alert (bell and email) when their account signs in from a new device or country.</p>
        </div>
      </header>
      {error ? <p className="adm-error">{error}</p> : null}
      {problem ? <p className="adm-error">{problem}</p> : null}
      {data ? (
        <div className="sec-kpis">
          <div className={missing2fa.length ? "is-bad" : "is-good"}>
            <b>{missing2fa.length}</b>
            <span>with a website account but no two-factor</span>
          </div>
          <div>
            <b>{noAccount.length}</b>
            <span>without a linked website account</span>
          </div>
          <div>
            <b>{staff.filter((s) => s.twoFactor).length}</b>
            <span>with two-factor on</span>
          </div>
        </div>
      ) : (
        <div className="adm-skeleton" style={{ height: 200 }} />
      )}
      <ul className="sec-staff">
        {staff.map((s) => (
          <li key={s.id} className={s.account && !s.twoFactor ? "is-bad" : undefined}>
            <div className="sec-staff-head">
              <PersonLink id={s.id} people={people} onOpen={onOpenMember} compact />
              <span className="adm-tag">{s.role}</span>
              {!s.account ? (
                <span className="adm-muted">No website account linked</span>
              ) : s.twoFactor ? (
                <span className="sec-ok">
                  <ShieldCheck size={13} aria-hidden="true" /> Two-factor on
                </span>
              ) : (
                <span className="sec-bad">
                  <ShieldAlert size={13} aria-hidden="true" /> No two-factor
                </span>
              )}
              {s.account && !s.emailVerified ? <span className="adm-muted">· email not confirmed</span> : null}
              {s.sessions.length ? (
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny sec-signout" onClick={() => void signOut(s)}>
                  <LogOut size={12} aria-hidden="true" /> Sign out everywhere
                </button>
              ) : null}
            </div>
            {s.sessions.length ? (
              <ul className="sec-sessions">
                {s.sessions.map((x) => (
                  <li key={x.id}>
                    <MonitorSmartphone size={13} aria-hidden="true" /> {x.device} <span className="adm-muted">· {x.where} · active {timeAgo(x.lastSeen)}</span>
                  </li>
                ))}
              </ul>
            ) : s.account ? (
              <small className="adm-muted">Not signed in on any device in the last 30 days.</small>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
