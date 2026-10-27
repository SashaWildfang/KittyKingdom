// Admin → Needs attention: everything waiting on a person, from every part of the panel, in one list (oldest and
// most urgent first). Staff claim an item so two people don't pick up the same thing; items that don't clear by
// themselves (flags, AutoMod alerts, bot problems) can be dismissed.
//
// website.inbox_state {_id: item key, claimedBy, claimedByName, claimedAt, doneBy, doneByName, doneAt}
// An item's key changes when the thing itself changes, so a dismissed item comes back if something new happens.

import { ObjectId, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { people } from "./admin-people";
import { getBotCollection, getJoinApplicationsCollection, getMongoClient } from "./mongodb";
import { listWatch, watchActivity } from "./staff-notes";

export type InboxKind = "join" | "ticket" | "ticket-quiet" | "appeal" | "ban-request" | "flag-18" | "automod" | "bot-issue" | "news" | "social-report" | "watch" | "report";

export type InboxItem = {
  key: string;
  kind: InboxKind;
  title: string;
  detail: string;
  at: string;
  /** Where to deal with it in the panel */
  link: string;
  urgent: boolean;
  /** Can be dismissed with Done (others clear when they're handled) */
  dismissable: boolean;
  member: string | null;
  claim: { by: string; name: string; at: string } | null;
};

const HOUR = 3_600_000;
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : typeof d === "string" ? d : new Date(0).toISOString());
const age = (d: unknown) => Date.now() - new Date(iso(d)).getTime();
const ago = (d: unknown) => {
  const ms = age(d);
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))}m`;
  if (ms < 48 * HOUR) return `${Math.round(ms / HOUR)}h`;
  return `${Math.round(ms / (24 * HOUR))}d`;
};
const NSFW = /nsfw/i;
const typeLabel = (t: unknown) => String(t ?? "support").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

async function site() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
}

async function stateCol() {
  return (await site()).collection<{ _id: string; claimedBy?: string; claimedByName?: string; claimedAt?: Date; doneBy?: string; doneByName?: string; doneAt?: Date }>("inbox_state");
}

const FLAG_TAGS = ["dob-mismatch", "under-18"];
const flagKey = (f: Document) => `flag-18:${f.ticketKey ?? f._id}:${((f.tags as string[]) ?? []).filter((t) => FLAG_TAGS.includes(t)).sort().join(",")}`;
const issueKey = (i: Document) => `bot-issue:${i._id}:${Number(i.count ?? 1)}`;
const ADMIN_KINDS = new Set(["appeal", "flag-18", "bot-issue", "news"]);
const DISMISSED_WINDOW_MS = 60 * 24 * HOUR;

/** Everything waiting for this panel user (staff don't see admin-only items or 18+ tickets). */
export async function inboxItems(panel: PanelUser): Promise<InboxItem[]> {
  return (await inboxFeed(panel)).items;
}

/** The list plus which sources couldn't be checked (so a database hiccup never reads as "All caught up"). */
export async function inboxFeed(panel: PanelUser): Promise<{ items: InboxItem[]; missing: string[] }> {
  const admin = panel.level === "admin";
  const db = await site();
  const missing: string[] = [];
  const safe =
    <T,>(label: string) =>
    (p: Promise<T[]>) =>
      p.catch((e) => {
        console.error(`Inbox: couldn't check ${label}`, e);
        missing.push(label);
        return [] as T[];
      });
  // Dismissed AutoMod alerts are skipped in the query itself, so older ones aren't stuck behind the limit
  const dismissedAutomod = (
    await (await stateCol())
      .find({ _id: { $regex: "^automod:" }, doneAt: { $gte: new Date(Date.now() - DISMISSED_WINDOW_MS) } } as never, { projection: { _id: 1 } })
      .toArray()
      .catch(() => [] as { _id: string }[])
  )
    .map((d) => d._id.slice("automod:".length))
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  // 18+ flags and bot problems: walk past dismissed ones instead of cutting off at a fixed limit
  const dismissedKeys = new Set(
    (await (await stateCol()).find({ _id: { $regex: "^(flag-18|bot-issue):" }, doneAt: { $exists: true } } as never, { projection: { _id: 1 } }).toArray().catch(() => [] as { _id: string }[])).map((d) => d._id),
  );
  const firstUndismissed = async (cursor: AsyncIterable<Document>, keyOf: (d: Document) => string, want: number) => {
    const out: Document[] = [];
    for await (const d of cursor) {
      if (dismissedKeys.has(keyOf(d))) continue;
      out.push(d);
      if (out.length >= want) break;
    }
    return out;
  };
  const [apps, active, appeals, bans, flags, alerts, issues, news, reports, watched, msgReports] = await Promise.all([
    safe<Document>("join applications")(getJoinApplicationsCollection().then((c) => c.find({ status: "pending" }, { projection: { discordId: 1, submittedAt: 1 } }).sort({ submittedAt: 1 }).limit(60).toArray())),
    safe<Document>("tickets")(getBotCollection("activeTickets").then((c) => c.find({}, { projection: { ticket_id: 1, ticket_type: 1, opened_by: 1, claimed_by: 1, created: 1, last_updated: 1, manual_ticket: 1 } }).toArray())),
    admin ? safe<Document>("appeals")(db.collection("appeals").find({ status: "pending" }, { projection: { discordId: 1, createdAt: 1, "punishment.action": 1 } }).sort({ createdAt: 1 }).limit(40).toArray()) : Promise.resolve([] as Document[]),
    safe<Document>("ban requests")(db.collection("ban_requests").find({ status: "pending" }, { projection: { userId: 1, userName: 1, requesterName: 1, createdAt: 1, reason: 1 } }).sort({ createdAt: 1 }).limit(40).toArray()),
    admin
      ? safe<Document>("18+ flags")(firstUndismissed(db.collection("ticket_summaries").find({ tags: { $in: ["dob-mismatch", "under-18"] }, checkedAt: { $gte: new Date(Date.now() - 60 * 24 * HOUR) } }, { projection: { tags: 1, ticketKey: 1, generatedAt: 1, headline: 1 } }).sort({ generatedAt: -1 }), flagKey, 40))
      : Promise.resolve([] as Document[]),
    safe<Document>("AutoMod")(getBotCollection("automod_events").then((c) => c.find({ action: "alert", _id: { $nin: dismissedAutomod }, at: { $gte: new Date(Date.now() - 72 * HOUR) } }, { projection: { userId: 1, rule: 1, reason: 1, at: 1, channelId: 1 } }).sort({ at: -1 }).limit(60).toArray())),
    admin ? safe<Document>("bot problems")(getBotCollection("bot_issues").then((c) => firstUndismissed(c.find({ resolved: { $ne: true }, level: "error" }, { projection: { bot: 1, title: 1, count: 1, lastAt: 1 } }).sort({ lastAt: -1 }), issueKey, 25))) : Promise.resolve([] as Document[]),
    admin ? safe<Document>("news")(db.collection("news").find({ status: "pending" }, { projection: { title: 1, createdAt: 1, updatedAt: 1 } }).limit(20).toArray()) : Promise.resolve([] as Document[]),
    safe<Document>("Social reports")(db.collection("dating_reports").find({ status: "open" }, { projection: { reported: 1, reason: 1, at: 1, type: 1 } }).sort({ at: 1 }).limit(30).toArray()),
    // Watchlist: anything a watched member did in the last 3 days
    listWatch()
      .then((list) => watchActivity(list.map((w) => w.discordId), new Date(Date.now() - 72 * HOUR)).then((activity) => ({ list, activity })))
      .catch((e) => {
        console.error("Inbox: couldn't check the watchlist", e);
        missing.push("the watchlist");
        return { list: [] as Awaited<ReturnType<typeof listWatch>>, activity: [] as Awaited<ReturnType<typeof watchActivity>> };
      }),
    safe<Document>("message reports")(getBotCollection("reports").then((c) => c.find({ status: "open" }, { projection: { authorId: 1, authorName: 1, count: 1, createdAt: 1, lastReportAt: 1, reporters: { $slice: -1 } } }).sort({ lastReportAt: 1 }).limit(60).toArray())),
  ]);

  const ids = [
    ...apps.map((a) => String(a.discordId ?? "")),
    ...active.flatMap((t) => [String(t.opened_by ?? ""), String(t.claimed_by ?? "")]),
    ...appeals.map((a) => String(a.discordId ?? "")),
    ...bans.map((b) => String(b.userId ?? "")),
    ...alerts.map((a) => String(a.userId ?? "")),
    ...reports.map((r) => String(r.reported ?? "")),
    ...watched.activity.map((a) => a.discordId),
    ...msgReports.map((r) => String(r.authorId ?? "")),
  ].filter((id) => /^\d{15,21}$/.test(id));
  const who = await people(ids).catch(() => ({}) as Record<string, { name?: string }>);
  const name = (id: unknown) => (id && who[String(id)]?.name) || "a member";
  const items: Omit<InboxItem, "claim">[] = [];

  for (const a of apps) {
    items.push({ key: `join:${a._id}`, kind: "join", title: `Join application from ${name(a.discordId)}`, detail: `Waiting ${ago(a.submittedAt)}`, at: iso(a.submittedAt), link: "/admin?tab=join", urgent: age(a.submittedAt) > 12 * HOUR, dismissable: false, member: String(a.discordId ?? "") || null });
  }
  for (const t of active) {
    if (!admin && NSFW.test(String(t.ticket_type ?? ""))) continue;
    const n = Number(t.ticket_id);
    if (!t.claimed_by) {
      items.push({ key: `ticket:${t._id}`, kind: "ticket", title: `Ticket #${n} · ${typeLabel(t.ticket_type)} from ${name(t.opened_by)}`, detail: `Nobody has picked it up · opened ${ago(t.created)} ago`, at: iso(t.created), link: `/admin?tab=tickets&search=%23${n}`, urgent: age(t.created) > 2 * HOUR, dismissable: false, member: String(t.opened_by ?? "") || null });
    } else if (!t.manual_ticket && age(t.last_updated ?? t.created) > 24 * HOUR) {
      items.push({ key: `ticket-quiet:${t._id}:${iso(t.last_updated)}`, kind: "ticket-quiet", title: `Ticket #${n} has gone quiet`, detail: `Claimed by ${name(t.claimed_by)} · nothing for ${ago(t.last_updated ?? t.created)}`, at: iso(t.last_updated ?? t.created), link: `/admin?tab=tickets&search=%23${n}`, urgent: age(t.last_updated ?? t.created) > 72 * HOUR, dismissable: true, member: String(t.opened_by ?? "") || null });
    }
  }
  for (const a of appeals) {
    items.push({ key: `appeal:${a._id}`, kind: "appeal", title: `Appeal from ${name(a.discordId)}`, detail: `${typeLabel((a.punishment as Document | undefined)?.action ?? "punishment")} · waiting ${ago(a.createdAt)}`, at: iso(a.createdAt), link: "/admin?tab=appeals", urgent: age(a.createdAt) > 48 * HOUR, dismissable: false, member: String(a.discordId ?? "") || null });
  }
  for (const b of bans) {
    items.push({ key: `ban-request:${b._id}`, kind: "ban-request", title: `Ban request for ${name(b.userId) === "a member" ? String(b.userName ?? "a member") : name(b.userId)}`, detail: `From ${String(b.requesterName ?? "a Jr Mod")} · ${String(b.reason ?? "").slice(0, 80)}`, at: iso(b.createdAt), link: "/admin?tab=banrequests", urgent: true, dismissable: false, member: String(b.userId ?? "") || null });
  }
  for (const f of flags) {
    const tags = ((f.tags as string[]) ?? []).filter((t) => t === "dob-mismatch" || t === "under-18");
    items.push({ key: flagKey(f), kind: "flag-18", title: `18+ ticket #${f._id}: ${tags.includes("under-18") ? "under 18" : "DOB mismatch"}`, detail: String(f.headline ?? "").slice(0, 120), at: iso(f.generatedAt), link: `/admin?tab=tickets&search=%23${f._id}`, urgent: tags.includes("under-18"), dismissable: true, member: null });
  }
  for (const a of alerts) {
    items.push({ key: `automod:${a._id}`, kind: "automod", title: `AutoMod flagged ${name(a.userId)}`, detail: `${String(a.reason ?? a.rule ?? "").slice(0, 100)} · ${ago(a.at)} ago`, at: iso(a.at), link: "/admin?tab=automod", urgent: false, dismissable: true, member: String(a.userId ?? "") || null });
  }
  for (const i of issues) {
    items.push({ key: issueKey(i), kind: "bot-issue", title: `${typeLabel(i.bot)} Bot: ${String(i.title ?? "an error").slice(0, 90)}`, detail: `Seen ${Number(i.count ?? 1)}× · last ${ago(i.lastAt)} ago`, at: iso(i.lastAt), link: "/admin?tab=bot-console", urgent: false, dismissable: true, member: null });
  }
  for (const n of news) {
    items.push({ key: `news:${n._id}`, kind: "news", title: `News post waiting for approval: ${String(n.title ?? "Untitled")}`, detail: `Written ${ago(n.updatedAt ?? n.createdAt)} ago`, at: iso(n.updatedAt ?? n.createdAt), link: "/admin?tab=news", urgent: false, dismissable: false, member: null });
  }
  for (const r of reports) {
    items.push({ key: `social-report:${r._id}`, kind: "social-report", title: `Social report about ${name(r.reported)}`, detail: `${String(r.reason ?? "")} · ${ago(r.at)} ago`, at: iso(r.at), link: "/admin?tab=dating", urgent: age(r.at) > 24 * HOUR, dismissable: false, member: String(r.reported ?? "") || null });
  }

  for (const r of msgReports) {
    const n = Number(r.count ?? 1);
    const reason = String(((r.reporters as Document[] | undefined) ?? [])[0]?.reason ?? "").slice(0, 90);
    // A new reporter changes the key, so a report comes back to the top of everyone's list
    items.push({ key: `report:${r._id}:${n}`, kind: "report", title: `Message from ${name(r.authorId) === "a member" ? String(r.authorName ?? "a member") : name(r.authorId)} reported${n > 1 ? ` by ${n} people` : ""}`, detail: `${reason} · ${ago(r.lastReportAt ?? r.createdAt)} ago`, at: iso(r.lastReportAt ?? r.createdAt), link: "/admin?tab=reports", urgent: n >= 3 || age(r.createdAt) > 6 * HOUR, dismissable: false, member: String(r.authorId ?? "") || null });
  }

  const reasons = new Map(watched.list.map((w) => [w.discordId, w.reason]));
  for (const a of watched.activity) {
    // 18+ tickets stay out of staff's view
    if (!admin && a.kind === "ticket" && NSFW.test(a.label)) continue;
    items.push({ key: `watch:${a.kind}:${a.ref}`, kind: "watch", title: `Watched: ${name(a.discordId)} · ${a.label}`, detail: `Watching because: ${String(reasons.get(a.discordId) ?? "").slice(0, 100)} · ${ago(a.at)} ago`, at: a.at, link: "/admin?tab=watchlist", urgent: a.kind === "joined", dismissable: true, member: a.discordId });
  }

  // Claims and dismissals
  const states = await (await stateCol()).find({ _id: { $in: items.map((i) => i.key) } }).toArray();
  const byKey = new Map(states.map((s) => [s._id, s]));
  const visible = items
    .filter((i) => !byKey.get(i.key)?.doneAt)
    .map((i) => {
      const s = byKey.get(i.key);
      return { ...i, claim: s?.claimedBy ? { by: s.claimedBy, name: s.claimedByName ?? "staff", at: iso(s.claimedAt) } : null };
    })
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || new Date(a.at).getTime() - new Date(b.at).getTime());
  return { items: visible, missing };
}

export async function inboxCount(panel: PanelUser) {
  const items = await inboxItems(panel);
  return { total: items.length, urgent: items.filter((i) => i.urgent).length, mine: items.filter((i) => i.claim?.by === panel.discordId).length };
}

export class InboxError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** claim / release / done / undo on one item. Claiming something someone else has is refused. */
export async function inboxAction(panel: PanelUser, key: string, action: string) {
  if (!/^[a-z0-9-]+:[\w:.,-]{1,200}$/i.test(key)) throw new InboxError("That item doesn't exist.");
  const c = await stateCol();
  const now = new Date();
  const kind = key.split(":")[0];
  if (ADMIN_KINDS.has(kind) && panel.level !== "admin") throw new InboxError("That item doesn't exist.", 404);
  if (action === "undo") {
    // Bring back something dismissed: yours, or anyone's for admins
    const res = await c.updateOne(
      { _id: key, doneAt: { $exists: true }, ...(panel.level === "admin" ? {} : { doneBy: panel.discordId }) },
      { $unset: { doneBy: "", doneByName: "", doneAt: "" } },
    );
    if (!res.matchedCount) throw new InboxError("That can't be brought back.", 404);
    return;
  }
  // Everything else only works on an item that's actually in your list right now
  const item = (await inboxItems(panel)).find((i) => i.key === key);
  if (!item) throw new InboxError("That item is gone (someone may have handled it already).", 404);
  if (action === "done" && !item.dismissable) throw new InboxError("This clears by itself once it's handled.");
  if (action === "claim") {
    const res = await c.findOneAndUpdate(
      { _id: key, $or: [{ claimedBy: { $exists: false } }, { claimedBy: panel.discordId }] } as never,
      { $set: { claimedBy: panel.discordId, claimedByName: panel.name, claimedAt: now } },
      { upsert: true, returnDocument: "after" },
    ).catch((e: { code?: number }) => {
      if (e?.code === 11000) return null;
      throw e;
    });
    if (!res) throw new InboxError("Someone else claimed that a moment ago.", 409);
    return;
  }
  if (action === "release") {
    await c.updateOne({ _id: key, ...(panel.level === "admin" ? {} : { claimedBy: panel.discordId }) }, { $unset: { claimedBy: "", claimedByName: "", claimedAt: "" } });
    return;
  }
  if (action === "done") {
    await c.updateOne({ _id: key }, { $set: { doneBy: panel.discordId, doneByName: panel.name, doneAt: now } }, { upsert: true });
    return;
  }
  throw new InboxError("Unknown action.");
}

