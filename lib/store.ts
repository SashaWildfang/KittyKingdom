// The website store. Mirrors the Discord bot's store (main_bot/store/*.py) and reads/writes the
// same collections in the same shapes, so purchases, inventories, boosters and gifts stay in
// sync between Discord and the website.
//
// Discord ids are 64-bit integers - too big for JS numbers - so every read that can contain an
// id uses `useBigInt64` and every id written to the bot's integer fields is a BSON Long.

import { Long, MongoServerError, type Document } from "mongodb";
import { ITEM, MAX_CUSTOM_BADGES, cleanFlair, cosmeticOf, rarityFor, type CosmeticSlot, type CustomBadge, type CustomTitle, type Flair, type Rarity } from "./cosmetics";
import { getBotCollection, getUsersCollection } from "./mongodb";
import { storeDiscountFromRoles } from "./perks";
import { hasActiveCustomRole } from "./supporter";
import { withTierAliases } from "./tier-roles";
import { SITE_ITEMS, ensureSiteCatalog, inWindow } from "./store-catalog";
import {
  addMemberRole,
  getGuildMember,
  getGuildRoles,
  getMemberRoleIds,
  postChannelMessage,
  removeMemberRole,
  sendDirectMessage,
} from "./discord-member";

export const STACKABLE_CATEGORIES = ["Consumables", "Boosters", "Gifts", "Social"];
export const MAX_BUY_AMOUNT = 50;
const GIFT_COOLDOWN_MS = 5 * 60 * 1000;
const LETTER_MAX_LENGTH = 1000;
const NOTE_MAX_LENGTH = 200;
const BOOSTER_LOG_CHANNEL_ID = "1358485891361804358"; // same channel the bot posts booster redemptions in
const STAFF_LOG_CHANNEL_ID = "1360344042705256660"; // private staff log (gifts)

// Items that no longer exist. Hidden everywhere on the site even if old copies are still in the database.
const RETIRED_ITEM_IDS = ["booster_crab"];
const isRetired = (item: Record<string, unknown>) =>
  RETIRED_ITEM_IDS.includes(String(item.item_id)) || item.retired === true;

// Icon keys the website maps to its icon set (app/ui-icons.tsx)
const ITEM_ICONS: Record<string, string> = {
  booster_xp: "xp",
  booster_profile: "heart",
  booster_balance: "leaf",
  booster_spotlight: "spotlight",
  streak_shield: "shield",
  super_like: "superlike",
  custom_title: "title",
  custom_badge: "badge",
};

const ICON_BY_NAME: [RegExp, string][] = [
  [/latte|coffee/, "coffee"],
  [/rose|bouquet|flower/, "flower"],
  [/chocolate|candy/, "candy"],
  [/teddy|bear|plush/, "paw"],
  [/letter|note/, "mail"],
  [/cookie/, "cookie"],
  [/boba|tea|soda/, "soda"],
  [/cake/, "cake"],
];

const BIG = { useBigInt64: true } as const;
const LIMITED_EDITIONS: Record<string, number> = Object.fromEntries(SITE_ITEMS.filter((i) => i.quantity).map((i) => [i.item_id, i.quantity!]));

export class StoreError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// ---------- helpers ----------
const idString = (value: unknown) => (value === null || value === undefined ? null : String(value));
const num = (value: unknown) => (typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : Number(value ?? 0) || 0);
const toLong = (id: string) => Long.fromString(id);

/** Bot user docs store discordId as an integer (older ones as a string) - match either. */
const discordIdFilter = (discordId: string) => ({ discordId: { $in: [toLong(discordId), discordId] } });

export function iconFor(item: Document) {
  if (ITEM_ICONS[item.item_id]) return ITEM_ICONS[item.item_id];
  const id = String(item.item_id ?? "").toLowerCase();
  for (const [pattern, key] of ICON_BY_NAME) if (pattern.test(id)) return key;
  if (item.type === "booster") return "rocket";
  if (item.type === "cosmetic") return "sparkles";
  if (item.type === "gift") return "gift";
  return null;
}

function isStackable(item: Document) {
  return item.stackable === true || STACKABLE_CATEGORIES.includes(item.category);
}

/** On sale right now: active, and inside its seasonal/limited window if it has one. */
function onSale(item: Document) {
  return Boolean(item.is_active) && !isRetired(item) && inWindow(item as { available_from?: unknown; available_until?: unknown });
}

/** The most of an item one member may hold (null = no cap). */
function maxOwned(item: Document) {
  const n = num(item.max_owned);
  if (n > 0) return n;
  if (item.item_id === ITEM.customBadge) return MAX_CUSTOM_BADGES;
  return null;
}

async function collections() {
  const [storeInventory, storeSales, userInventory, users, shopSettings, boosters, cooldowns, giftLog, datingProfiles] =
    await Promise.all([
      getBotCollection("store_inventory"),
      getBotCollection("store_sales"),
      getBotCollection("user_inventory"),
      getBotCollection("users"),
      getBotCollection("shop_settings"),
      getBotCollection("temporary_boosters"),
      getBotCollection("gift_cooldowns"),
      getBotCollection("gift_log"),
      getBotCollection("dating_profiles"),
    ]);
  return { storeInventory, storeSales, userInventory, users, shopSettings, boosters, cooldowns, giftLog, datingProfiles };
}

async function getBalanceDoc(discordId: string) {
  const { users } = await collections();
  return users.findOne(discordIdFilter(discordId), { projection: { balance: 1 }, ...BIG });
}

async function boughtInLast24h(discordId: string, itemIds: string[]) {
  const { storeSales } = await collections();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const counts = new Map<string, number>();
  if (!itemIds.length) return counts;
  const sales = await storeSales.find({ buyerId: discordId, item_id: { $in: itemIds }, timestamp: { $gte: since } }).toArray();
  for (const sale of sales) counts.set(sale.item_id, (counts.get(sale.item_id) ?? 0) + (num(sale.quantity) || 1));
  return counts;
}

// ==========================================
// STATE
// ==========================================
export type StoreItem = {
  itemId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number | null; // null = unlimited
  rotation: "daily" | "weekly" | "permanent";
  type: string;
  icon: string | null;
  imageUrl: string | null;
  roleId: string | null;
  roleColors: string[];
  stackable: boolean;
  dailyLimit: number | null;
  boughtToday: number;
  owned: number;
  equipped: boolean;
  requiresMessage: boolean;
  rarity: Rarity;
  /** The cosmetic it applies (frames, banners, name effects) */
  cosmetic: { slot: CosmeticSlot; key: string } | null;
  /** Seasonal and limited items: when they leave the store */
  availableUntil: string | null;
  season: string | null;
  /** Limited items: how many were ever made */
  edition: number | null;
  maxOwned: number | null;
  isNew: boolean;
};

export type InventoryEntry = {
  itemId: string;
  name: string;
  description: string;
  type: string;
  icon: string | null;
  count: number;
  roleId: string | null;
  roleColors: string[];
  equipped: boolean;
  durationSeconds: number | null;
  giftedCount: number;
  requiresMessage: boolean;
  rarity: Rarity;
  cosmetic: { slot: CosmeticSlot; key: string } | null;
  /** Custom badges: each one they own, and its design (null until designed) */
  badges?: { id: string; design: CustomBadge | null }[];
};

export type ActiveBooster = { itemId: string; name: string; icon: string | null; endsAt: string };

export type StoreState = {
  balance: number;
  items: StoreItem[];
  inventory: InventoryEntry[];
  boosters: ActiveBooster[];
  nextDaily: string | null;
  nextWeekly: string | null;
  giftCooldownEndsAt: string | null;
  inServer: boolean;
  serverTime: string;
  /** What they've equipped and set up with perks */
  flair: Flair;
  customTitle: CustomTitle | null;
  shields: number;
  superLikes: number;
  /** Their name and avatar, for "try it on" previews */
  me: { name: string; avatar: string | null };
};

export async function getStoreState(discordId: string): Promise<StoreState> {
  await ensureSiteCatalog();
  const c = await collections();
  const now = new Date();
  const [activeItems, allRoleItems, timers, balanceDoc, invDocs, boosterDocs, memberRoles, guildRoles, cooldown] = await Promise.all([
    c.storeInventory.find({ is_active: true, quantity: { $ne: 0 }, item_id: { $nin: RETIRED_ITEM_IDS }, retired: { $ne: true } }, BIG).toArray(),
    c.storeInventory.find({ role_id: { $ne: null } }, { projection: { item_id: 1, role_id: 1, requires_message: 1 }, ...BIG }).toArray(),
    c.shopSettings.findOne({ _id: "rotation_timers" as never }),
    getBalanceDoc(discordId),
    c.userInventory.find({ discordId, item_id: { $nin: RETIRED_ITEM_IDS } }, BIG).toArray(),
    c.boosters.find({ discordId, end_time: { $gt: now }, item_id: { $nin: RETIRED_ITEM_IDS } }).toArray(),
    getMemberRoleIds(discordId),
    getGuildRoles(),
    c.cooldowns.findOne({ _id: toLong(discordId) as never }),
  ]);
  const [account, member] = await Promise.all([
    getUsersCollection().then((u) => u.findOne({ discordId }, { projection: { cosmetics: 1, customTitle: 1, displayName: 1, username: 1 } })).catch(() => null),
    getGuildMember(discordId).catch(() => null),
  ]);
  const saleItems = activeItems.filter((i) => inWindow(i as { available_from?: unknown; available_until?: unknown }));

  const memberRoleSet = new Set(memberRoles ?? []);
  const ownedCounts = new Map<string, number>();
  for (const doc of invDocs) ownedCounts.set(doc.item_id, (ownedCounts.get(doc.item_id) ?? 0) + 1);
  const limited = saleItems.filter((i) => num(i.daily_limit) > 0).map((i) => i.item_id as string);
  const today = await boughtInLast24h(discordId, limited);
  const roleIdByItem = new Map(allRoleItems.map((i) => [i.item_id as string, idString(i.role_id)]));

  const items: StoreItem[] = saleItems.map((item) => {
    const roleId = idString(item.role_id);
    const stock = num(item.quantity);
    const created = item.created_at instanceof Date ? item.created_at.getTime() : 0;
    return {
      itemId: item.item_id,
      name: item.name,
      description: item.description ?? "",
      category: item.category ?? "Misc",
      price: num(item.price),
      stock: stock < 0 ? null : stock,
      rotation: ["daily", "weekly"].includes(item.rotation_type) ? item.rotation_type : "permanent",
      type: item.type ?? "role",
      icon: iconFor(item),
      imageUrl: item.image_url || null,
      roleId,
      roleColors: roleId ? guildRoles.get(roleId)?.colors ?? [] : [],
      stackable: isStackable(item),
      dailyLimit: num(item.daily_limit) || null,
      boughtToday: today.get(item.item_id) ?? 0,
      owned: ownedCounts.get(item.item_id) ?? 0,
      equipped: roleId ? memberRoleSet.has(roleId) : false,
      requiresMessage: Boolean(item.requires_message),
      rarity: rarityFor(num(item.price), item.rarity),
      cosmetic: cosmeticOf(String(item.item_id)),
      availableUntil: item.available_until instanceof Date ? item.available_until.toISOString() : null,
      season: typeof item.season === "string" ? item.season : null,
      edition: item.rotation_type === "limited" ? num(siteEdition(String(item.item_id))) || null : null,
      maxOwned: maxOwned(item),
      isNew: created > 0 && now.getTime() - created < 7 * 86_400_000,
    };
  });

  // Inventory, grouped by item (roles bought before they rotated out still show up)
  const grouped = new Map<string, InventoryEntry>();
  for (const doc of invDocs) {
    const existing = grouped.get(doc.item_id);
    if (existing) {
      existing.count += 1;
      if (doc.gifted_by) existing.giftedCount += 1;
      existing.badges?.push({ id: String(doc._id), design: badgeDesign(doc) });
      continue;
    }
    const roleId = idString(doc.role_id) ?? roleIdByItem.get(doc.item_id) ?? null;
    const storeItem = activeItems.find((i) => i.item_id === doc.item_id) ?? allRoleItems.find((i) => i.item_id === doc.item_id);
    grouped.set(doc.item_id, {
      itemId: doc.item_id,
      name: doc.name ?? doc.item_id,
      description: doc.description ?? "",
      type: doc.type ?? "role",
      icon: iconFor({ ...doc, ...(storeItem ?? {}) }),
      count: 1,
      roleId,
      roleColors: roleId ? guildRoles.get(roleId)?.colors ?? [] : [],
      equipped: roleId ? memberRoleSet.has(roleId) : false,
      durationSeconds: num((storeItem as { duration?: unknown } | undefined)?.duration) || (doc.duration ? num(doc.duration) : null),
      giftedCount: doc.gifted_by ? 1 : 0,
      requiresMessage: Boolean(storeItem?.requires_message),
      rarity: rarityFor(num(storeItem?.price ?? doc.price), storeItem?.rarity),
      cosmetic: cosmeticOf(String(doc.item_id)),
      badges: doc.item_id === ITEM.customBadge ? [{ id: String(doc._id), design: badgeDesign(doc) }] : undefined,
    });
  }

  const cooldownEnd = cooldown?.next_gift_at instanceof Date && cooldown.next_gift_at > now ? cooldown.next_gift_at : null;
  return {
    balance: num(balanceDoc?.balance),
    items,
    inventory: Array.from(grouped.values()),
    boosters: boosterDocs.map((b) => ({
      itemId: b.item_id,
      name: b.item_name ?? b.item_id,
      icon: ITEM_ICONS[b.item_id] ?? "rocket",
      endsAt: (b.end_time as Date).toISOString(),
    })),
    nextDaily: timers?.next_daily instanceof Date ? timers.next_daily.toISOString() : null,
    nextWeekly: timers?.next_weekly instanceof Date ? timers.next_weekly.toISOString() : null,
    giftCooldownEndsAt: cooldownEnd ? cooldownEnd.toISOString() : null,
    inServer: memberRoles !== null,
    serverTime: now.toISOString(),
    flair: cleanFlair(account?.cosmetics),
    customTitle: account?.customTitle?.text ? { text: String(account.customTitle.text), hue: String(account.customTitle.hue ?? "#f59b2a") } : null,
    shields: ownedCounts.get(ITEM.shield) ?? 0,
    superLikes: ownedCounts.get(ITEM.superLike) ?? 0,
    me: {
      name: String(account?.displayName || member?.displayName || member?.username || account?.username || "You"),
      avatar: member?.avatar?.replace("size=64", "size=256") ?? `/api/discord/avatar/${discordId}`,
    },
  };
}

function badgeDesign(doc: Document): CustomBadge | null {
  const c = doc.custom as Record<string, unknown> | undefined;
  if (!c || typeof c.name !== "string") return null;
  return { id: String(doc._id), name: c.name, desc: String(c.desc ?? ""), icon: String(c.icon ?? "Star"), shape: String(c.shape ?? "circle"), hue: String(c.hue ?? "#f59b2a") };
}

/** How many of a limited website item were made (from the website catalog). */
function siteEdition(itemId: string) {
  return LIMITED_EDITIONS[itemId] ?? 0;
}

// ==========================================
// BUY (same rules as the bot's /store buy)
// ==========================================
export async function buyItem(discordId: string, itemId: string, amount: number) {
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_BUY_AMOUNT) {
    throw new StoreError(`You can buy between 1 and ${MAX_BUY_AMOUNT} at a time.`);
  }
  const c = await collections();
  const item = await c.storeInventory.findOne({ item_id: itemId }, BIG);
  if (!item || !onSale(item)) throw new StoreError("That item isn't in the store right now.");
  const stock = num(item.quantity);
  if (stock === 0) throw new StoreError("That item is out of stock.");
  const cap = maxOwned(item);
  if (cap !== null) {
    const have = await c.userInventory.countDocuments({ discordId, item_id: itemId });
    if (have + amount > cap) throw new StoreError(have >= cap ? `You can hold up to ${cap} of ${item.name}.` : `You can only hold ${cap - have} more ${item.name}.`);
  }

  if (!isStackable(item)) {
    if (amount > 1) throw new StoreError("You can only buy one of this item.");
    if (await c.userInventory.findOne({ discordId, item_id: itemId })) throw new StoreError("You already own this item!");
  }
  if (stock > 0 && amount > stock) throw new StoreError(`Only ${stock} left in stock.`);

  const dailyLimit = num(item.daily_limit);
  if (dailyLimit > 0) {
    const bought = (await boughtInLast24h(discordId, [itemId])).get(itemId) ?? 0;
    if (bought + amount > dailyLimit) {
      const left = Math.max(dailyLimit - bought, 0);
      throw new StoreError(left === 0
        ? `You've reached the daily limit of ${dailyLimit} for this item.`
        : `This item has a daily limit of ${dailyLimit} — you can buy ${left} more today.`);
    }
  }

  const discount = await supporterDiscount(discordId);
  const total = Math.floor(num(item.price) * amount * (1 - discount));
  const balanceDoc = await getBalanceDoc(discordId);
  if (!balanceDoc || num(balanceDoc.balance) < total) {
    throw new StoreError(`You need ${total.toLocaleString()} leaves for this.`);
  }

  // Take stock first (atomic, so two buyers can't both get the last copies)
  if (stock > 0) {
    const taken = await c.storeInventory.updateOne({ item_id: itemId, quantity: { $gte: amount } }, { $inc: { quantity: -amount } });
    if (taken.modifiedCount === 0) throw new StoreError("There isn't enough stock left for this purchase.");
  }
  // Charge in the same step as the balance check
  const charged = await c.users.updateOne({ _id: balanceDoc._id, balance: { $gte: total } }, { $inc: { balance: -total } });
  if (charged.modifiedCount === 0) {
    if (stock > 0) await c.storeInventory.updateOne({ item_id: itemId }, { $inc: { quantity: amount } });
    throw new StoreError("You no longer have enough leaves for this purchase.");
  }

  const now = new Date();
  await c.userInventory.insertMany(Array.from({ length: amount }, () => ({
    discordId,
    item_id: itemId,
    name: item.name,
    description: item.description ?? "No description provided.",
    image_url: item.image_url ?? "",
    role_id: item.role_id ?? null, // kept as the bot's 64-bit integer
    type: item.type ?? "role",
    duration: item.duration ?? null,
    purchasedAt: now,
  })));
  await c.storeSales.insertOne({ buyerId: discordId, item_id: itemId, quantity: amount, price_paid: total, timestamp: now, source: "website" });
  return { message: `Bought ${amount > 1 ? `${amount}× ` : ""}${item.name}!` };
}

// ==========================================
// CHECKOUT: a whole cart in one go
// ==========================================
export const MAX_CART_LINES = 15;

/**
 * Buys every line in the cart, or nothing: each item gets the same checks as a single purchase
 * (in the store, stock, one-per-person, daily limits), then stock is taken, the total charged once
 * and the items handed out. If any step fails, anything already taken is put back.
 */
export async function checkout(discordId: string, rawLines: unknown) {
  const discount = await supporterDiscount(discordId);
  if (!Array.isArray(rawLines) || !rawLines.length) throw new StoreError("Your cart is empty.");
  // Same item twice = one line
  const wanted = new Map<string, number>();
  for (const line of rawLines.slice(0, 50)) {
    const itemId = String((line as { itemId?: unknown })?.itemId ?? "").slice(0, 80);
    const amount = Number((line as { amount?: unknown })?.amount ?? 1);
    if (!itemId || !Number.isInteger(amount) || amount < 1) throw new StoreError("Something in your cart isn't right. Refresh and try again.");
    wanted.set(itemId, (wanted.get(itemId) ?? 0) + amount);
  }
  if (wanted.size > MAX_CART_LINES) throw new StoreError(`You can check out up to ${MAX_CART_LINES} different items at once.`);

  const c = await collections();
  const ids = Array.from(wanted.keys());
  const items = await c.storeInventory.find({ item_id: { $in: ids } }, BIG).toArray();
  const byId = new Map(items.map((i) => [String(i.item_id), i]));
  const bought = await boughtInLast24h(discordId, ids);
  const lines: { item: Document; itemId: string; amount: number; stock: number; cost: number }[] = [];
  for (const [itemId, amount] of Array.from(wanted.entries())) {
    const item = byId.get(itemId);
    if (!item || !onSale(item)) throw new StoreError("Something in your cart isn't in the store anymore. Remove it and try again.");
    const name = String(item.name ?? itemId);
    const cap = maxOwned(item);
    if (cap !== null && (await c.userInventory.countDocuments({ discordId, item_id: itemId })) + amount > cap) throw new StoreError(`You can hold up to ${cap} of ${name}.`);
    if (amount > MAX_BUY_AMOUNT) throw new StoreError(`You can buy up to ${MAX_BUY_AMOUNT} of ${name} at a time.`);
    const stock = num(item.quantity);
    if (stock === 0) throw new StoreError(`${name} is out of stock.`);
    if (!isStackable(item)) {
      if (amount > 1) throw new StoreError(`You can only buy one ${name}.`);
      if (await c.userInventory.findOne({ discordId, item_id: itemId })) throw new StoreError(`You already own ${name}.`);
    }
    if (stock > 0 && amount > stock) throw new StoreError(`Only ${stock} ${name} left in stock.`);
    const dailyLimit = num(item.daily_limit);
    if (dailyLimit > 0 && (bought.get(itemId) ?? 0) + amount > dailyLimit) {
      const left = Math.max(dailyLimit - (bought.get(itemId) ?? 0), 0);
      throw new StoreError(left === 0 ? `You've reached today's limit for ${name}.` : `You can buy ${left} more ${name} today.`);
    }
    lines.push({ item, itemId, amount, stock, cost: Math.floor(num(item.price) * amount * (1 - discount)) });
  }

  const total = lines.reduce((n, l) => n + l.cost, 0);
  const balanceDoc = await getBalanceDoc(discordId);
  if (!balanceDoc || num(balanceDoc.balance) < total) throw new StoreError(`You need ${total.toLocaleString()} leaves for this cart.`);

  // Take stock for every limited item; put it all back if any is gone
  const taken: { itemId: string; amount: number }[] = [];
  const putBack = async () => {
    for (const t of taken) await c.storeInventory.updateOne({ item_id: t.itemId }, { $inc: { quantity: t.amount } }).catch(() => undefined);
  };
  for (const l of lines) {
    if (l.stock <= 0) continue;
    const res = await c.storeInventory.updateOne({ item_id: l.itemId, quantity: { $gte: l.amount } }, { $inc: { quantity: -l.amount } });
    if (!res.modifiedCount) {
      await putBack();
      throw new StoreError(`${String(l.item.name ?? l.itemId)} just sold out. Nothing was charged.`);
    }
    taken.push({ itemId: l.itemId, amount: l.amount });
  }
  // One charge for the whole cart, in the same step as the balance check
  const charged = await c.users.updateOne({ _id: balanceDoc._id, balance: { $gte: total } }, { $inc: { balance: -total } });
  if (!charged.modifiedCount) {
    await putBack();
    throw new StoreError("You no longer have enough leaves for this cart. Nothing was charged.");
  }

  const now = new Date();
  await c.userInventory.insertMany(
    lines.flatMap((l) =>
      Array.from({ length: l.amount }, () => ({
        discordId,
        item_id: l.itemId,
        name: l.item.name,
        description: l.item.description ?? "No description provided.",
        image_url: l.item.image_url ?? "",
        role_id: l.item.role_id ?? null,
        type: l.item.type ?? "role",
        duration: l.item.duration ?? null,
        purchasedAt: now,
      })),
    ),
  );
  await c.storeSales.insertMany(lines.map((l) => ({ buyerId: discordId, item_id: l.itemId, quantity: l.amount, price_paid: l.cost, timestamp: now, source: "website-cart" })));
  const count = lines.reduce((n, l) => n + l.amount, 0);
  return { message: `Checked out ${count} item${count === 1 ? "" : "s"} for ${total.toLocaleString()} leaves!`, total };
}

// ==========================================
// USE A BOOSTER (same as /inventory use)
// ==========================================
export async function activateItem(discordId: string, itemId: string) {
  const c = await collections();
  const owned = await c.userInventory.findOne({ discordId, item_id: itemId }, BIG);
  if (!owned || RETIRED_ITEM_IDS.includes(itemId)) throw new StoreError("You don't own that item anymore.");
  if (owned.type === "gift") throw new StoreError("Gifts are meant to be given! Use Send gift instead.");
  if (itemId === ITEM.shield) throw new StoreError("Streak Shields work on their own: one is used automatically if you miss a day.");
  if (itemId === ITEM.superLike) throw new StoreError("Use Super Likes from someone's Social profile.");
  if (owned.type !== "booster") throw new StoreError("That item can't be used.");

  if (itemId === "booster_profile" || itemId === ITEM.spotlight) {
    const profile = await c.datingProfiles.findOne({ _id: { $in: [toLong(discordId), discordId] } as never });
    if (!profile) throw new StoreError("You need a Social profile before using a Profile Booster. Make one in Social on the website.");
  }

  // Consume the item first so a double-click can't use one item twice
  const removed = await c.userInventory.deleteOne({ _id: owned._id });
  if (removed.deletedCount === 0) throw new StoreError("You don't own that item anymore.");

  const now = new Date();
  // The catalog's current duration wins (items bought earlier kept an old copy of it)
  const catalog = await c.storeInventory.findOne({ item_id: itemId }, { projection: { duration: 1 } });
  const seconds = num(catalog?.duration) || num(owned.duration) || 86400;
  const active = await c.boosters.findOne({ discordId, item_id: itemId });
  let endsAt: Date;
  if (active && active.end_time instanceof Date && active.end_time > now) {
    endsAt = new Date(active.end_time.getTime() + seconds * 1000);
    await c.boosters.updateOne({ _id: active._id }, { $set: { end_time: endsAt } });
  } else {
    endsAt = new Date(now.getTime() + seconds * 1000);
    await c.boosters.insertOne({ discordId, item_id: itemId, item_name: owned.name, start_time: now, end_time: endsAt, duration: seconds });
  }

  await postChannelMessage(
    BOOSTER_LOG_CHANNEL_ID,
    { content: `🔥 <@${discordId}>, you redeemed a personal **${owned.name}** on the website! Active until <t:${Math.floor(endsAt.getTime() / 1000)}:f>.` },
    [discordId],
  );
  return { message: `${owned.name} activated!`, endsAt: endsAt.toISOString() };
}

// ==========================================
// EQUIP / UNEQUIP ROLES (same as /inventory equip)
// ==========================================
async function ownedRoleId(discordId: string, itemId: string) {
  const c = await collections();
  const owned = await c.userInventory.findOne({ discordId, item_id: itemId }, BIG);
  const roleId = idString(owned?.role_id) ??
    idString((await c.storeInventory.findOne({ item_id: itemId }, { projection: { role_id: 1 }, ...BIG }))?.role_id);
  if (!owned || !roleId || (owned.type && owned.type !== "role")) throw new StoreError("You don't own that role.");
  return roleId;
}

/** Every color role the shop has, and whether it's for sale right now. */
export async function getShopColorRoles() {
  const c = await collections();
  const docs = await c.storeInventory
    .find({ role_id: { $ne: null }, item_id: { $nin: RETIRED_ITEM_IDS }, retired: { $ne: true } }, BIG)
    .sort({ name: 1 })
    .toArray();
  return docs.map((d) => ({
    itemId: String(d.item_id),
    name: String(d.name ?? d.item_id),
    roleId: idString(d.role_id) ?? "",
    price: num(d.price),
    inShop: Boolean(d.is_active) && num(d.quantity) !== 0,
    rotation: ["daily", "weekly"].includes(d.rotation_type) ? (d.rotation_type as string) : "permanent",
  }));
}

/** How many color roles the shop has in total (for "3/57 unlocked"). */
export async function countShopColorRoles() {
  const c = await collections();
  return c.storeInventory.countDocuments({ role_id: { $ne: null }, item_id: { $nin: RETIRED_ITEM_IDS }, retired: { $ne: true } });
}

/** Shop color roles the member owns (for the role manager on My Account). */
export async function getOwnedColorRoles(discordId: string) {
  const c = await collections();
  const docs = await c.userInventory
    .find({ discordId, role_id: { $ne: null }, item_id: { $nin: RETIRED_ITEM_IDS } }, BIG)
    .toArray();
  const byItem = new Map<string, { itemId: string; name: string; roleId: string }>();
  for (const doc of docs) {
    const roleId = idString(doc.role_id);
    if (roleId && !byItem.has(doc.item_id)) byItem.set(doc.item_id, { itemId: doc.item_id, name: String(doc.name ?? doc.item_id), roleId });
  }
  return Array.from(byItem.values());
}

export async function equipRole(discordId: string, itemId: string) {
  const roleId = await ownedRoleId(discordId, itemId);
  // A Patreon custom role is your color: shop color roles stay in your inventory but can't be worn with it
  if (await hasActiveCustomRole(discordId)) {
    throw new StoreError("Your Patreon custom role is your color now, so shop color roles can't be equipped with it. Remove your custom role on My Account → Supporter perks (or /myrole remove) to wear this one.");
  }
  const memberRoles = await getMemberRoleIds(discordId);
  if (!memberRoles) throw new StoreError("You need to be in the Kitty Kingdom Discord server to equip roles.");
  if (memberRoles.includes(roleId)) throw new StoreError("That role is already equipped.");

  // Only one shop role at a time, like the bot
  const c = await collections();
  const shopRoles = new Set(
    (await c.storeInventory.find({ role_id: { $ne: null } }, { projection: { role_id: 1 }, ...BIG }).toArray())
      .map((i) => idString(i.role_id))
      .filter((id): id is string => Boolean(id)),
  );
  for (const current of memberRoles) {
    if (shopRoles.has(current)) await removeMemberRole(discordId, current);
  }
  if (!(await addMemberRole(discordId, roleId))) {
    throw new StoreError("The bot couldn't give you that role. Please contact staff.", 502);
  }
  return { message: "Role equipped!" };
}

export async function unequipRole(discordId: string, itemId: string) {
  const roleId = await ownedRoleId(discordId, itemId);
  const memberRoles = await getMemberRoleIds(discordId);
  if (!memberRoles) throw new StoreError("You need to be in the Kitty Kingdom Discord server to manage roles.");
  if (!memberRoles.includes(roleId)) throw new StoreError("That role isn't equipped.");
  if (!(await removeMemberRole(discordId, roleId))) {
    throw new StoreError("The bot couldn't remove that role. Please contact staff.", 502);
  }
  return { message: "Role unequipped." };
}

// ==========================================
// GIFTS (same as /gift)
// ==========================================
export async function giftItem(
  sender: { discordId: string; name: string },
  recipientId: string,
  itemId: string,
  rawMessage: string,
) {
  const c = await collections();
  const item = await c.storeInventory.findOne({ item_id: itemId }, BIG);
  if (!item || item.type !== "gift") throw new StoreError("That isn't a giftable item.");
  if (recipientId === sender.discordId) throw new StoreError("You can't gift yourself!");
  // Look the recipient up on Discord ourselves - never trust names/bot flags sent by the browser
  const recipient = await getGuildMember(recipientId);
  if (!recipient) throw new StoreError("That member isn't in the server.");
  if (recipient.bot) throw new StoreError("You can't send gifts to bots!");

  const message = rawMessage.trim().replace(/`/g, "'") || null;
  const limit = item.requires_message ? LETTER_MAX_LENGTH : NOTE_MAX_LENGTH;
  if (item.requires_message && !message) throw new StoreError("Write your letter first!");
  if (message && message.length > limit) throw new StoreError(`Your message is too long (${message.length}/${limit}).`);
  if (!(await c.userInventory.findOne({ discordId: sender.discordId, item_id: itemId }))) {
    throw new StoreError(`You don't have a ${item.name} to give.`);
  }

  // Claim the shared 5-minute cooldown atomically (same doc the bot uses)
  const now = new Date();
  try {
    await c.cooldowns.updateOne(
      { _id: toLong(sender.discordId) as never, next_gift_at: { $lte: now } },
      { $set: { next_gift_at: new Date(now.getTime() + GIFT_COOLDOWN_MS) } },
      { upsert: true },
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new StoreError("You're sending gifts too fast! Wait for the cooldown to finish.", 429);
    }
    throw error;
  }

  const moved = await c.userInventory.findOneAndUpdate(
    { discordId: sender.discordId, item_id: itemId },
    { $set: { discordId: recipient.id, gifted_by: sender.discordId, gifted_at: now, gift_message: message } },
    { sort: { purchasedAt: 1 } },
  );
  if (!moved) {
    await c.cooldowns.updateOne({ _id: toLong(sender.discordId) as never }, { $set: { next_gift_at: now } });
    throw new StoreError(`You no longer have a ${item.name} to give.`);
  }

  await c.giftLog.insertOne({
    sender_id: sender.discordId, recipient_id: recipient.id, item_id: itemId, message, channel_id: null,
    source: "website", timestamp: now,
  });

  const color = parseInt(String(item.color ?? "#ff7eb9").replace("#", ""), 16) || 0xff7eb9;
  const description = String(item.gift_text ?? `{sender} sent {recipient} a **${item.name}**!`)
    .replace("{sender}", `<@${sender.discordId}>`).replace("{recipient}", `<@${recipient.id}>`);
  const fields = message
    ? [{ name: item.requires_message ? "💌 The letter reads..." : "📝 Note", value: `>>> ${message}` }]
    : [];

  await sendDirectMessage(recipient.id, {
    embeds: [{
      title: `${item.emoji ?? "🎁"} You got a gift!`,
      description, color, fields,
      footer: { text: `From ${sender.name} • It's been added to your /inventory` },
      timestamp: now.toISOString(),
    }],
  });
  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [{
      title: `${item.emoji ?? "🎁"} Gift Sent • ${item.name}`,
      color,
      fields: [
        { name: "From", value: `<@${sender.discordId}>\n\`${sender.discordId}\``, inline: true },
        { name: "To", value: `<@${recipient.id}>\n\`${recipient.id}\``, inline: true },
        { name: "Channel", value: "🌐 Website", inline: true },
        ...(message ? [{ name: item.requires_message ? "💌 Letter" : "📝 Note", value: message.slice(0, 1024) }] : []),
      ],
      footer: { text: `Item ID: ${itemId}` },
      timestamp: now.toISOString(),
    }],
  });
  return { message: `${item.name} sent to ${recipient.displayName}!` };
}

// ==========================================
// ADMIN: view and edit a member's inventory (like /inventoryadmin in Discord)
// ==========================================
export async function adminInventory(discordId: string) {
  const c = await collections();
  const [docs, catalog, memberRoles] = await Promise.all([
    c.userInventory.find({ discordId }, BIG).sort({ purchasedAt: 1 }).toArray(),
    c.storeInventory.find({ item_id: { $nin: RETIRED_ITEM_IDS }, retired: { $ne: true } }, BIG).sort({ name: 1 }).toArray(),
    getMemberRoleIds(discordId),
  ]);
  const grouped = new Map<string, { itemId: string; name: string; type: string; icon: string | null; count: number; gifted: number; roleId: string | null; equipped: boolean; oldest: string | null }>();
  for (const doc of docs) {
    const roleId = idString(doc.role_id);
    const entry = grouped.get(doc.item_id) ?? {
      itemId: String(doc.item_id),
      name: String(doc.name ?? doc.item_id),
      type: String(doc.type ?? "role"),
      icon: iconFor(doc),
      count: 0,
      gifted: 0,
      roleId,
      equipped: roleId ? Boolean(memberRoles?.includes(roleId)) : false,
      oldest: doc.purchasedAt instanceof Date ? doc.purchasedAt.toISOString() : null,
    };
    entry.count += 1;
    if (doc.gifted_by) entry.gifted += 1;
    grouped.set(doc.item_id, entry);
  }
  return {
    items: Array.from(grouped.values()).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)),
    catalog: catalog.map((i) => ({ itemId: String(i.item_id), name: String(i.name ?? i.item_id), type: String(i.type ?? "role"), icon: iconFor(i), stackable: isStackable(i) })),
  };
}

/** Sets how many of an item a member has (adds or removes copies). Returns what changed. */
export async function adminSetInventory(discordId: string, itemId: string, wanted: number) {
  if (!Number.isInteger(wanted) || wanted < 0 || wanted > 500) throw new StoreError("Pick an amount from 0 to 500.");
  const c = await collections();
  const item = await c.storeInventory.findOne({ item_id: itemId }, BIG);
  const existing = await c.userInventory.find({ discordId, item_id: itemId }, BIG).sort({ purchasedAt: 1 }).toArray();
  if (!item && !existing.length) throw new StoreError("That item doesn't exist.");
  if (item && !isStackable(item) && wanted > 1) throw new StoreError("Members can only hold one of this item.");

  const diff = wanted - existing.length;
  if (diff > 0) {
    const source = item ?? existing[0];
    const now = new Date();
    await c.userInventory.insertMany(
      Array.from({ length: diff }, () => ({
        discordId,
        item_id: itemId,
        name: source.name,
        description: source.description ?? "No description provided.",
        image_url: source.image_url ?? "",
        role_id: source.role_id ?? null,
        type: source.type ?? "role",
        duration: source.duration ?? null,
        purchasedAt: now,
        granted_by_staff: true,
      })),
    );
  } else if (diff < 0) {
    // Newest copies go first, so gifts and older purchases stay put where possible
    const remove = existing.slice(diff).map((d) => d._id);
    await c.userInventory.deleteMany({ _id: { $in: remove } });
    // Taking away a member's last copy of an equipped role also takes the role off them in Discord
    const roleId = idString((item ?? existing[0]).role_id);
    if (wanted === 0 && roleId) await removeMemberRole(discordId, roleId).catch(() => false);
  }
  return { name: String((item ?? existing[0]).name ?? itemId), before: existing.length, after: wanted };
}

/** Patreon supporters get a Store discount (5% / 10% / 15% by tier, lib/perks.ts). */
export async function supporterDiscount(discordId: string) {
  const roles = await withTierAliases(await getMemberRoleIds(discordId).catch(() => null));
  return storeDiscountFromRoles(roles);
}
