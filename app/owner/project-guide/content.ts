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

export type Section = { id: string; kicker: string; title: string; intro?: string; blocks: Block[]; prep?: boolean; roleTag?: string; role?: string };

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
        head: ["Layer", "What I used", "Related tools in this role"],
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
    id: "picture",
    roleTag: "Azure architecture",
    role: "This is the same shape as a typical Azure system: a web front end, **Azure Functions** for the API, **Service Bus** between services and **Cosmos DB** for data. I already think in these building blocks.",
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
    id: "frontend",
    roleTag: "Front end & Angular",
    role: "The role supports **front-end development** in HTML, CSS and JavaScript, with Angular preferred. I build component-based TypeScript interfaces, the same model Angular uses.",
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
    roleTag: "Back-end development",
    role: "The role supports **back-end web development**. This is my everyday work: APIs that check access, validate input, apply business rules and return clear errors.",
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
    roleTag: "Secure data handling",
    role: "Care organisations handle sensitive personal information. I already build security in from the start: hashed passwords, signed sessions, two-factor login and rate limits.",
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
    roleTag: "MSSQL & Cosmos DB",
    role: "The role creates and maintains **MSSQL** databases and works with **Cosmos DB**. I already model data, design indexes and keep data correct under real use.",
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
        head: ["MongoDB (in this project)", "SQL Server"],
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
    roleTag: "OOP & server-side",
    role: "The role asks for **object-oriented programming** and **server-side languages**. My services are class-based and run 24/7 in the background, the same job Azure Functions and WebJobs do.",
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
    roleTag: "Service Bus",
    role: "The job description asks for deploying code for **Service Bus**. These five flows are queues I designed, built and run: sending, claiming, processing and handling failures.",
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
    roleTag: "Functions & Logic Apps",
    role: "The role deploys **Azure Functions** and **Logic Apps**. I already run HTTP-triggered, timer-triggered and queue-triggered work, plus approval workflows.",
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
    roleTag: "Deploying code",
    role: "The role involves **deploying code** to Azure. My pull request, automated checks and auto-deploy flow maps directly onto Azure DevOps or GitHub Actions.",
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
    title: "Why I'm a fit for this role",
    intro: "Kitty Kingdom is a real product with real users, and I've built and run every layer of it. Here's how that experience lines up with the work in this role.",
    blocks: [
      {
        t: "table",
        head: ["This role", "My experience from Kitty Kingdom"],
        rows: [
          ["**Object-oriented programming**", "Every feature in my Python services is a class (a \"cog\") built on inheritance, and my TypeScript code uses typed models throughout"],
          ["**HTML, CSS and JavaScript**", "I hand-built all 40 pages: semantic HTML, my own CSS themes (dark and light) and responsive layouts that work on phones, in TypeScript"],
          ["**Server-side development**", "I wrote 134 API endpoints in TypeScript on Node.js, plus four Python services that run 24/7"],
          ["**Database concepts**", "I design for correctness: indexes, unique keys, auto-expiring data, atomic balance updates and concurrency control so money can't be double-spent"],
          ["**Azure Functions**", "My whole API runs as serverless functions, triggered by HTTP requests, and my services run 30+ timer-based jobs"],
          ["**Service Bus**", "I built five message-queue flows that pass work between my website and my services, with claiming, status tracking and failure handling"],
          ["**Logic Apps**", "I've built multi-step and approval workflows: staff approve ban requests and news posts, and a ban automatically closes the account and emails the member"],
          ["**Cosmos DB (NoSQL)**", "I run MongoDB in production, and Cosmos DB offers the same MongoDB API"],
          ["**MSSQL**", "I can model the same data relationally (see the SQL Server schema below), and I'm ready to put that into practice in SQL Server"],
          ["**C# / .NET**", "I work in strict TypeScript and class-based Python, and C#'s syntax, types and async/await follow the same patterns"],
          ["**Angular**", "I build component-based front ends in React and TypeScript, the same architecture Angular uses"],
          ["**Troubleshooting**", "I trace bugs from the screen to the database. For example, I found leaderboards dropping 64-bit IDs, and boosters that stopped after an hour"],
        ],
      },
      {
        t: "list",
        items: [
          "**I own the whole thing:** design, code, database, deployment, and support for the people who use it",
          "**I ship safely:** every change goes through a pull request with automated checks and a preview deployment before it reaches users",
          "**I think about security:** hashed passwords, signed sessions, two-factor login and rate limits, all built and tested myself",
          "**I learn fast:** I implemented two-factor login straight from its specification, and I'm excited to go deep on Azure",
          "**I write for people:** clear rules, a staff handbook and an FAQ for the community, so non-technical people can use what I build",
        ],
      },
    ],
  },

];

/** Present mode order: the story for a 30-minute screen share (prep sections follow in Prep mode) */

/** Present mode: the pitch at the top of the page (the detailed sections sit below as deep dives) */
export const PITCH = {
  eyebrow: "Prepared for Consumer Direct Care Network · Software Engineer I",
  title: "Kitty Kingdom",
  lead: "A full-stack platform I designed, built and run for a live online community: a web app, four background services and a cloud database, all built on the same patterns this team uses on Azure.",
  stats: [
    ["40", "pages"],
    ["134", "API endpoints"],
    ["4", "background services"],
    ["30+", "scheduled jobs"],
    ["320+", "changes shipped"],
  ],
  about: {
    title: "About me",
    lead: "I'm **Sasha Wildfang**, a Computer Science graduate from **Clemson University** living right here in **Missoula**. I've been writing software since I was a teenager, and I've spent years leading teams in fast-paced jobs. Kitty Kingdom is where those two sides come together.",
    facts: [
      ["Education", "B.S. Computer Science, Clemson University (2024), including Database Management Systems and Web Application Design"],
      ["Software experience", "Java developer for Minehut's multiplayer servers, IT apprentice at Southern Eagle Distributing, and founder of Kitty Kingdom"],
      ["Leadership", "Restaurant Lead at Chick-fil-A: trained 25+ team members while working 40 hours a week as a full-time student"],
      ["Right now", "Security Officer at Southgate Mall (GDI Ainsworth), and building Kitty Kingdom every day"],
    ],
  },
  why: {
    title: "Why I built Kitty Kingdom",
    paragraphs: [
      "Kitty Kingdom started in **April 2025** as a Discord server: a place for people to make friends, hang out and feel at home. As it grew, I wanted features that no ready-made tool offered, so I started building them myself.",
      "It became the best way I know to grow as a developer. School gave me the fundamentals, but running a real product taught me what it takes to ship: real users, real bugs, real security, and real consequences when something breaks.",
      "When the job market got tough, I didn't stop. I treated Kitty Kingdom like a job: planning features, fixing what members reported, and learning a new part of the stack along the way.",
    ],
    timeline: [
      ["Apr 2025", "Founded the community on Discord"],
      ["2025", "Built my own Python services for the economy, games and moderation"],
      ["Jul 2026", "Launched the website: Next.js, React and TypeScript"],
      ["Today", "134 API endpoints, 4 services and 338+ commits, used every day"],
    ],
  },
  company: {
    kicker: "Why Consumer Direct",
    title: "Why I want to work here",
    paragraphs: [
      "This one is personal. My grandmother lived with **dementia**, and **hospice** cared for her right before she passed. I saw firsthand how much it means for someone to be cared for at home, and how much families depend on the people and the systems behind that care.",
      "I want my work to help others. Consumer Direct was **founded right here in Missoula in 1990** and now supports people in **15 states**. I'd be proud to build the software that helps caregivers get paid accurately and on time, and helps people stay at home with the care they need.",
      "I was referred by a family friend, **LaDonna Knowlton**, a **UTEX Supervisor** who has been with the company for about **nine years**. Hearing how her team makes sure caregivers' time is correct before it goes to payroll showed me how much the technology behind the scenes matters, and that people who join Consumer Direct choose to stay.",
    ],
    commute: {
      title: "I'm right down the road",
      text: "Consumer Direct's office at **100 Consumer Direct Way** is only about **5 minutes** from my home at **Grant Creek Village Apartments** (5385 Elyn Loop), so being in the office for a hybrid schedule is easy.",
      home: "Home · Grant Creek Village",
      office: "Consumer Direct · 100 Consumer Direct Way",
    },
    facts: [
      ["Founded", "Missoula, MT · 1990"],
      ["Reach", "Supporting people in 15 states"],
      ["Mission", "Helping people receive care at home"],
      ["Referred by", "LaDonna Knowlton, UTEX Supervisor (about 9 years)"],
      ["Commute", "About 5 minutes from home"],
    ],
  },
  fitIntro: "I didn't just study these patterns. I built them, I run them, and real people depend on them every day.",
  fits: [
    {
      icon: "cloud",
      title: "I've already built the architecture this team runs",
      evidence: [
        "**134 serverless API endpoints**, the same model as Azure Functions",
        "**5 message-queue workflows** connecting my website to my background services",
        "A **NoSQL database in production**, with the same API Cosmos DB offers",
        "Prior cloud experience with **AWS Lambda, S3 and API Gateway**, Amazon's equivalents of Azure Functions and Storage",
      ],
      forRole: "I'd be learning Azure's names for patterns I already use, not the patterns themselves.",
    },
    {
      icon: "layers",
      title: "I build features end to end",
      evidence: [
        "Interface, API, database and background service, all written by me",
        "Example: **ban requests** span a Discord command, a website approval screen, a queue, a service that carries out the ban, and an automatic email",
        "Hand-written **HTML, CSS and TypeScript**, plus **Python** services",
      ],
      forRole: "I can pick up a task anywhere in the stack, front end or back end.",
    },
    {
      icon: "rocket",
      title: "Real users depend on what I ship",
      evidence: [
        "A live community uses it every day, so mistakes are visible fast",
        "Every change goes through a **pull request, automated checks and a preview deployment**",
        "Security built in: **hashed passwords, signed sessions, two-factor login, rate limits**",
      ],
      forRole: "I already work the way professional teams do, and I take reliability seriously.",
    },
    {
      icon: "learn",
      title: "I learn new technology fast",
      evidence: [
        "**B.S. in Computer Science** from Clemson, plus Java, C, C++ and SQL from school and work",
        "Learned **Next.js, React, async Python and MongoDB** by building this",
        "Implemented **two-factor login straight from its official specification** (RFC 6238)",
      ],
      forRole: "C#, SQL Server and Angular are my next step, and they build on foundations I already have.",
    },
  ],
  checklist: [
    {
      item: "Object-oriented programming",
      explain: "Organising code into **classes**: objects that bundle data with the functions that work on it, and can inherit shared behaviour from a parent class. C# and .NET are built around it.",
      level: "built",
      done: "Every Discord feature is its own **class**. The Mines game is `class Mines(commands.Cog)`: it holds its database collections and methods like `add_to_jackpot()`, and inherits everything a bot plugin needs. Each service loads its classes automatically, like plugins.",
      code: `class Mines(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.users_col = get_connection()["users"]

    async def add_to_jackpot(self, amount: int):
        await self.globals_col.find_one_and_update(
            {"_id": "casino_jackpot"}, {"$inc": {"amount": amount}}, upsert=True)`,
    },
    {
      item: "HTML, CSS and JavaScript",
      explain: "The three languages of the web: **HTML** gives a page its structure, **CSS** styles and lays it out, and **JavaScript** makes it interactive.",
      level: "built",
      done: "The **Leaderboards** page: semantic HTML lists, hand-written CSS Grid that reflows from four groups side by side on a desktop to two per row on a phone, and TypeScript that refreshes the rankings every 10 seconds and animates rank changes.",
    },
    {
      item: "Server-side code (TypeScript, Python)",
      explain: "Code that runs on a server instead of in the browser. It checks who you are, applies the business rules, talks to the database and sends data back.",
      level: "built",
      done: "`POST /api/games/mines` checks the member's session, validates the input, runs the game on the server (the browser never sees where the mines are) and returns JSON. In Python, four services handle Discord events around the clock.",
    },
    {
      item: "Database concepts",
      explain: "How data is stored and kept correct: **keys** that identify records, **indexes** that make lookups fast, and making sure two changes at the same moment can't corrupt anything.",
      level: "built",
      done: "Placing a bet is **one atomic update** that only succeeds if the balance is high enough. Every game save carries a **version number**, so two tabs can't cash out twice. \"Who's online\" records expire automatically after 5 minutes (a **TTL index**).",
      code: `// Only saves if nobody changed the game since it was read
sessions.replaceOne(
  { _id: game._id, version: game.version },
  { ...next, version: game.version + 1 },
);`,
    },
    {
      item: "Serverless functions (Azure Functions)",
      explain: "**Azure Functions** are small pieces of code that run when something triggers them (a web request, a timer, a message on a queue). Azure runs and scales them, so there are no servers to manage.",
      level: "built",
      done: "All **134 API endpoints** deploy as serverless functions on Vercel and scale on their own. Because instances don't share memory, rate limits live in the database, so they hold across every instance. I've also worked with **AWS Lambda and API Gateway**, Amazon's version of the same idea.",
    },
    {
      item: "Message queues (Service Bus)",
      explain: "**Azure Service Bus** passes messages between systems. One app puts a message on a **queue**, and another app picks it up and processes it, even if it was offline when the message was sent. It handles retries and failed messages, so work is never lost between systems.",
      level: "built",
      done: "**Join approvals:** the website saves a job as `queued`, a background service claims it (`processing`), gives the member their roles and marks it `done` or `failed`, and the website shows the result. The same pattern runs ban requests and unread-message reminders.",
    },
    {
      item: "Automated workflows (Logic Apps)",
      explain: "**Azure Logic Apps** chain steps into a workflow (when something happens, do this, wait for an approval, then send an email) with little or no code.",
      level: "built",
      done: "**Ban requests:** a junior moderator requests a ban → a senior moderator approves it by typing CONFIRM → the service carries out the ban → the member's website account is closed and they're emailed how to appeal. Every step is automatic after the approval.",
    },
    {
      item: "NoSQL (Cosmos DB)",
      explain: "**Azure Cosmos DB** is a NoSQL database: instead of tables it stores flexible JSON documents, and it scales worldwide. One of its APIs is compatible with **MongoDB**.",
      level: "built",
      done: "Kitty Kingdom runs on **MongoDB Atlas**: two databases, dozens of collections, shared by the website and four services. **Azure Cosmos DB for MongoDB** speaks the same API, so the same queries and indexes carry over.",
    },
    {
      item: "MSSQL",
      explain: "**Microsoft SQL Server** is a relational database: data lives in **tables** of rows and columns, linked by keys and queried with **SQL**.",
      level: "learn",
      done: "Although I haven't used SQL Server specifically, I've worked with relational databases for years: at Southern Eagle Distributing I optimized **MySQL** tables and cut query times by **20%**, I've used **PostgreSQL**, and I studied **Database Management Systems** at Clemson. Here's how my Kitty Kingdom data would map to SQL:",
      code: `UPDATE Users SET Balance = Balance - @Bet
WHERE UserId = @UserId AND Balance >= @Bet;  -- 0 rows = not enough`,
    },
    {
      item: "C# / .NET",
      explain: "**C#** is Microsoft's main programming language, and **.NET** is the framework it runs on, used for web APIs, background services and Azure Functions.",
      level: "learn",
      done: "Although I haven't written C# yet, I was a **Java** developer at Minehut, and C# is very close to Java. I also studied C and C++ at Clemson, and I write strict **TypeScript** every day, a language designed by the same person as C# (Anders Hejlsberg). Classes, interfaces, generics and async/await all carry straight over.",
    },
    {
      item: "Angular",
      explain: "**Angular** is a front-end framework for building web apps out of **TypeScript components**, with routing, forms and services built in.",
      level: "learn",
      done: "Although I haven't built with Angular yet, I build component-based interfaces in **React with TypeScript** every day, and I studied **Web Application Design** at Clemson. Angular uses the same component model and the same language, so I'd be learning its tools, not a new way of thinking.",
    },
  ],
  spotlight: {
    title: "Spotlight: a Service Bus-style queue I built",
    problem: "Staff approve new members on the **website**, but only my **Discord service** can give them access. The two run separately, and either one can restart at any time.",
    solution: "The website drops a **job** into a queue in the database. The service picks it up, does the work and reports back. If the service is offline, the job simply waits.",
    azure: "This is exactly what **Azure Service Bus** is for: a **queue**, processed by a **queue-triggered Azure Function**.",
    steps: [
      ["Staff click Accept", "on the website", "Sender"],
      ["Job saved as \"queued\"", "added to the queue", "Send message"],
      ["Service claims the job", "\"queued\" → \"processing\" in one step", "Peek-lock"],
      ["Roles given, welcome sent", "the actual work", "Process"],
      ["Marked \"done\" or \"failed\"", "the website shows the result", "Complete / dead-letter"],
    ],
    more: ["Ban request approvals", "Unread message reminders", "Live AutoMod settings", "Restart-proof timers"],
  },
  hire: {
    intro: "I want this job, and I'll be the hardest worker on the team. Here's the skill set I'd bring from day one, and what I'm ready to learn next.",
    groups: [
      { name: "Languages", skills: ["TypeScript", "JavaScript", "Python", "Java", "C / C++", "SQL", "HTML", "CSS"] },
      { name: "Front end", skills: ["React", "Next.js", "Responsive design", "Accessibility", "CSS Grid & Flexbox", "Theming"] },
      { name: "Frameworks", skills: ["Node.js", "Express.js", "Flask", "discord.py", "REST APIs", "Pandas", "NumPy"] },
      { name: "Back end", skills: ["REST APIs", "Node.js", "Async Python", "Authentication & sessions", "Two-factor login", "Rate limiting", "Third-party APIs & OAuth2"] },
      { name: "Data", skills: ["MongoDB", "MySQL", "PostgreSQL", "SQLAlchemy", "Data modelling", "Indexes & unique keys", "Atomic updates", "Concurrency control", "Message queues"] },
      { name: "Cloud & delivery", skills: ["Serverless deployment", "AWS (Lambda, S3, API Gateway)", "Docker", "CI/CD", "Git & GitHub", "Pull requests & code review", "Automated checks", "Preview deployments", "Secrets management"] },
      { name: "Professional", skills: ["Leadership", "Training & mentoring", "Agile / Scrum", "Debugging", "Owning a product end to end", "Supporting real users", "Writing docs", "Taking feedback"] },
    ],
    next: ["C#", ".NET", "SQL Server", "Angular", "Azure"],
    ethic: [
      ["Nobody assigned this project", "I built Kitty Kingdom because I wanted to, and I keep improving it: 320+ changes and counting."],
      ["I follow problems all the way down", "When members report a problem, I trace it from the screen to the database and ship a fix."],
      ["I keep going until it's right", "When members felt the games were unfair, I worked out the real odds for every game and rebuilt them."],
      ["I've always worked hard", "At Clemson I worked 40 hours a week as a Restaurant Lead while carrying a full course load, and trained 25+ team members."],
      ["I'm hungry to grow", "I learned this whole stack by building with it. I'll bring that same drive to Azure, C# and SQL Server."],
    ],
  },
  closing: {
    title: "One last thing",
    heading: "Give me a chance, and I'll prove it every day",
    paragraphs: [
      "I'm the hardest worker you'll ever find. I don't stop at what's asked of me: I go above and beyond, and I keep going until the job is done right.",
      "The job market has been rough, and I've spent this time building, learning and working. What I'm looking for now is a company I can settle down with and grow with for the long term.",
    ],
    points: [
      ["A track record you can count on", "I've never been fired. I show up, I stay, and I do the work."],
      ["Dedicated and committed", "From 40-hour weeks during college to building Kitty Kingdom on my own time, I finish what I start."],
      ["Ready to learn from your team", "Azure, C#, SQL Server and Angular are my next step, and I'm eager to take it with you."],
    ],
    clearance: "Also worth knowing: I hold a U.S. government **SECRET** security clearance.",
    thanks: "Thank you for your time. I'd love the chance to show you what I can do.",
  },
  stack: [
    {
      group: "Front end",
      icon: "globe",
      items: [
        ["Next.js 14", "React framework: pages, routing and server code in one project"],
        ["React 18", "Builds the interface out of reusable components"],
        ["TypeScript 5", "JavaScript with types, in strict mode"],
        ["CSS (hand-written)", "Custom properties for dark and light themes, Grid and Flexbox layouts"],
        ["lucide-react", "Icon set"],
        ["qrcode", "QR codes for setting up two-factor login"],
        ["fflate", "Creates zip downloads in the browser"],
      ],
    },
    {
      group: "Back end",
      icon: "server",
      items: [
        ["Node.js", "Runs the API code"],
        ["Next.js Route Handlers", "134 API endpoints, deployed as serverless functions"],
        ["mongodb (driver)", "Official MongoDB driver for Node.js"],
        ["Node crypto", "Password hashing (scrypt), signed sessions (HMAC), two-factor codes"],
        ["Resend API", "Sends account emails"],
        ["Discord REST API + OAuth2", "Member roles, account linking and sign-in"],
      ],
    },
    {
      group: "Background services (Python)",
      icon: "bot",
      items: [
        ["Python 3", "Language for the four services"],
        ["discord.py 2.6", "Async framework for Discord services"],
        ["Motor + PyMongo", "Async and standard MongoDB drivers"],
        ["aiohttp", "Async HTTP requests"],
        ["python-dotenv", "Loads secrets from environment files"],
        ["matplotlib", "Draws the daily quiz results chart"],
      ],
    },
    {
      group: "Data, hosting and tooling",
      icon: "database",
      items: [
        ["MongoDB Atlas", "Cloud NoSQL database shared by everything"],
        ["Vercel", "Hosts the website; every merge to main deploys"],
        ["SparkedHost", "Runs the always-on Python services"],
        ["Git + GitHub", "Branches, pull requests and code review"],
        ["GitGuardian", "Scans every pull request for leaked secrets"],
      ],
    },
  ],
};

/** Present mode: detailed sections, collapsed under "Technical deep dives" */
export const DEEP_DIVES = ["picture", "servicebus", "functions", "backend", "database", "frontend", "security", "bots", "devops"];
