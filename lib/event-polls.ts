// Event polls: staff write them in Admin → Members → Events, the Main Bot (events/event_polls.py) posts them as
// native Discord polls in the event polls channel and copies the vote counts back here.
//   zeo_bot.event_polls  {question, answers[{text, emoji}], hours, multiple, eventId, ping, createdBy, createdAt,
//                         status pending|posted|ended|failed, messageId, channelId, postedAt, expiresAt,
//                         results[{text, votes}], totalVotes, endRequested, deleted, error}

import { ObjectId, type Document } from "mongodb";
import { getBotCollection } from "./mongodb";
import { EventError } from "./events";

export type PollStatus = "pending" | "posted" | "ended" | "failed";
export type EventPoll = {
  id: string;
  question: string;
  answers: { text: string; emoji: string | null; votes: number }[];
  hours: number;
  multiple: boolean;
  eventId: string | null;
  ping: boolean;
  status: PollStatus;
  totalVotes: number;
  postedAt: string | null;
  expiresAt: string | null;
  messageUrl: string | null;
  endRequested: boolean;
  error: string | null;
  createdBy: string | null;
  createdAt: string | null;
};

/** The lengths Discord offers for a poll (in hours). */
export const POLL_LENGTHS = [1, 4, 8, 24, 72, 168, 336] as const;
const GUILD_ID = "1358452494128250940";
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);

async function pollsCol() {
  return getBotCollection("event_polls");
}

function toPoll(d: Document): EventPoll {
  const results: { text: string; votes: number }[] = Array.isArray(d.results) ? d.results : [];
  const answers = (Array.isArray(d.answers) ? d.answers : []).map((a: Document, i: number) => ({
    text: String(a.text ?? ""),
    emoji: a.emoji ? String(a.emoji) : null,
    votes: Number(results[i]?.votes ?? 0),
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
    totalVotes: Number(d.totalVotes ?? 0),
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
  return docs.map(toPoll);
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
  if (answers.some((a) => a.emoji && (a.emoji.length > 16 || /[\w\s]/.test(a.emoji)))) throw new EventError("Answer emoji must be a single emoji (or left empty).");
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
}
