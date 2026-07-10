import { ReviewCarousel } from "./review-carousel";
import { ThemeToggle } from "./theme-toggle";

const news = [
  "Fall season hub is opening with cozy builds, community events, and staff updates.",
  "Email-confirmed accounts, username login, and Discord linking are moving into dedicated account pages.",
  "Leaderboards, dating profiles, and store pages are staged for signed-in members.",
];

const memberSections = [
  {
    title: "Leaderboards",
    text: "Show top community members, event winners, playtime, and seasonal challenge scores after sign-in.",
  },
  {
    title: "Dating Profiles",
    text: "A member-only profile area for introductions, preferences, and safe community matching.",
  },
  {
    title: "Store",
    text: "A future shop home for ranks, cosmetics, supporter perks, and Kitty Kingdom extras.",
  },
];

const leaves = Array.from({ length: 18 }, (_, index) => index + 1);

export default function Home() {
  return (
    <main>
      <div className="leaf-field" aria-hidden="true">
        {leaves.map((leaf) => (
          <span className="falling-leaf" key={leaf} />
        ))}
      </div>

      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="#home" aria-label="Kitty Kingdom home">
          <img className="brand-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
          <span className="brand-copy">
            <strong>Kitty Kingdom</strong>
            <small>Furry community</small>
          </span>
        </a>
        <div className="tabs">
          <a href="#home">Home</a>
          <a href="#news">News</a>
          <a href="#discord">Discord</a>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <a className="login-link" href="/login">Login</a>
          <a className="primary-pill" href="/register">Register</a>
        </div>
      </nav>

      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">Minecraft server • furry community • dating platform</p>
          <h1>Find your place in Kitty Kingdom.</h1>
          <p className="subtitle">
            A warm fall-themed community home for players, friends, and verified members. Explore the kingdom, then create a
            dedicated account when you are ready to join the member areas.
          </p>
          <div className="hero-actions">
            <a className="cta" href="/register">Create your account</a>
            <a className="ghost" href="#discord">Discord linking details</a>
          </div>
        </div>
        <div className="showcase artwork-showcase" aria-label="Kitty Kingdom server artwork">
          <img className="banner-image" src="/banner.jpg" alt="Kitty Kingdom fall banner" />
          <img className="logo-image-card" src="/logo.png" alt="Kitty Kingdom logo" />
        </div>
      </section>

      <section className="panel-grid" id="news" aria-label="Latest Kitty Kingdom news">
        <div className="section-heading">
          <p className="eyebrow">News</p>
          <h2>What is happening in the kingdom</h2>
        </div>
        {news.map((item, index) => (
          <article className="feature-card" key={item}>
            <span className="card-kicker">Update {index + 1}</span>
            <p>{item}</p>
          </article>
        ))}
      </section>

      <section className="discord-panel" id="discord">
        <div>
          <p className="eyebrow">Discord after account creation</p>
          <h2>Link Discord from account settings.</h2>
          <p>
            Registration starts on its own page with email confirmation. After sign-in, members can create a username and use the
            Discord link button in account settings to connect their server identity.
          </p>
        </div>
        <a className="cta" href="/account">Open account settings</a>
      </section>

      <section className="member-preview" aria-label="Signed-in member areas">
        <div className="section-heading">
          <p className="eyebrow">After sign-in</p>
          <h2>Member areas are staged for the next backend pass</h2>
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
          <h2>What people are saying</h2>
          <p>Community reviews are hosted on DISBOARD so visitors can read the live, public feedback source.</p>
        </div>
        <ReviewCarousel />
        <div className="review-actions">
          <a className="cta" href="/reviews">View all reviews</a>
          <a className="ghost" href="https://disboard.org/review/create/1358452494128250940">Leave a review</a>
        </div>
      </section>

      <footer className="site-footer" aria-label="Footer navigation">
        <div className="footer-brand">
          <a className="brand" href="#home" aria-label="Kitty Kingdom home">
            <img className="brand-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
            <span className="brand-copy">
              <strong>Kitty Kingdom</strong>
              <small>Community portal</small>
            </span>
          </a>
          <div className="social-links" aria-label="Social links">
            <a href="#discord" aria-label="Discord">
              <svg viewBox="0 0 24 24" role="img"><path d="M20.3 4.4A16.5 16.5 0 0 0 16.2 3l-.2.4a13 13 0 0 1 3.6 1.8 12.5 12.5 0 0 0-10.4 0 13 13 0 0 1 3.6-1.8L12.6 3a16.5 16.5 0 0 0-4.1 1.4C5.9 8.2 5.2 12 5.5 15.8a16 16 0 0 0 5 2.5l.6-.9a10.5 10.5 0 0 1-1.6-.8l.4-.3a11.7 11.7 0 0 0 8.2 0l.4.3c-.5.3-1 .6-1.6.8l.6.9a16 16 0 0 0 5-2.5c.4-4.5-.7-8.2-2.2-11.4ZM10.1 14.2c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" /></svg>
            </a>
            <a href="https://youtube.com" aria-label="YouTube">
              <svg viewBox="0 0 24 24" role="img"><path d="M21.6 7.2s-.2-1.5-.8-2.1c-.8-.8-1.7-.8-2.1-.9C15.8 4 12 4 12 4s-3.8 0-6.7.2c-.4.1-1.3.1-2.1.9-.6.6-.8 2.1-.8 2.1S2.2 9 2.2 10.8v1.7c0 1.8.2 3.6.2 3.6s.2 1.5.8 2.1c.8.8 1.9.8 2.4.9 1.7.2 6.4.2 6.4.2s3.8 0 6.7-.2c.4-.1 1.3-.1 2.1-.9.6-.6.8-2.1.8-2.1s.2-1.8.2-3.6v-1.7c0-1.8-.2-3.6-.2-3.6ZM10.2 14.8V8.6l5 3.1-5 3.1Z" /></svg>
            </a>
            <a href="https://x.com" aria-label="X">
              <svg viewBox="0 0 24 24" role="img"><path d="M14.7 10.6 22 2h-1.7l-6.4 7.5L8.8 2H3l7.7 11.2L3 22h1.7l6.8-7.9 5.4 7.9H22l-7.3-11.4Zm-2.4 2.8-.8-1.1L5.3 3.3H8l5 7.2.8 1.1 6.5 9.3h-2.7l-5.3-7.5Z" /></svg>
            </a>
          </div>
          <p>© 2026 Kitty Kingdom. All rights reserved.</p>
        </div>
        <div className="footer-columns">
          <div>
            <h3>Play</h3>
            <a href="/login">My Account</a>
            <a href="#news">News</a>
            <a href="#discord">Learn how to join</a>
          </div>
          <div>
            <h3>Community</h3>
            <a href="#discord">Discord</a>
            <a href="/account">Account Settings</a>
            <a href="/register">Dating Profiles</a>
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
