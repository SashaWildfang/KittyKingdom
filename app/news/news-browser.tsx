"use client";

import { ArrowRight, Check, CheckCheck, Clock, Megaphone, Pin, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { isRead, markAllNewsRead, useNewsReads } from "./news-seen";

export type NewsItem = { id: string; title: string; excerpt: string; cover: string | null; tag: string; tagColor: string; pinned: boolean; publishedAt: string; date: string; month: string; monthLabel: string; minutes: number; search: string };
type Show = "all" | "unread" | "read";

/** The News list: filter by read state, tag, month and search, all instantly. */
export function NewsBrowser({ posts, tags, initial }: { posts: NewsItem[]; tags: { name: string; color: string }[]; initial: { tag: string | null; month: string | null; q: string } }) {
  const reads = useNewsReads();
  const [show, setShow] = useState<Show>("all");
  const [tag, setTag] = useState<string | null>(initial.tag);
  const [month, setMonth] = useState<string | null>(initial.month);
  const [q, setQ] = useState(initial.q);

  // Keep the filters in the address bar so they can be shared or bookmarked
  useEffect(() => {
    const p = new URLSearchParams();
    if (tag) p.set("tag", tag);
    if (month) p.set("month", month);
    if (q.trim()) p.set("q", q.trim());
    if (show !== "all") p.set("show", show);
    window.history.replaceState(null, "", p.toString() ? `/news?${p}` : "/news");
  }, [tag, month, q, show]);
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("show");
    if (s === "unread" || s === "read") setShow(s);
  }, []);

  const read = (p: NewsItem) => isRead(reads, p.id, p.publishedAt);
  const unreadCount = reads ? posts.filter((p) => !read(p)).length : 0;
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts) m.set(p.tag, (m.get(p.tag) ?? 0) + 1);
    return m;
  }, [posts]);
  const months = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const p of posts) m.set(p.month, { label: p.monthLabel, n: (m.get(p.month)?.n ?? 0) + 1 });
    return Array.from(m.entries());
  }, [posts]);

  const needle = q.trim().toLowerCase();
  const list = posts.filter(
    (p) =>
      (!tag || p.tag === tag) &&
      (!month || p.month === month) &&
      (!needle || p.search.includes(needle)) &&
      (show === "all" || (reads && (show === "unread" ? !read(p) : read(p)))),
  );
  const filtered = Boolean(tag || month || needle || show !== "all");
  const featured = filtered ? null : list[0] ?? null;
  const rest = featured ? list.slice(1) : list;

  return (
    <div className="nw2">
      <div className="nw2-bar">
        <div className="nw2-seg" role="tablist" aria-label="Show">
          {(
            [
              ["all", "All", posts.length],
              ["unread", "Unread", unreadCount],
              ["read", "Read", reads ? posts.length - unreadCount : 0],
            ] as const
          ).map(([k, label, n]) => (
            <button key={k} type="button" role="tab" aria-selected={show === k} className={show === k ? "is-on" : undefined} onClick={() => setShow(k)}>
              {label} <b className={k === "unread" && n ? "is-hot" : undefined}>{n}</b>
            </button>
          ))}
        </div>
        <label className="nw2-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search news…" aria-label="Search news" />
        </label>
        {months.length > 1 ? (
          <select className="nw2-select" value={month ?? ""} onChange={(e) => setMonth(e.target.value || null)} aria-label="Month">
            <option value="">Any month</option>
            {months.map(([key, m]) => (
              <option key={key} value={key}>
                {m.label} ({m.n})
              </option>
            ))}
          </select>
        ) : null}
        {unreadCount ? (
          <button type="button" className="nw2-markall" onClick={() => void markAllNewsRead()}>
            <CheckCheck size={15} aria-hidden="true" /> Mark all as read
          </button>
        ) : null}
      </div>

      <div className="nw2-tags" role="group" aria-label="Tags">
        <button type="button" className={!tag ? "is-on" : undefined} onClick={() => setTag(null)}>
          All tags
        </button>
        {tags
          .filter((t) => counts.get(t.name))
          .map((t) => (
            <button key={t.name} type="button" className={tag === t.name ? "is-on" : undefined} style={{ "--tag": t.color } as CSSProperties} onClick={() => setTag(tag === t.name ? null : t.name)}>
              <i aria-hidden="true" /> {t.name} <small>{counts.get(t.name)}</small>
            </button>
          ))}
      </div>

      {filtered ? (
        <p className="nw2-filtering">
          {list.length} post{list.length === 1 ? "" : "s"}
          <button
            type="button"
            onClick={() => {
              setTag(null);
              setMonth(null);
              setQ("");
              setShow("all");
            }}
          >
            <X size={13} aria-hidden="true" /> Clear filters
          </button>
        </p>
      ) : null}

      {featured ? (
        <Link href={`/news/${featured.id}`} className={`nw2-featured${featured.cover ? " has-cover" : ""}${reads && read(featured) ? " is-read" : ""}`}>
          {featured.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={featured.cover} alt="" />
          ) : null}
          <div>
            <Meta p={featured} read={reads ? read(featured) : null} latest />
            <h2>{featured.title}</h2>
            <p>{featured.excerpt}</p>
            <span className="nw2-more">
              Read the post <ArrowRight size={14} aria-hidden="true" />
            </span>
          </div>
        </Link>
      ) : null}

      {rest.length ? (
        <ul className="nw2-list">
          {rest.map((p) => (
            <li key={p.id}>
              <Link href={`/news/${p.id}`} className={`nw2-row${reads && read(p) ? " is-read" : ""}`} id={p.id}>
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover} alt="" loading="lazy" />
                ) : (
                  <span className="nw2-icon" style={{ "--tag": p.tagColor } as CSSProperties} aria-hidden="true">
                    <Megaphone size={20} />
                  </span>
                )}
                <div>
                  <Meta p={p} read={reads ? read(p) : null} />
                  <h3>{p.title}</h3>
                  <p>{p.excerpt}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : !featured ? (
        <div className="news-empty">
          <Megaphone size={28} aria-hidden="true" />
          <p>{show === "unread" && !tag && !month && !needle ? "You're all caught up. Nothing unread!" : "No posts match those filters."}</p>
        </div>
      ) : null}
    </div>
  );
}

function Meta({ p, read, latest }: { p: NewsItem; read: boolean | null; latest?: boolean }) {
  return (
    <div className="nw2-meta">
      {latest ? <span className="nw-latest">Latest</span> : null}
      <span className="news-tag" style={{ "--tag": p.tagColor } as CSSProperties}>
        {p.tag}
      </span>
      {p.pinned ? (
        <span className="nw-pin" title="Pinned">
          <Pin size={12} aria-hidden="true" />
        </span>
      ) : null}
      <span>{p.date}</span>
      <span>
        <Clock size={12} aria-hidden="true" /> {p.minutes} min
      </span>
      {read === null ? null : read ? (
        <span className="nw2-state is-read">
          <Check size={12} aria-hidden="true" /> Read
        </span>
      ) : (
        <span className="nw2-state is-unread">
          <i aria-hidden="true" /> Unread
        </span>
      )}
    </div>
  );
}
