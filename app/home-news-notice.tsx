"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NEWS_SEEN_KEY } from "./news/news-seen";

type Item = { id: string; title: string; publishedAt: string };

/** "3 new posts since your last visit" above the home page news (or new this week, first time). */
export function HomeNewsNotice({ posts }: { posts: Item[] }) {
  const [fresh, setFresh] = useState<Item[] | null>(null);
  const [firstVisit, setFirstVisit] = useState(false);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(NEWS_SEEN_KEY);
    } catch {
      seen = null;
    }
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    setFirstVisit(!seen);
    setFresh(posts.filter((p) => p.publishedAt > (seen ?? weekAgo)));
  }, [posts]);

  if (!fresh?.length) return null;
  const newest = fresh[0];
  const dismiss = () => {
    try {
      window.localStorage.setItem(NEWS_SEEN_KEY, newest.publishedAt);
    } catch {
      // ignore
    }
    setFresh([]);
  };
  return (
    <div className="home-news-notice" role="status">
      <Sparkles size={16} aria-hidden="true" />
      <span>
        <b>
          {fresh.length} new post{fresh.length === 1 ? "" : "s"} {firstVisit ? "this week" : "since your last visit"}
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
