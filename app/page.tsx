const tabs = ["Home", "News", "Ranks", "Rules", "Community"];

const features = [
  {
    title: "Cozy Kingdom Spawn",
    text: "Step into a warm autumn hub with tavern lights, leaf trails, and friendly faces waiting at the gate.",
  },
  {
    title: "Player Profiles",
    text: "Register your account, personalize your kingdom identity, and keep your adventure connected.",
  },
  {
    title: "Events & Quests",
    text: "Seasonal challenges, harvest hunts, and community events built around the Kitty Kingdom vibe.",
  },
];

export default function Home() {
  return (
    <main>
      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="#home" aria-label="Kitty Kingdom home">
          <span className="brand-mark">KK</span>
          <span>Kitty Kingdom</span>
        </a>
        <div className="tabs">
          {tabs.map((tab) => (
            <a href={`#${tab.toLowerCase()}`} key={tab}>
              {tab}
            </a>
          ))}
        </div>
        <div className="auth-links">
          <a href="#login">Login</a>
          <a className="primary-pill" href="#register">Register</a>
        </div>
      </nav>

      <section className="hero" id="home">
        <div className="leaf leaf-one" />
        <div className="leaf leaf-two" />
        <div className="hero-copy">
          <p className="eyebrow">Fall season now forming</p>
          <h1>Build your legend in Kitty Kingdom.</h1>
          <p className="subtitle">
            A polished Minecraft community home inspired by warm maple forests, cozy castle halls, and your Kitty Kingdom art.
          </p>
          <div className="hero-actions">
            <a className="cta" href="#register">Join the Kingdom</a>
            <a className="ghost" href="#rules">View Server Rules</a>
          </div>
        </div>
        <div className="crest-card" aria-label="Kitty Kingdom crest placeholder">
          <div className="crest-glow" />
          <div className="crest">
            <span className="crest-letters">KK</span>
            <span className="paw-row">paw paw paw</span>
            <span className="tail" />
          </div>
        </div>
      </section>

      <section className="feature-grid" id="news" aria-label="Website highlights">
        {features.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <span className="card-icon">✦</span>
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </article>
        ))}
      </section>

      <section className="kingdom-strip" aria-label="Kingdom quick links">
        <article id="ranks">
          <span>Ranks</span>
          <strong>Founder, Noble, Knight, and Kitten tiers ready for future perks.</strong>
        </article>
        <article id="rules">
          <span>Rules</span>
          <strong>Friendly play, no griefing, no cheating, and respect the kingdom.</strong>
        </article>
        <article id="community">
          <span>Community</span>
          <strong>Discord, events, staff updates, and seasonal announcements can live here.</strong>
        </article>
      </section>

      <section className="auth-panel" aria-label="Login and registration preview">
        <div className="auth-copy">
          <p className="eyebrow">Account system ready for MongoDB wiring</p>
          <h2>Login and registration get a premium home.</h2>
          <p>
            The layout reserves polished auth entry points now, so your existing MongoDB connection can be wired into real user flows next.
          </p>
        </div>
        <div className="forms-shell">
          <form className="mini-form" id="login">
            <h3>Login</h3>
            <label>
              Username
              <input placeholder="SashaWildfang" type="text" />
            </label>
            <label>
              Password
              <input placeholder="••••••••" type="password" />
            </label>
            <button type="button">Enter Kingdom</button>
          </form>
          <form className="mini-form register" id="register">
            <h3>Register</h3>
            <label>
              Email
              <input placeholder="you@kittykingdom.net" type="email" />
            </label>
            <label>
              Username
              <input placeholder="YourMCName" type="text" />
            </label>
            <button type="button">Create Account</button>
          </form>
        </div>
      </section>
    </main>
  );
}
