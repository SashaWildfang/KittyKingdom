# Kitty Kingdom

**A full-stack community platform: a Next.js web app, background services and a shared cloud database.**

Live at **[kittykingdom.net](https://www.kittykingdom.net)** · Created and maintained by **[Sasha Wildfang](https://github.com/SashaWildfang)**

Kitty Kingdom is a cozy, autumn-themed online community. This repository is its website. It works hand in hand with a set of Python services (Discord bots) that run the community's economy, games and moderation. Both sides share one MongoDB database, which is also how they pass work to each other.

---

## Highlights

- **Accounts and security:** email sign-up and verification, scrypt password hashing, HMAC-signed sessions you can revoke, two-factor login (TOTP, RFC 6238) with backup codes, Discord OAuth2 account linking, and rate limits stored in the database so they hold across every serverless instance.
- **Economy and store:** a shared "Leaves" currency, daily rewards with streaks, a store with roles, boosters and cosmetics, gifting and member-to-member trading.
- **Real-time games:** blackjack, live multiplayer roulette, slots, mines and scratch-offs. Every outcome is decided on the server, and every move is saved with a version check so double clicks can't pay out twice. Members can watch each other play live.
- **Leaderboards:** live rankings for Leaves, levels, messages, bumps, voice time and the daily quiz, with rank-change animations.
- **Social:** profiles, private messaging and notifications.
- **News and community pages:** news with an approval workflow, server rules generated from the same source the bot posts, an FAQ and support pages.
- **Staff tools:** an admin panel for moderation, punishments and appeals, ban-request approvals, AutoMod settings that sync to the bot within seconds, ticket transcripts, analytics and a staff handbook.
- **Responsive design:** hand-written CSS with light and dark themes, built to work on desktop and phones.

---

## Architecture

```
            Members (browser · Discord)
                 │                 │
   ┌─────────────▼─────────┐   ┌───▼─────────────────────────┐
   │ Website (this repo)   │   │ Python services (discord.py) │
   │ Next.js on Vercel     │   │ Main · Economy · Moderation  │
   │ 40 pages · 134 API    │   │ · Ticketing                  │
   │ routes (serverless)   │   │ always-on background workers │
   └──────────┬────────────┘   └───────────────┬──────────────┘
              │      reads / writes / jobs      │
              └──────────►  MongoDB Atlas  ◄────┘
                      "website" + bot databases
```

- **Serverless API:** every route in `app/api/` deploys as its own serverless function.
- **Database as the integration layer:** the website and the services never call each other directly. Work that has to happen in Discord is written to a job collection (`queued` → `processing` → `done` / `failed`). The service claims each job atomically and processes it, and the website shows the result. Examples include join approvals, ban requests and unread-message reminders.
- **Safe concurrency:** balance changes are atomic updates with guards, and game state uses optimistic concurrency (a `version` field).

---

## Tech stack

| Layer | Technology |
|---|---|
| Front end | Next.js 14 (App Router), React 18, TypeScript (strict), hand-written CSS, lucide-react |
| Back end | Next.js Route Handlers on Node.js, the official `mongodb` driver, Node `crypto` |
| Database | MongoDB Atlas |
| Integrations | Discord REST API and OAuth2, Resend (email) |
| Hosting | Vercel (website), SparkedHost (Python services) |
| Workflow | GitHub pull requests with Vercel preview deployments, automated review and GitGuardian secret scanning; merging to `main` deploys to production |

---

## Project structure

```
app/            Pages and layouts (App Router)
  api/          Serverless API routes, grouped by feature
  admin/        Staff and admin panel
  games/        Casino games and live tables
  social/       Social profiles and messaging
  ...           Account, store, leaderboards, news, rules, FAQ, support
lib/            Business logic shared by pages and API routes
  games/        Game engines (blackjack, roulette, slots, mines, scratch-offs)
  dating/       Social profiles, matching and messaging
scripts/        Build helpers (e.g. generating the rules page from the bot's rules file)
public/         Static assets
middleware.ts   Request middleware
```

---

## Getting started

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MongoDB connection string |
| `MONGODB_DB` | Website database name (default `website`) |
| `BOT_MONGODB_DB` | Bot database name (default `zeo_bot`) |
| `AUTH_SECRET` | Long random secret used to sign sessions |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sending account emails |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Discord OAuth2 |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` | Reading server roles and members |
| `DISCORD_INVITE_CODE` | Invite shown on the site |
| `SITE_URL` / `NEXT_PUBLIC_SITE_URL` | Public site address |

Secrets live in environment variables only. Never commit them.

---

## Deployment

1. Create a branch for each change.
2. Run `npx tsc --noEmit` and `npx next build` locally.
3. Open a pull request. GitHub runs a Vercel preview deployment and automated checks.
4. Merge to `main`, which deploys to production automatically.

---

## Author

**Sasha Wildfang**: founder, designer and developer of Kitty Kingdom.
B.S. Computer Science, Clemson University · Missoula, MT

---

## License

Released under the [MIT License](LICENSE). The Kitty Kingdom name, logo and artwork are not covered by the license.
