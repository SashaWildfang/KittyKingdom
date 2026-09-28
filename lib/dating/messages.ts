// Private messages between 18+ Verified members.
//   dating_conversations {_id: "lo-hi", users, state: "open"|"request"|"declined", requestFrom, lastAt,
//                         lastText, lastFrom, unread: {id: n}, declinedAt}
//   dating_messages      {conv, from, text, at, deleted?}
// Matches and friends chat freely; anyone else starts in the other person's Message Requests
// (they wait in a Requests tab until accepted). Blocking hides everything both ways. AutoMod's severe words
// and scam-link checks apply here too.

import { ObjectId, type Collection, type Document } from "mongodb";
import { getAutomodConfig } from "../automod";
import { Matcher, scanLinks } from "../automod-engine";
import { getMongoClient } from "../mongodb";
import { notify, markReadByKey } from "../notifications";
import { getCurrentBans } from "../moderation";
import { blockedIds, datingCols, pairId, toLong } from "./db";
import { getSettings } from "./settings";
import { friendState, isMatch } from "./social";

export const MAX_MESSAGE = 2000;
const DECLINE_COOLDOWN_MS = 7 * 86_400_000;

let ready: Promise<unknown> | null = null;
async function cols(): Promise<{ convs: Collection<Document>; msgs: Collection<Document> }> {
  const db = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
  const convs = db.collection("dating_conversations");
  const msgs = db.collection("dating_messages");
  ready ??= Promise.all([convs.createIndex({ users: 1, lastAt: -1 }), msgs.createIndex({ conv: 1, at: -1 })]).catch(() => undefined);
  await ready;
  return { convs, msgs };
}

// AutoMod words, cached briefly
let matcher: { at: number; m: Matcher } | null = null;
async function automod() {
  if (!matcher || Date.now() - matcher.at > 60_000) {
    const cfg = await getAutomodConfig().catch(() => null);
    matcher = { at: Date.now(), m: new Matcher(cfg?.words ?? [], cfg?.allow ?? []) };
  }
  return matcher.m;
}

export type ConversationSummary = {
  id: string;
  other: string;
  state: "open" | "request" | "declined";
  incomingRequest: boolean;
  lastText: string;
  lastFromMe: boolean;
  lastAt: string | null;
  unread: number;
};

function summary(c: Document, me: string): ConversationSummary {
  const other = (c.users as string[]).find((u) => u !== me)!;
  return {
    id: String(c._id),
    other,
    state: c.state,
    incomingRequest: c.state === "request" && c.requestFrom !== me,
    lastText: String(c.lastText ?? ""),
    lastFromMe: c.lastFrom === me,
    lastAt: c.lastAt instanceof Date ? c.lastAt.toISOString() : null,
    unread: Number(c.unread?.[me] ?? 0),
  };
}

export async function conversations(me: string) {
  const { convs } = await cols();
  const blocked = await blockedIds(me);
  const rows = await convs.find({ users: me, [`hidden.${me}`]: { $ne: true } }).sort({ lastAt: -1 }).limit(200).toArray();
  const list = rows.map((c) => summary(c, me)).filter((c) => !blocked.has(c.other));
  return {
    inbox: list.filter((c) => c.state === "open" || (c.state === "request" && !c.incomingRequest)),
    requests: list.filter((c) => c.incomingRequest),
    unread: list.filter((c) => !c.incomingRequest).reduce((n, c) => n + c.unread, 0),
    requestCount: list.filter((c) => c.incomingRequest).length,
  };
}

/** Whether these two can chat freely (match or friends). */
async function trusted(a: string, b: string) {
  return (await isMatch(a, b)) || (await friendState(a, b)) === "friends";
}

export async function thread(me: string, other: string, before?: string) {
  if ((await blockedIds(me)).has(other)) return null;
  const { convs, msgs } = await cols();
  const id = pairId(me, other);
  const conv = await convs.findOne({ _id: id } as never);
  const q: Document = { conv: id };
  if (before && ObjectId.isValid(before)) q._id = { $lt: new ObjectId(before) };
  const rows = conv ? await msgs.find(q).sort({ _id: -1 }).limit(50).toArray() : [];
  // Opening the thread reads it
  if (conv && Number(conv.unread?.[me] ?? 0) > 0) await convs.updateOne({ _id: id } as never, { $set: { [`unread.${me}`]: 0, [`readAt.${me}`]: new Date() } });
  await markReadByKey(me, `msg:${id}`);
  const canWriteFreely = await trusted(me, other);
  const [mySettings, theirSettings] = await Promise.all([getSettings(me), getSettings(other)]);
  const receipts = mySettings.readReceipts && theirSettings.readReceipts;
  const state = conv?.state ?? (canWriteFreely ? "open" : "none");
  return {
    id,
    state,
    incomingRequest: conv?.state === "request" && conv.requestFrom !== me,
    // No cap on messages while a request is waiting; they land in the other person's Requests tab
    canSend: state === "open" || canWriteFreely || state === "none" || (conv?.state === "request" && conv.requestFrom === me),
    requestPending: conv?.state === "request" && conv.requestFrom === me,
    // "Seen" works both ways: either of you turning read receipts off hides it for both
    theirReadAt: receipts && conv?.readAt?.[other] instanceof Date ? (conv.readAt[other] as Date).toISOString() : null,
    messages: rows.reverse().map((m) => ({ id: String(m._id), from: String(m.from), text: m.deleted ? "" : String(m.text), deleted: Boolean(m.deleted), at: (m.at as Date).toISOString() })),
    more: rows.length === 50,
  };
}

export async function send(me: string, other: string, raw: string, myName: string): Promise<{ id: string } | string> {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return "Write a message first.";
  if (text.length > MAX_MESSAGE) return `Messages can be up to ${MAX_MESSAGE.toLocaleString()} characters.`;
  if (me === other) return "You can't message yourself.";
  if ((await blockedIds(me)).has(other)) return "You can't message this member.";
  // Both of you need a dating profile, and theirs can't be paused by staff
  const { profiles } = await datingCols();
  const [mine, theirs] = await Promise.all([profiles.findOne({ _id: toLong(me) } as never, { projection: { _id: 1 } }), profiles.findOne({ _id: toLong(other) } as never, { projection: { web: 1 } })]);
  if (!mine) return "Create your dating profile first.";
  if (!theirs || (theirs.web as { pausedByStaff?: boolean } | undefined)?.pausedByStaff) return "You can't message this member.";
  if ((await getCurrentBans().catch(() => null))?.has(other)) return "You can't message this member.";
  const m = await automod();
  const hit = m.find(text);
  if (hit?.severe) return "That message has language that isn't allowed here.";
  if (scanLinks(text)) return "That link looks unsafe, so it wasn't sent.";

  const { convs, msgs } = await cols();
  const id = pairId(me, other);
  const conv = await convs.findOne({ _id: id } as never);
  const free = await trusted(me, other);
  let state: string = conv?.state ?? (free ? "open" : "request");
  if (free && state !== "open") state = "open";
  if (state === "declined") {
    if (conv?.requestFrom === me && conv.declinedAt instanceof Date && Date.now() - conv.declinedAt.getTime() < DECLINE_COOLDOWN_MS) return "They passed on your message request. You can try again in a few days.";
    state = "request";
  }
  if (state === "request" && !(conv && conv.requestFrom !== me && conv.state === "request") && (await getSettings(other)).messagesFrom === "connections") {
    return "They only take messages from matches and friends. Try adding them as a friend first.";
  }
  if (state === "request") {
    if (conv && conv.requestFrom !== me && conv.state === "request") {
      // Replying to a request accepts it
      state = "open";
    }
  }
  const now = new Date();
  const res = await msgs.insertOne({ conv: id, from: me, to: other, text, at: now });
  await convs.updateOne(
    { _id: id } as never,
    {
      $set: { users: [me, other].sort(), state, lastAt: now, lastText: text.slice(0, 120), lastFrom: me, [`unread.${me}`]: 0, [`hidden.${other}`]: false, [`hidden.${me}`]: false, ...(state === "request" ? { requestFrom: conv?.requestFrom ?? me } : {}) },
      $inc: { [`unread.${other}`]: 1 },
    },
    { upsert: true },
  );
  await notify(other, {
    type: state === "request" ? "request" : "message",
    actor: me,
    title: state === "request" ? `📨 ${myName} sent you a message request` : `💬 New message from ${myName}`,
    body: text.slice(0, 100),
    link: `/social/messages/${me}`,
    key: `msg:${id}`,
  });
  return { id: String(res.insertedId) };
}

export async function respondToRequest(me: string, other: string, accept: boolean) {
  const { convs } = await cols();
  const id = pairId(me, other);
  const conv = await convs.findOne({ _id: id } as never);
  if (!conv || conv.state !== "request" || conv.requestFrom === me) return "There's no request to answer.";
  await convs.updateOne({ _id: id } as never, accept ? { $set: { state: "open" } } : { $set: { state: "declined", declinedAt: new Date(), [`hidden.${me}`]: true } });
  return null;
}

/** Hides a conversation from your list (it comes back if they write again). */
export async function hideConversation(me: string, other: string) {
  const { convs } = await cols();
  await convs.updateOne({ _id: pairId(me, other) } as never, { $set: { [`hidden.${me}`]: true, [`unread.${me}`]: 0 } });
}

/** Unsends one of your own messages. */
export async function deleteMessage(me: string, messageId: string) {
  if (!ObjectId.isValid(messageId)) return;
  const { msgs } = await cols();
  await msgs.updateOne({ _id: new ObjectId(messageId), from: me }, { $set: { deleted: true, text: "", deletedAt: new Date() } });
}

/** A reported message with a little context (two before and after), for staff. */
export async function messageWithContext(messageId: string) {
  if (!ObjectId.isValid(messageId)) return null;
  const { msgs } = await cols();
  const m = await msgs.findOne({ _id: new ObjectId(messageId) });
  if (!m) return null;
  const [before, after] = await Promise.all([
    msgs.find({ conv: m.conv, _id: { $lt: m._id } }).sort({ _id: -1 }).limit(2).toArray(),
    msgs.find({ conv: m.conv, _id: { $gt: m._id } }).sort({ _id: 1 }).limit(2).toArray(),
  ]);
  const shape = (x: Document) => ({ id: String(x._id), from: String(x.from), text: String(x.text ?? ""), at: (x.at as Date).toISOString(), reported: String(x._id) === messageId });
  return { conv: String(m.conv), from: String(m.from), to: String(m.to), messages: [...before.reverse(), m, ...after].map(shape) };
}
