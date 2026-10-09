import { Check, Crown, ExternalLink, Gem, Heart, Link2, Minus, Palette, Sparkles, Wallet } from "lucide-react";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { NITRO, PATREON_URL, TIERS, itemsLabel, pct } from "../../lib/perks";
import { TierIcon } from "../tier-icon";
import { SiteNav } from "../site-nav";
import { LeafEmote } from "../ui-icons";
import "./patreon.css";
import { CurrencyName, Seasonal } from "../season-context";

export const metadata: Metadata = {
  title: "Patreon Supporters | Kitty Kingdom",
  description: "Support Kitty Kingdom on Patreon: monthly currency, big XP and currency bonuses, bigger Daily Rewards, premium games and your own custom role with gradient colors.",
};

type Row = { label: string; values: (string | boolean)[]; nitro: string | boolean };

const [, noble, monarch] = TIERS;
const ROWS: Row[] = [
  { label: "Leaves every month", values: TIERS.map((t) => t.monthly.toLocaleString()), nitro: NITRO.monthly.toLocaleString() },
  { label: "Monthly items", values: TIERS.map((t) => itemsLabel(t.items)), nitro: itemsLabel(NITRO.items) },
  { label: "XP bonus", values: TIERS.map((t) => pct(t.xp)), nitro: pct(NITRO.xp) },
  { label: "Leaf bonus", values: TIERS.map((t) => pct(t.leaf)), nitro: pct(NITRO.leaf) },
  { label: "Extra Leaves on every Daily Reward", values: TIERS.map((t) => `+${t.daily}`), nitro: "Streak bonus up to +700" },
  { label: "Custom role: your own name and color", values: TIERS.map((t) => t.customRole), nitro: false },
  { label: "Gradient role colors", values: TIERS.map((t) => t.customRole), nitro: false },
  { label: "Holographic role style + role icon", values: TIERS.map((t) => t.roleExtras), nitro: false },
  { label: "25 slot spins + premium scratch-offs", values: TIERS.map((t) => t.premiumGames), nitro: true },
  { label: "Weekly Royal Chest (/chest)", values: TIERS.map((t) => `${t.chest.toLocaleString()}+${t.chestItems.length ? " + XP Booster" : ""}`), nitro: false },
  { label: "Daily Royal Wheel (/wheel)", values: TIERS.map((t) => `×${t.wheelMult} prizes`), nitro: false },
  { label: "Store discount", values: TIERS.map((t) => `${Math.round(t.discount * 100)}% off`), nitro: false },
  { label: "Choose your title (e.g. King or Queen)", values: TIERS.map(() => true), nitro: false },
  { label: "Social Featured draw weight", values: TIERS.map((t) => `+${t.weight}`), nitro: `+${NITRO.weight}` },
  { label: "Exclusive supporter role", values: TIERS.map(() => true), nitro: true },
  { label: "Leaves for every server boost", values: TIERS.map(() => false), nitro: NITRO.perBoost.toLocaleString() },
  { label: "Emotes and stickers from other servers", values: TIERS.map(() => false), nitro: true },
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check size={18} className="pt-yes" aria-label="Included" />;
  if (v === false) return <Minus size={16} className="pt-no" aria-label="Not included" />;
  return <>{v}</>;
}

function tierPoints(t: (typeof TIERS)[number]) {
  const pts = [
    <><b>{t.monthly.toLocaleString()}</b> <LeafEmote size={14} /> + {itemsLabel(t.items)} every month</>,
    <><b>{pct(t.xp)}</b> XP and <b>{pct(t.leaf)}</b> <CurrencyName /> on everything you earn</>,
    <><b>+{t.daily}</b> <LeafEmote size={14} /> on every Daily Reward</>,
  ];
  if (t.customRole) pts.push(<><b>Custom role</b>: your own name, solid or gradient color{t.roleExtras ? ", holographic style and an icon" : ""}</>);
  if (t.premiumGames) pts.push(<>25 slot spins at once + the <b>premium scratch-offs</b></>);
  pts.push(<>A weekly <b>Royal Chest</b> worth {t.chest.toLocaleString()}+ <LeafEmote size={14} />{t.chestItems.length ? " and a 2x XP Booster" : ""}</>);
  pts.push(<>A daily spin of the <b>Royal Wheel</b>{t.wheelMult > 1 ? <> with <b>×{t.wheelMult}</b> prizes</> : null}</>);
  pts.push(<><b>{Math.round(t.discount * 100)}% off</b> everything in the Store</>);
  pts.push(<>The <b>{t.titles[0]}</b> or <b>{t.titles[1]}</b> role (your choice) and a bigger Social Featured chance</>);
  return pts;
}

export default async function PatreonPage() {
  const [user, discord] = await Promise.all([getCurrentUser().catch(() => null), getDiscordInviteSummary()]);
  return (
    <main className="site-shell pt-shell">
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <div className="pt">
        <section className="pt-hero">
          <span className="pt-eyebrow">
            <Heart size={14} aria-hidden="true" /> Support Kitty Kingdom
          </span>
          <h1>Join the Royal Court</h1>
          <p>
            Patreon keeps the server, the bots and this website running for everyone. In return, every tier comes <b>packed</b> with perks: monthly <CurrencyName />, huge XP and <CurrencyName one /> bonuses, bigger Daily Rewards and, from $10, a <b>custom role you design yourself</b>.
          </p>
          <div className="pt-hero-actions">
            <a className="pt-btn is-primary" href={PATREON_URL} target="_blank" rel="noopener noreferrer">
              Join on Patreon <ExternalLink size={15} aria-hidden="true" />
            </a>
            <a className="pt-btn" href="#compare">
              Compare tiers
            </a>
          </div>
        </section>

        <section className="pt-tiers" aria-label="Tiers">
          {TIERS.map((t) => (
            <article key={t.key} className={`pt-tier${t.key === "noble" ? " is-popular" : ""}`} style={{ "--tier": t.color } as CSSProperties}>
              {t.key === "noble" ? <span className="pt-popular">Most popular</span> : null}
              <span className="pt-tier-emoji"><TierIcon tier={t.key} size={26} /></span>
              <h2>{t.name}</h2>
              <p className="pt-price">
                <b>${t.price}</b>/month
              </p>
              <p className="pt-tagline">{t.tagline}</p>
              <ul>
                {tierPoints(t).map((pt, i) => (
                  <li key={i}>
                    <Check size={16} aria-hidden="true" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
              <a className="pt-btn is-tier" href={PATREON_URL} target="_blank" rel="noopener noreferrer">
                Become a {t.name}
              </a>
            </article>
          ))}
        </section>

        <section className="pt-block pt-role">
          <div>
            <span className="pt-eyebrow">
              <Palette size={14} aria-hidden="true" /> {noble.name} & {monarch.name}
            </span>
            <h2>Design your own role</h2>
            <p>
              Pick a name and colors on <b>My Account</b> and your role appears in Discord within seconds. Go with one color, a smooth <b>gradient</b>, or, as a {monarch.name}, Discord&apos;s shimmering <b>holographic</b> style with an emoji <b>icon</b> next to your name. Change it whenever you like, here or with <code>/myrole</code>.
            </p>
          </div>
          <div className="pt-role-demo" aria-hidden="true">
            <div className="pt-demo-msg">
              <span className="pt-demo-avatar">K</span>
              <b style={{ color: "#5BC0EB" }}>Solid Kitty</b>
            </div>
            <div className="pt-demo-msg">
              <span className="pt-demo-avatar">M</span>
              <b className="pt-demo-grad" style={{ backgroundImage: "linear-gradient(90deg, #ff8a3d, #ff3d77)" }}>Maple Royalty</b>
            </div>
            <div className="pt-demo-msg">
              <span className="pt-demo-avatar">H</span>
              <b className="pt-demo-grad is-holo" style={{ backgroundImage: "linear-gradient(90deg, #A9C9FF, #FFBBEC, #FFC3A0, #A9C9FF)" }}>Queen of Autumn</b>
              <span>👑</span>
            </div>
          </div>
        </section>

        <section className="pt-block" id="compare">
          <h2>Compare every perk</h2>
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead>
                <tr>
                  <th>Perk</th>
                  {TIERS.map((t) => (
                    <th key={t.key} style={{ "--tier": t.color } as CSSProperties}>
                      <span className="pt-th-name"><TierIcon tier={t.key} size={15} /> {t.name}</span>
                      <small>${t.price}/mo</small>
                    </th>
                  ))}
                  <th className="is-nitro">
                    <span className="pt-th-name"><TierIcon tier="nitro" size={15} /> Nitro Booster</span>
                    <small>Boost the server</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label}>
                    <td>
                      <Seasonal>{r.label}</Seasonal>
                    </td>
                    {r.values.map((v, i) => (
                      <td key={i} data-label={TIERS[i].name}>
                        <Cell v={v} />
                      </td>
                    ))}
                    <td data-label="Nitro Booster" className="is-nitro">
                      <Cell v={r.nitro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pt-small">Patreon tiers and Nitro boosting stack: support both and you get both sets of perks.</p>
        </section>

        <section className="pt-block pt-cmds">
          <span className="pt-eyebrow">
            <Crown size={14} aria-hidden="true" /> Supporter-only commands
          </span>
          <h2>Royal commands</h2>
          <div className="pt-cmd-grid">
            <div>
              <code>/chest</code>
              <b>Weekly Royal Chest</b>
              <p>Open a chest of <CurrencyName /> every week, with a lucky bonus of up to 25%. Kings and Queens also find a 2x XP Booster inside.</p>
            </div>
            <div>
              <code>/wheel</code>
              <b>Daily Royal Wheel</b>
              <p>One free spin every day for prizes up to 3,000 <CurrencyName />, Streak Shields and <CurrencyName one /> Boosters. Higher tiers win bigger.</p>
            </div>
            <div>
              <code>/myrole</code>
              <b>Custom role</b>
              <p>Prince / Princess and up: rename and recolor your own role, with gradients (and holographic + an icon for Kings and Queens).</p>
            </div>
            <div>
              <code>/title</code>
              <b>Choose your title</b>
              <p>Be a King or a Queen, a Prince or a Princess, a Duke or a Duchess. Switch any time.</p>
            </div>
            <div>
              <code>/perks</code>
              <b>Your perks</b>
              <p>See everything your tier gives you, any time.</p>
            </div>
          </div>
        </section>

        <section className="pt-block pt-nitro" style={{ "--tier": NITRO.color } as CSSProperties}>
          <div>
            <span className="pt-eyebrow">
              <Gem size={14} aria-hidden="true" /> Nitro boosters
            </span>
            <h2>Boost the server, get rewarded</h2>
            <p>
              Have Discord Nitro? Boosting Kitty Kingdom pays <b>{NITRO.perBoost.toLocaleString()}</b> <LeafEmote size={14} /> per boost, then <b>{NITRO.monthly.toLocaleString()}</b> <LeafEmote size={14} /> and a Streak Shield every month, plus <b>{pct(NITRO.xp)}</b> XP and Leaves, a daily streak bonus up to +700, the premium games and emotes and stickers from other servers.
            </p>
          </div>
        </section>

        <section className="pt-block">
          <h2>How it works</h2>
          <ol className="pt-steps">
            <li>
              <span><Wallet size={18} aria-hidden="true" /></span>
              <b>Pick a tier on Patreon</b>
              <p>Choose Duke / Duchess, Prince / Princess or King / Queen, then pick your title on My Account.</p>
            </li>
            <li>
              <span><Link2 size={18} aria-hidden="true" /></span>
              <b>Connect Discord on Patreon</b>
              <p>In your Patreon settings, connect your Discord account so we know it&apos;s you.</p>
            </li>
            <li>
              <span><Crown size={18} aria-hidden="true" /></span>
              <b>Your perks arrive automatically</b>
              <p>Your role shows up within a few minutes. Monthly <CurrencyName /> and items are paid on the last day of every month.</p>
            </li>
            <li>
              <span><Sparkles size={18} aria-hidden="true" /></span>
              <b>Design your role</b>
              <p>As a Prince or Princess and up, open My Account → Supporter perks and make it yours.</p>
            </li>
          </ol>
        </section>

        <section className="pt-block pt-faq">
          <h2>Questions</h2>
          <details>
            <summary>
              When do I get my monthly <CurrencyName />?
            </summary>
            <p>On the last day of every month at 11:59 PM Mountain, along with your monthly items. Your XP, <CurrencyName one /> and Daily Reward bonuses start as soon as your role arrives.</p>
          </details>
          <details>
            <summary>My role didn&apos;t show up. What do I do?</summary>
            <p>Make sure your Discord account is connected in your Patreon settings and that you&apos;re in the server. Roles sync every few minutes. Still nothing after 15 minutes? Open a support ticket in Discord.</p>
          </details>
          <details>
            <summary>What happens if I cancel?</summary>
            <p>Your role and bonuses end when your pledge does, but everything you&apos;ve earned or bought stays yours. Your custom role design is saved, so it comes right back if you return.</p>
          </details>
          <details>
            <summary>Can I upgrade or downgrade?</summary>
            <p>Any time on Patreon. Your role and perks update automatically within a few minutes.</p>
          </details>
        </section>

        <section className="pt-final">
          <h2>Ready to join the court?</h2>
          <a className="pt-btn is-primary" href={PATREON_URL} target="_blank" rel="noopener noreferrer">
            Join on Patreon <ExternalLink size={15} aria-hidden="true" />
          </a>
          {user ? <a className="pt-link" href="/account#supporter">Already a supporter? See your perks</a> : null}
        </section>
      </div>
    </main>
  );
}
