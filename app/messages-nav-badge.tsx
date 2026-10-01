"use client";

import { Mail } from "lucide-react";
import { useEffect, useState } from "react";

/** Unread Social messages (and requests), checked every 8 seconds while the page is visible, and as soon as you come back to it. */
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
    const t = window.setInterval(() => document.visibilityState === "visible" && void check(), 8_000);
    const onFocus = () => void check();
    const onVisible = () => document.visibilityState === "visible" && void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
  return unread;
}

/** The envelope next to the bell: opens Social messages, with a bubble for unread ones. */
export function MessagesButton() {
  const unread = useUnreadMessages();
  return (
    <a className={`nav-msg${unread ? " has-unread" : ""}`} href="/social/messages" title="Messages" aria-label={unread ? `Messages, ${unread} unread` : "Messages"}>
      <Mail size={19} strokeWidth={2.1} aria-hidden="true" />
      {unread ? <span className="nb-count nav-msg-count">{unread > 99 ? "99+" : unread}</span> : null}
    </a>
  );
}
