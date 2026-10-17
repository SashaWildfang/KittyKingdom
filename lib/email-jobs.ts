// Sends the opt-in notification emails (Settings → Email) for news posts, new events, event reminders and
// new giveaways. Runs from the Main Bot's once-a-minute website check (/api/status/ping) and right after an
// admin publishes news, within a small time budget each run.
//
// Each post / event / giveaway keeps its own progress in `emailJob` { cursor, sent, done, lockUntil }: members
// are emailed in _id order, 100 per Resend batch, so a big list is spread over a few runs, nobody is emailed
// twice, and two runs at once can't both send (the lock).

import type { Collection, Document } from "mongodb";
import { compact } from "./compact";
import { sendNotificationBatch, type NotificationEmail } from "./email";
import { recipientByDiscordId, recipientsPage, unsubscribeUrl, type Recipient } from "./email-prefs";
import { EMAIL_PREF_LABELS, type EmailPrefKey } from "./email-prefs-shared";
import { getBotCollection, getMongoClient } from "./mongodb";
import { newsExcerpt } from "./news-format";
import { getSeason } from "./season-store";

const SITE = "https://bear-nation.net";
const BATCH = 100;
const LOCK_MS = 90_000;
// Only things that went live recently: never a backlog of old posts when someone first turns emails on
const RECENT_MS = 2 * 86_400_000;
const REMIND_BEFORE_MS = 60 * 60_000;
const MAX_FAILS = 10;

type Built = Omit<NotificationEmail, "to" | "unsubscribeUrl" | "unsubscribeLabel" | "reason">;

function forRecipient(r: Recipient, kind: EmailPrefKey, email: Built): NotificationEmail {
  return {
    ...email,
    to: r.email,
    reason: `You're receiving this because you turned on “${EMAIL_PREF_LABELS[kind]}” emails on bear-nation.net.`,
    unsubscribeUrl: unsubscribeUrl(r.id, kind),
    unsubscribeLabel: `Turn off ${EMAIL_PREF_LABELS[kind].toLowerCase()} emails`,
  };
}

const when = (d: Date) =>
  `${d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET`;

/**
 * One job: claim a document that still needs emailing, send batches until the list is done or time runs
 * out, and save where it got to. Returns false when there was nothing to do (or sending failed, so the
 * next run tries again instead of retrying straight away).
 */
async function runOne(o: {
  col: Collection<Document>;
  filter: Document;
  field: string;
  kind: EmailPrefKey;
  deadline: number;
  build: (doc: Document) => Promise<Built> | Built;
  discordIds?: (doc: Document) => Promise<string[]>;
}) {
  const now = new Date();
  const doc = await o.col.findOneAndUpdate(
    { ...o.filter, [`${o.field}.done`]: { $ne: true }, $or: [{ [`${o.field}.lockUntil`]: { $exists: false } }, { [`${o.field}.lockUntil`]: { $lt: now } }] },
    { $set: { [`${o.field}.lockUntil`]: new Date(now.getTime() + LOCK_MS) } },
    { returnDocument: "after" },
  );
  if (!doc) return false;
  const job = (doc[o.field] ?? {}) as { cursor?: string | null; sent?: number; fails?: number };
  let cursor = job.cursor ?? null;
  let sent = job.sent ?? 0;
  let done = false;
  let error: string | null = null;
  try {
    const email = await o.build(doc);
    const ids = o.discordIds ? await o.discordIds(doc) : undefined;
    while (Date.now() < o.deadline) {
      const people = ids && !ids.length ? [] : await recipientsPage(o.kind, cursor, BATCH, ids);
      if (!people.length) {
        done = true;
        break;
      }
      const result = await sendNotificationBatch(people.map((p) => forRecipient(p, o.kind, email)));
      if (result.error) {
        // Keep the cursor so this batch is tried again on the next run
        error = result.error.slice(0, 300);
        break;
      }
      sent += result.sent;
      cursor = people[people.length - 1].id;
      if (people.length < BATCH) {
        done = true;
        break;
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 300) : "Failed";
  }
  // Give up after 10 failed runs in a row (e.g. the email provider is down or misconfigured)
  const fails = error ? (job.fails ?? 0) + 1 : 0;
  if (fails >= MAX_FAILS) done = true;
  await o.col.updateOne(
    { _id: doc._id },
    {
      $set: { [`${o.field}.cursor`]: cursor, [`${o.field}.sent`]: sent, [`${o.field}.done`]: done, [`${o.field}.fails`]: fails, [`${o.field}.lastError`]: error, [`${o.field}.at`]: new Date() },
      $unset: { [`${o.field}.lockUntil`]: "" },
    },
  );
  return !error;
}

async function newsCol() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("news");
}

/** Runs every email job that's due, for at most `budgetMs`. Never throws. */
export async function runEmailJobs(budgetMs = 6_000) {
  const deadline = Date.now() + budgetMs;
  const now = new Date();
  const recent = new Date(now.getTime() - RECENT_MS);
  const jobs: (() => Promise<boolean>)[] = [
    // News posts that are live (scheduled ones once their time comes)
    async () =>
      runOne({
        col: await newsCol(),
        filter: { published: { $ne: false }, status: { $nin: ["pending", "draft"] }, publishedAt: { $lte: now, $gte: recent } },
        field: "emailJob",
        kind: "news",
        deadline,
        build: (d) => ({
          kind: "notify-news",
          subject: `📰 ${String(d.title ?? "News from Bear Nation")}`,
          eyebrow: d.tag ? String(d.tag) : "News",
          title: String(d.title ?? "News from Bear Nation"),
          intro: newsExcerpt(String(d.body ?? ""), 320).text || "There's a new post on the Bear Nation website.",
          button: { label: "Read the post", url: `${SITE}/news/${String(d._id)}` },
          note: "Posted by the Bear Nation staff team.",
        }),
      }),
    // New events on the calendar
    async () =>
      runOne({
        col: await getBotCollection("events"),
        filter: { createdAt: { $gte: recent }, startAt: { $gt: now }, cancelled: { $ne: true } },
        field: "emailJob",
        kind: "events",
        deadline,
        build: (d) => ({
          kind: "notify-event",
          subject: `📅 New event: ${String(d.title ?? "Event")}`,
          eyebrow: "New event",
          title: String(d.title ?? "A new event"),
          intro: String(d.description ?? "").replace(/\s+/g, " ").slice(0, 320) || "A new event was added to the Bear Nation calendar.",
          rows: [{ label: "When", value: when(new Date(d.startAt)) }, ...(d.place ? [{ label: "Where", value: String(d.place) }] : d.channelId ? [{ label: "Where", value: "On Discord" }] : [])],
          button: { label: "See the event", url: `${SITE}/events` },
          note: "On the events page you can ask for a reminder before it starts.",
        }),
      }),
    // Reminders about an hour before events members asked to be reminded about (once per start time)
    async () => {
      const col = await getBotCollection("events");
      const soon = await col.find({ startAt: { $gt: now, $lte: new Date(now.getTime() + REMIND_BEFORE_MS) }, cancelled: { $ne: true } }, { projection: { startAt: 1, emailReminder: 1 } }).toArray();
      // A weekly event moves to its next date: start the reminder over for the new time
      for (const e of soon) {
        const start = new Date(e.startAt).toISOString();
        if ((e.emailReminder as Document | undefined)?.for !== start) await col.updateOne({ _id: e._id }, { $set: { emailReminder: { for: start, done: false, sent: 0, cursor: null } } });
      }
      return runOne({
        col,
        filter: { startAt: { $gt: now, $lte: new Date(now.getTime() + REMIND_BEFORE_MS) }, cancelled: { $ne: true } },
        field: "emailReminder",
        kind: "eventReminders",
        deadline,
        discordIds: async (d) => (await (await getBotCollection("event_rsvps")).find({ eventId: String(d._id) }, { projection: { discordId: 1 } }).limit(2000).toArray()).map((r) => String(r.discordId)),
        build: (d) => ({
          kind: "notify-event-reminder",
          subject: `⏰ Starting soon: ${String(d.title ?? "your event")}`,
          eyebrow: "Event reminder",
          title: `${String(d.title ?? "Your event")} starts soon`,
          intro: "You asked to be reminded about this event. It starts in about an hour.",
          rows: [{ label: "When", value: when(new Date(d.startAt)) }, ...(d.place ? [{ label: "Where", value: String(d.place) }] : d.channelId ? [{ label: "Where", value: "On Discord" }] : [])],
          button: { label: "Open the events page", url: `${SITE}/events` },
          note: "See you there!",
        }),
      });
    },
    // Giveaways that just started
    async () => {
      const season = await getSeason().catch(() => null);
      return runOne({
        col: await getBotCollection("giveaways"),
        filter: { status: { $in: ["running", "ending"] }, $and: [{ $or: [{ startAt: { $gte: recent } }, { startAt: null, createdAt: { $gte: recent } }] }] },
        field: "emailJob",
        kind: "giveaways",
        deadline,
        build: (d) => {
          const p = (d.prize ?? {}) as Document;
          const prize =
            p.type === "leaves" ? `${compact(Number(p.amount ?? 0))} ${season?.many ?? "Leaves"}`
            : p.type === "xp" ? `${compact(Number(p.amount ?? 0))} XP`
            : p.type === "item" ? `${Number(p.quantity ?? 1) > 1 ? `${p.quantity}× ` : ""}${String(p.itemName ?? "A store item")}`
            : String(p.text ?? "A prize");
          return {
            kind: "notify-giveaway",
            subject: `🎁 Giveaway: ${String(d.title ?? prize)}`,
            eyebrow: "New giveaway",
            title: String(d.title ?? "A new giveaway"),
            intro: String(d.description ?? "").replace(/\s+/g, " ").slice(0, 280) || "A new giveaway just started. Enter before it ends!",
            rows: [
              { label: "Prize", value: prize },
              { label: "Winners", value: String(d.winners ?? 1) },
              ...(d.endAt ? [{ label: "Ends", value: when(new Date(d.endAt)) }] : []),
            ],
            button: { label: "Enter the giveaway", url: `${SITE}/giveaways` },
            note: "Requirements (level, time in the server) are shown on the giveaways page.",
          };
        },
      });
    },
  ];
  // Social messages still unread after 15 minutes (the same queue the bot's Discord DM reminder uses;
  // reading the chat removes the entry)
  jobs.push(async () => {
    const queue = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("message_dm_queue");
    const due = await queue
      .find({ firstAt: { $lte: new Date(now.getTime() - 15 * 60_000), $gte: new Date(now.getTime() - 86_400_000) }, emailAt: { $exists: false } }, { projection: { to: 1 } })
      .limit(50)
      .toArray();
    for (const q of due) {
      if (Date.now() > deadline) break;
      const claimed = await queue.updateOne({ _id: q._id, emailAt: { $exists: false } }, { $set: { emailAt: new Date() } });
      if (claimed.modifiedCount && q.to) await sendSocialEmail(String(q.to), { type: "message", title: "You have unread messages", link: "/social/messages" });
    }
    return false;
  });
  let ran = 0;
  for (const job of jobs) {
    if (Date.now() > deadline) break;
    try {
      // Keep going on the same kind while there's more and time left
      while (Date.now() < deadline && (await job())) ran += 1;
    } catch (e) {
      console.error("Email job failed", e);
    }
  }
  return ran;
}

// ---------- Social (sent as it happens, from lib/notifications.ts) ----------

const SOCIAL_KIND: Record<string, EmailPrefKey> = { match: "socialMatches", message: "socialMessages", "friend-request": "socialFriends" };
// Unread messages: at most one email per member every 6 hours. Matches / requests: one per person per hour.
const SOCIAL_GAP_MS: Record<string, number> = { message: 6 * 3_600_000, match: 60_000, "friend-request": 60_000 };

export async function sendSocialEmail(toDiscordId: string, n: { type: string; title: string; body?: string; link: string; actor?: string | null }) {
  const kind = SOCIAL_KIND[n.type];
  if (!kind) return;
  const r = await recipientByDiscordId(toDiscordId, kind);
  if (!r) return;
  // Throttle: one row per member + type, claimed atomically
  const throttle = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("email_throttle");
  const key = `${r.id}:${n.type}${n.type === "message" ? "" : `:${n.actor ?? ""}`}`;
  const cutoff = new Date(Date.now() - (SOCIAL_GAP_MS[n.type] ?? 3_600_000));
  try {
    const claimed = await throttle.updateOne({ _id: key as never, at: { $lt: cutoff } }, { $set: { at: new Date() } }, { upsert: true });
    if (!claimed.upsertedCount && !claimed.modifiedCount) return;
  } catch {
    // Duplicate key: someone else just claimed it (sent recently)
    return;
  }
  const link = n.link.startsWith("http") ? n.link : `${SITE}${n.link}`;
  const copy: Record<string, Built> = {
    match: { kind: "notify-social", subject: "💞 You have a new match!", eyebrow: "Social", title: n.title, intro: n.body || "You and someone liked each other. Say hi!", button: { label: "Open Social", url: link }, note: "Only you can see your matches." },
    message: {
      kind: "notify-social",
      subject: "💬 You have unread messages on Social",
      eyebrow: "Social",
      title: "You have unread messages",
      intro: "Someone messaged you on Bear Nation Social and it's still waiting. We don't put messages in emails, so open the site to read it.",
      button: { label: "Read your messages", url: `${SITE}/social/messages` },
      note: "We'll email about messages at most once every 6 hours.",
    },
    "friend-request": { kind: "notify-social", subject: "🤝 New friend request", eyebrow: "Social", title: n.title, intro: n.body || "Someone wants to be friends on Bear Nation Social.", button: { label: "See the request", url: link }, note: "You can choose who can send you requests in Settings → Messages." },
  };
  await sendNotificationBatch([forRecipient(r, kind, copy[n.type])]).catch(() => undefined);
}
