"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isRead, useNewsReads } from "./news/news-seen";

type Item = { id: string; title: string; publishedAt: string };

/** "3 new posts since your last visit" above the home page news (or new this week, first time). */
const DISMISS_KEY = "kk_news_notice_dismissed";

export function HomeNewsNotice({ posts }: { posts: Item[] }) {
  const reads = useNewsReads();
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  useEffect(() => {
    try {
      setDismissedAt(window.localStorage.getItem(DISMISS_KEY));
    } catch {}
  }, []);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  // Unread posts from the last week (hidden until the next new post once dismissed)
  const fresh = reads ? posts.filter((p) => p.publishedAt > weekAgo && !isRead(reads, p.id, p.publishedAt) && (!dismissedAt || p.publishedAt > dismissedAt)) : [];
  const firstVisit = false;

  if (!fresh.length) return null;
  const newest = fresh[0];
  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, newest.publishedAt);
    } catch {}
    setDismissedAt(newest.publishedAt);
  };
  return (
    <div className="home-news-notice" role="status">
      <Sparkles size={16} aria-hidden="true" />
      <span>
        <b>
          {fresh.length} new post{fresh.length === 1 ? "" : "s"} unread this week
        </b>
        {" · "}
        <a href={`/news/${newest.id}`}>{newest.title}</a>
      </span>
      <a className="home-news-notice-all" href="/news">
        See all
      </a>
      <button type="button" onClick={dismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
