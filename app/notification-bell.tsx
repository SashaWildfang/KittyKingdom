"use client";

import { Bell, ChevronDown, Eye, History, Heart, HeartHandshake, Inbox, MessageCircle, Settings, Sparkles, Star, Trash2, UserCheck, UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: string; type: string; actor?: string | null; title: string; body: string; link: string; at: string; read: boolean; count: number };

export const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  like: Heart,
  superlike: Star,
  match: Sparkles,
  message: MessageCircle,
  request: Inbox,
  "friend-request": UserPlus,
  "friend-accepted": UserCheck,
  view: Eye,
  partner: HeartHandshake,
};

/** The circle on a notification: who it's from (their profile picture, with the kind as a small badge), or just the kind. */
export function NotificationFace({ type, actor, size = 32 }: { type: string; actor?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const Icon = NOTIFICATION_ICONS[type] ?? Bell;
  // "Someone new liked your profile" stays anonymous (and groups several likes), so no face there
  if (!actor || failed || type === "like") {
    return (
      <span className={`nb-icon nb-icon--${type}`} style={{ width: size, height: size }}>
        <Icon size={Math.round(size / 2.1)} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="nb-face" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/discord/avatar/${actor}`} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />
      <span className={`nb-face-badge nb-icon--${type}`} aria-hidden="true">
        <Icon size={9} />
      </span>
    </span>
  );
}

// The panel starts with a few; "Show more" adds this many at a time
const PAGE = 5;

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
  const [shown, setShown] = useState(PAGE);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    const r = await fetch("/api/notifications?count=1", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) setUnread(r.unread);
  }, []);
  // Opening the bell reads everything: the count clears right away, and what was new stays
  // highlighted while the panel is open
  const load = useCallback(async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) {
      setItems(r.items);
      setUnread(0);
      if (r.unread) await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => null);
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
    setShown(PAGE);
    setConfirmClear(false);
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

  const clearAll = async () => {
    setClearing(true);
    const r = await fetch("/api/notifications", { method: "DELETE" }).then((x) => x.json()).catch(() => null);
    setClearing(false);
    setConfirmClear(false);
    if (r?.ok) {
      setItems([]);
      setUnread(0);
    }
  };
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
            {items && items.length ? (
              confirmClear ? (
                <span className="nb-clear-confirm">
                  Clear all?
                  <button type="button" className="nb-clear-yes" onClick={() => void clearAll()} disabled={clearing}>
                    {clearing ? "Clearing…" : "Yes"}
                  </button>
                  <button type="button" onClick={() => setConfirmClear(false)} disabled={clearing}>
                    No
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmClear(true)}>
                  <Trash2 size={13} aria-hidden="true" /> Clear all
                </button>
              )
            ) : null}
          </header>
          {!items ? (
            <p className="nb-empty">Loading…</p>
          ) : items.length ? (
            <ul>
              {items.slice(0, shown).map((n) => {
                return (
                  <li key={n.id}>
                    <a
                      href={n.link}
                      className={n.read ? undefined : "is-unread"}
                      onClick={() => {
                        if (!n.read) void mark({ ids: [n.id] });
                      }}
                    >
                      <NotificationFace type={n.type} actor={n.actor} />
                      <span className="nb-text">
                        <b>{n.title}</b>
                        {n.body ? <small>{n.body}</small> : null}
                      </span>
                      <small className="nb-time">{when(n.at)}</small>
                    </a>
                  </li>
                );
              })}
              {items.length > shown ? (
                <li className="nb-more">
                  <button type="button" onClick={() => setShown((v) => v + PAGE)}>
                    <ChevronDown size={14} aria-hidden="true" /> Show {Math.min(PAGE, items.length - shown)} more
                    {items.length - shown > PAGE ? <small> ({items.length - shown} left)</small> : null}
                  </button>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="nb-empty">You&apos;re all caught up.</p>
          )}
          <div className="nb-foot-row">
            <a className="nb-foot" href="/notifications">
              <History size={13} aria-hidden="true" /> See all notifications
            </a>
            <a className="nb-foot" href="/settings#notifications">
              <Settings size={13} aria-hidden="true" /> Settings
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
