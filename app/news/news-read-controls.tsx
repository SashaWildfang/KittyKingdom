"use client";

import { CheckCheck } from "lucide-react";
import { useMemo } from "react";
import { useUnreadNews } from "../news-nav-badge";
import { NEWS_EVENT, NEWS_READ_KEY, NEWS_SEEN_KEY } from "./news-seen";

type Stamp = { id: string; at: string };

/** "3 unread · Mark all as read" on the News page. */
export function NewsReadControls({ items }: { items: Stamp[] }) {
  const unread = useUnreadNews(items);
  if (!unread) return null;
  return (
    <div className="nw-unread">
      <span>
        <i aria-hidden="true" /> {unread} unread post{unread === 1 ? "" : "s"}
      </span>
      <button
        type="button"
        onClick={() => {
          try {
            const latest = items.reduce((m, p) => (p.at > m ? p.at : m), "");
            if (latest) window.localStorage.setItem(NEWS_SEEN_KEY, latest);
            window.localStorage.setItem(NEWS_READ_KEY, "[]");
          } catch {
            // ignore
          }
          window.dispatchEvent(new Event(NEWS_EVENT));
        }}
      >
        <CheckCheck size={15} aria-hidden="true" /> Mark all as read
      </button>
    </div>
  );
}

/** The little dot on a card you haven't opened yet. */
export function UnreadDot({ id, at }: { id: string; at: string }) {
  const items = useMemo(() => [{ id, at }], [id, at]);
  const unread = useUnreadNews(items);
  return unread ? <span className="nw-dot" title="Unread" aria-label="Unread" /> : null;
}
