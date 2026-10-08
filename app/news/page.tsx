import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { newsTags, publishedNews } from "../../lib/news";
import { newsCover, newsExcerpt, newsPlainText, newsReadMinutes } from "../../lib/news-format";
import { userTimeZone } from "../../lib/timezone";
import { FallingLeaves } from "../fall-effects";
import { SiteNav } from "../site-nav";
import { NewsBrowser, type NewsItem } from "./news-browser";

export const dynamic = "force-dynamic";
export const metadata = { title: "News | Kitty Kingdom", description: "Updates, events and announcements from the Kitty Kingdom team." };

export default async function NewsPage({ searchParams }: { searchParams: { tag?: string; month?: string; q?: string } }) {
  const tz = userTimeZone();
  const [user, discord, all, tags] = await Promise.all([getCurrentUser(), getDiscordInviteSummary(), publishedNews({ limit: 300 }), newsTags().catch(() => [])]);
  const posts: NewsItem[] = all.map((p) => {
    const d = new Date(p.publishedAt);
    const month = d.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", timeZone: tz }).slice(0, 7);
    return {
      id: p.id,
      title: p.title,
      excerpt: newsExcerpt(p.body, 220).text,
      cover: newsCover(p.body),
      tag: p.tag,
      tagColor: p.tagColor,
      pinned: p.pinned,
      publishedAt: p.publishedAt,
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz }),
      month,
      monthLabel: new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      minutes: newsReadMinutes(p.body),
      views: p.views,
      search: `${p.title} ${newsPlainText(p.body)}`.toLowerCase(),
    };
  });
  const tag = searchParams.tag && tags.some((t) => t.name === searchParams.tag) ? searchParams.tag : null;
  const month = searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : null;

  return (
    <main className="site-shell news-shell">
      <FallingLeaves foreground={false} />
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <div className="nw nw--v2">
        <header className="nw-head">
          <p className="home-eyebrow">News</p>
          <h1>What&apos;s happening in the kingdom</h1>
          <p>Updates, events and announcements from the Kitty Kingdom team.{user ? " What you've read is saved to your account." : ""}</p>
        </header>
        <NewsBrowser posts={posts} tags={tags.map((t) => ({ name: t.name, color: t.color }))} initial={{ tag, month, q: (searchParams.q ?? "").slice(0, 80) }} />
      </div>
    </main>
  );
}
