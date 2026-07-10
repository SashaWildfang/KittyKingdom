import { ThemeToggle } from "./theme-toggle";

const news = [
  "Fall season hub is opening with cozy builds, community events, and staff updates.",
  "Email-confirmed accounts are the first step before usernames and Discord linking.",
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
            A warm fall-themed community home for players, friends, and verified members. Register with email first, confirm
            your account, then add a username and link Discord from account settings.
          </p>
          <div className="hero-actions">
            <a className="cta" href="#register">Create your account</a>
            <a className="ghost" href="#discord">Discord linking details</a>
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
          <p className="eyebrow">Discord after account creation</p>
          <h2>Link Discord from account settings.</h2>
          <p>
            Registration now starts with email confirmation. After sign-in, members can choose a username and use the Discord
            link button in account settings to connect their server identity.
          </p>
        </div>
        <a className="cta" href="#account">Open account settings</a>
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
          <h2>Email-confirmed accounts with optional usernames.</h2>
          <p>
            Register with email, confirm email, and password. Once verified, you can sign in with email plus password, then add a
            username so future logins work with username plus password too.
          </p>
        </div>
        <div className="forms-shell">
          <form className="mini-form" id="login" action="/api/account/login" method="post">
            <h3>Login</h3>
            <label>
              Email or username
              <input name="identifier" placeholder="you@kittykingdom.net or YourMCName" type="text" required />
            </label>
            <label>
              Password
              <input name="password" placeholder="••••••••" type="password" required />
            </label>
            <button type="submit">Enter Kingdom</button>
          </form>
          <form className="mini-form register" id="register" action="/api/account/register" method="post">
            <h3>Register</h3>
            <p className="form-note">A confirmation link will be sent before the account can log in.</p>
            <label>
              Email
              <input name="email" placeholder="you@kittykingdom.net" type="email" required />
            </label>
            <label>
              Confirm email
              <input name="confirmEmail" placeholder="you@kittykingdom.net" type="email" required />
            </label>
            <label>
              Password
              <input name="password" placeholder="Minimum 8 characters" type="password" minLength={8} required />
            </label>
            <button type="submit">Send confirmation email</button>
          </form>
        </div>
      </section>

      <section className="account-panel" id="account" aria-label="Account settings preview">
        <div>
          <p className="eyebrow">Account settings</p>
          <h2>Finish your member profile after email verification.</h2>
          <p>
            Signed-in members can create a username for username-based login and connect Discord from this account area.
          </p>
        </div>
        <div className="forms-shell account-forms">
          <form className="mini-form" action="/api/account/username" method="post">
            <h3>Create username</h3>
            <label>
              Username
              <input name="username" placeholder="YourMCName" pattern="[A-Za-z0-9_]{3,20}" required />
            </label>
            <button type="submit">Save username</button>
          </form>
          <div className="mini-form">
            <h3>Discord</h3>
            <p className="form-note">Connect Discord after logging in so your website account can match your community member identity.</p>
            <a className="form-button" href="/api/auth/discord">Link Discord account</a>
          </div>
        </div>
      </section>
    </main>
  );
}
