import { ThemeToggle } from "./theme-toggle";

const news = [
  "Fall season hub is opening with cozy builds, community events, and staff updates.",
  "Discord-linked registration is planned so every account can be tied to a verified server member.",
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
          <span className="brand-crest">KK</span>
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
          <a className="login-link" href="#login">Login</a>
          <a className="primary-pill" href="#register">Register</a>
        </div>
      </nav>

      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">Minecraft server • furry community • dating platform</p>
          <h1>Find your place in Kitty Kingdom.</h1>
          <p className="subtitle">
            A warm fall-themed community home for players, friends, and verified members. Join the Discord, link your account,
            and unlock member areas for leaderboards, dating profiles, and the store.
          </p>
          <div className="hero-actions">
            <a className="cta" href="#register">Create a Discord-linked account</a>
            <a className="ghost" href="#discord">Join the Discord</a>
          </div>
        </div>
        <div className="showcase" aria-label="Kitty Kingdom server artwork inspired card">
          <div className="banner-art">
            <span className="tree tree-left" />
            <span className="tree tree-right" />
            <span className="sun" />
            <span className="dragon">✦</span>
          </div>
          <div className="logo-card">
            <span className="logo-vines" />
            <span className="logo-mark">KK</span>
            <span className="paw-row">paw • paw</span>
          </div>
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
          <p className="eyebrow">Discord required</p>
          <h2>Registration starts by linking Discord.</h2>
          <p>
            The UI is ready for a Discord OAuth flow. Once you provide the bot/client details, registration can require Discord
            membership before a user profile is created in the database.
          </p>
        </div>
        <a className="cta" href="#register">Start registration</a>
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

      <section className="auth-panel" aria-label="Login and registration preview">
        <div className="auth-copy">
          <p className="eyebrow">Account portal</p>
          <h2>Login now, Discord-linked registration next.</h2>
          <p>
            The database can stay behind environment variables. The registration flow is designed to call Discord first, then
            create a blank user profile record after verification succeeds.
          </p>
        </div>
        <div className="forms-shell">
          <form className="mini-form" id="login">
            <h3>Login</h3>
            <label>
              Username or email
              <input placeholder="you@kittykingdom.net" type="text" />
            </label>
            <label>
              Password
              <input placeholder="••••••••" type="password" />
            </label>
            <button type="button">Enter Kingdom</button>
          </form>
          <form className="mini-form register" id="register">
            <h3>Register</h3>
            <p className="form-note">Discord must be linked before profile creation.</p>
            <a className="form-button" href="/api/auth/discord">Link Discord to register</a>
            <label>
              Preferred username
              <input placeholder="YourMCName" type="text" />
            </label>
          </form>
        </div>
      </section>
    </main>
  );
}
