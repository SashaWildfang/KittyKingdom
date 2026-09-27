import { Megaphone, Pin } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { NEWS_TAGS, publishedNews } from "../../lib/news";
import { FallingLeaves } from "../fall-effects";
import { NewsBody } from "../news-body";
import { SiteNav } from "../site-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "News | Kitty Kingdom" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Denver" });
}

export default async function NewsPage({ searchParams }: { searchParams: { tag?: string } }) {
  const tag = searchParams.tag && (NEWS_TAGS as readonly string[]).includes(searchParams.tag) ? searchParams.tag : undefined;
  const [user, discord, posts, all] = await Promise.all([getCurrentUser(), getDiscordInviteSummary(), publishedNews({ tag }), publishedNews()]);
  const usedTags = NEWS_TAGS.filter((t) => all.some((p) => p.tag === t));

  return (
    <main className="site-shell news-shell">
      <FallingLeaves foreground={false} />
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />

      <section className="news-page">
        <header className="news-head">
          <p className="home-eyebrow">News</p>
          <h1>What&apos;s happening in the kingdom</h1>
          <p>Updates, events and announcements from the Kitty Kingdom team.</p>
        </header>

        {usedTags.length > 1 ? (
          <nav className="news-tags" aria-label="Filter news">
            <Link href="/news" className={!tag ? "is-active" : undefined}>
              All
            </Link>
            {usedTags.map((t) => (
              <Link key={t} href={`/news?tag=${encodeURIComponent(t)}`} className={tag === t ? "is-active" : undefined}>
                {t}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="news-list">
          {posts.map((post, i) => (
            <article key={post.id} id={post.id} className={`news-card${post.pinned ? " is-pinned" : ""}${i === 0 && !tag ? " is-featured" : ""}`}>
              <div className="news-card-meta">
                <span className="news-tag">{post.tag}</span>
                {post.pinned ? (
                  <span className="news-pinned">
                    <Pin size={13} aria-hidden="true" /> Pinned
                  </span>
                ) : null}
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              </div>
              <h2>{post.title}</h2>
              <div className="news-card-body">
                <NewsBody body={post.body} />
              </div>
              {post.authorName ? <p className="news-author">— {post.authorName}</p> : null}
            </article>
          ))}
          {!posts.length ? (
            <div className="news-empty">
              <Megaphone size={28} aria-hidden="true" />
              <p>No news here yet. Check back soon!</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
