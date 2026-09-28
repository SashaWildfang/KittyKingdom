"use client";

import { useEffect } from "react";

export const NEWS_SEEN_KEY = "kk_news_seen";
export const NEWS_READ_KEY = "kk_news_read";
export const NEWS_EVENT = "kk-news-read";

/**
 * Remembers what this browser has read: opening the News page counts everything up to the newest
 * post as seen; opening a single post marks that post as read. The News tab bubble and the home
 * page notice use this.
 */
export function NewsSeen({ latest, readId }: { latest: string | null; readId?: string }) {
  useEffect(() => {
    try {
      if (readId) {
        const read = new Set<string>(JSON.parse(window.localStorage.getItem(NEWS_READ_KEY) ?? "[]"));
        read.add(readId);
        window.localStorage.setItem(NEWS_READ_KEY, JSON.stringify(Array.from(read).slice(-60)));
      } else if (latest) {
        const prev = window.localStorage.getItem(NEWS_SEEN_KEY);
        if (!prev || prev < latest) window.localStorage.setItem(NEWS_SEEN_KEY, latest);
      }
      window.dispatchEvent(new Event(NEWS_EVENT));
    } catch {
      // Private mode: the bubble just keeps showing recent posts
    }
  }, [latest, readId]);
  return null;
}
