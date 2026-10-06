// The owner's project guide (/owner/project-guide): how Kitty Kingdom is built, explained simply, and how
// each part lines up with the Software Engineer I role at Consumer Direct Care Network (Azure, C#/.NET,
// MSSQL, Cosmos DB, Angular). Text uses **bold** and `code`.

export type QueueCard = {
  name: string;
  azure: string;
  collection: string;
  producer: string;
  consumer: string;
  flow: string[];
  why: string;
};

export type Block =
  | { t: "p"; text: string }
  | { t: "list"; items: string[] }
  | { t: "code"; label: string; code: string; note?: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "callout"; tone: "azure" | "tip" | "honest"; title: string; text: string }
  | { t: "steps"; items: { title: string; text: string }[] }
  | { t: "queues"; items: QueueCard[] }
  | { t: "diagram" }
  | { t: "terms"; items: { term: string; plain: string; mine: string }[] };

/** `prep` sections are private notes: only shown in Prep mode, never while presenting */
export type Section = { id: string; kicker: string; title: string; intro?: string; blocks: Block[]; prep?: boolean };

export const JOB = {
  title: "Software Engineer I",
  company: "Consumer Direct Care Network",
  url: "https://cdcn.avature.net/careers/JobDetail/Software-Engineer-I/8611",
  stack: ["Azure Functions", "Service Bus", "Logic Apps", "Cosmos DB (NoSQL)", "MSSQL", "C# / .NET", "HTML · CSS · JavaScript", "Angular"],
};

export const SECTIONS: Section[] = [
  {
    id: "overview",
    kicker: "Overview",
    title: "Kitty Kingdom at a glance",
    intro: "A full-stack platform I built and run for an online community: a **web app** and **four Python services**, connected through one shared **NoSQL database**.",
    blocks: [
      {
        t: "table",
        head: ["Layer", "Technology", "Closest match in your stack"],
        rows: [
          ["Front end", "**Next.js 14, React 18, TypeScript**, hand-written CSS", "HTML · CSS · JavaScript, **Angular**"],
          ["API / back end", "**134 serverless API routes** (Node.js) on Vercel", "**Azure Functions** (HTTP trigger)"],
          ["Background services", "**4 Python services** (discord.py, async), 30+ scheduled jobs", "**Azure Functions** (timer) · **Logic Apps**"],
          ["Messaging between services", "Job queues in the database with status, claiming and retries", "**Azure Service Bus**"],
          ["Database", "**MongoDB Atlas** (document / NoSQL)", "**Cosmos DB** (has a MongoDB API) · relational design for **MSSQL**"],
          ["Delivery", "GitHub pull requests → automated checks → auto-deploy", "Azure DevOps / GitHub Actions"],
        ],
      },
      {
        t: "list",
        items: [
          "**Accounts and security:** hashed passwords, signed sessions, two-factor login, rate limits",
          "**Features:** an in-app economy and store, real-time games with live spectating, private messaging, support tickets and transcripts, leaderboards, and staff moderation tools",
          "**Scale of the codebase:** 40 pages, 134 API endpoints, 4 services, 320+ commits",
        ],
      },
    ],
  },
  {
    id: "pitch",
    kicker: "Prep only",
    title: "Your 30-second pitch",
    prep: true,
    intro: "Say this first, almost word for word. Everything else on this page is backup detail for when they ask follow-up questions.",
    blocks: [
      {
        t: "callout",
        tone: "tip",
        title: "Your pitch",
        text:
          "\"Kitty Kingdom is a full-stack platform I built and run for an online community. It has two halves: a **web app** made with **Next.js, React and TypeScript** that runs as serverless functions on **Vercel**, and **four Python services** (Discord bots). Both halves share one **MongoDB** NoSQL database, and that database is how they talk to each other, using queues of jobs much like **Azure Service Bus**. Members get accounts with **two-factor login**, an economy and store, real-time games, private messaging, support tickets, and staff moderation tools. I ship through **GitHub pull requests** with automatic checks and preview deployments, and merging to main deploys to production.\"",
      },
      {
        t: "table",
        head: ["Fact", "Number"],
        rows: [
          ["Website pages", "40"],
          ["API endpoints (serverless functions)", "134"],
          ["Python services (bots)", "4: Main, Economy, Moderation, Ticketing"],
          ["Background jobs in the bots", "30+ scheduled loops"],
          ["Commits to the website", "320+"],
        ],
      },
    ],
  },
  {
    id: "picture",
    kicker: "Architecture",
    title: "The big picture",
    intro: "Three parts, connected by one database. The website and the services never call each other directly: they share data and hand each other jobs.",
    blocks: [
      { t: "diagram" },
      {
        t: "steps",
        items: [
          { title: "The website (Next.js on Vercel)", text: "What members see in a browser. Every button that changes something calls an **API route**, a small function that runs on Vercel's servers only when it's needed." },
          { title: "The bots (Python on SparkedHost)", text: "Programs that are always running and connected to Discord. They react to things happening in the server and run timed jobs." },
          { title: "The database (MongoDB Atlas)", text: "One shared place where everything is stored. The website and the bots never call each other directly. They read and write the same data, and leave **jobs** for each other." },
        ],
      },
      {
        t: "callout",
        tone: "azure",
        title: "How this looks in Azure",
        text: "Website API routes → **Azure Functions** (HTTP trigger). Bot timed jobs → **Azure Functions** (timer trigger) or **Logic Apps**. My job collections → **Service Bus queues**. MongoDB → **Cosmos DB** (it even has a MongoDB-compatible API). The front end could be React or **Angular** either way.",
      },
    ],
  },
  {
    id: "terms",
    prep: true,
    kicker: "Plain English",
    title: "Every term, explained simply",
    intro: "Prep notes: every term in plain English.",
    blocks: [
      {
        t: "terms",
        items: [
          { term: "Front end", plain: "The part that runs in the browser: what people see and click.", mine: "React components in the `app/` folder" },
          { term: "Back end", plain: "Code on a server that checks permissions, does the work and talks to the database.", mine: "API routes in `app/api/` and the helpers in `lib/`" },
          { term: "API / endpoint", plain: "A URL the front end calls to ask for data or make a change. It answers with JSON.", mine: "e.g. `POST /api/games/mines`" },
          { term: "Serverless function", plain: "Code that only runs when a request comes in. No server to manage, it scales by itself.", mine: "Every API route on Vercel. Same idea as an **Azure Function**" },
          { term: "Next.js", plain: "A framework on top of React that adds pages, routing and server code in one project.", mine: "The whole website" },
          { term: "React", plain: "A library for building the screen out of reusable pieces called components.", mine: "Every page and widget. **Angular** is the same idea with different syntax" },
          { term: "TypeScript", plain: "JavaScript with types, so mistakes are caught before the code runs.", mine: "All website code, in strict mode. Very close to **C#** in feel" },
          { term: "NoSQL / document database", plain: "Stores data as JSON-like documents instead of rows in tables.", mine: "MongoDB. **Cosmos DB** is Microsoft's version" },
          { term: "SQL / relational database", plain: "Stores data in tables with rows and columns, linked by keys.", mine: "Not used here, but see the SQL section for how I'd model it" },
          { term: "Queue", plain: "A to-do list for programs: one side adds jobs, another side picks them up and does them.", mine: "`join_actions`, `ban_requests`, `message_dm_queue`" },
          { term: "Async", plain: "Code that can wait for something slow (the network, the database) without freezing everything else.", mine: "All the Python bots (`async`/`await`) and the website's database calls" },
          { term: "Environment variables", plain: "Secret settings (passwords, keys) kept outside the code.", mine: "Set in Vercel and each bot's `.env`. Never committed to GitHub" },
          { term: "CI/CD", plain: "Automatic checks on every change (CI) and automatic deploys (CD).", mine: "GitHub pull requests → Vercel preview + checks → merge → live" },
        ],
      },
    ],
  },
  {
    id: "frontend",
    kicker: "Front end",
    title: "The website you see",
    intro: "Built with Next.js 14, React 18 and TypeScript. No CSS framework: every style is hand-written.",
    blocks: [
      {
        t: "table",
        head: ["Piece", "What I use", "Why"],
        rows: [
          ["Framework", "**Next.js 14** (App Router) + **React 18**", "Pages, routing and back-end code in one project"],
          ["Language", "**TypeScript** (strict)", "Catches mistakes before they reach users"],
          ["Styling", "Plain **CSS** with CSS variables", "Dark and light themes by swapping variables. Responsive with Grid, Flexbox and media queries"],
          ["Icons", "`lucide-react`", "Clean, consistent icons"],
          ["Small libraries", "`qrcode`, `fflate`, `node-html-parser`", "2FA setup QR codes, zip downloads, reading HTML"],
          ["Live updates", "Polling + animations", "Leaderboards refresh every 10 seconds. The live roulette table runs off a server clock so everyone sees the same spin"],
        ],
      },
      {
        t: "p",
        text: "Next.js has two kinds of components. **Server components** run on the server, load data and send finished HTML (fast, and secrets never reach the browser). **Client components** (marked `\"use client\"`) run in the browser for anything interactive, like the games and chat.",
      },
      {
        t: "code",
        label: "A server component: the Rules page loads its data on the server",
        code: `export default async function RulesPage() {
  const [user, discord] = await Promise.all([getCurrentUser(), getDiscordInviteSummary()]);
  return (
    <main className="site-shell">
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      {RULES.parts.map((part) => (
        <section key={part.key} id={part.key}>…</section>
      ))}
    </main>
  );
}`,
      },
      {
        t: "callout",
        tone: "azure",
        title: "Angular connection",
        text: "React and Angular are both **component-based** and both use **TypeScript**. React components ↔ Angular components. React state and hooks ↔ Angular services and RxJS. Next.js routing ↔ Angular Router. The thinking (break the screen into reusable pieces, pass data down, call APIs) is the same.",
      },
    ],
  },
  {
    id: "backend",
    kicker: "Back end",
    title: "What happens when you click a button",
    intro: "One click in the Mines game, followed from the browser to the database and back.",
    blocks: [
      {
        t: "steps",
        items: [
          { title: "1. You click a tile in Mines", text: "The React component sends `POST /api/games/mines` with `{ action: \"reveal\", tile: 7 }`." },
          { title: "2. The API route checks who you are", text: "It reads your signed session cookie and makes sure you're logged in with Discord linked. Not logged in → `401`." },
          { title: "3. Business logic in `lib/games/mines.ts`", text: "It loads your game from the database. The mine positions were picked with secure randomness when the game started and **never leave the server** until it's over, so nobody can cheat in the browser." },
          { title: "4. Save safely", text: "The update only applies if the game's `version` hasn't changed since it was read. A double-click or second tab can't reveal twice or cash out twice." },
          { title: "5. Answer with JSON", text: "The route returns the new board and balance. React re-renders the tile as a gem or a bomb." },
        ],
      },
      {
        t: "code",
        label: "lib/games/mines.ts: saving a move with a version check (optimistic concurrency)",
        code: `async function save(prev: MinesSession, next: MinesSession) {
  const { sessions } = await gameCollections();
  const res = await sessions.replaceOne(
    { _id: prev._id, version: prev.version },          // only if nobody changed it
    { ...next, version: prev.version + 1, updatedAt: new Date() },
  );
  if (!res.modifiedCount) throw new GameError("That board changed in another tab.", 409);
}`,
        note: "In SQL Server this is the same idea as a `rowversion` column: UPDATE … WHERE Version = @Version.",
      },
      {
        t: "list",
        items: [
          "**134 API routes** in `app/api/`, grouped by feature: account, admin, games, store, news, tickets…",
          "Shared logic lives in `lib/` so routes stay short (the route checks access, the `lib` function does the work)",
          "Errors come back as clear JSON with the right HTTP status: `400` bad input, `401` not logged in, `403` not allowed, `409` conflict",
          "**Email** goes through the Resend REST API. **Discord data** comes from the Discord REST API and OAuth2",
          "**Middleware** runs before every request (for example, it blocks changes while an admin is \"viewing as\" a member)",
        ],
      },
    ],
  },
  {
    id: "security",
    kicker: "Security",
    title: "Logins and keeping accounts safe",
    intro: "Built by hand with Node's built-in `crypto` module. No auth library.",
    blocks: [
      {
        t: "table",
        head: ["Feature", "How it works"],
        rows: [
          ["Passwords", "Hashed with **scrypt** and a random salt per user. Compared with `timingSafeEqual` so attackers can't time the check"],
          ["Sessions", "A random token in an **httpOnly, secure cookie**, signed with **HMAC-SHA256**, and stored in the database so it can be **revoked** (log out other devices)"],
          ["Remember me", "30 days if ticked, 8 hours if not"],
          ["Two-factor (2FA)", "Authenticator-app codes (**TOTP, RFC 6238**), implemented from the spec, with backup codes"],
          ["Rate limits", "Stored in MongoDB, not memory, so they hold across every serverless instance"],
          ["Secrets", "Environment variables only. **GitGuardian** scans every pull request for leaked keys"],
          ["Linked accounts", "Discord **OAuth2**. Banned Discord members have their website account closed automatically"],
        ],
      },
      {
        t: "code",
        label: "lib/auth.ts: password hashing",
        code: `export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = Buffer.from(hashPassword(password, salt).hash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}`,
      },
    ],
  },
  {
    id: "database",
    kicker: "Data",
    title: "The database: MongoDB, and how it maps to SQL",
    intro: "MongoDB Atlas (cloud hosted). Two databases: `website` (accounts, sessions, news, tickets, messages) and `zeo_bot` (balances, levels, inventory, games, quiz streaks).",
    blocks: [
      {
        t: "code",
        label: "A real document: one player's Question of the Day stats (collection `qotd`)",
        code: `{
  "user_id": 972010676543422505,   // Discord ID (a 64-bit number)
  "current": 4,                     // current streak
  "best": 9,
  "total_correct": 31,
  "total_answered": 40,
  "leaves_earned": 7750
}`,
      },
      {
        t: "list",
        items: [
          "**Indexes** make lookups fast. **Unique** indexes stop duplicates (one record per player)",
          "**TTL indexes** delete old data automatically: \"who's online\" records disappear after 5 minutes, live chat after a set number of hours",
          "**Atomic updates**: `$inc` changes a balance in one step, with a filter so it only happens if you can afford it",
          "**Optimistic concurrency**: the `version` field you saw in the back-end section",
        ],
      },
      {
        t: "callout",
        tone: "azure",
        title: "Cosmos DB connection",
        text: "**Azure Cosmos DB for MongoDB** speaks the same API as MongoDB, so my queries, indexes and driver code would carry over. Concepts like partitioning by a key (I look most things up by Discord ID) and TTL also exist in Cosmos DB.",
      },
      {
        t: "callout",
        tone: "honest",
        title: "SQL Server",
        text: "This project runs on MongoDB, but the same data maps cleanly to relational tables. Here's how the core of it would look in SQL Server.",
      },
      {
        t: "table",
        head: ["MongoDB (what I use)", "SQL Server (what they use)"],
        rows: [
          ["Collection", "Table"],
          ["Document", "Row"],
          ["Nested fields", "A separate table + foreign key, joined"],
          ["`$inc` with a filter", "`UPDATE … SET Balance = Balance - @Bet WHERE Balance >= @Bet`"],
          ["`version` field", "`rowversion` column"],
          ["TTL index", "A SQL Agent job that deletes old rows"],
          ["Unique index", "`UNIQUE` constraint"],
        ],
      },
      {
        t: "code",
        label: "How I'd model it in SQL Server",
        code: `CREATE TABLE Users (
  UserId     BIGINT       NOT NULL PRIMARY KEY,           -- Discord ID
  Username   NVARCHAR(32) NOT NULL UNIQUE,
  Balance    BIGINT       NOT NULL DEFAULT 0 CHECK (Balance >= 0),
  Level      INT          NOT NULL DEFAULT 1,
  CreatedAt  DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE GameResults (
  GameId     BIGINT IDENTITY PRIMARY KEY,
  UserId     BIGINT       NOT NULL REFERENCES Users(UserId),
  Game       NVARCHAR(20) NOT NULL,
  Bet        BIGINT       NOT NULL,
  Payout     BIGINT       NOT NULL,
  PlayedAt   DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_GameResults_User ON GameResults (UserId, PlayedAt DESC);

-- Charge a bet safely: 0 rows affected means "not enough leaves"
UPDATE Users SET Balance = Balance - @Bet
WHERE UserId = @UserId AND Balance >= @Bet;`,
      },
    ],
  },
  {
    id: "bots",
    kicker: "Python services",
    title: "The bots",
    intro: "Four separate Python programs, each with one job. Built with **discord.py 2.6**, which is fully async.",
    blocks: [
      {
        t: "table",
        head: ["Service", "What it does"],
        rows: [
          ["**Main**", "Help menu, store, server guide, stat channels, live chat for the website, unread-message reminders"],
          ["**Economy**", "Leaves, levels, daily rewards, casino games, bumps, voice-chat rewards, Question of the Day, monthly payouts"],
          ["**Moderation**", "AutoMod filter, bans and mutes, join verification, rules, ban requests"],
          ["**Ticketing**", "Support tickets and transcripts"],
        ],
      },
      {
        t: "list",
        items: [
          "**Libraries:** `discord.py`, **Motor** (async MongoDB driver), `pymongo`, `python-dotenv`, `aiohttp`, `matplotlib` (draws the daily quiz chart)",
          "**Object-oriented:** every feature is a **class** that inherits from `commands.Cog`. Commands are methods and shared state lives on the object",
          "**Plugin-style loading:** each bot loads every file in its `cmds/` and `events/` folders automatically",
          "**Hosting:** SparkedHost (Pterodactyl panel), running as long-lived processes",
        ],
      },
      {
        t: "code",
        label: "Economy/cmds/mines.py: a cog is a class",
        code: `class Mines(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.db = get_connection()
        self.users_col = self.db["users"]
        self.globals_col = self.db["globals"]

    async def add_to_jackpot(self, amount: int):
        await self.globals_col.find_one_and_update(
            {"_id": "casino_jackpot"},
            {"$inc": {"amount": amount}},
            upsert=True,
        )`,
        note: "In C# this would be a class with a constructor, private fields and async Task methods. Same structure, different syntax.",
      },
    ],
  },
  {
    id: "servicebus",
    kicker: "Service Bus",
    title: "Service Bus, in my project",
    intro:
      "Azure Service Bus is a managed **message queue**: one program drops a message in, another program picks it up and processes it, even if it was offline when the message was sent. I built the same pattern on MongoDB to connect the website and the bots. Here are five real examples.",
    blocks: [
      {
        t: "table",
        head: ["Service Bus idea", "What it means", "Where I do it"],
        rows: [
          ["Queue + message", "A list of jobs waiting to be done", "A collection of job documents with a `status`"],
          ["Sender / receiver", "Who adds jobs, who does them", "The website adds, a bot does them (or the other way)"],
          ["Peek-lock", "Claim a message so no one else processes it", "`find_one_and_update` from `queued` to `processing` in one atomic step"],
          ["Complete / dead-letter", "Mark done, or set aside if it failed", "`status: \"done\"` or `\"failed\"` with the error saved in `result`"],
          ["Duplicate detection", "Ignore the same message twice", "A fixed `_id` per job, or a check for an identical job in flight"],
          ["Scheduled messages", "Deliver later, not now", "`firstAt` + wait 10 minutes; due-time checks for unmutes and unbans"],
          ["Topics / subscriptions", "Broadcast a change to listeners", "A settings document with a `version` number the bot watches"],
        ],
      },
      {
        t: "queues",
        items: [
          {
            name: "Join application decisions",
            azure: "Service Bus queue with peek-lock + a health check",
            collection: "website.join_actions",
            producer: "Website: a staff member clicks Accept, Deny or Ban on an application in the admin panel",
            consumer: "Moderation bot, every 3 seconds, up to 5 jobs per tick",
            flow: [
              "Website inserts `{ discordId, action, by, status: \"queued\" }`, after checking no decision for that person is already in flight (duplicate protection)",
              "Bot claims the oldest job atomically: `queued` → `processing` (nobody else can grab it)",
              "Bot gives the roles, sends the welcome and logs it, using the same code as its Discord buttons",
              "Bot sets `done` or `failed` with a `result` message; the website polls the job and shows the outcome",
              "Bot writes a heartbeat to `live_meta` every tick. If it's older than 30 seconds, the website warns staff the bot is offline (queued jobs wait safely)",
            ],
            why: "Only the bot can change Discord roles, but staff work on the website. The queue lets them hand work across, even while the bot restarts.",
          },
          {
            name: "Ban requests (approval workflow)",
            azure: "Service Bus queue + Logic Apps approval step",
            collection: "website.ban_requests",
            producer: "Jr Mods run /ban in Discord (they can't ban directly), creating a pending request",
            consumer: "Mods and up approve or deny on the website or in Discord; the Moderation bot carries out approved bans (checks every 5 seconds)",
            flow: [
              "`pending` → a Mod+ reviews it (must type CONFIRM to approve)",
              "`approved` → the bot picks it up and bans the member",
              "`executed`, `failed`, `denied`, or `cancelled` (if they were already banned)",
            ],
            why: "Junior staff can't ban on their own, so every request waits for a senior to approve it.",
          },
          {
            name: "Unread message reminders",
            azure: "Scheduled messages + cancel a scheduled message + duplicate detection",
            collection: "website.message_dm_queue",
            producer: "Website: a member sends someone a private message",
            consumer: "Main bot, every 10 minutes",
            flow: [
              "Website upserts one job per conversation per person (`_id: \"conv:user\"`), so 20 messages don't create 20 reminders",
              "If the message is still unread **10 minutes** later, the bot sends one Discord DM",
              "Reading the chat **deletes** the job, cancelling the reminder before it's sent",
            ],
            why: "People get nudged about messages they missed, without being spammed.",
          },
          {
            name: "AutoMod settings from the website",
            azure: "Topic / subscription (broadcast a change to a listener)",
            collection: "automod_config (one settings document with a `version`)",
            producer: "Admins change word lists and rules in Admin → AutoMod",
            consumer: "Moderation bot checks the version every 15 seconds",
            flow: [
              "Saving on the website bumps `version`",
              "The bot sees a new version and reloads its filters within seconds, with no restart",
              "Raid mode timers expire automatically and are logged",
            ],
            why: "Staff can tune moderation live from a web page.",
          },
          {
            name: "Timed punishments and boosters",
            azure: "Scheduled messages / timer-triggered Azure Functions",
            collection: "punishments, temporary_boosters",
            producer: "A mute, scheduled unban, or booster is saved with an end time",
            consumer: "Bots check every 30 seconds (mutes), every minute (unbans and boosters)",
            flow: [
              "The end time is stored in the database, not just in memory",
              "A loop finds everything that's due and undoes it (unmute, unban, end booster)",
              "Because it's in the database, it still happens even if the bot was restarting",
            ],
            why: "Restart-proof timers: nothing is lost if a service goes down.",
          },
        ],
      },
      {
        t: "callout",
        tone: "honest",
        title: "Where I'd take it next",
        text:
          "My version polls the database every few seconds. **Service Bus** pushes messages instantly and handles retries, lock timeouts, dead-letter queues and scaling as a managed service. The natural next step: move these job collections to Service Bus queues, processed by Service Bus-triggered Azure Functions.",
      },
    ],
  },
  {
    id: "functions",
    kicker: "Functions & Logic Apps",
    title: "Timed jobs and workflows",
    intro: "Azure Functions run code on a trigger (an HTTP request, a timer, a queue message). Logic Apps chain steps into a workflow. I have both patterns.",
    blocks: [
      {
        t: "table",
        head: ["In my project", "Trigger", "Azure equivalent"],
        rows: [
          ["Every API route (134)", "HTTP request", "Azure Function, HTTP trigger"],
          ["Question of the Day posts at 12:00 PM Mountain", "Daily time", "Timer-triggered Function"],
          ["Monthly bump and voice prizes paid out", "Monthly time", "Timer-triggered Function / Logic App"],
          ["Level and Patreon roles re-synced every 6 hours", "Interval", "Timer-triggered Function"],
          ["Join decisions, ban requests, DM reminders", "New job in a queue", "Service Bus-triggered Function"],
          ["News posts: pending → owner approves → published", "Human approval", "Logic Apps approval workflow"],
          ["Ban → close website account → email the reason", "An event, then several steps", "Logic App chaining a few actions"],
        ],
      },
    ],
  },
  {
    id: "devops",
    kicker: "Workflow",
    title: "How I ship changes",
    blocks: [
      {
        t: "steps",
        items: [
          { title: "1. Branch", text: "Every change starts on its own Git branch." },
          { title: "2. Test locally", text: "A local copy of the site, pointed at a local MongoDB and a **fake Discord API server**, so I can test without touching real members. Then `tsc --noEmit` (type check) and a production build." },
          { title: "3. Pull request", text: "GitHub runs **checks**: a **Vercel preview deployment** (a full working copy of the site), **GitGuardian** secret scanning and an automated code review." },
          { title: "4. Merge", text: "Merging to `main` deploys to production automatically (**continuous deployment**)." },
          { title: "5. Bots", text: "Bot updates are uploaded to the host and the service is restarted." },
        ],
      },
      {
        t: "callout",
        tone: "azure",
        title: "Azure connection",
        text: "The same flow works with **Azure DevOps** or **GitHub Actions** deploying to **Azure App Service / Static Web Apps** and **Azure Functions**.",
      },
    ],
  },
  {
    id: "match",
    kicker: "The role",
    title: "How this relates to the role",
    blocks: [
      {
        t: "table",
        head: ["They ask for", "What I can show"],
        rows: [
          ["Basic object-oriented programming", "Python bot features are classes (cogs) with inheritance; typed TypeScript models"],
          ["HTML, CSS and JavaScript", "Every page hand-built: semantic HTML, custom CSS themes, responsive layouts, TypeScript"],
          ["Server-side languages", "TypeScript (Node.js) API routes and Python services"],
          ["Database concepts", "Indexes, unique keys, TTL, atomic updates, concurrency control; SQL modelling above"],
          ["Azure Functions", "134 serverless HTTP functions + many timed jobs"],
          ["Service Bus", "Five queue-style flows between the website and the bots"],
          ["Logic Apps", "Approval and multi-step workflows (news, ban requests, ban → email)"],
          ["Cosmos DB (NoSQL)", "MongoDB in production, the same API Cosmos DB offers"],
          ["MSSQL", "Relational design knowledge (honest: not used in this project)"],
          ["C# / .NET", "Strict TypeScript and class-based Python; C# syntax and async/await are very similar"],
          ["Angular (preferred)", "React + TypeScript component architecture"],
          ["Troubleshooting bugs", "See the bug stories below"],
        ],
      },
    ],
  },
  {
    id: "bugs",
    prep: true,
    kicker: "Stories",
    title: "Bug stories to tell",
    intro: "Use the order: what happened → what I had to do → what I did → the result.",
    blocks: [
      {
        t: "steps",
        items: [
          {
            title: "The empty leaderboard",
            text:
              "I added quiz leaderboards and the board showed nobody, even though the data was in the database. I traced the API: Discord IDs are 64-bit numbers, too big for a JavaScript number to hold exactly, so the driver returns them as `BigInt`. My ID parser only handled strings and numbers, so it silently dropped every one. I added the BigInt case and re-tested with seeded data. **Lesson:** test with realistic data types.",
          },
          {
            title: "The 24-hour booster that lasted 1 hour",
            text: "Members said a \"2x Leaves\" booster stopped early. The earning code only applied the **first** running booster it found, so a second one was ignored. I changed it to apply every running booster, in both the bot and the website so they agree.",
          },
          {
            title: "Double cash-outs",
            text: "Very fast double-clicks could send two cash-out requests at once. I added a version number to each game so the second request fails safely with \"this changed in another tab\".",
          },
          {
            title: "Auditing the game math",
            text: "Members felt the casino was rigged. I calculated each game's **return to player**: slots only paid back about 42%. I re-tuned every game to normal casino odds (slots about 95%, mines 99%) and checked the probability math for every combination.",
          },
        ],
      },
    ],
  },
  {
    id: "demo",
    prep: true,
    kicker: "Tomorrow",
    title: "Demo plan and likely questions",
    blocks: [
      {
        t: "callout",
        tone: "tip",
        title: "Before the call",
        text: "Share your **browser window**, not your whole screen. Close Discord and turn off notifications. Stay on SFW pages. **Don't show:** admin member data, the Social section, anything NSFW, or `.env` files.",
      },
      {
        t: "steps",
        items: [
          { title: "1. Home and News (30s)", text: "\"The public site. News posts go through an approval queue.\"" },
          { title: "2. Log in → My Account (1 min)", text: "Daily reward, boosters, stats. Mention scrypt, sessions and 2FA." },
          { title: "3. Leaderboards (1 min)", text: "Live updates, rank changes, and resize the window to show it working on a phone." },
          { title: "4. Games → Mines (1–2 min)", text: "\"Everything is decided on the server. The browser never sees where the mines are.\" Then walk the click from the back-end section." },
          { title: "5. Rules (30s)", text: "\"Generated from the same file the Discord bot posts, one source of truth.\"" },
          { title: "6. GitHub (1 min)", text: "Open a merged pull request: checks, preview deployment, merge = deploy." },
          { title: "7. This page (if it helps)", text: "Show the architecture diagram and the Service Bus section." },
        ],
      },
      {
        t: "table",
        head: ["Question", "Answer"],
        rows: [
          ["Why MongoDB and not SQL?", "My data is document-shaped (member records with lots of optional fields), it changed constantly while I built, and Python and Node both read it easily. For relational reporting I'd pick SQL."],
          ["How do the website and bots stay in sync?", "One shared database is the source of truth, and work that has to happen in Discord goes through job queues the bots process."],
          ["How do you handle security?", "Salted scrypt hashes, signed httpOnly cookies, 2FA, rate limits, server-side validation, secrets in environment variables, and secret scanning on every PR."],
          ["What would you improve?", "Move my job queues to Service Bus, add automated unit tests to CI, and use WebSockets for the live features."],
          ["How do you learn new tech?", "Docs first, then build something small that works. I implemented 2FA straight from the RFC spec."],
          ["What don't you know yet?", "\"I haven't used Azure or SQL Server in production yet, but the concepts map closely to what I've built, and I learn fast.\""],
        ],
      },
      {
        t: "callout",
        tone: "honest",
        title: "If they ask how you built it",
        text:
          "Be upfront that you used **AI coding tools (Claude Code)** to move faster. Most teams use them now. What matters is that **you understand the system**: why each piece exists, how data flows, and how you test and debug. If you don't know something, say \"I'm not sure, but here's how I'd find out.\" That's a strong answer for a Software Engineer I.",
      },
    ],
  },
];

/** Present mode order: the story for a 30-minute screen share (prep sections follow in Prep mode) */
export const ORDER = ["overview", "picture", "match", "servicebus", "functions", "backend", "database", "frontend", "security", "bots", "devops", "pitch", "terms", "bugs", "demo"];
