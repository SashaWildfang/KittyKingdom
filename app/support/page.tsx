import { BookOpen, Crown, FileText, Gavel, KeyRound, LifeBuoy, Link2, MailCheck, MessageCircle, Shield, ShieldAlert, ShoppingBag, Ticket, Users } from "lucide-react";
import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { getServerStatsCollection } from "../../lib/mongodb";
import { DISCORD_INVITE, PATREON_URL } from "../faq/content";
import { FallingLeaves } from "../fall-effects";
import { SiteNav } from "../site-nav";
import { SupportFixes, type Fix } from "./support-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Support | Kitty Kingdom",
  description: "Get help with your Kitty Kingdom account, Discord linking, the Store, moderation and more.",
};

const FIXES: Fix[] = [
  {
    id: "login",
    title: "I can't log in",
    tags: "login sign in password forgot locked",
    steps: [
      <>You can log in with your email <b>or</b> username.</>,
      <>Forgot your password? Use <a href="/forgot-password">Reset password</a> and follow the link we email you (it works for an hour).</>,
      <>Using two-factor? Enter the 6-digit code from your authenticator app, or one of your backup codes.</>,
      <>Still locked out (lost your authenticator and backup codes)? Open a ticket and staff can verify it&apos;s you and reset it.</>,
    ],
  },
  {
    id: "verify-email",
    title: "I never got my confirmation email",
    tags: "verify email confirm confirmation spam resend",
    steps: [
      <>Check your spam or promotions folder for an email from Kitty Kingdom.</>,
      <>On the <a href="/login">login page</a>, try to log in and press <b>Resend</b> when it asks you to confirm your email.</>,
      <>Only the newest few links work, so use the most recent email.</>,
      <>Signed up but never linked Discord? The confirmation email only comes after you finish the Discord step on the sign-up page.</>,
    ],
  },
  {
    id: "link",
    title: "My Discord link code isn't working",
    tags: "link discord code /link expired",
    steps: [
      <>Codes only last <b>10 minutes</b>. Press <b>Get code</b> again on <a href="/account">My Account</a> for a fresh one.</>,
      <>Type <code className="kb-cmd">/link</code> in the Kitty Kingdom server and paste the whole code.</>,
      <>You need to be a verified member of the server to link.</>,
      <>Each Discord account can only be linked to one website account. Linked the wrong one? Unlink it from My Account first.</>,
    ],
  },
  {
    id: "store",
    title: "I bought something but didn't get it",
    tags: "store purchase role missing bought inventory",
    steps: [
      <>Roles and boosters usually arrive within a few seconds. Check your inventory on <a href="/account#inventory">My Account</a> or with <code className="kb-cmd">/store view</code>.</>,
      <>Make sure your Discord is linked, since website purchases are delivered to that account.</>,
      <>Still missing after a few minutes? Open a ticket with the item name and roughly when you bought it. Every purchase is logged, so staff can fix it.</>,
    ],
  },
  {
    id: "leaves",
    title: "My Leaves, level or streak look wrong",
    tags: "leaves balance level xp streak daily wrong missing",
    steps: [
      <>Chat rewards only count once a minute, so fast messages only earn once.</>,
      <>The Daily Reward resets at midnight UTC. Booster streaks reset if you miss a full day.</>,
      <>Check <code className="kb-cmd">/stats</code> or the stats page on My Account for your multipliers.</>,
      <>If something still doesn&apos;t add up, open a ticket with a screenshot.</>,
    ],
  },
  {
    id: "muted",
    title: "I was warned or muted and think it was a mistake",
    tags: "muted warn automod strike appeal punishment ban",
    steps: [
      <>See your record with <code className="kb-cmd">/punishments</code> and time left with <code className="kb-cmd">/muteduration</code>.</>,
      <>AutoMod strikes fade on their own after a day (an hour for small formatting slips).</>,
      <>To appeal, open a ticket in <b>#staff-support</b> and explain what happened. Staff can see exactly what was caught.</>,
    ],
    note: <>Be honest and polite. Appeals are reviewed by a different staff member where possible.</>,
  },
  {
    id: "patreon",
    title: "My Patreon or booster perks are missing",
    tags: "patreon booster nitro perks role missing",
    steps: [
      <>For Patreon, connect your Discord in your <a href={PATREON_URL}>Patreon</a> settings. The role arrives automatically.</>,
      <>Booster perks switch on within a minute of boosting. Leaving and rejoining the server can remove them.</>,
      <>Still missing? Open a ticket and include your Patreon tier or boost date.</>,
    ],
  },
  {
    id: "data",
    title: "I want to delete my account or get a copy of my data",
    tags: "delete account data privacy gdpr remove",
    steps: [
      <>Delete your website account any time from <a href="/account#delete-account">My Account → Delete account</a>.</>,
      <>For a copy of your data, or to remove Discord-side data too, open a ticket and ask for a data request.</>,
      <>Read the <a href="/privacy">Privacy Policy</a> for what we keep and for how long.</>,
    ],
  },
];

export default async function SupportPage() {
  const [user, discord, staff] = await Promise.all([
    getCurrentUser().catch(() => null),
    getDiscordInviteSummary(),
    getServerStatsCollection()
      .then((c) => c.findOne({ _id: "live_staff_count" } as never))
      .catch(() => null) as Promise<{ online_count?: number } | null>,
  ]);
  const staffOnline = typeof staff?.online_count === "number" ? staff.online_count : null;
  const linked = Boolean(user?.discordId);

  const cards = [
    { icon: KeyRound, title: "Account & login", text: "Passwords, two-factor and confirmation emails.", href: "#login" },
    { icon: Link2, title: "Linking Discord", text: "Get a code and run /link in the server.", href: "#link" },
    { icon: ShoppingBag, title: "Store & Leaves", text: "Purchases, inventory, balance and streaks.", href: "#store" },
    { icon: Gavel, title: "Warnings & appeals", text: "AutoMod strikes, mutes and how to appeal.", href: "#muted" },
    { icon: Crown, title: "Patreon & boosting", text: "Perks that didn't show up.", href: "#patreon" },
    { icon: Shield, title: "Privacy & your data", text: "Delete your account or request your data.", href: "#data" },
  ];

  return (
    <main className="site-shell kb-shell">
      <FallingLeaves foreground={false} />
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <div className="kb-container">
        <section className="kb-hero kb-hero--support">
          <p className="eyebrow">Support</p>
          <h1>How can we help?</h1>
          <p>Quick fixes for the most common problems, and a real person when you need one.</p>
          <div className="kb-status" aria-label="Status">
            <span className="kb-status-dot is-on" aria-hidden="true" />
            <span>
              <b>{discord.online ? discord.online.toLocaleString() : "Lots of"}</b> members online
            </span>
            {staffOnline !== null ? (
              <>
                <span className="kb-status-sep" aria-hidden="true" />
                <Users size={15} aria-hidden="true" />
                <span>
                  <b>{staffOnline}</b> staff online now
                </span>
              </>
            ) : null}
          </div>
        </section>

        {user && !linked ? (
          <p className="kb-banner">
            <Link2 size={16} aria-hidden="true" /> Your account isn&apos;t linked to Discord yet. <a href="/account#discord-account">Link it on My Account</a> to unlock the Store and your stats.
          </p>
        ) : null}

        <nav className="kb-topics kb-topics--support" aria-label="Help topics">
          {cards.map((c) => (
            <a key={c.title} href={c.href} className="kb-topic">
              <span className="kb-topic-icon">
                <c.icon size={20} aria-hidden="true" />
              </span>
              <b>{c.title}</b>
              <small>{c.text}</small>
            </a>
          ))}
        </nav>

        <section className="kb-section">
          <header className="kb-section-head">
            <span className="kb-topic-icon">
              <LifeBuoy size={20} aria-hidden="true" />
            </span>
            <div>
              <h2>Common fixes</h2>
              <p>Step-by-step answers. Most problems are solved in a minute.</p>
            </div>
          </header>
          <SupportFixes fixes={FIXES} />
        </section>

        <section id="contact" className="kb-section">
          <header className="kb-section-head">
            <span className="kb-topic-icon">
              <MessageCircle size={20} aria-hidden="true" />
            </span>
            <div>
              <h2>Talk to staff</h2>
              <p>Didn&apos;t find it? Here&apos;s how to reach a real person.</p>
            </div>
          </header>
          <div className="kb-contact">
            <article className="kb-contact-card is-primary">
              <Ticket size={26} aria-hidden="true" />
              <h3>Open a support ticket</h3>
              <p>
                The fastest way to get help. In the server, go to <b>#staff-support</b> and open a ticket. It&apos;s private between you and staff, and everything is kept on record so nothing gets lost.
              </p>
              <a className="kb-btn kb-btn--primary" href={DISCORD_INVITE}>
                <MessageCircle size={16} aria-hidden="true" /> Open Discord
              </a>
            </article>
            <article className="kb-contact-card">
              <ShieldAlert size={26} aria-hidden="true" />
              <h3>Report someone</h3>
              <p>Harassment, scams or anything that makes you uncomfortable: open a ticket with screenshots or message links. Reports stay confidential.</p>
            </article>
            <article className="kb-contact-card">
              <MailCheck size={26} aria-hidden="true" />
              <h3>Before you open one</h3>
              <ul className="kb-list">
                <li>Your Discord username</li>
                <li>What you expected vs what happened</li>
                <li>Screenshots or when it happened</li>
              </ul>
              <p className="kb-note">Staff will never ask for your password or link codes.</p>
            </article>
          </div>
        </section>

        <aside className="kb-cta">
          <div>
            <b>Looking for how something works?</b>
            <span>Economy, levels, perks, games and more are in the FAQ &amp; Guide.</span>
          </div>
          <div className="kb-cta-actions">
            <a className="kb-btn kb-btn--primary" href="/faq">
              <BookOpen size={16} aria-hidden="true" /> FAQ &amp; Guide
            </a>
            <a className="kb-btn" href="/privacy">
              <Shield size={16} aria-hidden="true" /> Privacy
            </a>
            <a className="kb-btn" href="/terms">
              <FileText size={16} aria-hidden="true" /> Terms
            </a>
          </div>
        </aside>
      </div>
    </main>
  );
}
