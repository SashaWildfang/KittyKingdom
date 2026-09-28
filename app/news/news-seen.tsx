"use client";

import { useEffect } from "react";

export const NEWS_SEEN_KEY = "kk_news_seen";

/** Remembers the newest post this browser has seen, so the home page can say what's new. */
export function NewsSeen({ latest }: { latest: string | null }) {
  useEffect(() => {
    if (!latest) return;
    try {
      const prev = window.localStorage.getItem(NEWS_SEEN_KEY);
      if (!prev || prev < latest) window.localStorage.setItem(NEWS_SEEN_KEY, latest);
    } catch {
      // Private mode: the notice just keeps showing recent posts
    }
  }, [latest]);
  return null;
}
