"use client";

import { Bell, CheckCheck, Heart, Inbox, MessageCircle, Sparkles, UserCheck, UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: string; type: string; title: string; body: string; link: string; at: string; read: boolean; count: number };

const ICONS: Record<string, typeof Bell> = {
  like: Heart,
  match: Sparkles,
  message: MessageCircle,
  request: Inbox,
  "friend-request": UserPlus,
  "friend-accepted": UserCheck,
};

function when(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** The bell next to My Account: unread count, and a dropdown of recent notifications. */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    const r = await fetch("/api/notifications?count=1", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) setUnread(r.unread);
  }, []);
  const load = useCallback(async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) {
      setItems(r.items);
      setUnread(r.unread);
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = window.setInterval(() => document.visibilityState === "visible" && void poll(), 30_000);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [poll]);
  useEffect(() => {
    if (!open) return;
    void load();
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  const mark = (body: object) => fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);

  return (
    <div className="nb" ref={box}>
      <button type="button" className={`nb-button${unread ? " has-unread" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
        <Bell size={19} strokeWidth={2.1} aria-hidden="true" />
        {unread ? <span className="nb-count">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="nb-panel" role="dialog" aria-label="Notifications">
          <header>
            <b>Notifications</b>
            {unread ? (
              <button
                type="button"
                onClick={async () => {
                  await mark({ all: true });
                  setUnread(0);
                  setItems((xs) => xs?.map((x) => ({ ...x, read: true })) ?? null);
                }}
              >
                <CheckCheck size={14} aria-hidden="true" /> Mark all read
              </button>
            ) : null}
          </header>
          {!items ? (
            <p className="nb-empty">Loading…</p>
          ) : items.length ? (
            <ul>
              {items.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                return (
                  <li key={n.id}>
                    <a
                      href={n.link}
                      className={n.read ? undefined : "is-unread"}
                      onClick={() => {
                        if (!n.read) void mark({ ids: [n.id] });
                      }}
                    >
                      <span className={`nb-icon nb-icon--${n.type}`}>
                        <Icon size={15} aria-hidden="true" />
                      </span>
                      <span className="nb-text">
                        <b>{n.title}</b>
                        {n.body ? <small>{n.body}</small> : null}
                      </span>
                      <small className="nb-time">{when(n.at)}</small>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="nb-empty">You&apos;re all caught up.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
