"use client";

import { useEffect, useState } from "react";
import { NEWS_EVENT, NEWS_READ_KEY, NEWS_SEEN_KEY } from "./news/news-seen";

type Stamp = { id: string; at: string };

/** How many recent posts this browser hasn't read (first visit: the last two weeks). */
function unreadCount(items: Stamp[]) {
  try {
    const seen = window.localStorage.getItem(NEWS_SEEN_KEY) ?? new Date(Date.now() - 14 * 86_400_000).toISOString();
    const read = new Set<string>(JSON.parse(window.localStorage.getItem(NEWS_READ_KEY) ?? "[]"));
    return items.filter((p) => p.at > seen && !read.has(p.id)).length;
  } catch {
    return 0;
  }
}

export function useUnreadNews(items: Stamp[]) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(unreadCount(items));
    update();
    window.addEventListener(NEWS_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(NEWS_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [items]);
  return count;
}

/** The flashing number on the News tab. */
export function NewsNavBadge({ items }: { items: Stamp[] }) {
  const count = useUnreadNews(items);
  if (!count) return null;
  return (
    <span className="nav-news-badge" aria-label={`${count} unread news post${count === 1 ? "" : "s"}`}>
      {count > 9 ? "9+" : count}
    </span>
  );
}
