"use client";

import { useEffect, useState } from "react";

/** Unread Social messages (and requests), checked every 20 seconds while the page is visible. */
export function useUnreadMessages(enabled = true) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const check = async () => {
      const r = await fetch("/api/dating/unread", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (alive && typeof r?.unread === "number") setUnread(r.unread);
    };
    void check();
    const t = window.setInterval(() => document.visibilityState === "visible" && void check(), 20_000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);
  return unread;
}

/** The bubble on the Messages tab. */
export function MessagesNavBadge() {
  const unread = useUnreadMessages();
  return unread ? (
    <span className="nav-news-badge nav-msg-badge" aria-label={`${unread} unread`}>
      {unread > 99 ? "99+" : unread}
    </span>
  ) : null;
}
