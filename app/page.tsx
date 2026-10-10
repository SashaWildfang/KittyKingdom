import type { Metadata } from "next";
import "./landing.css";
import { HomePatrons } from "./home-patrons";
import { patronWall } from "../lib/patrons";
import type { CSSProperties } from "react";
import { ArrowRight, BadgeCheck, CalendarHeart, Dices, Gift, HeartHandshake, MessageCircleQuestion, ShieldCheck, Sparkles, Star, Trophy, UserRound } from "lucide-react";
import { getCurrentUser } from "../lib/auth";
import { getDiscordInviteSummary } from "../lib/discord";
import { publishedNews } from "../lib/news";
import { memberGrowth } from "../lib/member-directory";
import { userTimeZone, zoneOffsetMinutes } from "../lib/timezone";
import { newsExcerpt } from "../lib/news-format";
import { LEAVE_REVIEW_URL, REVIEWS_URL, getReviews, type Review } from "../lib/reviews";
import { FallEffects, SeasonGlyph, TiltCard } from "./fall-effects";
import { SeasonArt, SeasonCopy } from "./home-season";
import { HomeNewsNotice } from "./home-news-notice";
import { CountUp, LevelLadder, RotatingWord, SeasonBadge, SeasonFeature, StorePreview } from "./landing-client";
import { SiteNav } from "./site-nav";

const DISCORD_INVITE = "https://discord.com/invite/M9XKHFdYQV";


const JOIN_STEPS = [
  { title: "Join the Discord", text: "Hop in with the invite. You'll land in a welcome area while you get set up.", icon: "discord" },
  { title: "Fill in the join form", text: "A short form and the password from the rules. Staff check new members quickly to keep raids out.", icon: "form" },
  { title: "Make it yours", text: "Pick roles, set up a Social profile, link your website account and start earning.", icon: "spark" },
];

const FAQ = [
  { q: "Is Kitty Kingdom 18+ only?", a: "Yes. Everyone has to be 18 or older, and the NSFW areas need an extra ID check by staff." },
  { q: "Do I need to be a furry to join?", a: "Nope. Furries, friends of furries and the furry-curious are all welcome. Just be kind." },
  { q: "Is it free?", a: "Completely. Patreon and server boosts are optional and only add cosmetic perks and bonuses." },
  { q: "What's the website for?", a: "Your account links to Discord: the store, casino games, Social profiles, stats, leaderboards and more." },
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
    <span className="lp-stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={15} className={n <= Math.round(value) ? "is-on" : undefined} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="lp-review">
      <Stars value={review.rating} />
      {review.title ? <h3>{review.title}</h3> : null}
      <p>“{review.text}”</p>
      <footer>
        <span className="lp-review-avatar" aria-hidden="true">
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

// Only the homepage is canonical at "/" (setting it in the layout would point every page here)
export const metadata: Metadata = { alternates: { canonical: "/" } };

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams?: { register?: string; account?: string } }) {
  // Midnight today in the visitor's time zone, for "joined today"
  const tz = userTimeZone();
  const offsetMs = zoneOffsetMinutes(tz) * 60_000;
  const local = new Date(Date.now() + offsetMs);
  const startOfToday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMs);
  const [reviews, discord, user, latestNews, growth, patrons] = await Promise.all([
    getReviews(),
    getDiscordInviteSummary(),
    getCurrentUser(),
    publishedNews({ limit: 6 }),
    memberGrowth(startOfToday).catch(() => null),
    patronWall().catch(() => []),
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

  const firstReview = reviews.reviews.find((r) => r.rating >= 5 && r.text.length < 140) ?? reviews.reviews[0];

  return (
    <main className="site-shell home lp">
      <FallEffects />

      <SiteNav signedIn={signedIn} discordOnline={discord.online} />

      {status && homeMessages[status] ? (
        <div className={bannerClass(status)} role="status">
          {homeMessages[status]}
        </div>
      ) : null}

      {/* ============ Hero ============ */}
      <section className="lp-hero" id="home">
        <div className="lp-hero-copy">
          <a className="lp-live" href="/join?via=website-live">
            <i aria-hidden="true" /> {discord.online !== null ? `${discord.online.toLocaleString()} online now` : "Live now"}
            {discord.members ? <span>· {discord.members.toLocaleString()} members</span> : null}
          </a>
          <h1 className="lp-title">
            Find your <RotatingWord words={["place", "people", "pack", "home"]} />
            <br />
            in <span className="lp-title-glow">Kitty Kingdom.</span>
          </h1>
          <p className="lp-lead">
            <SeasonCopy part="subtitle" /> for adults: friends, verified members, Social profiles, games, events and a custom-built bot, with a website that grows with you.
          </p>
          <div className="lp-actions">
            <a className="lp-btn lp-btn--discord" href="/join?via=website" data-leaf-burst>
              <DiscordLogo size={20} /> Join the Discord
            </a>
            {signedIn ? (
              <a className="lp-btn lp-btn--ghost" href="/account">
                My account <ArrowRight size={16} aria-hidden="true" />
              </a>
            ) : (
              <a className="lp-btn lp-btn--ghost" href="/register" data-leaf-burst>
                Create an account <ArrowRight size={16} aria-hidden="true" />
              </a>
            )}
          </div>
          <ul className="lp-trust" aria-label="Highlights">
            <li>
              <Stars value={reviews.average} /> <b>{reviews.average.toFixed(1)}</b> on DISBOARD
            </li>
            <li>
              <BadgeCheck size={15} aria-hidden="true" /> 18+ &amp; verified
            </li>
            <li>
              <ShieldCheck size={15} aria-hidden="true" /> AutoMod &amp; active staff
            </li>
          </ul>
        </div>

        <div className="lp-hero-art">
          <TiltCard className="lp-hero-frame">
            <SeasonArt kind="banner" className="lp-hero-banner" />
            <span className="lp-hero-glare" aria-hidden="true" />
          </TiltCard>
          <SeasonArt kind="logo" className="lp-hero-logo" />
          <SeasonBadge />
          <div className="lp-float lp-float--live">
            <i aria-hidden="true" />
            <span>
              <b>{discord.online !== null ? discord.online.toLocaleString() : "Lots"} online</b>
              <small>{growth ? `${growth.today.toLocaleString()} joined today` : "Come say hi"}</small>
            </span>
          </div>
          {firstReview ? (
            <figure className="lp-float lp-float--review">
              <Stars value={firstReview.rating} />
              <blockquote>“{firstReview.text}”</blockquote>
              <figcaption>{firstReview.author}</figcaption>
            </figure>
          ) : null}
        </div>
      </section>

      {/* ============ Numbers ============ */}
      <section className="lp-stats" aria-label="Community in numbers" data-reveal>
        <div>
          <strong>{discord.members ? <CountUp value={discord.members} /> : "—"}</strong>
          <span>members</span>
        </div>
        <div>
          <strong>{discord.online !== null ? <CountUp value={discord.online} /> : "—"}</strong>
          <span>online right now</span>
        </div>
        <div>
          <strong>{growth ? <CountUp value={growth.perDay} decimals={growth.perDay >= 10 ? 0 : 1} /> : "—"}</strong>
          <span>new members a day</span>
        </div>
        <div>
          <strong>
            <CountUp value={reviews.average} decimals={1} />
            <Star size={22} fill="currentColor" strokeWidth={0} aria-hidden="true" />
          </strong>
          <span>{reviews.count} reviews</span>
        </div>
      </section>

      {/* ============ Inside the kingdom ============ */}
      <section className="lp-section" id="features" data-reveal>
        <div className="lp-head">
          <p className="lp-eyebrow">Inside the kingdom</p>
          <h2>More than a chat server</h2>
          <p className="lp-lead">A custom bot, a real website and a community that actually talks. Here&apos;s a peek at what&apos;s waiting.</p>
        </div>
        <div className="lp-bento">
          <a className="lp-tile lp-tile--social" href="/social" data-spotlight>
            <div className="lp-tile-copy">
              <span className="lp-tile-icon">
                <HeartHandshake size={20} aria-hidden="true" />
              </span>
              <h3>Social profiles</h3>
              <p>Make a profile, find people who share your interests and get matched with friends (or more).</p>
            </div>
            <div className="lp-mini-toast" aria-hidden="true">
              <span>💞</span>
              <span>
                <b>It&apos;s a match!</b>
                <small>You and Mochi liked each other</small>
              </span>
            </div>
            <div className="lp-mini-profile" aria-hidden="true">
              <div className="lp-mini-profile-top">
                <span className="lp-mini-avatar">🦊</span>
                <span>
                  <b>Mochi</b>
                  <small>Fox · 24 · they/them</small>
                </span>
                <span className="lp-mini-match">92% match</span>
              </div>
              <p>Gamer, night owl and professional cocoa enjoyer. Looking for VC buddies!</p>
              <div className="lp-mini-tags">
                <span>🎮 Gaming</span>
                <span>🎨 Art</span>
                <span>🎧 Music</span>
              </div>
              <div className="lp-mini-buttons">
                <span>Pass</span>
                <span className="is-like">Like</span>
              </div>
            </div>
          </a>

          <a className="lp-tile lp-tile--store" href={signedIn ? "/store" : "/register"} data-spotlight>
            <div className="lp-tile-copy">
              <span className="lp-tile-icon">
                <Gift size={20} aria-hidden="true" />
              </span>
              <h3>Economy &amp; store</h3>
              <p>Earn currency by chatting, then spend it on color roles, boosters and gifts.</p>
            </div>
            <StorePreview />
          </a>

          <a className="lp-tile lp-tile--games" href={signedIn ? "/games" : "/register"} data-spotlight>
            <div className="lp-tile-copy">
              <span className="lp-tile-icon">
                <Dices size={20} aria-hidden="true" />
              </span>
              <h3>Casino games</h3>
              <p>Slots, blackjack, roulette, mines and scratch-offs, on the website and in Discord.</p>
            </div>
            <div className="lp-mini-slots" aria-hidden="true">
              <span>🍒</span>
              <span>🐾</span>
              <span>🍒</span>
            </div>
          </a>

          <a className="lp-tile lp-tile--levels" href="/leaderboards" data-spotlight>
            <div className="lp-tile-copy">
              <span className="lp-tile-icon">
                <Trophy size={20} aria-hidden="true" />
              </span>
              <h3>Levels &amp; leaderboards</h3>
              <p>Level up as you chat and hang out in voice. Roles change with the seasons.</p>
            </div>
            <LevelLadder compact />
          </a>

          <div className="lp-tile lp-tile--events" data-spotlight>
            <div className="lp-tile-copy">
              <span className="lp-tile-icon">
                <CalendarHeart size={20} aria-hidden="true" />
              </span>
              <h3>Always something going on</h3>
              <p>Daily games, events and surprises in chat, run by the bot and the staff team.</p>
            </div>
            <ul className="lp-mini-list">
              <li>
                <MessageCircleQuestion size={15} aria-hidden="true" /> Question of the Day
              </li>
              <li>
                <Sparkles size={15} aria-hidden="true" /> Daily Wordle &amp; chat games
              </li>
              <li>
                <Gift size={15} aria-hidden="true" /> Giveaways
              </li>
              <li>
                <Trophy size={15} aria-hidden="true" /> Monthly top members
              </li>
            </ul>
          </div>

          <div className="lp-tile lp-tile--safety" data-spotlight>
            <div className="lp-tile-copy">
              <span className="lp-tile-icon">
                <ShieldCheck size={20} aria-hidden="true" />
              </span>
              <h3>Safe and looked after</h3>
              <p>A friendly space starts with keeping the trolls out.</p>
            </div>
            <ul className="lp-mini-list lp-mini-list--check">
              <li>Join forms and an anti-raid gate</li>
              <li>AutoMod that catches the bad stuff</li>
              <li>Real staff, fair appeals</li>
            </ul>
          </div>

          <a className="lp-tile lp-tile--account" href={signedIn ? "/account" : "/register"} data-spotlight>
            <div className="lp-tile-copy">
              <span className="lp-tile-icon">
                <UserRound size={20} aria-hidden="true" />
              </span>
              <h3>Your own account</h3>
              <p>Stats, badges, daily rewards and your inventory, all synced with Discord.</p>
            </div>
            <span className="lp-tile-cta">
              {signedIn ? "Open my account" : "Create one free"} <ArrowRight size={15} aria-hidden="true" />
            </span>
          </a>
        </div>
      </section>

      {/* ============ This season ============ */}
      <section className="lp-section" data-reveal>
        <SeasonFeature />
      </section>

      {/* ============ How to join ============ */}
      <section className="lp-section" id="join" data-reveal>
        <div className="lp-head">
          <p className="lp-eyebrow">Getting in</p>
          <h2>Three steps to the kingdom</h2>
        </div>
        <ol className="lp-steps">
          {JOIN_STEPS.map((step, i) => (
            <li key={step.title} style={{ "--i": i } as CSSProperties}>
              <span className="lp-step-num">{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ============ News ============ */}
      {news.length ? (
        <section className="lp-section" id="news" data-reveal>
          <div className="lp-head lp-head--row">
            <div>
              <p className="lp-eyebrow">News</p>
              <h2>What&apos;s new</h2>
            </div>
            {moreNews ? (
              <a className="lp-link" href="/news">
                All news <ArrowRight size={15} aria-hidden="true" />
              </a>
            ) : null}
          </div>
          <HomeNewsNotice posts={latestNews.map((p) => ({ id: p.id, title: p.title, publishedAt: p.publishedAt })).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))} />
          <div className={`lp-news lp-news--${news.length}`}>
            {news.map((item, index) => (
              <a className="lp-news-card" data-spotlight key={item.id} href={`/news/${item.id}`}>
                <span className="lp-news-tag" style={{ "--tag": item.tagColor } as CSSProperties}>
                  {item.tag}
                </span>
                {item.isNew ? <span className="lp-news-new">New</span> : null}
                <h3>{item.title}</h3>
                <p>
                  {item.text}
                  {item.cut ? "…" : ""}
                </p>
                <span className="lp-news-more">
                  Read more <ArrowRight size={14} aria-hidden="true" />
                </span>
                <span className="lp-news-glyph" aria-hidden="true">
                  <SeasonGlyph index={index} color="rgba(var(--ember-rgb), 0.14)" size={110} />
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* ============ Reviews ============ */}
      <section className="lp-section lp-reviews" aria-label="Kitty Kingdom reviews" data-reveal>
        <div className="lp-head lp-head--row">
          <div>
            <p className="lp-eyebrow">Reviews</p>
            <h2>What members say</h2>
          </div>
          <div className="lp-rating">
            <strong>{reviews.average.toFixed(1)}</strong>
            <div>
              <Stars value={reviews.average} />
              <small>{reviews.count} reviews on DISBOARD</small>
            </div>
          </div>
        </div>
        <div className="lp-review-rows">
          {[rowA, rowB].map((row, r) =>
            row.length ? (
              <div className={`lp-review-row${r === 1 ? " is-reverse" : ""}`} key={r}>
                <div className="lp-review-track" style={{ animationDuration: `${Math.max(40, row.length * 11)}s` }}>
                  {[...row, ...row].map((review, i) => (
                    <ReviewCard review={review} key={`${review.author}-${i}`} />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
        <div className="lp-actions lp-actions--center">
          <a className="lp-btn lp-btn--ghost" href={REVIEWS_URL}>
            Read all reviews
          </a>
          <a className="lp-btn lp-btn--primary" href={LEAVE_REVIEW_URL} data-leaf-burst>
            Leave a review
          </a>
        </div>
      </section>

      {/* ============ Supporters ============ */}
      <HomePatrons groups={patrons} />

      {/* ============ FAQ ============ */}
      <section className="lp-section lp-faq" data-reveal>
        <div className="lp-head">
          <p className="lp-eyebrow">Questions</p>
          <h2>Good to know</h2>
        </div>
        <div className="lp-faq-list">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
        <a className="lp-link lp-link--center" href="/faq">
          More answers in the FAQ &amp; Guide <ArrowRight size={15} aria-hidden="true" />
        </a>
      </section>

      {/* ============ Final call ============ */}
      <section className="lp-section" id="discord" data-reveal>
        <div className="lp-cta">
          <div className="lp-cta-glyphs" aria-hidden="true">
            <SeasonGlyph index={0} size={90} />
            <SeasonGlyph index={1} size={64} />
            <SeasonGlyph index={2} size={52} />
          </div>
          <h2>
            <SeasonCopy part="cta" />
          </h2>
          <p>Meet the community, join events and find your place in the kingdom. It only takes a minute.</p>
          <div className="lp-actions lp-actions--center">
            <a className="lp-btn lp-btn--discord" href="/join?via=website" data-leaf-burst>
              <DiscordLogo size={20} /> Join the Discord
              {discord.online !== null ? <small>{discord.online.toLocaleString()} online</small> : null}
            </a>
          </div>
        </div>
      </section>

      {/* What search engines read about the community */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": "https://www.kittykingdom.net/#org",
                name: "Kitty Kingdom",
                alternateName: ["Kitty Kingdom Discord", "Kitty Kingdom Furry Community", "kittykingdom.net"],
                url: "https://www.kittykingdom.net",
                logo: "https://www.kittykingdom.net/logo.png",
                description: "A cozy, seasonal 18+ furry Discord server and community website.",
                sameAs: [DISCORD_INVITE, "https://www.patreon.com/c/thekittykingdom", "https://disboard.org/server/1358452494128250940"],
              },
              {
                "@type": "WebSite",
                "@id": "https://www.kittykingdom.net/#website",
                name: "Kitty Kingdom",
                alternateName: "Kitty Kingdom Furry Discord",
                url: "https://www.kittykingdom.net",
                publisher: { "@id": "https://www.kittykingdom.net/#org" },
                description: "A cozy 18+ furry Discord community with Social profiles, events and an economy.",
              },
            ],
          }),
        }}
      />

    </main>
  );
}
