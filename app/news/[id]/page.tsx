import { ArrowLeft, ArrowRight, Clock, Pin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getCurrentUser } from "../../../lib/auth";
import { getDiscordInviteSummary } from "../../../lib/discord";
import { publishedNews, publishedPost } from "../../../lib/news";
import { newsExcerpt, newsReadMinutes } from "../../../lib/news-format";
import { userTimeZone } from "../../../lib/timezone";
import { FallingLeaves } from "../../fall-effects";
import { NewsBody } from "../../news-body";
import { SiteNav } from "../../site-nav";
import { NewsSeen } from "../news-seen";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const post = await publishedPost(params.id).catch(() => null);
  return post ? { title: `${post.title} | Kitty Kingdom News`, description: newsExcerpt(post.body, 160).text } : { title: "News | Kitty Kingdom" };
}

export default async function NewsArticle(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const post = await publishedPost(params.id);
  if (!post) notFound();
  const [user, discord, all] = await Promise.all([getCurrentUser(), getDiscordInviteSummary(), publishedNews({ limit: 300 })]);
  const tz = await userTimeZone();
  const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: tz });
  // Chronological neighbours (pinned order doesn't matter here)
  const byDate = [...all].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const i = byDate.findIndex((p) => p.id === post.id);
  const newer = i > 0 ? byDate[i - 1] : null;
  const older = i >= 0 && i < byDate.length - 1 ? byDate[i + 1] : null;
  const related = byDate.filter((p) => p.tag === post.tag && p.id !== post.id).slice(0, 3);

  return (
    <main className="site-shell news-shell">
      <FallingLeaves foreground={false} />
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <NewsSeen latest={post.publishedAt} readId={post.id} />
      <article className="nw-article">
        <Link href="/news" className="nw-back">
          <ArrowLeft size={15} aria-hidden="true" /> All news
        </Link>
        <header>
          <div className="nw-meta">
            <Link href={`/news?tag=${encodeURIComponent(post.tag)}`} className="news-tag" style={{ "--tag": post.tagColor } as CSSProperties}>
              {post.tag}
            </Link>
            {post.pinned ? (
              <span className="nw-pin">
                <Pin size={12} aria-hidden="true" /> Pinned
              </span>
            ) : null}
          </div>
          <h1>{post.title}</h1>
          <p className="nw-byline">
            <span>{date(post.publishedAt)}</span>
            <span>
              <Clock size={13} aria-hidden="true" /> {newsReadMinutes(post.body)} min read
            </span>
            {post.authorName ? <span>by {post.authorName}</span> : null}
          </p>
        </header>
        <div className="news-card-body nw-article-body">
          <NewsBody body={post.body} />
        </div>

        <nav className="nw-pager" aria-label="More posts">
          {older ? (
            <Link href={`/news/${older.id}`}>
              <small>
                <ArrowLeft size={13} aria-hidden="true" /> Older
              </small>
              <b>{older.title}</b>
            </Link>
          ) : (
            <span />
          )}
          {newer ? (
            <Link href={`/news/${newer.id}`} className="is-next">
              <small>
                Newer <ArrowRight size={13} aria-hidden="true" />
              </small>
              <b>{newer.title}</b>
            </Link>
          ) : null}
        </nav>

        {related.length ? (
          <section className="nw-related">
            <h2>More {post.tag} posts</h2>
            <div>
              {related.map((p) => (
                <Link key={p.id} href={`/news/${p.id}`}>
                  <b>{p.title}</b>
                  <small>{date(p.publishedAt)}</small>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </main>
  );
}
