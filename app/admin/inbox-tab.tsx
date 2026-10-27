"use client";

// Admin → Needs attention: one list of everything waiting on a person. Claim what you're handling so nobody
// doubles up; items that don't clear by themselves can be dismissed (and brought back).

import "./inbox.css";
import { AlertTriangle, BellRing, Bot, Eye, CheckCircle2, ClipboardCheck, Flag, Gavel, Hammer, HeartHandshake, Inbox, Newspaper, ShieldAlert, Ticket, Undo2, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLive } from "./admin-shared";

type Item = {
  key: string;
  kind: string;
  title: string;
  detail: string;
  at: string;
  link: string;
  urgent: boolean;
  dismissable: boolean;
  member: string | null;
  claim: { by: string; name: string; at: string } | null;
};

const KIND: Record<string, { icon: typeof Inbox; label: string }> = {
  join: { icon: ClipboardCheck, label: "Join apps" },
  ticket: { icon: Ticket, label: "Tickets" },
  "ticket-quiet": { icon: Ticket, label: "Tickets" },
  appeal: { icon: Gavel, label: "Appeals" },
  "ban-request": { icon: Hammer, label: "Ban requests" },
  "flag-18": { icon: ShieldAlert, label: "18+ flags" },
  automod: { icon: Flag, label: "AutoMod" },
  "bot-issue": { icon: Bot, label: "Bots" },
  news: { icon: Newspaper, label: "News" },
  "social-report": { icon: HeartHandshake, label: "Social" },
  watch: { icon: Eye, label: "Watchlist" },
};

type Filter = "all" | "mine" | "free" | "urgent";

export function InboxTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const { data, error, loading, reload } = useLive<{ items: Item[]; me: string; missing?: string[] }>("/api/admin/inbox", 20_000);
  const [filter, setFilter] = useState<Filter>("all");
  const [kind, setKind] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ key: string; title: string } | null>(null);

  const items = data?.items ?? [];
  const me = data?.me ?? "";
  const kinds = useMemo(() => Array.from(new Set([...items.map((i) => KIND[i.kind]?.label ?? i.kind), ...(kind !== "all" ? [kind] : [])])), [items, kind]);
  const shown = items.filter(
    (i) =>
      (kind === "all" || (KIND[i.kind]?.label ?? i.kind) === kind) &&
      (filter === "all" || (filter === "mine" && i.claim?.by === me) || (filter === "free" && !i.claim) || (filter === "urgent" && i.urgent)),
  );
  const counts = { all: items.length, mine: items.filter((i) => i.claim?.by === me).length, free: items.filter((i) => !i.claim).length, urgent: items.filter((i) => i.urgent).length };

  async function act(item: Item, action: "claim" | "release" | "done" | "undo") {
    setBusy(item.key);
    setProblem(null);
    const r = await fetch("/api/admin/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: item.key, action }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(null);
    if (!r?.ok) return setProblem(r?.error ?? "That didn't work.");
    setUndo(action === "done" ? { key: item.key, title: item.title } : null);
    reload();
  }

  return (
    <div className="ibx">
      <header className="ibx-head">
        <div>
          <h2>
            <Inbox size={20} aria-hidden="true" /> Needs attention
          </h2>
          <p className="adm-muted">Everything waiting on someone, most urgent and oldest first. Claim what you&apos;re handling so nobody doubles up.</p>
        </div>
        <AlertSettings />
        <div className="ibx-filters" role="tablist" aria-label="Show">
          {(
            [
              ["all", "All"],
              ["urgent", "Urgent"],
              ["free", "Unclaimed"],
              ["mine", "Mine"],
            ] as [Filter, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "is-on" : undefined} onClick={() => setFilter(k)}>
              {l} <small>{counts[k]}</small>
            </button>
          ))}
        </div>
      </header>

      {kinds.length > 1 || kind !== "all" ? (
        <div className="ibx-kinds">
          <button type="button" className={kind === "all" ? "is-on" : undefined} onClick={() => setKind("all")}>
            Everything
          </button>
          {kinds.map((k) => (
            <button key={k} type="button" className={kind === k ? "is-on" : undefined} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
      ) : null}

      {problem ? <p className="adm-error">{problem}</p> : null}
      {undo ? (
        <p className="adm-notice ibx-undo">
          Dismissed “{undo.title}”.
          <button type="button" onClick={() => void act({ key: undo.key } as Item, "undo")}>
            <Undo2 size={13} aria-hidden="true" /> Undo
          </button>
        </p>
      ) : null}
      {error ? <p className="adm-error">{error}</p> : null}
      {data?.missing?.length ? <p className="adm-error">Couldn&apos;t check {data.missing.join(", ")} just now, so this list may be missing things. It retries on its own.</p> : null}

      {!data && loading ? <p className="adm-muted">Checking everything…</p> : null}
      {data && !shown.length ? (
        <div className="ibx-empty">
          <CheckCircle2 size={34} aria-hidden="true" />
          <b>{items.length ? "Nothing here with these filters." : data.missing?.length ? "Nothing found (but some checks failed)" : "All caught up!"}</b>
          <span className="adm-muted">{items.length ? "Try another filter." : data.missing?.length ? "See the warning above." : "Nothing is waiting on anyone right now. 🎉"}</span>
        </div>
      ) : null}

      <ul className="ibx-list">
        {shown.map((i) => {
          const K = KIND[i.kind] ?? { icon: AlertTriangle, label: i.kind };
          const mine = i.claim?.by === me;
          return (
            <li key={i.key} className={`ibx-item${i.urgent ? " is-urgent" : ""}${mine ? " is-mine" : ""}`}>
              <span className="ibx-icon" aria-hidden="true">
                <K.icon size={17} />
              </span>
              <div className="ibx-body">
                <a href={i.link} className="ibx-title">
                  {i.title}
                </a>
                <span className="ibx-detail">
                  {i.urgent ? <b className="ibx-urgent">Urgent</b> : null}
                  {i.detail}
                </span>
                {i.claim ? (
                  <span className="ibx-claim">
                    <UserCheck size={12} aria-hidden="true" /> {mine ? "You're handling this" : `${i.claim.name} is handling this`}
                  </span>
                ) : null}
              </div>
              <div className="ibx-actions">
                {i.member ? (
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => onOpenMember(i.member!)}>
                    Member
                  </button>
                ) : null}
                <a className="adm-btn adm-btn--ghost adm-btn--tiny" href={i.link}>
                  Open
                </a>
                {!i.claim ? (
                  <button type="button" className="adm-btn adm-btn--tiny" disabled={busy === i.key} onClick={() => void act(i, "claim")}>
                    Claim
                  </button>
                ) : mine ? (
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" disabled={busy === i.key} onClick={() => void act(i, "release")}>
                    Release
                  </button>
                ) : null}
                {i.dismissable ? (
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" disabled={busy === i.key} onClick={() => void act(i, "done")} title="Dismiss (it comes back if something new happens)">
                    Done
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Which staff alerts show in your bell (saved on your account). */
function AlertSettings() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<{ key: string; label: string; help: string; on: boolean }[] | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open || alerts) return;
    fetch("/api/admin/prefs", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => setAlerts(r?.alerts ?? []))
      .catch(() => setAlerts([]));
  }, [open, alerts]);
  const toggle = async (key: string) => {
    if (!alerts) return;
    const next = alerts.map((a) => (a.key === key ? { ...a, on: !a.on } : a));
    setAlerts(next);
    setSaving(true);
    await fetch("/api/admin/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "alerts", muted: next.filter((a) => !a.on).map((a) => a.key) }) }).catch(() => null);
    setSaving(false);
  };
  return (
    <div className="ibx-alerts">
      <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <BellRing size={14} aria-hidden="true" /> My alerts
      </button>
      {open ? (
        <div className="ibx-alerts-menu">
          <b>Staff alerts in your bell</b>
          <p className="adm-muted">Turn off the ones you don&apos;t need. Everything still shows here in Needs attention.</p>
          {!alerts ? <p className="adm-muted">Loading…</p> : null}
          {alerts?.map((a) => (
            <label key={a.key} className="ibx-alert">
              <input type="checkbox" checked={a.on} onChange={() => void toggle(a.key)} />
              <span>
                <b>{a.label}</b>
                <small>{a.help}</small>
              </span>
            </label>
          ))}
          {saving ? <small className="adm-muted">Saving…</small> : null}
        </div>
      ) : null}
    </div>
  );
}
