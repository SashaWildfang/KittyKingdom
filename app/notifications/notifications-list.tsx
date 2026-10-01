"use client";

import { Check, Loader2, Settings, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NotificationFace } from "../notification-bell";

type Item = { id: string; type: string; actor?: string | null; title: string; body: string; link: string; at: string; read: boolean; count: number };

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function dayLabel(iso: string) {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86_400_000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : dayFmt.format(d);
}

/** All your notifications, grouped by day, 30 at a time. */
export function NotificationsList() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async (before?: string) => {
    setLoading(true);
    const r = await fetch(`/api/notifications${before ? `?before=${encodeURIComponent(before)}` : ""}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    setLoading(false);
    if (!r?.ok) return;
    setItems((prev) => (before && prev ? [...prev, ...r.items] : r.items));
    setMore(r.items.length >= 30);
    // Opening the page reads everything (what was new stays highlighted until you leave)
    if (!before && r.unread) await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clearAll = async () => {
    const r = await fetch("/api/notifications", { method: "DELETE" }).then((x) => x.json()).catch(() => null);
    setConfirmClear(false);
    if (r?.ok) {
      setItems([]);
      setMore(false);
    }
  };

  const groups: { day: string; items: Item[] }[] = [];
  for (const n of items ?? []) {
    const day = dayLabel(n.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(n);
    else groups.push({ day, items: [n] });
  }

  return (
    <div className="nf">
      <div className="nf-tools">
        <a className="nf-tool" href="/settings#notifications">
          <Settings size={15} aria-hidden="true" /> Notification settings
        </a>
        {items && items.length ? (
          confirmClear ? (
            <span className="nf-confirm">
              Clear every notification?
              <button type="button" className="nf-tool is-danger" onClick={() => void clearAll()}>
                Yes, clear
              </button>
              <button type="button" className="nf-tool" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className="nf-tool" onClick={() => setConfirmClear(true)}>
              <Trash2 size={15} aria-hidden="true" /> Clear all
            </button>
          )
        ) : null}
      </div>

      {!items ? (
        <div className="nf-loading" aria-busy="true" />
      ) : !items.length ? (
        <p className="nf-empty">
          <Check size={18} aria-hidden="true" /> You&apos;re all caught up. Nothing here yet.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.day} className="nf-day">
            <h2>{g.day}</h2>
            <ul>
              {g.items.map((n) => {
                return (
                  <li key={n.id}>
                    <a href={n.link} className={n.read ? undefined : "is-unread"}>
                      <NotificationFace type={n.type} actor={n.actor} size={36} />
                      <span className="nf-text">
                        <b>
                          {n.title}
                          {n.count > 1 ? <small className="nf-count"> ×{n.count}</small> : null}
                        </b>
                        {n.body ? <small>{n.body}</small> : null}
                      </span>
                      <time className="nf-time" dateTime={n.at}>
                        {timeFmt.format(new Date(n.at))}
                      </time>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {items && items.length && more ? (
        <button type="button" className="nf-more" onClick={() => void load(items[items.length - 1].at)} disabled={loading}>
          {loading ? <Loader2 size={15} className="set-spin" aria-hidden="true" /> : null} {loading ? "Loading…" : "Load older notifications"}
        </button>
      ) : null}
    </div>
  );
}
