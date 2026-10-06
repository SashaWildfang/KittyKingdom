import type { CSSProperties } from "react";
import { Bot, Coffee, Heart, HeartHandshake, Mic, Palette, Shield, ShoppingBag, Star, Trophy, type LucideIcon } from "lucide-react";
import { LeafEmote } from "./ui-icons";
import { getCurrentUser } from "../lib/auth";
import { getDiscordInviteSummary } from "../lib/discord";
import { publishedNews } from "../lib/news";
import { memberGrowth } from "../lib/member-directory";
import { userTimeZone, zoneOffsetMinutes } from "../lib/timezone";
import { newsExcerpt } from "../lib/news-format";
import { LEAVE_REVIEW_URL, REVIEWS_URL, getReviews, type Review } from "../lib/reviews";
import { Embers, FallEffects, FallingLeaves, LeafSvg, TiltCard } from "./fall-effects";
import { HomeShowcase } from "./home-showcase";
import { HomeNewsNotice } from "./home-news-notice";
import { SiteNav } from "./site-nav";

const DISCORD_INVITE = "https://discord.com/invite/M9XKHFdYQV";


const tickerItems: { label: string; icon: LucideIcon | "leaf" }[] = [
  { label: "Social profiles", icon: HeartHandshake },
  { label: "Leaf economy", icon: "leaf" },
  { label: "Custom bot", icon: Bot },
  { label: "Leaderboards", icon: Trophy },
  { label: "Store", icon: ShoppingBag },
  { label: "Voice chats", icon: Mic },
  { label: "AutoMod protection", icon: Shield },
  { label: "Games & events", icon: Heart },
  { label: "Art & media", icon: Palette },
  { label: "Cozy vibes", icon: Coffee },
];

const iconPaths: Record<string, string> = {
  bot: "M7 8h10a3 3 0 0 1 3 3v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5a3 3 0 0 1 3-3Zm2 4.5A1.5 1.5 0 1 0 9 15.5 1.5 1.5 0 0 0 9 12.5Zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM12 3l2 3h-4l2-3Z",
  chat: "M4 5h16v11H8l-4 4V5Zm4 4v2h8V9H8Zm0 4v2h5v-2H8Z",
  gem: "M12 3 4 8l8 13 8-13-8-5Zm-5 6 3-3h4l3 3-5 8-5-8Z",
  heart: "M12 21s-8-4.7-8-11a4.7 4.7 0 0 1 8-3.3A4.7 4.7 0 0 1 20 10c0 6.3-8 11-8 11Z",
  home: "M3 11 12 3l9 8v10h-6v-6H9v6H3V11Z",
  id: "M4 5h16v14H4V5Zm3 4v3h4V9H7Zm0 5v2h10v-2H7Zm6-5v2h4V9h-4Z",
  leaf: "M20 4C10 4 5 9 5 18c5 0 11-2 15-14ZM5 18c3-5 7-8 12-10",
  lock: "M7 10V8a5 5 0 0 1 10 0v2h2v11H5V10h2Zm2 0h6V8a3 3 0 0 0-6 0v2Z",
  media: "M4 5h16v14H4V5Zm3 3v8l6-4-6-4Zm8 1h3v2h-3V9Zm0 4h3v2h-3v-2Z",
  rank: "M12 3 9 9l-6 1 4.5 4.3L6.5 21 12 17.8 17.5 21l-1-6.7L21 10l-6-1-3-6Z",
  shield: "M12 3 20 6v6c0 5-3.4 8.1-8 9-4.6-.9-8-4-8-9V6l8-3Z",
  site: "M4 5h16v14H4V5Zm2 4h12V7H6v2Zm0 2v6h5v-6H6Zm7 0v6h5v-6h-5Z",
  spark: "M12 2 14 9l7 3-7 3-2 7-2-7-7-3 7-3 2-7Z",
  store: "M5 9h14l-1 12H6L5 9Zm2-5h10l2 4H5l2-4Zm3 8v5h4v-5h-4Z",
  users:
    "M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm8 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM2 21c.4-4 2.8-6 6-6s5.6 2 6 6H2Zm11.5-6c2.8.2 4.8 2.1 5.2 6H22c-.3-3.5-2.4-5.5-5.5-6Z",
};

const reasons = [
  { label: "Updates", detail: "Consistent server updates keep the community fresh.", icon: "spark" },
  { label: "Owner Care", detail: "Dedicated owner who cares about the community.", icon: "heart" },
  { label: "Feedback", detail: "Listens to community feedback and criticism.", icon: "chat" },
  { label: "Community", detail: "Friendly and active community.", icon: "users" },
  { label: "Verification", detail: "Secure anti-raid gate and fast manual verification.", icon: "lock" },
  { label: "Protection", detail: "Built-in AutoMod system for protection.", icon: "shield" },
  { label: "Custom Bot", detail: "Fully custom coded Discord bot.", icon: "bot" },
  { label: "Home", detail: "A place you can call home.", icon: "home" },
];

const features = [
  { label: "18+ Areas", detail: "18+ NSFW and social channels for ID-verified users.", icon: "id" },
  { label: "Ranks", detail: "Leveling, ranks, and role rewards.", icon: "rank" },
  { label: "Perks", detail: "Nitro Booster and Patreon perks.", icon: "gem" },
  { label: "Media", detail: "Role selection, media channels, and voice chats.", icon: "media" },
  { label: "Social", detail: "Introduction profiles to meet new friends.", icon: "heart" },
  { label: "Store", detail: "Server store to purchase roles and boosters.", icon: "store" },
  { label: "Currency", detail: "Custom server currency and chat-triggered events.", icon: "leaf" },
  { label: "Website", detail: "Fully functioning server website with accounts and member features.", icon: "site" },
];

const showcaseTabs = [
  {
    key: "why",
    label: "Why join",
    title: "Why you should join Kitty Kingdom",
    items: reasons.map((r) => ({ label: r.label, detail: r.detail, iconPath: iconPaths[r.icon] })),
  },
  {
    key: "features",
    label: "Features",
    title: "More ways to make the kingdom yours",
    items: features.map((f) => ({ label: f.label, detail: f.detail, iconPath: iconPaths[f.icon] })),
  },
];

const memberSections = [
  { title: "Leaderboards", text: "Track top members, activity and seasonal achievements, live.", href: "/leaderboards", icon: "rank", ready: true },
  { title: "Store", text: "Buy roles, boosters and gifts, and manage your inventory.", href: "/store", icon: "store", ready: true },
  { title: "Social Profiles", text: "Create an introduction and connect with verified members.", href: DISCORD_INVITE, icon: "heart", ready: true },
  { title: "Role Customization", text: "Manage role selection, profile identity and personalization.", href: DISCORD_INVITE, icon: "users", ready: true },
  { title: "Much More", text: "More member tools arrive as the website grows with the server.", href: "/news", icon: "spark", ready: false },
];

const homeMessages: Record<string, string> = {
  "check-email": "Account created. Check your email to verify your account, then log in when you are ready.",
  "email-provider-needed":
    "Account created, but the verification email could not be sent yet. Please contact staff so they can check email delivery.",
  "database-unreachable": "Registration could not reach the account database. Please try again shortly.",
  "service-unavailable": "Registration is temporarily unavailable. Please try again shortly.",
  deleted: "Your website account has been deleted.",
};

// Messages that report a problem or a destructive action show in red instead of the usual orange
const errorMessages = new Set(["deleted", "database-unreachable", "service-unavailable", "email-provider-needed"]);

function bannerClass(status: string) {
  return errorMessages.has(status) ? "home-status-banner home-status-banner--error" : "home-status-banner";
}

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

function timeAgo(iso: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "a month ago" : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years <= 1 ? "a year ago" : `${years} years ago`;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="home-stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={15} className={n <= Math.round(value) ? "home-star-on" : "home-stars-empty"} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="home-review">
      <Stars value={review.rating} />
      {review.title ? <h3>{review.title}</h3> : null}
      <p>“{review.text}”</p>
      <footer>
        <span className="home-review-avatar" aria-hidden="true">
          {review.author.charAt(0).toUpperCase()}
        </span>
        <span>
          <strong>{review.author}</strong>
          <small>{timeAgo(review.postedAt)} · DISBOARD</small>
        </span>
      </footer>
    </article>
  );
}

function DiscordLogo({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 127.14 96.36" width={size} height={size} aria-hidden="true" fill="currentColor">
      <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z" />
    </svg>
  );
}

/** Autumn hills along the bottom of the hero. */
function Hills() {
  return (
    <svg className="home-hills" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden="true">
      <path
        className="home-hills-back"
        d="M0 120 C160 70 280 60 420 96 C560 132 660 70 820 64 C980 58 1080 118 1220 104 C1320 94 1390 70 1440 72 V180 H0 Z"
      />
      <path
        className="home-hills-front"
        d="M0 150 C140 116 260 118 380 138 C520 162 640 118 800 112 C960 106 1080 150 1240 142 C1340 138 1400 120 1440 118 V180 H0 Z"
      />
    </svg>
  );
}

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams?: { register?: string; account?: string } }) {
  // Midnight today in the visitor's time zone, for "joined today"
  const tz = userTimeZone();
  const offsetMs = zoneOffsetMinutes(tz) * 60_000;
  const local = new Date(Date.now() + offsetMs);
  const startOfToday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMs);
  const [reviews, discord, user, latestNews, growth] = await Promise.all([
    getReviews(),
    getDiscordInviteSummary(),
    getCurrentUser(),
    publishedNews({ limit: 6 }),
    memberGrowth(startOfToday).catch(() => null),
  ]);
  // Newest three posts written by admins in the Admin tab
  // Show up to three; "All news" only when there's more than that to see
  const moreNews = latestNews.length > 0;
  const shownNews = latestNews.slice(0, 3);
  const news = shownNews.map((p) => {
    // A lone post gets the whole row, so it can show more of its text
    const { text, cut } = newsExcerpt(p.body, shownNews.length === 1 ? 420 : shownNews.length === 2 ? 240 : 150);
    return { id: p.id, tag: p.tag, tagColor: p.tagColor, title: p.title, text, cut, isNew: Date.now() - new Date(p.publishedAt).getTime() < 7 * 86_400_000 };
  });
  const status = searchParams?.register ?? searchParams?.account;
  const signedIn = Boolean(user);

  // Split reviews into two rows that scroll in opposite directions
  const rowA = reviews.reviews.filter((_, i) => i % 2 === 0);
  const rowB = reviews.reviews.filter((_, i) => i % 2 === 1);

  return (
    <main className="site-shell home">
      <FallingLeaves />
      <FallEffects />

      <SiteNav signedIn={signedIn} discordOnline={discord.online} />

      {status && homeMessages[status] ? (
        <div className={bannerClass(status)} role="status">
          {homeMessages[status]}
        </div>
      ) : null}

      {/* Hero */}
      <section className="home-hero" id="home">
        <Embers />
        <div className="home-sun" aria-hidden="true" />
        <div className="home-hero-copy">
          <p className="home-kicker">
            <LeafSvg shape="maple" color="#f39c12" size={18} /> Community · social platform
          </p>
          <h1 className="home-title">
            Find your place in <span className="home-title-glow">Kitty Kingdom.</span>
          </h1>
          <p className="home-subtitle">
            A warm, fall-themed community for friends, verified members, Social profiles, events, roles, and a place to call
            home.
          </p>
          <div className="home-actions">
            {signedIn ? (
              <>
                <a className="home-btn home-btn--primary" href="/store" data-leaf-burst>
                  Visit the Store
                </a>
                <a className="home-btn home-btn--ghost" href="/account">
                  My Account
                </a>
              </>
            ) : (
              <>
                <a className="home-btn home-btn--primary" href="/register" data-leaf-burst>
                  Create your account
                </a>
                <a className="home-btn home-btn--ghost" href="/join?via=website" data-leaf-burst>
                  Join the Discord
                </a>
              </>
            )}
          </div>
          <ul className="home-stats" aria-label="Community stats">
            <li>
              <strong>
                <i className="home-dot" aria-hidden="true" />
                {discord.online !== null ? discord.online.toLocaleString() : "Live"}
              </strong>
              <span>online now</span>
            </li>
            {discord.members ? (
              <li>
                <strong>{discord.members.toLocaleString()}</strong>
                <span>members</span>
              </li>
            ) : null}
            <li>
              <strong>
                {reviews.average.toFixed(1)} <Star className="home-star" size={18} fill="currentColor" strokeWidth={0} aria-hidden="true" />
              </strong>
              <span>on DISBOARD</span>
            </li>
          </ul>
          {growth ? (
            <ul className="home-stats home-stats--growth" aria-label="Discord server growth" title="From the Discord server's member list (not website accounts)">
              <li>
                <strong>{growth.today.toLocaleString()}</strong>
                <span>joined today</span>
              </li>
              <li>
                <strong>{growth.perDay >= 10 ? Math.round(growth.perDay) : growth.perDay.toFixed(1)}</strong>
                <span>avg joins / day</span>
              </li>
              <li>
                <strong className={growth.growth >= 0 ? "is-up" : "is-down"}>
                  {growth.growth >= 0 ? "+" : ""}
                  {(growth.growth * 100).toFixed(1)}%
                </strong>
                <span>server growth (30d)</span>
              </li>
            </ul>
          ) : null}
        </div>

        <TiltCard className="home-art">
          <div className="home-art-frame">
            <img className="home-art-banner" src="/banner.jpg" alt="Kitty Kingdom fall banner" />
            <span className="home-art-glare" aria-hidden="true" />
          </div>
          <img className="home-art-logo" src="/logo.png" alt="Kitty Kingdom logo" />
          <span className="home-art-chip home-art-chip--top"><LeafEmote size={16} /> Fall all year</span>
          <span className="home-art-chip home-art-chip--bottom">
            <i className="home-dot" aria-hidden="true" /> {discord.online !== null ? `${discord.online.toLocaleString()} online` : "Live now"}
          </span>
        </TiltCard>

        <Hills />
      </section>

      {/* Ticker */}
      <div className="home-ticker" aria-hidden="true">
        <div className="home-ticker-track">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i}>
              {item.icon === "leaf" ? <LeafEmote size={17} /> : <item.icon size={16} aria-hidden="true" />} {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* News */}
      {news.length ? (
      <section className="home-section" id="news" data-reveal>
        <div className="home-section-head">
          <div>
            <p className="home-eyebrow">News</p>
            <h2>What&apos;s happening in the kingdom</h2>
          </div>
          {moreNews ? (
            <a className="home-link" href="/news">
              All news →
            </a>
          ) : null}
        </div>
        <HomeNewsNotice posts={latestNews.map((p) => ({ id: p.id, title: p.title, publishedAt: p.publishedAt })).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))} />
        <div className={`home-news home-news--${news.length}`}>
          {news.map((item, index) => (
            <a className="home-news-card" data-spotlight key={item.id} href={`/news/${item.id}`}>
              <span className="home-news-num">0{index + 1}</span>
              {item.isNew ? <span className="home-news-new">New</span> : null}
              <span className="home-news-tag" style={{ "--tag": item.tagColor } as CSSProperties}>
                {item.tag}
              </span>
              <h3>{item.title}</h3>
              <p>
                {item.text}
                {item.cut ? <span className="home-news-more"> Click to see more <span aria-hidden="true">→</span></span> : null}
              </p>
              <LeafSvg shape={(["maple", "oak", "birch"] as const)[index % 3]} color="rgba(245,155,42,0.16)" size={120} />
            </a>
          ))}
        </div>
      </section>
      ) : null}

      {/* Why join / features */}
      <section className="home-section" data-reveal>
        <p className="home-eyebrow">Why join?</p>
        <HomeShowcase tabs={showcaseTabs} />
      </section>

      {/* Member features */}
      <section className="home-section" aria-label="Member features" data-reveal>
        <div className="home-section-head">
          <div>
            <p className="home-eyebrow">Member features</p>
            <h2>Everything your account unlocks</h2>
          </div>
          {!signedIn ? (
            <a className="home-link" href="/register">
              Create an account →
            </a>
          ) : null}
        </div>
        <div className="home-members">
          {memberSections.map((section) => (
            <a
              className="home-member-card"
              data-spotlight
              key={section.title}
              href={signedIn || !section.href.startsWith("/") || section.href === "/news" ? section.href : "/register"}
            >
              <span className="home-member-icon">
                <Icon name={section.icon} />
              </span>
              <span className={section.ready ? "home-badge" : "home-badge home-badge--soon"}>
                {!section.ready ? "Coming soon" : signedIn ? "Open" : "Members"}
              </span>
              <h3>{section.title}</h3>
              <p>{section.text}</p>
              <span className="home-member-arrow" aria-hidden="true">
                →
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="home-section home-reviews-section" aria-label="Kitty Kingdom reviews" data-reveal>
        <div className="home-reviews-head">
          <div>
            <p className="home-eyebrow">Reviews</p>
            <h2>What people are saying</h2>
          </div>
          <div className="home-rating">
            <strong>{reviews.average.toFixed(1)}</strong>
            <div>
              <Stars value={reviews.average} />
              <small>
                {reviews.count} reviews on DISBOARD
              </small>
            </div>
          </div>
        </div>
        <div className="home-review-rows">
          {[rowA, rowB].map((row, r) =>
            row.length ? (
              <div className={`home-review-row${r === 1 ? " home-review-row--reverse" : ""}`} key={r}>
                <div className="home-review-track" style={{ animationDuration: `${Math.max(40, row.length * 11)}s` }}>
                  {[...row, ...row].map((review, i) => (
                    <ReviewCard review={review} key={`${review.author}-${i}`} />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
        <div className="home-actions home-actions--center">
          <a className="home-btn home-btn--primary" href={REVIEWS_URL}>
            View all reviews
          </a>
          <a className="home-btn home-btn--ghost" href={LEAVE_REVIEW_URL} data-leaf-burst>
            Leave a review
          </a>
        </div>
      </section>

      {/* Discord call to action */}
      <section className="home-section" id="discord" data-reveal>
        <div className="home-cta">
          <div className="home-cta-leaves" aria-hidden="true">
            <LeafSvg shape="maple" color="#e25822" size={90} />
            <LeafSvg shape="oak" color="#f39c12" size={70} />
            <LeafSvg shape="birch" color="#c0392b" size={60} />
          </div>
          <div className="home-cta-copy">
            <p className="home-eyebrow">Discord community</p>
            <h2>Pull up a chair by the fire.</h2>
            <p>
              Meet the community, verify your account, join events, browse channels, and start building your place in the
              kingdom.
            </p>
          </div>
          <a className="home-btn home-btn--discord" href="/join?via=website" data-leaf-burst>
            <DiscordLogo size={22} />
            Join the Discord
            {discord.online !== null ? <small>{discord.online.toLocaleString()} online</small> : null}
          </a>
        </div>
      </section>

      {/* What search engines read about the community */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              { "@type": "Organization", name: "Kitty Kingdom", url: "https://www.kittykingdom.net", logo: "https://www.kittykingdom.net/logo.png", sameAs: [DISCORD_INVITE, "https://www.patreon.com/c/thekittykingdom"] },
              { "@type": "WebSite", name: "Kitty Kingdom", url: "https://www.kittykingdom.net", description: "A cozy 18+ furry Discord community with Social profiles, events and an economy." },
            ],
          }),
        }}
      />

    </main>
  );
}
