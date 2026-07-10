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
    </main>
  );
}
