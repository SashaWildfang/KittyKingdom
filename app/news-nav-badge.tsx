"use client";

import { isRead, useNewsReads } from "./news/news-seen";

type Stamp = { id: string; at: string };

/** How many recent posts you haven't opened yet. */
export function useUnreadNews(items: Stamp[]) {
  const reads = useNewsReads();
  if (!reads) return 0;
  return items.filter((p) => !isRead(reads, p.id, p.at)).length;
}

/** The number on the News tab. */
export function NewsNavBadge({ items }: { items: Stamp[] }) {
  const count = useUnreadNews(items);
  if (!count) return null;
  return (
    <span className="nav-news-badge" aria-label={`${count} unread news post${count === 1 ? "" : "s"}`}>
      {count > 9 ? "9+" : count}
    </span>
  );
}
