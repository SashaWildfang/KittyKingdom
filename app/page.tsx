import type { Metadata } from "next";
import "./home.css";
import { HomePatrons } from "./home-patrons";
import { patronWall } from "../lib/patrons";
import type { CSSProperties } from "react";
import { ArrowRight, BadgeCheck, CalendarDays, CalendarHeart, ChevronDown, Dices, HeartHandshake, MapPin, Newspaper, ShieldCheck, ShoppingBag, Star, Trophy, Users } from "lucide-react";
import { getCurrentUser } from "../lib/auth";
import { getDiscordInviteSummary } from "../lib/discord";
import { publishedNews } from "../lib/news";
import { nextEvents } from "../lib/events";
import { EVENT_KINDS, GIVEAWAY_KIND } from "../lib/events-shared";
import { memberGrowth } from "../lib/member-directory";
import { userTimeZone, zoneOffsetMinutes } from "../lib/timezone";
import { newsExcerpt } from "../lib/news-format";
import { LEAVE_REVIEW_URL, REVIEWS_URL, getReviews, type Review } from "../lib/reviews";
import { FallEffects, TiltCard } from "./fall-effects";
import { SeasonArt, SeasonCopy } from "./home-season";
import { CountUp, LocalDateBlock, LocalTime, RotatingWord } from "./landing-client";
import { seasonal } from "../lib/season-store";
import { SiteNav } from "./site-nav";
import { SITE_SOCIALS } from "../lib/site-socials";

const DISCORD_INVITE = "https://discord.com/invite/M9XKHFdYQV";


const JOIN_STEPS = [
  { title: "Join the Discord", text: "Hop in with the invite. You'll land in a welcome area while you get set up.", icon: "discord" },
  { title: "Fill in the join form", text: "A short form and the password from the rules. Staff check new members quickly to keep raids out.", icon: "form" },
  { title: "Make it yours", text: "Pick roles, set up a Social profile, link your website account and start earning.", icon: "spark" },
];

const FAQ = [
  { q: "Is Bear Nation 18+ only?", a: "Yes. Everyone has to be 18 or older, and the NSFW areas need an extra ID check by staff." },
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
    <figure className="hm-review">
      <Stars value={review.rating} />
      <blockquote>“{review.text}”</blockquote>
      <figcaption>
        <span className="hm-review-avatar" aria-hidden="true">
          {review.author.charAt(0).toUpperCase()}
        </span>
        <span>
          <strong>{review.author}</strong>
          <small>{timeAgo(review.postedAt)} on DISBOARD</small>
        </span>
      </figcaption>
    </figure>
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

const FEATURES = [
  { icon: HeartHandshake, title: "Social profiles", text: "Make a profile and get matched with people who share your interests, for friends or something more.", href: "/social" },
  { icon: CalendarHeart, title: "Events every week", text: "Game nights, movie nights, contests and voice hangouts. The bot reminds you before they start.", href: "/events" },
  { icon: ShoppingBag, title: "Earn and spend Leaves", text: "Chat and play to earn Leaves, then grab color roles, boosters and gifts in the store.", href: "/store" },
  { icon: Dices, title: "Casino and mini-games", text: "Slots, blackjack, roulette, mines and scratch-offs, in Discord and right here on the website.", href: "/games" },
  { icon: Trophy, title: "Levels and leaderboards", text: "Level up as you chat and hang out in voice. Climb the boards and collect badges.", href: "/leaderboards" },
  { icon: ShieldCheck, title: "Safe and looked after", text: "Verified 18+ members, AutoMod and an active staff team keep the trolls out.", href: "/rules" },
];

export default async function Home({ searchParams }: { searchParams?: { register?: string; account?: string } }) {
  // Midnight today in the visitor's time zone, for "joined today"
  const tz = userTimeZone();
  const offsetMs = zoneOffsetMinutes(tz) * 60_000;
  const local = new Date(Date.now() + offsetMs);
  const startOfToday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMs);
  const [reviews, discord, user, latestNews, growth, patrons, upcoming] = await Promise.all([
    getReviews(),
    getDiscordInviteSummary(),
    getCurrentUser(),
    publishedNews({ limit: 3 }),
    memberGrowth(startOfToday).catch(() => null),
    patronWall().catch(() => []),
    nextEvents(3).catch(() => []),
  ]);
  const news = latestNews.slice(0, 3).map((p) => ({ id: p.id, tag: p.tag, tagColor: p.tagColor, title: p.title, text: newsExcerpt(p.body, 140).text, publishedAt: p.publishedAt }));
  const status = searchParams?.register ?? searchParams?.account;
  const signedIn = Boolean(user);
  // Three reviews that read well side by side: best rated first, not too long
  const shownReviews = [...reviews.reviews].sort((a, b) => b.rating - a.rating || Math.abs(a.text.length - 180) - Math.abs(b.text.length - 180)).slice(0, 3);
  const kind = (k: string) => [...EVENT_KINDS, GIVEAWAY_KIND].find((e) => e.key === k);

  return (
    <main className="site-shell home hm">
      <FallEffects />
      <SiteNav signedIn={signedIn} discordOnline={discord.online} />

      {status && homeMessages[status] ? (
        <div className={bannerClass(status)} role="status">
          {homeMessages[status]}
        </div>
      ) : null}

      {/* ============ Hero: who we are and one clear next step ============ */}
      <section className="hm-hero" id="home">
        <div className="hm-hero-copy">
          <a className="hm-live" href="/join?via=website-live">
            <i aria-hidden="true" /> {discord.online !== null ? `${discord.online.toLocaleString()} members online now` : "Members online now"}
          </a>
          <h1>
            Find your <RotatingWord words={["people", "pack", "place", "home"]} /> in <span className="hm-glow">Bear Nation</span>
          </h1>
          <p className="hm-lead">
            <SeasonCopy part="subtitle" /> for adults. Make friends, join weekly events, play games and earn rewards, all connected to a website that grows with
            you.
          </p>
          <div className="hm-actions">
            <a className="hm-btn hm-btn--primary" href="/join?via=website" data-leaf-burst>
              <DiscordLogo size={20} /> Join the Discord
            </a>
            {signedIn ? (
              <a className="hm-btn hm-btn--ghost" href="/account">
                My account <ArrowRight size={16} aria-hidden="true" />
              </a>
            ) : (
              <a className="hm-btn hm-btn--ghost" href="/register">
                Create an account <ArrowRight size={16} aria-hidden="true" />
              </a>
            )}
          </div>
          <ul className="hm-trust" aria-label="Highlights">
            <li>
              <Stars value={reviews.average} /> <b>{reviews.average.toFixed(1)}</b> from {reviews.count} reviews
            </li>
            <li>
              <BadgeCheck size={16} aria-hidden="true" /> 18+ and verified
            </li>
            <li>
              <ShieldCheck size={16} aria-hidden="true" /> Friendly, active staff
            </li>
          </ul>
        </div>

        <div className="hm-hero-art">
          <TiltCard className="hm-frame">
            <SeasonArt kind="banner" className="hm-banner" />
          </TiltCard>
          <div className="hm-chip hm-chip--members">
            <Users size={18} aria-hidden="true" />
            <span>
              <b>{discord.members ? discord.members.toLocaleString() : "Hundreds of"} members</b>
              <small>{growth?.today ? `${growth.today.toLocaleString()} joined today` : "and counting"}</small>
            </span>
          </div>
          <div className="hm-chip hm-chip--online">
            <i aria-hidden="true" />
            <span>
              <b>{discord.online !== null ? discord.online.toLocaleString() : "Lots"} online</b>
              <small>Come say hi</small>
            </span>
          </div>
        </div>
      </section>

      {/* ============ Numbers ============ */}
      <section className="hm-stats" aria-label="Community in numbers" data-reveal>
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
          <span>average rating</span>
        </div>
      </section>

      {/* ============ What you get ============ */}
      <section className="hm-section" data-reveal>
        <header className="hm-head">
          <p className="hm-eyebrow">Why Bear Nation</p>
          <h2>More than a chat server</h2>
          <p>A custom bot, a real website and a community that actually talks. Here&apos;s what&apos;s waiting for you.</p>
        </header>
        <div className="hm-features">
          {FEATURES.map((f) => (
            <a key={f.title} className="hm-feature" href={f.href}>
              <span className="hm-feature-icon" aria-hidden="true">
                <f.icon size={22} />
              </span>
              <h3>{seasonal(f.title)}</h3>
              <p>{seasonal(f.text)}</p>
              <span className="hm-feature-more">
                Learn more <ArrowRight size={14} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* ============ How to join ============ */}
      <section className="hm-section" data-reveal>
        <header className="hm-head">
          <p className="hm-eyebrow">Getting started</p>
          <h2>Three steps and you&apos;re in</h2>
        </header>
        <ol className="hm-steps">
          {JOIN_STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="hm-step-num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ============ Happening now: events and news ============ */}
      <section className="hm-section hm-now" data-reveal>
        <div className="hm-panel">
          <header>
            <h2>
              <CalendarDays size={20} aria-hidden="true" /> Upcoming events
            </h2>
            <a href="/events">
              All events <ArrowRight size={14} aria-hidden="true" />
            </a>
          </header>
          {upcoming.length ? (
            <ul className="hm-events">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <a href={e.giveaway ? `/giveaways#${e.id}` : `/events#event-${e.id}`}>
                    <LocalDateBlock iso={e.giveaway?.running ? (e.endAt ?? e.startAt) : e.startAt} />
                    <span>
                      <b>
                        <span className="emo" aria-hidden="true">{kind(e.kind)?.emoji}</span>{e.title}
                      </b>
                      <small>
                        {e.giveaway ? (
                          <>
                            {e.giveaway.running ? "Open now · winners picked " : "Giveaway opens "}
                            <LocalTime iso={e.giveaway.running ? (e.endAt ?? e.startAt) : e.startAt} /> · {e.giveaway.prize}
                          </>
                        ) : (
                          <LocalTime iso={e.startAt} />
                        )}
                        {!e.giveaway && (e.place || e.channelName) ? (
                          <>
                            {" · "}
                            <MapPin size={12} aria-hidden="true" /> {e.channelName ? `#${e.channelName}` : e.place}
                          </>
                        ) : null}
                      </small>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hm-empty">New events are planned every week. Check the calendar soon!</p>
          )}
        </div>
        <div className="hm-panel">
          <header>
            <h2>
              <Newspaper size={20} aria-hidden="true" /> Latest news
            </h2>
            <a href="/news">
              All news <ArrowRight size={14} aria-hidden="true" />
            </a>
          </header>
          {news.length ? (
            <ul className="hm-news">
              {news.map((n) => (
                <li key={n.id}>
                  <a href={`/news/${n.id}`}>
                    {n.tag ? (
                      <span className="hm-tag" style={n.tagColor ? ({ "--tag": n.tagColor } as CSSProperties) : undefined}>
                        {n.tag}
                      </span>
                    ) : null}
                    <b>{n.title}</b>
                    <small>{n.text}</small>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hm-empty">No news yet. Big things are coming!</p>
          )}
        </div>
      </section>

      {/* ============ Reviews: a summary and three quotes ============ */}
      {shownReviews.length ? (
        <section className="hm-section hm-reviews" data-reveal>
          <div className="hm-rating">
            <p className="hm-eyebrow">What members say</p>
            <strong>{reviews.average.toFixed(1)}</strong>
            <Stars value={reviews.average} />
            <span>from {reviews.count} reviews on DISBOARD</span>
            <div className="hm-rating-links">
              <a href={REVIEWS_URL} target="_blank" rel="noopener noreferrer">
                Read them all <ArrowRight size={14} aria-hidden="true" />
              </a>
              <a href={LEAVE_REVIEW_URL} target="_blank" rel="noopener noreferrer">
                Leave a review
              </a>
            </div>
          </div>
          <div className="hm-review-list">
            {shownReviews.map((r) => (
              <ReviewCard key={`${r.author}-${r.postedAt}`} review={r} />
            ))}
          </div>
        </section>
      ) : null}

      <HomePatrons groups={patrons} />

      {/* ============ Questions ============ */}
      <section className="hm-section" data-reveal>
        <header className="hm-head">
          <p className="hm-eyebrow">Good to know</p>
          <h2>Questions people ask</h2>
        </header>
        <div className="hm-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
        <p className="hm-faq-more">
          More answers in the <a href="/faq">FAQ &amp; Guide</a>.
        </p>
      </section>

      {/* ============ Last call ============ */}
      <section className="hm-section" data-reveal>
        <div className="hm-cta">
          <h2>
            <SeasonCopy part="cta" />
          </h2>
          <p>Meet the community, join an event and find your place in the Nation. It only takes a minute.</p>
          <div className="hm-actions">
            <a className="hm-btn hm-btn--primary" href="/join?via=website" data-leaf-burst>
              <DiscordLogo size={20} /> Join the Discord
            </a>
            {signedIn ? null : (
              <a className="hm-btn hm-btn--ghost" href="/register">
                Create an account <ArrowRight size={16} aria-hidden="true" />
              </a>
            )}
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
                "@id": "https://bear-nation.net/#org",
                name: "Bear Nation",
                alternateName: ["Bear Nation Discord", "Bear Nation Furry Community", "bear-nation.net"],
                url: "https://bear-nation.net",
                logo: "https://bear-nation.net/logo.png",
                description: "A cozy, seasonal 18+ furry Discord server and community website.",
                sameAs: [DISCORD_INVITE, "https://www.patreon.com/c/thekittykingdom", "https://disboard.org/server/1358452494128250940", ...SITE_SOCIALS.map((s) => s.href)],
              },
              {
                "@type": "WebSite",
                "@id": "https://bear-nation.net/#website",
                name: "Bear Nation",
                alternateName: "Bear Nation Furry Discord",
                url: "https://bear-nation.net",
                publisher: { "@id": "https://bear-nation.net/#org" },
                description: "A cozy 18+ furry Discord community with Social profiles, events and an economy.",
              },
            ],
          }),
        }}
      />

    </main>
  );
}

