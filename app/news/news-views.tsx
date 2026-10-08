"use client";

import { Eye } from "lucide-react";
import { useEffect, useState } from "react";

/** The view count on an article; counts this visit once (the server also limits it to once a day). */
export function NewsViews({ id, initial }: { id: string; initial: number }) {
  const [views, setViews] = useState(initial);
  useEffect(() => {
    const key = `kk_news_viewed_${id}`;
    try {
      const last = Number(window.sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < 30 * 60_000) return;
      window.sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // storage blocked: the server's daily limit still stops repeats
    }
    fetch(`/api/news/${id}/view`, { method: "POST" })
      .then((r) => r.json())
      .then((r) => typeof r?.views === "number" && setViews(r.views))
      .catch(() => undefined);
  }, [id]);
  return (
    <span title="Times this post was read">
      <Eye size={13} aria-hidden="true" /> {views.toLocaleString()} view{views === 1 ? "" : "s"}
    </span>
  );
}
