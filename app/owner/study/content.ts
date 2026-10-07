// The owner's interview study guide (/owner/study): SQL, OOP, C#, Azure, REST and Git, explained simply,
// with examples from Kitty Kingdom and practice questions. Text uses **bold** and `code`.

export type StudyBlock =
  | { t: "p"; text: string }
  | { t: "list"; items: string[] }
  | { t: "code"; label: string; code: string; note?: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "tip"; title: string; text: string }
  | { t: "qa"; items: [string, string][] };

export type StudyTopic = { id: string; title: string; blocks: StudyBlock[] };
export type StudySection = { id: string; emoji: string; title: string; intro: string; topics: StudyTopic[] };

export const STUDY: StudySection[] = [
  {
    id: "sql",
    emoji: "🗄️",
    title: "SQL basics",
    intro:
      "SQL Server (MSSQL) stores data in **tables** of rows and columns. All of the examples below use two tables modelled on Kitty Kingdom: `Users` and `GameResults`.",
    topics: [
      {
        id: "sql-tables",
        title: "The example tables, keys and indexes",
        blocks: [
          {
            t: "code",
            label: "Two tables, linked by UserId",
            code: `CREATE TABLE Users (
  UserId    BIGINT        PRIMARY KEY,          -- unique, never NULL
  Username  NVARCHAR(32)  NOT NULL UNIQUE,
  Balance   BIGINT        NOT NULL DEFAULT 0,
  Level     INT           NOT NULL DEFAULT 1
);

CREATE TABLE GameResults (
  GameId    BIGINT IDENTITY PRIMARY KEY,         -- IDENTITY = auto-numbering
  UserId    BIGINT NOT NULL REFERENCES Users(UserId),   -- foreign key
  Game      NVARCHAR(20) NOT NULL,
  Bet       BIGINT NOT NULL,
  Payout    BIGINT NOT NULL,
  PlayedAt  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_GameResults_User ON GameResults (UserId, PlayedAt);`,
          },
          {
            t: "table",
            head: ["Term", "What it means", "Example"],
            rows: [
              ["**Primary key**", "Uniquely identifies each row. It can't repeat and can't be NULL", "`Users.UserId`"],
              ["**Foreign key**", "A column pointing at another table's primary key. The database won't allow a row that points at nothing", "`GameResults.UserId` → `Users.UserId`"],
              ["**Index**", "Like a book's index: makes lookups fast. The trade-off is slightly slower inserts and updates, and extra storage", "`IX_GameResults_User` makes \"this user's games\" fast"],
              ["**Clustered index** (SQL Server)", "Decides the physical order of rows. There's only one per table, usually the primary key", "`GameId`"],
              ["**Non-clustered index**", "A separate lookup structure. A table can have many", "`IX_GameResults_User`"],
              ["**NULL**", "\"No value\". Test it with `IS NULL`, never `= NULL`", "`WHERE LastLogin IS NULL`"],
            ],
          },
          {
            t: "tip",
            title: "Connect it to your project",
            text: "\"In Kitty Kingdom I index by Discord ID and use **unique indexes** to stop duplicates. That's the same idea as a primary key or a `UNIQUE` constraint in SQL Server.\"",
          },
        ],
      },
      {
        id: "sql-select",
        title: "SELECT, WHERE, ORDER BY",
        blocks: [
          {
            t: "code",
            label: "The 10 richest players at level 10 or above",
            code: `SELECT TOP 10 Username, Balance        -- TOP is SQL Server (MySQL/Postgres use LIMIT)
FROM Users
WHERE Level >= 10 AND Balance > 0
ORDER BY Balance DESC;                 -- DESC = highest first, ASC = lowest first`,
          },
          {
            t: "list",
            items: [
              "`WHERE` filters **rows**. Combine conditions with `AND`, `OR` and `NOT`. Other useful filters: `IN ('Slots','Mines')`, `BETWEEN 1 AND 10`, `LIKE 'Kit%'` (starts with \"Kit\")",
              "`ORDER BY` sorts the results. Without it, SQL makes no promise about the order",
              "`SELECT *` returns every column. In real code, list only the columns you need",
            ],
          },
        ],
      },
      {
        id: "sql-joins",
        title: "JOINs: inner vs left",
        blocks: [
          {
            t: "code",
            label: "INNER JOIN: only rows that match in both tables",
            code: `SELECT u.Username, g.Game, g.Bet, g.Payout
FROM GameResults g
INNER JOIN Users u ON u.UserId = g.UserId;
-- Every game, with the player's name. Users who never played don't appear.`,
          },
          {
            t: "code",
            label: "LEFT JOIN: every row from the left table, matched or not",
            code: `SELECT u.Username, COUNT(g.GameId) AS GamesPlayed
FROM Users u
LEFT JOIN GameResults g ON g.UserId = u.UserId
GROUP BY u.Username;
-- Every user, including the ones with 0 games (their game columns come back as NULL).`,
          },
          {
            t: "table",
            head: ["Join", "Returns"],
            rows: [
              ["`INNER JOIN`", "Only rows that match on both sides"],
              ["`LEFT JOIN`", "All rows from the **left** table, plus matches from the right (NULL where there's no match)"],
              ["`RIGHT JOIN`", "The mirror image: all rows from the right table"],
              ["`FULL OUTER JOIN`", "Everything from both sides, matched where possible"],
            ],
          },
          {
            t: "tip",
            title: "Classic interview question",
            text: "\"Find users who have **never** played a game\": use a `LEFT JOIN` and keep the rows where the right side is NULL: `SELECT u.Username FROM Users u LEFT JOIN GameResults g ON g.UserId = u.UserId WHERE g.GameId IS NULL;`",
          },
        ],
      },
      {
        id: "sql-group",
        title: "GROUP BY, HAVING and aggregates",
        blocks: [
          {
            t: "code",
            label: "How popular and profitable is each game?",
            code: `SELECT Game,
       COUNT(*)            AS Plays,
       SUM(Bet)            AS TotalBet,
       SUM(Payout - Bet)   AS PlayerProfit,
       AVG(Bet)            AS AverageBet
FROM GameResults
WHERE PlayedAt >= '2026-10-01'
GROUP BY Game
HAVING COUNT(*) > 100          -- HAVING filters groups (after grouping)
ORDER BY Plays DESC;`,
          },
          {
            t: "list",
            items: [
              "Aggregates: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`",
              "`WHERE` filters rows **before** grouping. `HAVING` filters groups **after** grouping",
              "Every column you `SELECT` must either be in the `GROUP BY` or wrapped in an aggregate",
              "The order SQL actually runs the clauses in: **FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY**",
            ],
          },
        ],
      },
      {
        id: "sql-write",
        title: "INSERT, UPDATE, DELETE and transactions",
        blocks: [
          {
            t: "code",
            label: "Changing data",
            code: `INSERT INTO Users (UserId, Username) VALUES (123, 'Sasha');

UPDATE Users SET Balance = Balance - 100
WHERE UserId = 123 AND Balance >= 100;   -- 0 rows affected = not enough money

DELETE FROM GameResults WHERE PlayedAt < '2025-01-01';
-- Always double-check the WHERE on UPDATE and DELETE: without it, every row is changed!`,
          },
          {
            t: "code",
            label: "A transaction: all or nothing",
            code: `BEGIN TRANSACTION;
  UPDATE Users SET Balance = Balance - 500 WHERE UserId = 1;
  UPDATE Users SET Balance = Balance + 500 WHERE UserId = 2;
COMMIT;      -- or ROLLBACK to undo both if something failed`,
          },
          {
            t: "list",
            items: [
              "**ACID**: **A**tomic (all or nothing), **C**onsistent (rules always hold), **I**solated (transactions don't interfere), **D**urable (saved even after a crash)",
              "**SQL injection**: never build SQL by gluing user text into a string. Use **parameters** (`@UserId`) so input is treated as data, not code",
            ],
          },
        ],
      },
      {
        id: "sql-practice",
        title: "Practice questions",
        blocks: [
          {
            t: "qa",
            items: [
              ["What's the difference between a primary key and a foreign key?", "A primary key uniquely identifies a row in its own table. A foreign key is a column that points at another table's primary key, linking the two and preventing \"orphan\" rows."],
              ["INNER JOIN vs LEFT JOIN?", "INNER returns only matching rows. LEFT returns every row from the left table, with NULLs where the right table has no match."],
              ["WHERE vs HAVING?", "WHERE filters individual rows before grouping. HAVING filters the groups after GROUP BY, so it can use aggregates like COUNT(*) > 5."],
              ["Why not index every column?", "Each index speeds up reads but slows inserts and updates (the index has to be updated too) and uses storage. Index the columns you search, join and sort on."],
              ["Write a query: total payout per user, highest first.", "`SELECT u.Username, SUM(g.Payout) AS TotalPayout FROM Users u JOIN GameResults g ON g.UserId = u.UserId GROUP BY u.Username ORDER BY TotalPayout DESC;`"],
              ["How do you prevent SQL injection?", "Use parameterized queries (or an ORM like Entity Framework) instead of string concatenation, so user input is never run as SQL."],
              ["What's a transaction?", "A group of statements that succeed or fail together (BEGIN, then COMMIT or ROLLBACK), for example taking money from one account and adding it to another."],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "oop",
    emoji: "🧱",
    title: "OOP: the four pillars",
    intro: "Object-oriented programming organises code into **classes** (blueprints) and **objects** (instances). The four pillars are the classic interview question. Each one below has an example from your code.",
    topics: [
      {
        id: "oop-pillars",
        title: "The four pillars, with your examples",
        blocks: [
          {
            t: "table",
            head: ["Pillar", "In plain English", "Your Kitty Kingdom example"],
            rows: [
              ["**Encapsulation**", "Keep an object's data private and only change it through its own methods", "In Mines, the mine positions **never leave the server**. The only way to change a game is through `startMines`, `revealTile` or `cashOutMines`, which enforce the rules"],
              ["**Inheritance**", "A class gets the behaviour of a parent class and adds its own", "`class Mines(commands.Cog)`: every bot feature inherits from discord.py's `Cog`, getting command registration and event listening for free"],
              ["**Polymorphism**", "Different classes respond to the same method call in their own way", "Each cog can override `cog_app_command_error`. My Rules cog overrides it to reply \"Only staff can quote rules\", and the bot calls it the same way on every cog"],
              ["**Abstraction**", "Hide complicated details behind a simple interface", "`charge(discordId, amount)` hides the atomic database update that checks the balance. API routes just call it without knowing how it works"],
            ],
          },
          {
            t: "code",
            label: "The same four ideas in C#",
            code: `public interface IGame                         // ABSTRACTION: what a game does, not how
{
    string Name { get; }
    Task<long> PlayAsync(long userId, long bet);
}

public abstract class GameBase : IGame        // shared parent class
{
    private readonly IWallet _wallet;          // ENCAPSULATION: private, set once
    protected GameBase(IWallet wallet) => _wallet = wallet;

    public abstract string Name { get; }
    protected abstract long Resolve(long bet); // each game decides its own result

    public async Task<long> PlayAsync(long userId, long bet)
    {
        await _wallet.ChargeAsync(userId, bet);
        long payout = Resolve(bet);
        if (payout > 0) await _wallet.CreditAsync(userId, payout);
        return payout;
    }
}

public class Slots : GameBase                  // INHERITANCE
{
    public Slots(IWallet wallet) : base(wallet) { }
    public override string Name => "Slots";
    protected override long Resolve(long bet)  // POLYMORPHISM: same call, different result
        => Random.Shared.Next(100) < 40 ? bet * 2 : 0;
}`,
          },
          {
            t: "tip",
            title: "How to answer \"explain OOP\"",
            text: "Name each pillar, give a one-line definition, then a real example: \"For example, in my Mines game the board is encapsulated: it never leaves the server, and it can only change through methods that enforce the rules.\"",
          },
        ],
      },
      {
        id: "oop-practice",
        title: "Practice questions",
        blocks: [
          {
            t: "qa",
            items: [
              ["What's the difference between a class and an object?", "A class is the blueprint (Mines). An object is one instance built from it (Sasha's current Mines game)."],
              ["Interface vs abstract class?", "An interface only says what methods a class must have (no state). An abstract class can include shared code and fields, but can't be created on its own. In C# a class can implement many interfaces but inherit from only one class."],
              ["What's method overriding?", "A child class replaces a parent's method with its own version (C#: `virtual` in the parent, `override` in the child). It's how polymorphism works."],
              ["Why use encapsulation?", "It protects data from invalid changes and lets you change the inside of a class without breaking the code that uses it."],
              ["Composition vs inheritance?", "Inheritance is an \"is-a\" relationship (Slots is a Game). Composition is \"has-a\" (a Game has a Wallet). Many developers prefer composition because it's more flexible."],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "csharp",
    emoji: "🟪",
    title: "C# basics",
    intro: "C# is Microsoft's main language for .NET. If you know Java and TypeScript you already know most of it: it looks like Java, and it shares a designer with TypeScript (Anders Hejlsberg).",
    topics: [
      {
        id: "cs-compare",
        title: "Java and TypeScript → C#",
        blocks: [
          {
            t: "table",
            head: ["Concept", "Java", "TypeScript", "C#"],
            rows: [
              ["Text type", "`String`", "`string`", "`string`"],
              ["Inherit / implement", "`extends` / `implements`", "`extends` / `implements`", "`:` for both (`class Slots : GameBase, IGame`)"],
              ["Getters and setters", "`getName()` / `setName()`", "`get name()`", "Properties: `public string Name { get; set; }`"],
              ["Lists", "`ArrayList<T>`", "`T[]`", "`List<T>`"],
              ["Key/value maps", "`HashMap<K,V>`", "`Map` / object", "`Dictionary<K,V>`"],
              ["Async", "`CompletableFuture`", "`Promise` + `async`/`await`", "`Task` + `async`/`await`"],
              ["Grouping code", "`package`", "modules", "`namespace`"],
              ["Collection queries", "Streams", "`.filter().map()`", "**LINQ**: `.Where().Select()`"],
              ["Possibly empty value", "`Optional<T>`", "`T | null`", "`T?` (nullable)"],
            ],
          },
        ],
      },
      {
        id: "cs-code",
        title: "Classes, interfaces, async/await and LINQ",
        blocks: [
          {
            t: "code",
            label: "A small, realistic C# example",
            code: `namespace KittyKingdom.Economy;

public record Player(long Id, string Name, long Balance);   // record = simple data class

public interface IPlayerRepository
{
    Task<Player?> FindAsync(long id);          // ? = may return null
    Task<List<Player>> AllAsync();
}

public class LeaderboardService
{
    private readonly IPlayerRepository _players;      // dependency injection
    public LeaderboardService(IPlayerRepository players) => _players = players;

    public async Task<List<string>> TopTenAsync()
    {
        var players = await _players.AllAsync();      // await: wait without blocking
        return players
            .Where(p => p.Balance > 0)                // LINQ, like .filter()
            .OrderByDescending(p => p.Balance)        // like ORDER BY ... DESC
            .Take(10)                                 // like TOP 10
            .Select(p => $"{p.Name}: {p.Balance:N0}") // $"" = template string
            .ToList();
    }
}`,
          },
          {
            t: "list",
            items: [
              "`var` lets the compiler work out the type, but C# is still strongly typed",
              "`async Task` methods return a `Task`, and callers `await` it, exactly like TypeScript's `async` and `Promise`",
              "**Dependency injection** (passing `IPlayerRepository` into the constructor) is everywhere in .NET. It makes code testable and swappable",
              "**Entity Framework (EF Core)** is .NET's ORM: you write LINQ, and it writes the SQL for you",
              "**ASP.NET Core** is .NET's web framework for building APIs. **Azure Functions** can be written in C# too",
            ],
          },
        ],
      },
      {
        id: "cs-practice",
        title: "Practice questions",
        blocks: [
          {
            t: "qa",
            items: [
              ["What is .NET?", "The platform C# runs on: a runtime plus a huge library for web APIs (ASP.NET Core), data access (Entity Framework), Azure Functions and more."],
              ["What's a property in C#?", "A getter/setter pair written like a field: `public int Level { get; set; }`. You can make the setter private to protect the value."],
              ["What does async/await do?", "It lets a method wait for slow work (a database or HTTP call) without blocking the thread. The method returns a Task that callers await."],
              ["What is LINQ?", "Language Integrated Query: query methods like Where, Select and OrderBy that work on lists and, through Entity Framework, on databases."],
              ["How would you learn C# quickly?", "\"I'd use my Java and TypeScript knowledge, work through Microsoft Learn's C# path, then rebuild a small part of Kitty Kingdom, like an API endpoint, in ASP.NET Core.\""],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "azure",
    emoji: "☁️",
    title: "Azure basics",
    intro: "The four Azure services from the job description, what they do, the words people use about them, and what you built that's similar.",
    topics: [
      {
        id: "az-functions",
        title: "Azure Functions",
        blocks: [
          {
            t: "p",
            text: "**Serverless code**: small functions that run only when something **triggers** them. Azure handles the servers and scaling, and you pay only for what runs.",
          },
          {
            t: "list",
            items: [
              "**Triggers**: HTTP request (an API), **Timer** (a schedule, written as CRON), **Service Bus** message, Blob upload, Cosmos DB change",
              "**Bindings**: built-in input and output connections (read from Cosmos DB, write to a queue) without writing connection code",
              "**Cold start**: the first run after a quiet period is slower while Azure spins the function up",
              "**Your equivalent**: 134 HTTP API routes on Vercel (HTTP triggers), plus your bots' timed jobs (timer triggers)",
            ],
          },
          {
            t: "code",
            label: "What one looks like in C#",
            code: `[Function("DailyPayout")]
public async Task Run([TimerTrigger("0 0 12 * * *")] TimerInfo timer)   // every day at 12:00
{
    await _payouts.RunDailyAsync();
}`,
          },
        ],
      },
      {
        id: "az-servicebus",
        title: "Azure Service Bus",
        blocks: [
          {
            t: "p",
            text: "A **message broker**: one app sends a message, another receives it later. The two apps don't have to be running at the same time, and work isn't lost if one crashes.",
          },
          {
            t: "table",
            head: ["Term", "Meaning", "In Kitty Kingdom"],
            rows: [
              ["**Queue**", "One sender, one receiver. Each message is processed once", "`join_actions`: the website sends, the Moderation bot processes"],
              ["**Topic + subscriptions**", "One message, many receivers (publish/subscribe)", "AutoMod settings version that the bot watches"],
              ["**Peek-lock**", "The receiver locks a message while working on it, so nobody else takes it", "`queued` → `processing` in one atomic update"],
              ["**Complete / Abandon**", "Done, remove it / give it back for a retry", "`done`"],
              ["**Dead-letter queue**", "Messages that keep failing are set aside to inspect", "`failed`, with the error in `result`"],
              ["**At-least-once delivery**", "A message might arrive twice, so processing must be **idempotent** (safe to repeat)", "Duplicate check before queuing a join decision"],
            ],
          },
        ],
      },
      {
        id: "az-logic",
        title: "Azure Logic Apps",
        blocks: [
          {
            t: "p",
            text: "**Low-code workflows**: drag-and-drop steps in a visual designer. A **trigger** starts it, and **actions** run in order, with hundreds of **connectors** (Outlook, Teams, SQL, Service Bus...).",
          },
          {
            t: "list",
            items: [
              "Example: \"When a timesheet is submitted → check it in SQL → if it's over 40 hours, email a supervisor for approval → update payroll\"",
              "Functions vs Logic Apps: Functions are **code** for custom logic. Logic Apps **orchestrate** steps and connect services, often calling Functions",
              "**Your equivalent**: ban requests (request → senior approves → bot bans → email) and the news approval flow",
            ],
          },
        ],
      },
      {
        id: "az-cosmos",
        title: "Azure Cosmos DB",
        blocks: [
          {
            t: "p",
            text: "Microsoft's globally distributed **NoSQL** database. It stores JSON documents, scales automatically, and offers several APIs, including one **compatible with MongoDB**.",
          },
          {
            t: "list",
            items: [
              "**Partition key**: the field Cosmos uses to spread data across servers (for example `userId`). Choosing it well matters most for performance",
              "**Request Units (RU/s)**: how throughput and cost are measured. Each read or write costs RUs",
              "**Consistency levels**: Strong → Bounded staleness → **Session** (the default) → Consistent prefix → Eventual. A trade-off between freshness and speed",
              "**Your equivalent**: MongoDB Atlas, the same document model, and most lookups are by Discord ID (a natural partition key)",
              "**SQL vs Cosmos**: SQL Server for relational data and reporting (like payroll). Cosmos DB for flexible, high-scale documents",
            ],
          },
        ],
      },
      {
        id: "az-practice",
        title: "Practice questions",
        blocks: [
          {
            t: "qa",
            items: [
              ["What's an Azure Function?", "A small piece of serverless code that runs when triggered (HTTP, timer, queue message...). Azure handles servers and scaling."],
              ["Why use Service Bus instead of calling another service directly?", "It decouples the two: the sender doesn't wait, work isn't lost if the receiver is down, failed messages can be retried or dead-lettered, and you can scale receivers."],
              ["What's a dead-letter queue?", "Where messages go after they fail too many times or expire, so they can be inspected and fixed instead of blocking the queue."],
              ["Functions or Logic Apps?", "Functions for custom code and logic. Logic Apps for orchestrating multi-step workflows and connecting services with little code. They're often used together."],
              ["What's a partition key in Cosmos DB?", "The property Cosmos uses to distribute data. A good one spreads load evenly and matches how you query, like userId."],
              ["Have you used Azure?", "\"Not directly yet. I've built the same patterns on other platforms (serverless functions on Vercel, a queue between my website and services, NoSQL in MongoDB) and AWS Lambda before, so I'd be learning Azure's version of things I already understand.\""],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "rest-git",
    emoji: "🔀",
    title: "REST APIs and Git",
    intro: "How front ends talk to back ends, and how teams share code safely.",
    topics: [
      {
        id: "rest",
        title: "REST APIs and HTTP methods",
        blocks: [
          {
            t: "p",
            text: "A **REST API** exposes **resources** (users, games, tickets) at URLs, and clients use **HTTP methods** to act on them, usually sending and receiving **JSON**. Each request is **stateless**: it carries everything needed, like a session cookie or token.",
          },
          {
            t: "table",
            head: ["Method", "Does", "Example"],
            rows: [
              ["`GET`", "Read data (never changes anything)", "`GET /api/leaderboards?sort=balance`"],
              ["`POST`", "Create something or perform an action", "`POST /api/games/mines` with `{ action: \"start\", bet: 100 }`"],
              ["`PUT`", "Replace a whole resource", "`PUT /api/profile` with the full profile"],
              ["`PATCH`", "Update part of a resource", "`PATCH /api/settings` with `{ theme: \"dark\" }`"],
              ["`DELETE`", "Remove a resource", "`DELETE /api/messages/42`"],
            ],
          },
          {
            t: "table",
            head: ["Status code", "Meaning"],
            rows: [
              ["`200 OK` / `201 Created`", "Success / something was created"],
              ["`400 Bad Request`", "The input was invalid"],
              ["`401 Unauthorized`", "Not logged in"],
              ["`403 Forbidden`", "Logged in, but not allowed"],
              ["`404 Not Found`", "Doesn't exist"],
              ["`409 Conflict`", "Clashes with the current state (my \"changed in another tab\" error)"],
              ["`500 Internal Server Error`", "A bug or failure on the server"],
            ],
          },
          {
            t: "list",
            items: [
              "**Idempotent** means doing it twice has the same effect as once: `GET`, `PUT` and `DELETE` are idempotent, `POST` usually isn't",
              "**Your examples**: 134 route handlers, each checking the session, validating input and returning JSON with the right status code",
            ],
          },
        ],
      },
      {
        id: "git",
        title: "Git, branches and pull requests",
        blocks: [
          {
            t: "code",
            label: "Your everyday workflow",
            code: `git checkout main && git pull          # get the latest code
git checkout -b feat/qotd-leaderboard  # new branch for one change
# ...edit files...
git add app/leaderboards/page.tsx
git commit -m "Add QOTD leaderboard tabs"
git push -u origin feat/qotd-leaderboard
# open a Pull Request → automated checks + preview → review → merge into main`,
          },
          {
            t: "table",
            head: ["Term", "Meaning"],
            rows: [
              ["**Commit**", "A saved snapshot of changes, with a message"],
              ["**Branch**", "A separate line of work, so `main` stays stable"],
              ["**Pull request (PR)**", "A request to merge a branch, where teammates review the changes and automated checks run"],
              ["**Merge**", "Combine a branch into another. It keeps the history of both"],
              ["**Rebase**", "Replay your commits on top of the latest main, for a straight-line history"],
              ["**Merge conflict**", "Two branches changed the same lines. Git asks you to choose. Fix it, then commit"],
              ["**Revert**", "A new commit that undoes an earlier one (safe on shared branches)"],
              ["**CI/CD**", "Automatic tests and checks on every PR (CI), and automatic deploys after merging (CD)"],
            ],
          },
        ],
      },
      {
        id: "rest-git-practice",
        title: "Practice questions",
        blocks: [
          {
            t: "qa",
            items: [
              ["PUT vs PATCH?", "PUT replaces the entire resource. PATCH updates only the fields you send."],
              ["401 vs 403?", "401 means not authenticated (not logged in). 403 means authenticated but not allowed."],
              ["What makes an API RESTful?", "Resources at URLs, standard HTTP methods, stateless requests, standard status codes, and usually JSON."],
              ["How do you resolve a merge conflict?", "Pull the latest main, open the conflicted files, choose or combine the changes between the markers, test, then commit and push."],
              ["Merge vs rebase?", "Merge combines branches and keeps both histories (adds a merge commit). Rebase rewrites your commits on top of the target for a linear history. Don't rebase shared branches."],
              ["Why use pull requests?", "Code review catches bugs, spreads knowledge, and lets automated tests run before anything reaches main."],
            ],
          },
        ],
      },
    ],
  },
];
