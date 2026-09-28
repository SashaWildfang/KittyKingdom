import { ArrowRight, CalendarDays, Clock, Megaphone, Pin, Search, Tag as TagIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { newsTags, publishedNews, type NewsPost } from "../../lib/news";
import { newsCover, newsExcerpt, newsReadMinutes } from "../../lib/news-format";
import { userTimeZone } from "../../lib/timezone";
import { FallingLeaves } from "../fall-effects";
import { SiteNav } from "../site-nav";
import { NewsSeen } from "./news-seen";
import { NewsReadControls, UnreadDot } from "./news-read-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "News | Kitty Kingdom", description: "Updates, events and announcements from the Kitty Kingdom team." };

const NEW_DAYS = 7;

export default async function NewsPage({ searchParams }: { searchParams: { tag?: string; month?: string; q?: string } }) {
  const tz = userTimeZone();
  const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: tz });
  const monthKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", timeZone: tz }).slice(0, 7);
  const monthLabel = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const [user, discord, all, tags] = await Promise.all([getCurrentUser(), getDiscordInviteSummary(), publishedNews({ limit: 300 }), newsTags().catch(() => [])]);
  const tag = searchParams.tag && tags.some((t) => t.name === searchParams.tag) ? searchParams.tag : null;
  const month = searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : null;
  const q = (searchParams.q ?? "").trim().slice(0, 80);

  const counts = new Map<string, number>();
  for (const p of all) counts.set(p.tag, (counts.get(p.tag) ?? 0) + 1);
  const months = new Map<string, number>();
  for (const p of all) months.set(monthKey(p.publishedAt), (months.get(monthKey(p.publishedAt)) ?? 0) + 1);

  const posts = all.filter(
    (p) => (!tag || p.tag === tag) && (!month || monthKey(p.publishedAt) === month) && (!q || `${p.title} ${p.body}`.toLowerCase().includes(q.toLowerCase())),
  );
  const filtered = Boolean(tag || month || q);
  const featured = filtered ? null : posts[0] ?? null;
  const rest = filtered ? posts : posts.slice(1);
  const isNew = (p: NewsPost) => Date.now() - new Date(p.publishedAt).getTime() < NEW_DAYS * 86_400_000;
  const link = (params: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ tag, month, q: q || null, ...params })) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/news?${s}` : "/news";
  };

  return (
    <main className="site-shell news-shell">
      <FallingLeaves foreground={false} />
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <NewsSeen latest={null} />

      <div className="nw">
        <header className="nw-head">
          <p className="home-eyebrow">News</p>
          <h1>What&apos;s happening in the kingdom</h1>
          <p>Updates, events and announcements from the Kitty Kingdom team.</p>
          <NewsReadControls items={all.slice(0, 30).map((p) => ({ id: p.id, at: p.publishedAt }))} />
        </header>

        <div className="nw-layout">
          <div className="nw-main">
            {filtered ? (
              <p className="nw-filtering">
                Showing {posts.length} post{posts.length === 1 ? "" : "s"}
                {tag ? <> tagged <b>{tag}</b></> : null}
                {month ? <> from <b>{monthLabel(month)}</b></> : null}
                {q ? <> matching <b>“{q}”</b></> : null}
                <Link href="/news">Clear filters</Link>
              </p>
            ) : null}

            {featured ? <FeaturedCard post={featured} date={date(featured.publishedAt)} isNew={isNew(featured)} /> : null}

            <div className="nw-grid">
              {rest.map((p) => {
                const cover = newsCover(p.body);
                return (
                  <Link key={p.id} href={`/news/${p.id}`} className={`nw-card${cover ? " has-cover" : ""}`} id={p.id}>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="nw-cover" src={cover} alt="" loading="lazy" />
                    ) : null}
                    <div className="nw-card-body">
                      <div className="nw-meta">
                        <span className="news-tag" style={{ "--tag": p.tagColor } as CSSProperties}>
                          {p.tag}
                        </span>
                        {isNew(p) ? <span className="nw-new">New</span> : null}
                        <UnreadDot id={p.id} at={p.publishedAt} />
                        {p.pinned ? (
                          <span className="nw-pin">
                            <Pin size={12} aria-hidden="true" />
                          </span>
                        ) : null}
                      </div>
                      <h2>{p.title}</h2>
                      <p>{newsExcerpt(p.body, 170).text}</p>
                      <span className="nw-foot">
                        <span>{date(p.publishedAt)}</span>
                        <span>
                          <Clock size={12} aria-hidden="true" /> {newsReadMinutes(p.body)} min
                        </span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {!posts.length ? (
              <div className="news-empty">
                <Megaphone size={28} aria-hidden="true" />
                <p>{filtered ? "No posts match those filters." : "No news here yet. Check back soon!"}</p>
              </div>
            ) : null}
          </div>

          <aside className="nw-side" aria-label="Browse news">
            <form className="nw-search" action="/news">
              <Search size={16} aria-hidden="true" />
              <input type="search" name="q" defaultValue={q} placeholder="Search news…" aria-label="Search news" />
              {tag ? <input type="hidden" name="tag" value={tag} /> : null}
            </form>

            <section>
              <h3>
                <TagIcon size={14} aria-hidden="true" /> Tags
              </h3>
              <ul className="nw-tags">
                <li>
                  <Link href={link({ tag: null })} className={!tag ? "is-on" : undefined}>
                    <span>All posts</span>
                    <b>{all.length}</b>
                  </Link>
                </li>
                {tags
                  .filter((t) => counts.get(t.name))
                  .map((t) => (
                    <li key={t.id}>
                      <Link href={link({ tag: tag === t.name ? null : t.name })} className={tag === t.name ? "is-on" : undefined} style={{ "--tag": t.color } as CSSProperties}>
                        <span>
                          <i aria-hidden="true" /> {t.name}
                        </span>
                        <b>{counts.get(t.name)}</b>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>

            {months.size > 1 ? (
              <section>
                <h3>
                  <CalendarDays size={14} aria-hidden="true" /> Archive
                </h3>
                <ul className="nw-tags">
                  {Array.from(months.entries()).map(([key, n]) => (
                    <li key={key}>
                      <Link href={link({ month: month === key ? null : key })} className={month === key ? "is-on" : undefined}>
                        <span>{monthLabel(key)}</span>
                        <b>{n}</b>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

function FeaturedCard({ post, date, isNew }: { post: NewsPost; date: string; isNew: boolean }) {
  const cover = newsCover(post.body);
  return (
    <Link href={`/news/${post.id}`} className={`nw-featured${cover ? " has-cover" : ""}`} id={post.id}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="nw-cover" src={cover} alt="" />
      ) : null}
      <div className="nw-featured-body">
        <div className="nw-meta">
          <span className="nw-latest">Latest</span>
          <UnreadDot id={post.id} at={post.publishedAt} />
          <span className="news-tag" style={{ "--tag": post.tagColor } as CSSProperties}>
            {post.tag}
          </span>
          {isNew ? <span className="nw-new">New</span> : null}
          {post.pinned ? (
            <span className="nw-pin">
              <Pin size={12} aria-hidden="true" /> Pinned
            </span>
          ) : null}
        </div>
        <h2>{post.title}</h2>
        <p>{newsExcerpt(post.body, 320).text}</p>
        <span className="nw-foot">
          <span>{date}</span>
          <span>
            <Clock size={12} aria-hidden="true" /> {newsReadMinutes(post.body)} min read
          </span>
          <span className="nw-read">
            Read the post <ArrowRight size={14} aria-hidden="true" />
          </span>
        </span>
      </div>
    </Link>
  );
}
