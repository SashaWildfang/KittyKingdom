// Event polls: staff write them in Admin → Members → Events, the Main Bot (events/event_polls.py) posts them as
// native Discord polls in the event polls channel and copies the votes (and who voted) back here.
// Members with Discord linked can also vote on /events. A bot can't vote in a Discord poll for someone, so website
// votes are kept separately and added on top; anyone who already voted in Discord is counted once, by their Discord vote.
//   zeo_bot.event_polls       {question, answers[{text, emoji}], hours, multiple, eventId, ping, createdBy, createdAt,
//                              status pending|posted|ended|failed, messageId, channelId, postedAt, expiresAt,
//                              results[{text, votes, voters[]}], totalVotes, endRequested, deleted, error}
//   zeo_bot.event_poll_votes  {pollId, discordId, answers[index], at}, one per member voting on the website

import { ObjectId, type Document } from "mongodb";
import { getBotCollection } from "./mongodb";
import { EventError } from "./events";

export type PollStatus = "pending" | "posted" | "ended" | "failed";
export type EventPoll = {
  id: string;
  question: string;
  /** votes = Discord + website (each member once) */
  answers: { text: string; emoji: string | null; votes: number }[];
  hours: number;
  multiple: boolean;
  eventId: string | null;
  ping: boolean;
  status: PollStatus;
  /** Members who voted (Discord + website) */
  totalVotes: number;
  webVotes: number;
  postedAt: string | null;
  expiresAt: string | null;
  messageUrl: string | null;
  endRequested: boolean;
  error: string | null;
  createdBy: string | null;
  createdAt: string | null;
};

/** The lengths Discord offers for a poll (in hours). */
/** What /events shows: the poll plus the viewer's own vote. */
export type PublicPoll = Omit<EventPoll, "ping" | "endRequested" | "error" | "createdBy" | "createdAt" | "status" | "hours"> & {
  open: boolean;
  /** Answer indexes the viewer picked (on the website, or in Discord) */
  mine: number[];
  votedInDiscord: boolean;
};

export const POLL_LENGTHS = [1, 4, 8, 24, 72, 168, 336] as const;
const GUILD_ID = "1358452494128250940";
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);

const EMOJI = new RegExp("\\p{Extended_Pictographic}|\\u20E3|\\p{Regional_Indicator}", "u");

/** Exactly one emoji (incl. keycaps like 1️⃣, flags and skin-tone / joined emoji). */
function isSingleEmoji(value: string) {
  const parts = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value));
  return parts.length === 1 && EMOJI.test(value);
}

async function pollsCol() {
  return getBotCollection("event_polls");
}
async function votesCol() {
  const c = await getBotCollection("event_poll_votes");
  await c.createIndex({ pollId: 1, discordId: 1 }, { unique: true }).catch(() => undefined);
  return c;
}

type WebVote = { discordId: string; answers: number[] };

/** Members who voted in Discord, per answer (synced by the bot). */
function discordVoters(d: Document): Set<string>[] {
  const results: Document[] = Array.isArray(d.results) ? d.results : [];
  return (Array.isArray(d.answers) ? d.answers : []).map((_: unknown, i: number) => new Set<string>((results[i]?.voters ?? []).map(String)));
}

/** Discord votes plus website votes from members who didn't vote in Discord. */
function tally(d: Document, web: WebVote[]) {
  const results: Document[] = Array.isArray(d.results) ? d.results : [];
  const voters = discordVoters(d);
  const inDiscord = new Set<string>(voters.flatMap((v) => Array.from(v)));
  const counted = web.filter((v) => !inDiscord.has(v.discordId));
  // Older syncs may have counts without voter lists
  const votes = voters.map((v, i) => Math.max(v.size, Number(results[i]?.votes ?? 0)) + counted.filter((w) => w.answers.includes(i)).length);
  const discordTotal = Math.max(inDiscord.size, Number(d.totalVotes ?? 0));
  return { votes, total: discordTotal + counted.length, webVotes: counted.length, inDiscord, voters };
}

async function webVotes(pollIds: string[]) {
  const map = new Map<string, WebVote[]>();
  if (!pollIds.length) return map;
  for (const v of await (await votesCol()).find({ pollId: { $in: pollIds } }).toArray()) {
    const list = map.get(String(v.pollId)) ?? [];
    list.push({ discordId: String(v.discordId), answers: Array.isArray(v.answers) ? v.answers.map(Number) : [] });
    map.set(String(v.pollId), list);
  }
  return map;
}

function toPoll(d: Document, web: WebVote[] = []): EventPoll {
  const t = tally(d, web);
  const answers = (Array.isArray(d.answers) ? d.answers : []).map((a: Document, i: number) => ({
    text: String(a.text ?? ""),
    emoji: a.emoji ? String(a.emoji) : null,
    votes: t.votes[i] ?? 0,
  }));
  return {
    id: String(d._id),
    question: String(d.question ?? ""),
    answers,
    hours: Number(d.hours ?? 24),
    multiple: Boolean(d.multiple),
    eventId: d.eventId ? String(d.eventId) : null,
    ping: Boolean(d.ping),
    status: (["pending", "posted", "ended", "failed"].includes(d.status) ? d.status : "pending") as PollStatus,
    totalVotes: t.total,
    webVotes: t.webVotes,
    postedAt: iso(d.postedAt),
    expiresAt: iso(d.expiresAt),
    messageUrl: d.messageId && d.channelId ? `https://discord.com/channels/${GUILD_ID}/${d.channelId}/${d.messageId}` : null,
    endRequested: Boolean(d.endRequested),
    error: d.error ? String(d.error) : null,
    createdBy: d.createdBy ? String(d.createdBy) : null,
    createdAt: iso(d.createdAt),
  };
}

export async function staffPolls() {
  const docs = await (await pollsCol()).find({ deleted: { $ne: true } }).sort({ createdAt: -1 }).limit(40).toArray();
  const web = await webVotes(docs.map((d) => String(d._id)));
  return docs.map((d) => toPoll(d, web.get(String(d._id))));
}

const isOpen = (d: Document) => d.status === "posted" && !d.endRequested && !d.deleted && (!d.expiresAt || new Date(d.expiresAt).getTime() > Date.now());

/** /events: running polls, and ones that ended in the last 3 days (with results). */
export async function publicPolls(discordId: string | null): Promise<PublicPoll[]> {
  const since = new Date(Date.now() - 3 * 86400_000);
  const docs = await (await pollsCol())
    .find({ deleted: { $ne: true }, $or: [{ status: "posted" }, { status: "ended", expiresAt: { $gte: since } }] })
    .sort({ postedAt: -1 })
    .limit(12)
    .toArray();
  const web = await webVotes(docs.map((d) => String(d._id)));
  return docs.map((d) => {
    const list = web.get(String(d._id)) ?? [];
    const p = toPoll(d, list);
    const voters = discordVoters(d);
    const fromDiscord = discordId ? voters.flatMap((v, i) => (v.has(discordId) ? [i] : [])) : [];
    const fromWeb = discordId ? list.find((v) => v.discordId === discordId)?.answers ?? [] : [];
    return {
      id: p.id,
      question: p.question,
      answers: p.answers,
      multiple: p.multiple,
      eventId: p.eventId,
      totalVotes: p.totalVotes,
      webVotes: p.webVotes,
      postedAt: p.postedAt,
      expiresAt: p.expiresAt,
      messageUrl: p.messageUrl,
      open: isOpen(d),
      mine: fromDiscord.length ? fromDiscord : fromWeb,
      votedInDiscord: fromDiscord.length > 0,
    };
  });
}

/** A member's website vote (an empty list takes it back). */
export async function castVote(pollId: string, discordId: string, raw: unknown) {
  if (!ObjectId.isValid(pollId)) throw new EventError("Unknown poll.", 404);
  const doc = await (await pollsCol()).findOne({ _id: new ObjectId(pollId) });
  if (!doc || doc.deleted) throw new EventError("Unknown poll.", 404);
  if (!isOpen(doc)) throw new EventError("This poll has closed.");
  if (discordVoters(doc).some((v) => v.has(discordId))) throw new EventError("You already voted in Discord. Change your vote there.");
  const count = Array.isArray(doc.answers) ? doc.answers.length : 0;
  const answers = Array.from(new Set((Array.isArray(raw) ? raw : []).map(Number))).filter((i) => Number.isInteger(i) && i >= 0 && i < count);
  if (!doc.multiple && answers.length > 1) throw new EventError("Pick one answer.");
  const col = await votesCol();
  if (!answers.length) await col.deleteOne({ pollId, discordId });
  else await col.updateOne({ pollId, discordId }, { $set: { answers, at: new Date() } }, { upsert: true });
  const fresh = await webVotes([pollId]);
  return { poll: toPoll(doc, fresh.get(pollId)), mine: answers };
}

export async function createPoll(raw: Record<string, unknown>, by: string) {
  const question = String(raw.question ?? "").trim();
  if (!question) throw new EventError("Write the question.");
  if (question.length > 300) throw new EventError("Keep the question under 300 characters.");
  const answers = (Array.isArray(raw.answers) ? raw.answers : [])
    .map((a) => ({ text: String((a as Document)?.text ?? "").trim(), emoji: String((a as Document)?.emoji ?? "").trim() || null }))
    .filter((a) => a.text);
  if (answers.length < 2) throw new EventError("Add at least two answers.");
  if (answers.length > 10) throw new EventError("Discord polls can have up to 10 answers.");
  if (answers.some((a) => a.text.length > 55)) throw new EventError("Each answer has to be 55 characters or less.");
  if (answers.some((a) => a.emoji && !isSingleEmoji(a.emoji))) throw new EventError("Answer emoji must be a single emoji (or left empty).");
  const hours = Number(raw.hours);
  if (!POLL_LENGTHS.includes(hours as (typeof POLL_LENGTHS)[number])) throw new EventError("Pick how long the poll runs.");
  const eventId = raw.eventId && ObjectId.isValid(String(raw.eventId)) ? String(raw.eventId) : null;
  const res = await (await pollsCol()).insertOne({
    question,
    answers,
    hours,
    multiple: Boolean(raw.multiple),
    eventId,
    ping: Boolean(raw.ping),
    status: "pending",
    createdBy: by,
    createdAt: new Date(),
  });
  return { id: String(res.insertedId) };
}

export async function endPoll(id: string) {
  if (!ObjectId.isValid(id)) throw new EventError("Unknown poll.", 404);
  const res = await (await pollsCol()).updateOne({ _id: new ObjectId(id), status: "posted" }, { $set: { endRequested: true } });
  if (!res.matchedCount) throw new EventError("That poll isn't running.");
}

export async function deletePoll(id: string) {
  if (!ObjectId.isValid(id)) throw new EventError("Unknown poll.", 404);
  const col = await pollsCol();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return;
  // Posted: the bot deletes the Discord message first, then the record
  if (doc.messageId) await col.updateOne({ _id: doc._id }, { $set: { deleted: true } });
  else await col.deleteOne({ _id: doc._id });
  await (await votesCol()).deleteMany({ pollId: id });
}
