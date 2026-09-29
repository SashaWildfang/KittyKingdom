// FAQ & Guide content. Numbers come straight from the bots (main_bot: daily.py, leveling.py,
// stats.py, store/items.py, ad_manager.py; dating/core/store.py), so keep them in sync when those change.

import type { ReactNode } from "react";

export const DISCORD_INVITE = "https://discord.com/invite/M9XKHFdYQV";
export const PATREON_URL = "https://www.patreon.com/c/thekittykingdom/membership";
export const DISBOARD_URL = "https://disboard.org/server/1358452494128250940";

export type Faq = { q: string; a: ReactNode; keywords?: string };
export type Guide = { title: string; icon: string; body: ReactNode; keywords?: string };
export type Topic = { id: string; title: string; icon: string; blurb: string; guides?: Guide[]; faqs: Faq[] };

const Cmd = ({ children }: { children: ReactNode }) => <code className="kb-cmd">{children}</code>;
const Leaf = ({ n }: { n: string }) => (
  <b className="kb-leaf">
    {n} <span aria-label="leaves">🍁</span>
  </b>
);

export const LEVEL_ROLES = [
  { levels: "1–4", name: "Wanderer", emoji: "🍂", perk: "Welcome to the kingdom!" },
  { levels: "5–10", name: "Trail Scout", emoji: "🦊", perk: "Unlocks Media Perms (pictures, GIFs & reactions)" },
  { levels: "11–20", name: "Forager", emoji: "🐿️" },
  { levels: "21–30", name: "Pumpkin Spice", emoji: "🎃" },
  { levels: "31–40", name: "Cocoa Addict", emoji: "☕" },
  { levels: "41–50", name: "Maple Leaf", emoji: "🍁" },
  { levels: "51–60", name: "Rosewood", emoji: "🌹" },
  { levels: "61–70", name: "Campfire", emoji: "🔥" },
  { levels: "71–80", name: "Scarf Season", emoji: "🧣" },
  { levels: "81–90", name: "Biscuit Thief", emoji: "🥐" },
  { levels: "91–100+", name: "Gobble Gobble", emoji: "🦃" },
];

export const EARN = [
  { how: "Chatting", amount: "5 🍁 + 15–25 XP", when: "Once a minute while you chat", cmd: null },
  { how: "Daily Reward", amount: "250 🍁", when: "Every day (resets at midnight UTC)", cmd: "/daily" },
  { how: "Bumping the server", amount: "250 🍁 + 300 XP", when: "Every 2 hours", cmd: "/bump" },
  { how: "Daily Wordle", amount: "300 🍁 + 300 XP", when: "Once every 24 hours", cmd: "/wordle" },
  { how: "Hanging out in VC", amount: "Leaves + XP", when: "Automatically after 5 minutes", cmd: null },
  { how: "Monthly bump top 3", amount: "Up to 5,000 🍁", when: "End of every month", cmd: "/leaderboard" },
  { how: "Disboard review", amount: "5,000 🍁", when: "One time", cmd: null },
];

export const TOPICS: Topic[] = [
  {
    id: "start",
    title: "Getting started",
    icon: "Sparkles",
    blurb: "Joining, verifying and finding your way around.",
    guides: [
      {
        title: "Your first 10 minutes",
        icon: "Map",
        body: (
          <ol className="kb-steps">
            <li>Join the server and read the rules.</li>
            <li>Get verified so you can see the whole kingdom (you must be 18+).</li>
            <li>
              Say hi! Every message earns Leaves and XP. Type <Cmd>/help</Cmd> for a menu of every command.
            </li>
            <li>
              Claim your <Cmd>/daily</Cmd> Leaves and try the <Cmd>/wordle</Cmd>.
            </li>
            <li>Make a website account and link Discord to unlock the Store, your stats and badges here.</li>
          </ol>
        ),
      },
    ],
    faqs: [
      {
        q: "What is Kitty Kingdom?",
        a: "A warm, fall-themed furry community for adults: friends, dating profiles, events, games, an economy with its own currency (Leaves 🍁) and a website that syncs with Discord.",
      },
      {
        q: "Do I have to be 18?",
        a: "Yes. Kitty Kingdom is 18+ only. Members verify their age with staff, and the 18+ Verified role unlocks the adult areas and the dating system.",
        keywords: "age adult verify verification",
      },
      {
        q: "How do I get verified?",
        a: (
          <>
            Open a verification ticket in the <b>#nsfw-verify</b> channel and a staff member walks you through it. Once you&apos;re done you get the <b>18+ Verified</b> role.
          </>
        ),
        keywords: "verification 18 ticket",
      },
      {
        q: "Where can I see every command?",
        a: (
          <>
            Type <Cmd>/help</Cmd> anywhere in the server for an interactive menu, or check the <a href="#commands">command cheat sheet</a> below.
          </>
        ),
      },
    ],
  },
  {
    id: "economy",
    title: "Leaves & economy",
    icon: "Leaf",
    blurb: "How to earn, send and spend Leaves 🍁.",
    guides: [
      {
        title: "Ways to earn Leaves",
        icon: "Coins",
        keywords: "earn money leaves daily bump wordle vc",
        body: (
          <div className="kb-table-wrap">
            <table className="kb-table">
              <thead>
                <tr>
                  <th>How</th>
                  <th>You get</th>
                  <th>How often</th>
                </tr>
              </thead>
              <tbody>
                {EARN.map((e) => (
                  <tr key={e.how}>
                    <td>
                      <b>{e.how}</b> {e.cmd ? <Cmd>{e.cmd}</Cmd> : null}
                    </td>
                    <td>{e.amount}</td>
                    <td>{e.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      },
      {
        title: "Spending Leaves",
        icon: "ShoppingBag",
        keywords: "store shop buy roles gifts boosters",
        body: (
          <ul className="kb-list">
            <li>
              <b>Color roles</b> from <Leaf n="2,500" /> to <Leaf n="15,000" />. Some are always in stock; others rotate daily or weekly, so check back often.
            </li>
            <li>
              <b>Boosters</b> for <Leaf n="5,000" />: the <b>2x XP Booster</b> doubles your XP for a day, and the <b>Profile Booster</b> doubles how often your dating profile is shown for a day (one of each per day).
            </li>
            <li>
              <b>Gifts</b> for friends from <Leaf n="100" /> to <Leaf n="750" />: Coffee, Cookie, Single Rose, Boba Tea, Pumpkin Spice Latte, Love Letter (with your own message), Box of Chocolates, Bouquet, Birthday Cake and Teddy Bear.
            </li>
            <li>
              Shop in Discord with <Cmd>/store view</Cmd> or right here on the website&apos;s <a href="/store">Store</a>. Everything syncs instantly.
            </li>
          </ul>
        ),
      },
    ],
    faqs: [
      {
        q: "How does the Daily Reward work?",
        a: (
          <>
            <Cmd>/daily</Cmd> (or the Daily Reward card on My Account) gives you <Leaf n="250" /> once a day. It resets at midnight UTC. Server boosters also build a streak: day 1 adds +100, day 2 +200, all the way up to +700 on day 7, then the cycle starts again. Miss a full day and the streak resets.
          </>
        ),
        keywords: "daily streak reset",
      },
      {
        q: "Can I send Leaves to someone?",
        a: (
          <>
            Yes: <Cmd>/pay [user] [amount]</Cmd> sends Leaves straight to another member. You can also buy them a gift from the Store.
          </>
        ),
        keywords: "pay give transfer",
      },
      {
        q: "How do I get the 5,000 Leaves review reward?",
        a: (
          <>
            Leave an honest 5-star review on <a href={DISBOARD_URL}>Disboard</a>, then open a ticket in <b>#staff-support</b> with a screenshot and staff will pay you <Leaf n="5,000" />.
          </>
        ),
        keywords: "disboard review reward",
      },
      {
        q: "What are the monthly bump prizes?",
        a: (
          <>
            Every <Cmd>/bump</Cmd> in #bot-commands pays <Leaf n="250" /> and 300 XP (every 2 hours). The top 3 on <Cmd>/leaderboard Monthly Bumps</Cmd> win up to <Leaf n="5,000" /> at the end of the month.
          </>
        ),
        keywords: "bump disboard monthly",
      },
      {
        q: "Why didn't I get Leaves for my message?",
        a: "Chat rewards are given at most once a minute, so rapid messages only count once. Spam that AutoMod removes doesn't count either.",
      },
    ],
  },
  {
    id: "levels",
    title: "Levels & XP",
    icon: "TrendingUp",
    blurb: "Leveling up, level roles and multipliers.",
    guides: [
      {
        title: "Level roles",
        icon: "Award",
        keywords: "roles ranks levels media perms",
        body: (
          <div className="kb-roles">
            {LEVEL_ROLES.map((r) => (
              <div key={r.name} className="kb-role">
                <span className="kb-role-emoji" aria-hidden="true">
                  {r.emoji}
                </span>
                <div>
                  <b>{r.name}</b>
                  <small>Levels {r.levels}</small>
                  {r.perk ? <em>{r.perk}</em> : null}
                </div>
              </div>
            ))}
          </div>
        ),
      },
    ],
    faqs: [
      {
        q: "How do I earn XP?",
        a: "Chatting gives 15–25 XP (once a minute). Bumping, the daily Wordle and hanging out in voice chat give XP too. Watch for 2x XP weekends!",
        keywords: "xp experience",
      },
      {
        q: "How much XP do I need for the next level?",
        a: (
          <>
            Level 1 takes 100 XP; after that each level needs <b>100 × level^1.2</b> XP (for example about 1,580 XP at level 10 and 3,640 XP at level 20). Check your progress with <Cmd>/stats</Cmd> or the stats page on My Account.
          </>
        ),
        keywords: "formula next level",
      },
      {
        q: "When can I post pictures and GIFs?",
        a: "Media Perms unlock automatically at level 5 (Trail Scout). Until then, keep chatting and you'll be there in no time.",
        keywords: "media images gif perms",
      },
      {
        q: "What makes XP multipliers go up?",
        a: "Server boosting (+15%), Patreon (+10%, +20% or +40% depending on tier), 2x XP weekend events and the 2x XP Booster from the Store all stack together.",
        keywords: "multiplier boost bonus",
      },
    ],
  },
  {
    id: "casino",
    title: "Casino games",
    icon: "Dices",
    blurb: "Blackjack, slots, mines, crash and scratch-offs.",
    faqs: [
      {
        q: "Which games can I play?",
        a: (
          <ul className="kb-list">
            <li>
              <Cmd>/blackjack</Cmd>: pays a clean 3:2. Losing bets feed the progressive jackpot.
            </li>
            <li>
              <Cmd>/slots</Cmd>: spin for the progressive jackpot (<Cmd>/slots Jackpot</Cmd> shows the pool).
            </li>
            <li>
              <Cmd>/mines</Cmd>: pick your bet and how many mines, then cash out before you hit one.
            </li>
            <li>
              <Cmd>/crash</Cmd>: cash out before it explodes, up to a 100x max win.
            </li>
            <li>
              <Cmd>/scratchoff</Cmd>: buy a ticket and scratch it.
            </li>
          </ul>
        ),
        keywords: "gambling blackjack slots mines crash scratch",
      },
      {
        q: "Where do I play?",
        a: (
          <>
            In the <b>#gambling</b> channel. Every game has a View Odds option, and <Cmd>/casinostats</Cmd> shows yours (or the server&apos;s) results.
          </>
        ),
      },
      { q: "Any perks for boosters?", a: "Yes, server boosters can spin up to 25 slots at a time." },
    ],
  },
  {
    id: "nitro",
    title: "Server boosting perks",
    icon: "Gem",
    blurb: "What you get for boosting Kitty Kingdom with Nitro.",
    guides: [
      {
        title: "Golden Leaf 🍂 perks",
        icon: "Gem",
        keywords: "nitro boost booster perks golden leaf",
        body: (
          <ul className="kb-perks">
            <li>
              <b>Golden Leaf (Nitro) role</b> and a shiny booster badge
            </li>
            <li>
              <b>+15% Leaves and +15% XP</b> on everything you earn
            </li>
            <li>
              <b>Daily streaks:</b> +100 to +700 extra Leaves on your Daily Reward
            </li>
            <li>
              <b>Spin up to 25 slots</b> at a time
            </li>
            <li>
              <b>Unlimited dating likes</b> (instead of 3 a day) and you can see everyone who liked you
            </li>
            <li>Occasional booster-only Leaf drops from staff</li>
          </ul>
        ),
      },
    ],
    faqs: [
      {
        q: "How do I boost?",
        a: "Click the server name at the top of the channel list in Discord and choose Server Boost. Perks switch on automatically within a minute.",
      },
      {
        q: "What happens when my boost ends?",
        a: "Your booster perks and role are removed automatically, but everything you already earned or bought stays yours.",
      },
    ],
  },
  {
    id: "patreon",
    title: "Patreon perks",
    icon: "Heart",
    blurb: "Support the kingdom and get monthly rewards.",
    guides: [
      {
        title: "Patreon tiers",
        icon: "Crown",
        keywords: "patreon support tiers",
        body: (
          <div className="kb-tiers">
            {[
              { name: "Royal Kitten", xp: "+10% XP" },
              { name: "Kitten Guardian", xp: "+20% XP" },
              { name: "Legendary Neko", xp: "+40% XP" },
            ].map((t, i) => (
              <div key={t.name} className={`kb-tier kb-tier--${i + 1}`}>
                <small>Tier {i + 1}</small>
                <b>{t.name}</b>
                <span>{t.xp}</span>
                <em>Monthly Leaf allowance · exclusive role · custom name color and more</em>
              </div>
            ))}
          </div>
        ),
      },
    ],
    faqs: [
      {
        q: "How do I get my Patreon perks?",
        a: (
          <>
            Join a tier on <a href={PATREON_URL}>our Patreon</a> and connect Discord in your Patreon settings. Your role (and its perks) arrive automatically. Use <Cmd>/patreon</Cmd> in the server for the link any time.
          </>
        ),
      },
      {
        q: "Do Patreon and boosting stack?",
        a: "Yes! Your Patreon XP bonus and booster bonus add together, on top of any XP weekend or Store booster.",
      },
    ],
  },
  {
    id: "dating",
    title: "Social (dating & friends)",
    icon: "HeartHandshake",
    blurb: "Profiles, matching, friends and messages on the website.",
    faqs: [
      {
        q: "How do I make a dating profile?",
        a: (
          <>
            Dating lives on the website now, in <b>Social</b>. You need the <b>18+ Verified</b> role, a website account and your Discord linked (My Account → Discord → Get code, then <Cmd>/link</Cmd> in the server). Then open Social and follow the guided setup. It fills in what it can from your roles.
          </>
        ),
        keywords: "profile startprofile social dating setup",
      },
      {
        q: "I had a profile on the old dating bot. Is it gone?",
        a: "No, it moved to the website with you. Open Social and it's already there. Take a moment to check any answers we converted, then add photos, prompts and your colors.",
        keywords: "old profile migrate dating bot",
      },
      {
        q: "How does matching work?",
        a: "Discover shows your best matches one at a time (or people you'd get along with in Friends mode), and Browse lets you search and filter everyone. Our AI compares interests by meaning, and every profile shows what you have in common.",
        keywords: "findmatch discover browse match",
      },
      { q: "Is there a limit on likes?", a: "No, likes are unlimited for everyone, and you can see everyone who liked you. Server boosters get a bigger chance in the hourly Featured draw." },
      {
        q: "Can I get Social notifications in Discord?",
        a: "Yes. Open Settings (the gear at the top) → Notifications and switch on the Discord DM column for the ones you want (likes, matches, messages and more). They're all off until you turn them on.",
        keywords: "dm notifications discord",
      },
    ],
  },
  {
    id: "website",
    title: "The website",
    icon: "Globe",
    blurb: "Accounts, linking Discord, stats and badges.",
    guides: [
      {
        title: "Link your Discord",
        icon: "Link",
        keywords: "link discord code account website",
        body: (
          <ol className="kb-steps">
            <li>
              <a href="/login">Log in</a> and open <a href="/account">My Account</a>. Your email has to be confirmed first.
            </li>
            <li>
              In the Discord section, press <b>Get code</b>.
            </li>
            <li>
              In the server, type <Cmd>/link</Cmd> and paste the code (it works for 10 minutes).
            </li>
            <li>The page updates by itself once it&apos;s linked.</li>
          </ol>
        ),
      },
    ],
    faqs: [
      {
        q: "What does linking unlock?",
        a: "The Store, Leaderboards, your Daily Reward, live stats with badges and your friendship and topic maps, and managing your roles, all synced with Discord.",
      },
      {
        q: "I didn't get my confirmation email",
        a: (
          <>
            Check spam, then use <b>Resend</b> on the <a href="/login">login page</a>. Still nothing? Head to <a href="/support">Support</a>.
          </>
        ),
        keywords: "verify email confirm",
      },
      {
        q: "I typed my email wrong when I signed up",
        a: (
          <>
            No problem. On the sign-up page (or when you <a href="/login">log in</a>), press <b>Typed your email wrong? Fix it</b>, enter the right address and we&apos;ll
            send a new link there. You confirm your email before linking Discord, so nothing gets stuck.
          </>
        ),
        keywords: "wrong email typo change email",
      },
      {
        q: "Where can I read my ticket transcripts?",
        a: (
          <>
            On <a href="/account#transcripts">My Account → Transcripts</a>, or with the <b>View transcript</b> button in the DM you get when a ticket closes. You
            need a website account with the Discord that opened the ticket linked. Images, videos and files are removed from your copy for privacy.
          </>
        ),
        keywords: "ticket transcript support copy",
      },
      {
        q: "Where are my settings?",
        a: (
          <>
            Press the <b>gear</b> at the top of the site (or <b>Settings</b> in the My Account menu). Theme, notifications, privacy, messages and Discover are all in
            one place.
          </>
        ),
        keywords: "settings notifications privacy theme dark mode",
      },
      {
        q: "How do I keep my account safe?",
        a: "Turn on two-factor authentication in My Account → Security. Staff will never ask for your password or link codes.",
        keywords: "2fa security password",
      },
    ],
  },
  {
    id: "rules",
    title: "Rules, AutoMod & appeals",
    icon: "Shield",
    blurb: "How moderation works and what to do if something goes wrong.",
    faqs: [
      {
        q: "How does AutoMod work?",
        a: "AutoMod removes slurs, scam links, invites to other servers and spam. Each removal is a strike: two warnings, then mutes from 5 minutes up to a day. Strikes fade after a day (an hour for small formatting slips). It never kicks or bans.",
        keywords: "automod strike warning mute",
      },
      {
        q: "How do I check my warnings or a mute?",
        a: (
          <>
            <Cmd>/punishments</Cmd> shows your record and <Cmd>/muteduration</Cmd> shows how long a mute has left.
          </>
        ),
      },
      {
        q: "I think I was punished by mistake",
        a: (
          <>
            Open a ticket in <b>#staff-support</b> and explain what happened. Staff can see what AutoMod caught and remove strikes that shouldn&apos;t count.
          </>
        ),
        keywords: "appeal mistake unfair",
      },
      {
        q: "How do I get into voice chats?",
        a: "Read the Voice Channel terms in the server and sign them with today's date. Voice chats aren't recorded, so staff can't moderate them without proof: join at your own risk, and report problems with screenshots or clips.",
        keywords: "vc voice",
      },
    ],
  },
];

export const COMMANDS: { group: string; items: [string, string][] }[] = [
  { group: "Economy", items: [["/daily", "Claim your Daily Reward"], ["/pay", "Send Leaves to someone"], ["/stats", "Your level, XP and multipliers"], ["/leaderboard", "Rankings"], ["/milestones", "Milestone rewards"], ["/wordle", "Daily Wordle"], ["/patreon", "Patreon link and perks"], ["/store view", "Browse the Store"]] },
  { group: "Casino", items: [["/blackjack", "Blackjack (3:2)"], ["/slots", "Slots and jackpot"], ["/mines", "Mines"], ["/crash", "Crash (up to 100x)"], ["/scratchoff", "Scratch-off tickets"], ["/casinostats", "Casino stats"]] },
  { group: "Fun & info", items: [["/help", "Every command"], ["/hug", "Hug someone"], ["/boop", "Boop someone"], ["/8ball", "Ask the Magic 8-Ball"], ["/dice", "Roll a die"], ["/avatar", "See a profile picture"], ["/serverinfo", "About the server"], ["/staff", "Who's on staff"]] },
  { group: "Account", items: [["/link", "Link the website"], ["/punishments", "Your record"], ["/muteduration", "Mute time left"], ["/settings", "Privacy settings"]] },
];
