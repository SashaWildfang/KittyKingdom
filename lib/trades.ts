// Trading between members (Store → Trades). One member offers items and/or leaves for the other's
// items and/or leaves; the other accepts, declines or counters. Nothing is locked while an offer is
// open: when it's accepted, both sides are checked again and everything swaps in one go, or nothing
// does. A 5% fee on leaves that change hands keeps the economy healthy.
//
//   website trades { from, to, give: { items: TradeItem[], leaves }, want: {...}, message, status,
//                    createdAt, expiresAt, decidedAt, fee }
//   items are zeo_bot.user_inventory documents (by _id), moved by changing their owner.

import { Long, ObjectId, type Document } from "mongodb";
import { people } from "./admin-people";
import { ITEM, rarityFor, type Rarity } from "./cosmetics";
import { getMemberRoleIds, postChannelMessage, removeMemberRole } from "./discord-member";
import { getBotCollection, getMongoClient } from "./mongodb";
import { notify } from "./notifications";
import { StoreError } from "./store";
import { seasonal } from "./season-store";

const STAFF_LOG_CHANNEL_ID = "1360344042705256660";
export const TRADE_FEE = 0.05;
const TRADE_DAYS = 3;
const MAX_ITEMS_PER_SIDE = 8;
const MAX_OPEN_OUTGOING = 5;
const MAX_LEAVES = 10_000_000;
/** Personal items that can't change hands. */
const UNTRADABLE = new Set<string>([ITEM.customTitle, ITEM.customBadge]);
const BIG = { useBigInt64: true } as const;

export type TradeItem = { docId: string; itemId: string; name: string; type: string; rarity: Rarity };
export type TradeSide = { items: TradeItem[]; leaves: number };
export type TradeStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired" | "failed";
export type Trade = {
  id: string;
  from: string;
  to: string;
  give: TradeSide;
  want: TradeSide;
  message: string | null;
  status: TradeStatus;
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
  failReason: string | null;
};
/** Items someone can put in a trade, grouped by item. */
export type TradableGroup = { itemId: string; name: string; type: string; rarity: Rarity; docIds: string[]; roleColors?: string[] };

const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v ?? 0) || 0);
const idFilter = (discordId: string) => ({ discordId: { $in: [Long.fromString(discordId), discordId] } });
const feeOn = (leaves: number) => (leaves > 0 ? Math.ceil(leaves * TRADE_FEE) : 0);

async function trades() {
  const c = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("trades");
  await c.createIndex({ to: 1, status: 1, createdAt: -1 }).catch(() => undefined);
  await c.createIndex({ from: 1, status: 1, createdAt: -1 }).catch(() => undefined);
  return c;
}

function shape(t: Document): Trade {
  const expired = t.status === "pending" && t.expiresAt instanceof Date && t.expiresAt.getTime() < Date.now();
  return {
    id: String(t._id),
    from: String(t.from),
    to: String(t.to),
    give: t.give as TradeSide,
    want: t.want as TradeSide,
    message: t.message ? String(t.message) : null,
    status: expired ? "expired" : (t.status as TradeStatus),
    createdAt: (t.createdAt as Date).toISOString(),
    expiresAt: (t.expiresAt as Date).toISOString(),
    decidedAt: t.decidedAt instanceof Date ? t.decidedAt.toISOString() : null,
    failReason: t.failReason ? String(t.failReason) : null,
  };
}

/** What a member could trade right now (personal items left out). */
export async function tradableInventory(discordId: string): Promise<TradableGroup[]> {
  const [docs, catalog] = await Promise.all([
    (await getBotCollection("user_inventory")).find({ discordId, item_id: { $nin: Array.from(UNTRADABLE) } }, BIG).toArray(),
    (await getBotCollection("store_inventory")).find({}, { projection: { item_id: 1, price: 1, rarity: 1, retired: 1 }, ...BIG }).toArray(),
  ]);
  const byId = new Map(catalog.map((c) => [String(c.item_id), c]));
  const groups = new Map<string, TradableGroup>();
  for (const d of docs) {
    const itemId = String(d.item_id);
    const cat = byId.get(itemId);
    if (!cat || cat.retired === true) continue;
    const g = groups.get(itemId) ?? { itemId, name: String(d.name ?? itemId), type: String(d.type ?? "role"), rarity: rarityFor(num(cat.price), cat.rarity), docIds: [] };
    g.docIds.push(String(d._id));
    groups.set(itemId, g);
  }
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Turns { itemId, count } picks into specific items that member owns. */
async function pickItems(owner: string, raw: unknown): Promise<TradeItem[]> {
  const picks = Array.isArray(raw) ? raw.slice(0, MAX_ITEMS_PER_SIDE * 2) : [];
  const wanted = new Map<string, number>();
  for (const p of picks) {
    const itemId = String((p as { itemId?: unknown })?.itemId ?? "").slice(0, 80);
    const count = Math.floor(Number((p as { count?: unknown })?.count ?? 1));
    if (!itemId || !Number.isFinite(count) || count < 1) throw new StoreError("Something in that trade isn't right. Refresh and try again.");
    wanted.set(itemId, (wanted.get(itemId) ?? 0) + count);
  }
  const total = Array.from(wanted.values()).reduce((a, b) => a + b, 0);
  if (total > MAX_ITEMS_PER_SIDE) throw new StoreError(`Up to ${MAX_ITEMS_PER_SIDE} items per side.`);
  if (!total) return [];
  const have = await tradableInventory(owner);
  const out: TradeItem[] = [];
  for (const [itemId, count] of Array.from(wanted.entries())) {
    const g = have.find((x) => x.itemId === itemId);
    if (!g || g.docIds.length < count) throw new StoreError(`${g?.name ?? "An item"} isn't available to trade anymore.`);
    for (const docId of g.docIds.slice(0, count)) out.push({ docId, itemId, name: g.name, type: g.type, rarity: g.rarity });
  }
  return out;
}

function cleanLeaves(v: unknown) {
  const n = Math.floor(Number(v ?? 0));
  if (!Number.isFinite(n) || n < 0) throw new StoreError("Leaves can't be negative.");
  if (n > MAX_LEAVES) throw new StoreError(`Up to ${MAX_LEAVES.toLocaleString()} leaves per side.`);
  return n;
}

async function balanceOf(discordId: string) {
  const doc = await (await getBotCollection("users")).findOne(idFilter(discordId), { projection: { balance: 1 }, ...BIG });
  return num(doc?.balance);
}

const describe = (side: TradeSide) => {
  const parts = side.items.length ? Array.from(new Set(side.items.map((i) => i.name))).map((n) => `${side.items.filter((i) => i.name === n).length > 1 ? `${side.items.filter((i) => i.name === n).length}× ` : ""}${n}`) : [];
  if (side.leaves) parts.push(seasonal(`${side.leaves.toLocaleString()} leaves`));
  return parts.join(", ") || "nothing";
};

/** Sends a trade offer. */
export async function createTrade(from: { discordId: string; name: string }, input: Record<string, unknown>) {
  const to = String(input.to ?? "");
  if (!/^\d{15,21}$/.test(to)) throw new StoreError("Pick who to trade with.");
  if (to === from.discordId) throw new StoreError("You can't trade with yourself.");
  if (!(await getMemberRoleIds(to).catch(() => null))) throw new StoreError("They need to be in the server to trade.");
  const col = await trades();
  const open = await col.countDocuments({ from: from.discordId, status: "pending", expiresAt: { $gt: new Date() } });
  if (open >= MAX_OPEN_OUTGOING) throw new StoreError(`You can have up to ${MAX_OPEN_OUTGOING} open offers. Cancel one first.`);

  const give: TradeSide = { items: await pickItems(from.discordId, input.giveItems), leaves: cleanLeaves(input.giveLeaves) };
  const want: TradeSide = { items: await pickItems(to, input.wantItems), leaves: cleanLeaves(input.wantLeaves) };
  if (!give.items.length && !give.leaves && !want.items.length && !want.leaves) throw new StoreError("Add something to the trade.");
  if (!want.items.length && !want.leaves) throw new StoreError("Ask for something in return (or use Send gift to give an item away).");
  if (!give.items.length && !give.leaves) throw new StoreError("Offer something in return.");
  if (give.leaves && (await balanceOf(from.discordId)) < give.leaves) throw new StoreError(`You only have ${(await balanceOf(from.discordId)).toLocaleString()} leaves.`);
  const message = typeof input.message === "string" ? input.message.trim().slice(0, 200) : "";

  const now = new Date();
  const res = await col.insertOne({ from: from.discordId, to, give, want, message: message || null, status: "pending", createdAt: now, expiresAt: new Date(now.getTime() + TRADE_DAYS * 86_400_000) });
  await notify(to, {
    type: "system",
    actor: from.discordId,
    title: `${from.name} sent you a trade offer`,
    body: `They offer ${describe(give)} for ${describe(want)}.`,
    link: "/store?tab=trades",
  }).catch(() => undefined);
  return { message: "Trade offer sent! They have 3 days to answer.", id: String(res.insertedId) };
}

/** Accepts an offer: checks both sides again and swaps everything, or nothing. */
export async function acceptTrade(me: { discordId: string; name: string }, id: string) {
  if (!ObjectId.isValid(id)) throw new StoreError("Unknown trade.", 404);
  const col = await trades();
  const now = new Date();
  // Claim it first so it can't be accepted twice
  const t = await col.findOneAndUpdate({ _id: new ObjectId(id), to: me.discordId, status: "pending", expiresAt: { $gt: now } }, { $set: { status: "processing", decidedAt: now } }, { returnDocument: "after" });
  if (!t) throw new StoreError("That offer isn't open anymore.", 409);
  const give = t.give as TradeSide;
  const want = t.want as TradeSide;
  const from = String(t.from);
  const inv = await getBotCollection("user_inventory");
  const users = await getBotCollection("users");

  const fail = async (reason: string) => {
    await col.updateOne({ _id: t._id }, { $set: { status: "failed", failReason: reason } });
    throw new StoreError(`${reason} Nothing was traded.`, 409);
  };

  // Both sides still have what's on the table?
  const owned = async (owner: string, items: TradeItem[]) =>
    items.length ? (await inv.countDocuments({ _id: { $in: items.map((i) => new ObjectId(i.docId)) }, discordId: owner })) === items.length : true;
  if (!(await owned(from, give.items))) await fail("They no longer have everything they offered.");
  if (!(await owned(me.discordId, want.items))) await fail("You no longer have everything they asked for.");
  // Anyone receiving leaves needs an economy record to put them in
  const hasWallet = async (who: string) => Boolean(await users.findOne(idFilter(who), { projection: { _id: 1 } }));
  if (give.leaves && !(await hasWallet(me.discordId))) await fail("You need to have used the economy (e.g. claimed a daily) before receiving leaves.");
  if (want.leaves && !(await hasWallet(from))) await fail("They need an economy record before receiving leaves.");

  // Take the leaves from each side (only if they have enough)
  const take = async (who: string, amount: number) => {
    if (!amount) return true;
    const doc = await users.findOne(idFilter(who), { projection: { _id: 1 }, ...BIG });
    if (!doc) return false;
    return (await users.updateOne({ _id: doc._id, balance: { $gte: amount } }, { $inc: { balance: -amount } })).modifiedCount === 1;
  };
  const give_back = async (who: string, amount: number) => {
    if (!amount) return;
    await users.updateOne(idFilter(who), { $inc: { balance: amount } }).catch(() => undefined);
  };
  if (!(await take(from, give.leaves))) await fail("They don't have enough leaves anymore.");
  if (!(await take(me.discordId, want.leaves))) {
    await give_back(from, give.leaves);
    await fail("You don't have enough leaves for this trade.");
  }

  // Move the items both ways; if anything went missing in the meantime, put everything back
  const move = async (items: TradeItem[], owner: string, newOwner: string) => {
    if (!items.length) return 0;
    return (await inv.updateMany({ _id: { $in: items.map((i) => new ObjectId(i.docId)) }, discordId: owner }, { $set: { discordId: newOwner, traded_from: owner, traded_at: now } })).modifiedCount;
  };
  const movedA = await move(give.items, from, me.discordId);
  const movedB = await move(want.items, me.discordId, from);
  if (movedA !== give.items.length || movedB !== want.items.length) {
    const undo = async (items: TradeItem[], wasOwner: string, nowOwner: string) => {
      if (items.length) await inv.updateMany({ _id: { $in: items.map((i) => new ObjectId(i.docId)) }, discordId: nowOwner, traded_at: now }, { $set: { discordId: wasOwner }, $unset: { traded_from: "", traded_at: "" } });
    };
    await undo(give.items, from, me.discordId);
    await undo(want.items, me.discordId, from);
    await give_back(from, give.leaves);
    await give_back(me.discordId, want.leaves);
    await fail("Something changed while the trade was going through.");
  }

  // Pay out the leaves, minus the fee
  const feeA = feeOn(give.leaves);
  const feeB = feeOn(want.leaves);
  if (give.leaves) await users.updateOne(idFilter(me.discordId), { $inc: { balance: give.leaves - feeA } }, { upsert: false });
  if (want.leaves) await users.updateOne(idFilter(from), { $inc: { balance: want.leaves - feeB } }, { upsert: false });
  await col.updateOne({ _id: t._id }, { $set: { status: "accepted", fee: feeA + feeB } });

  // Shop roles that changed hands come off the person who gave them
  const roleItems = async (items: TradeItem[], oldOwner: string) => {
    const roles = items.filter((i) => i.type === "role");
    if (!roles.length) return;
    const docs = await inv.find({ _id: { $in: roles.map((r) => new ObjectId(r.docId)) } }, { projection: { role_id: 1 }, ...BIG }).toArray();
    const theirRoles = new Set((await getMemberRoleIds(oldOwner).catch(() => null)) ?? []);
    for (const d of docs) {
      const roleId = d.role_id ? String(d.role_id) : null;
      if (roleId && theirRoles.has(roleId)) await removeMemberRole(oldOwner, roleId).catch(() => false);
    }
  };
  await roleItems(give.items, from);
  await roleItems(want.items, me.discordId);

  await notify(from, { type: "system", actor: me.discordId, title: `${me.name} accepted your trade!`, body: `You got ${describe(want)}.`, link: "/store?tab=trades" }).catch(() => undefined);
  const who = await people([from, me.discordId]).catch(() => ({}) as Awaited<ReturnType<typeof people>>);
  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: "🔁 Store trade completed",
        color: 0x3e9bff,
        fields: [
          { name: who[from]?.name ?? "Member", value: `<@${from}> gave\n${describe(give).slice(0, 900)}`, inline: true },
          { name: who[me.discordId]?.name ?? "Member", value: `<@${me.discordId}> gave\n${describe(want).slice(0, 900)}`, inline: true },
          ...(feeA + feeB ? [{ name: "Fee", value: seasonal(`${(feeA + feeB).toLocaleString()} leaves`), inline: true }] : []),
        ],
        timestamp: now.toISOString(),
      },
    ],
  }).catch(() => false);
  return { message: `Trade complete! You got ${describe(give)}.` };
}

/** Decline (them) or cancel (you). */
export async function closeTrade(me: { discordId: string; name: string }, id: string, action: "decline" | "cancel") {
  if (!ObjectId.isValid(id)) throw new StoreError("Unknown trade.", 404);
  const col = await trades();
  const t = await col.findOneAndUpdate(
    { _id: new ObjectId(id), status: "pending", ...(action === "decline" ? { to: me.discordId } : { from: me.discordId }) },
    { $set: { status: action === "decline" ? "declined" : "cancelled", decidedAt: new Date() } },
  );
  if (!t) throw new StoreError("That offer isn't open anymore.", 409);
  if (action === "decline") {
    await notify(String(t.from), { type: "system", actor: me.discordId, title: `${me.name} declined your trade`, link: "/store?tab=trades" }).catch(() => undefined);
  }
  return { message: action === "decline" ? "Offer declined." : "Offer cancelled." };
}

/** Their offers: incoming and outgoing that are open, plus recent history. */
export async function myTrades(discordId: string) {
  const col = await trades();
  const rows = await col.find({ $or: [{ from: discordId }, { to: discordId }] }).sort({ createdAt: -1 }).limit(60).toArray();
  const list = rows.map(shape);
  const ids = Array.from(new Set(list.flatMap((t) => [t.from, t.to])));
  const who = await people(ids).catch(() => ({}) as Awaited<ReturnType<typeof people>>);
  return {
    incoming: list.filter((t) => t.status === "pending" && t.to === discordId),
    outgoing: list.filter((t) => t.status === "pending" && t.from === discordId),
    history: list.filter((t) => t.status !== "pending" && t.status !== ("processing" as TradeStatus)).slice(0, 20),
    people: Object.fromEntries(ids.map((id) => [id, { name: who[id]?.name ?? "Member", avatar: who[id]?.avatar ?? null }])),
    fee: TRADE_FEE,
    me: discordId,
  };
}

export async function incomingTradeCount(discordId: string) {
  return (await trades()).countDocuments({ to: discordId, status: "pending", expiresAt: { $gt: new Date() } });
}
