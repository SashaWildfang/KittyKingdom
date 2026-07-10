import { getDisboardSummary } from "../lib/disboard";
import { manualReviews } from "../lib/manual-reviews";
import { getDiscordInviteSummary } from "../lib/discord";
import { getCurrentUser } from "../lib/auth";
import { CommunityCarousel } from "./community-carousel";
import { OnlineStatus } from "./online-status";
import { ReviewCarousel } from "./review-carousel";
import { ThemeToggle } from "./theme-toggle";

const news = [
  {
    title: "Fall Update",
    text: "We permanently moved Kitty Kingdom over to a cozy fall theme.",
  },
  {
    title: "Discord Website",
    text: "We started work on the Discord website and account portal.",
  },
  {
    title: "Leaves Currency",
    text: "We changed the server currency to leaves.",
  },
];

const memberSections = [
  {
    title: "Leaderboards",
    text: "Track top members, activity, events, and seasonal achievements.",
  },
  {
    title: "Dating Profiles",
    text: "Create introductions and match with other verified community members.",
  },
  {
    title: "Server Store",
    text: "Purchase roles, boosters, and supporter perks from the website.",
  },
  {
    title: "Role Customization",
    text: "Manage role selection, profile identity, and community personalization.",
  },
  {
    title: "Much More",
    text: "More member tools will be added as the website grows with the Discord server.",
  },
];

const reasons = [
  {
    label: "Updates",
    detail: "Consistent server updates keep the community fresh.",
    icon: "spark",
  },
  {
    label: "Owner Care",
    detail: "Dedicated owner who cares about the community.",
    icon: "heart",
  },
  {
    label: "Feedback",
    detail: "Listens to community feedback and criticism.",
    icon: "chat",
  },
  {
    label: "Community",
    detail: "Friendly and active furry community.",
    icon: "users",
  },
  {
    label: "Verification",
    detail: "Secure anti-raid gate and fast manual verification.",
    icon: "lock",
  },
  {
    label: "Protection",
    detail: "Built-in AutoMod system for protection.",
    icon: "shield",
  },
  {
    label: "Custom Bot",
    detail: "Fully custom coded Discord bot.",
    icon: "bot",
  },
  { label: "Home", detail: "A place you can call home.", icon: "home" },
];

const features = [
  {
    label: "18+ Areas",
    detail: "18+ NSFW and dating channels for ID-verified users.",
    icon: "id",
  },
  {
    label: "Ranks",
    detail: "Leveling, ranks, and role rewards.",
    icon: "rank",
  },
  { label: "Perks", detail: "Nitro Booster and Patreon perks.", icon: "gem" },
  {
    label: "Media",
    detail: "Role selection, media channels, and voice chats.",
    icon: "media",
  },
  {
    label: "Dating",
    detail: "Dating introduction profiles and date matching.",
    icon: "heart",
  },
  {
    label: "Store",
    detail: "Server store to purchase roles and boosters.",
    icon: "store",
  },
  {
    label: "Currency",
    detail: "Custom server currency and chat-triggered events.",
    icon: "leaf",
  },
  {
    label: "Website",
    detail:
      "Fully functioning server website with accounts and member features.",
    icon: "site",
  },
];

const leaves = Array.from({ length: 18 }, (_, index) => index + 1);

const iconPaths: Record<string, string> = {
  bot: "M7 8h10a3 3 0 0 1 3 3v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5a3 3 0 0 1 3-3Zm2 4.5A1.5 1.5 0 1 0 9 15.5 1.5 1.5 0 0 0 9 12.5Zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM12 3l2 3h-4l2-3Z",
  chat: "M4 5h16v11H8l-4 4V5Zm4 4v2h8V9H8Zm0 4v2h5v-2H8Z",
  gem: "M12 3 4 8l8 13 8-13-8-5Zm-5 6 3-3h4l3 3-5 8-5-8Z",
  heart:
    "M12 21s-8-4.7-8-11a4.7 4.7 0 0 1 8-3.3A4.7 4.7 0 0 1 20 10c0 6.3-8 11-8 11Z",
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

function CleanIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

const reasonCarouselItems = reasons.map((item) => ({
  ...item,
  iconPath: iconPaths[item.icon],
}));
const featureCarouselItems = features.map((item) => ({
  ...item,
  iconPath: iconPaths[item.icon],
}));

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: { register?: string };
}) {
  const [disboard, discord, user] = await Promise.all([
    getDisboardSummary(),
    getDiscordInviteSummary(),
    getCurrentUser(),
  ]);
  return (
    <main>
      <div className="leaf-field" aria-hidden="true">
        {leaves.map((leaf) => (
          <span className="falling-leaf" key={leaf} />
        ))}
      </div>

      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="/home" aria-label="Kitty Kingdom home">
          <img
            className="brand-logo-img"
            src="/logo.png"
            alt="Kitty Kingdom logo"
          />
          <span className="brand-copy">
            <strong>Kitty Kingdom</strong>
            <OnlineStatus initialOnline={discord.online} />
          </span>
        </a>
        <div className="tabs">
          <a href="/home">Home</a>
          <a href="/news">News</a>
          <a href="/discord">Discord</a>
          <a href="/staff">Staff</a>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          {user ? (
            <a className="login-link logged-in-link" href="/account">
              Account
            </a>
          ) : (
            <a className="login-link" href="/login">
              Login
            </a>
          )}
          {user ? (
            <form action="/api/account/logout" method="post">
              <button className="primary-pill" type="submit">
                Logout
              </button>
            </form>
          ) : (
            <a className="primary-pill" href="/register">
              Register
            </a>
          )}
        </div>
      </nav>

      {searchParams?.register === "check-email" ? (
        <div className="home-status-banner">
          Account created. Check your email to verify your account, then log in
          when you are ready.
        </div>
      ) : null}

      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">Furry community • dating platform</p>
          <h1>Find your place in Kitty Kingdom.</h1>
          <p className="subtitle">
            A warm fall-themed community home for friends, verified members,
            dating profiles, events, roles, and a place to call home.
          </p>
          <div className="hero-actions">
            <a className="cta" href="/register">
              Create your account
            </a>
          </div>
        </div>
        <div
          className="showcase artwork-showcase"
          aria-label="Kitty Kingdom server artwork"
        >
          <img
            className="banner-image"
            src="/banner.jpg"
            alt="Kitty Kingdom fall banner"
          />
          <img
            className="logo-image-card"
            src="/logo.png"
            alt="Kitty Kingdom logo"
          />
        </div>
      </section>

      <section
        className="panel-grid"
        id="news"
        aria-label="Latest Kitty Kingdom news"
      >
        <div className="section-heading">
          <p className="eyebrow">News</p>
          <h2>What is happening in the kingdom</h2>
        </div>
        {news.map((item, index) => (
          <article className="feature-card" key={item.title}>
            <span className="card-kicker">Update {index + 1}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      <CommunityCarousel
        eyebrow="Why join?"
        items={reasonCarouselItems}
        title="Why you should join Kitty Kingdom"
      />

      <CommunityCarousel
        eyebrow="Other features"
        items={featureCarouselItems}
        title="More ways to make the kingdom yours"
      />

      <section className="discord-panel" id="discord">
        <div>
          <p className="eyebrow">Discord community</p>
          <h2>Join the Kitty Kingdom Discord.</h2>
          <p>
            Meet the community, verify your account, join events, browse
            channels, and start building your place in the kingdom.
          </p>
        </div>
        <a className="cta" href="https://discord.com/invite/M9XKHFdYQV">
          Join the Discord
        </a>
      </section>

      <section className="member-preview" aria-label="Signed-in member areas">
        <div className="section-heading">
          <p className="eyebrow">Member features</p>
          <h2>Everything your account will unlock</h2>
        </div>
        <div className="member-grid">
          {memberSections.map((section) => (
            <article className="locked-card" key={section.title}>
              <span className="lock-badge">Members</span>
              <h3>{section.title}</h3>
              <p>{section.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="reviews-section" aria-label="Kitty Kingdom reviews">
        <div className="section-heading">
          <p className="eyebrow">Reviews</p>
          <h2>
            {disboard.rating
              ? `We have a ${disboard.rating}/5 star review`
              : "What people are saying"}
          </h2>
          <p>Here’s what people are saying about Kitty Kingdom on DISBOARD.</p>
        </div>
        <ReviewCarousel
          rating={disboard.rating}
          reviews={
            disboard.reviews.length > 0 ? disboard.reviews : manualReviews
          }
        />
        <div className="review-actions">
          <a className="cta" href="/reviews">
            View all reviews
          </a>
          <a
            className="ghost"
            href="https://disboard.org/review/create/1358452494128250940"
          >
            Leave a review
          </a>
        </div>
      </section>

      <footer className="site-footer" aria-label="Footer navigation">
        <div className="footer-brand">
          <a className="brand" href="/home" aria-label="Kitty Kingdom home">
            <img
              className="brand-logo-img"
              src="/logo.png"
              alt="Kitty Kingdom logo"
            />
            <span className="brand-copy">
              <strong>Kitty Kingdom</strong>
              <small>Community portal</small>
            </span>
          </a>
          <div className="social-links" aria-label="Social links">
            <a
              href="https://discord.com/invite/M9XKHFdYQV"
              aria-label="Discord"
            >
              <svg viewBox="0 0 127.14 96.36" role="img">
                <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z" />
              </svg>
            </a>
            <a href="https://youtube.com" aria-label="YouTube">
              <svg viewBox="0 0 24 24" role="img">
                <path d="M21.6 7.2s-.2-1.5-.8-2.1c-.8-.8-1.7-.8-2.1-.9C15.8 4 12 4 12 4s-3.8 0-6.7.2c-.4.1-1.3.1-2.1.9-.6.6-.8 2.1-.8 2.1S2.2 9 2.2 10.8v1.7c0 1.8.2 3.6.2 3.6s.2 1.5.8 2.1c.8.8 1.9.8 2.4.9 1.7.2 6.4.2 6.4.2s3.8 0 6.7-.2c.4-.1 1.3-.1 2.1-.9.6-.6.8-2.1.8-2.1s.2-1.8.2-3.6v-1.7c0-1.8-.2-3.6-.2-3.6ZM10.2 14.8V8.6l5 3.1-5 3.1Z" />
              </svg>
            </a>
            <a href="https://x.com" aria-label="X">
              <svg viewBox="0 0 24 24" role="img">
                <path d="M14.7 10.6 22 2h-1.7l-6.4 7.5L8.8 2H3l7.7 11.2L3 22h1.7l6.8-7.9 5.4 7.9H22l-7.3-11.4Zm-2.4 2.8-.8-1.1L5.3 3.3H8l5 7.2.8 1.1 6.5 9.3h-2.7l-5.3-7.5Z" />
              </svg>
            </a>
          </div>
          <p>© 2026 Kitty Kingdom. All rights reserved.</p>
        </div>
        <div className="footer-columns">
          <div>
            <h3>Play</h3>
            <a href="/login">My Account</a>
            <a href="/news">News</a>
            <a href="/discord">Learn how to join</a>
          </div>
          <div>
            <h3>Community</h3>
            <a href="/discord">Discord</a>
            <a href="/reviews">Reviews</a>
            <a href="/account">Account Settings</a>
          </div>
          <div>
            <h3>Corporate</h3>
            <a href="/support">Support</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
