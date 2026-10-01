// What store perks do: equipping cosmetics, custom titles and custom badges, and loading a
// member's extras for their profile card and Social profile.
//
//   website users.cosmetics   { frame, banner, nameplate }   cosmetic keys they equipped
//   website users.customTitle { text, hue }                  needs the Custom Title item
//   zeo_bot.user_inventory    custom_badge docs carry { custom: { name, desc, icon, shape, hue } }
// Anything equipped only counts while they still own the item (it can be traded or wiped).

import { ObjectId, type Document } from "mongodb";
import {
  BADGE_HUES,
  BADGE_ICONS,
  BADGE_SHAPES,
  COSMETICS,
  ITEM,
  NO_EXTRAS,
  TITLE_HUES,
  cleanFlair,
  type CosmeticSlot,
  type CustomBadge,
  type CustomTitle,
  type Flair,
  type ProfileExtras,
} from "./cosmetics";
import { getBotCollection, getUsersCollection } from "./mongodb";
import { checkText } from "./spam-check";

export class PerkError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const SLOTS: CosmeticSlot[] = ["frame", "banner", "nameplate"];
const COSMETIC_IDS = Object.keys(COSMETICS);

function cleanBadge(id: string, raw: unknown): CustomBadge | null {
  const c = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!c || typeof c.name !== "string" || !c.name) return null;
  return {
    id,
    name: c.name.slice(0, 24),
    desc: typeof c.desc === "string" ? c.desc.slice(0, 80) : "",
    icon: BADGE_ICONS.includes(String(c.icon)) ? String(c.icon) : "Star",
    shape: BADGE_SHAPES.includes(String(c.shape)) ? String(c.shape) : "circle",
    hue: BADGE_HUES.includes(String(c.hue)) ? String(c.hue) : BADGE_HUES[0],
  };
}

function cleanTitle(raw: unknown): CustomTitle | null {
  const t = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!t || typeof t.text !== "string" || !t.text.trim()) return null;
  return { text: t.text.trim().slice(0, 24), hue: TITLE_HUES.includes(String(t.hue)) ? String(t.hue) : TITLE_HUES[0] };
}

/** Profile extras for many members at once (only what they still own counts). */
export async function profileExtrasMany(discordIds: string[]): Promise<Map<string, ProfileExtras>> {
  const ids = Array.from(new Set(discordIds.filter((id) => /^\d{15,21}$/.test(id))));
  const out = new Map<string, ProfileExtras>();
  if (!ids.length) return out;
  const [accounts, owned] = await Promise.all([
    (await getUsersCollection())
      .find({ discordId: { $in: ids }, $or: [{ cosmetics: { $exists: true } }, { customTitle: { $exists: true } }] } as Document, { projection: { discordId: 1, cosmetics: 1, customTitle: 1 } })
      .toArray(),
    (await getBotCollection("user_inventory"))
      .find({ discordId: { $in: ids }, item_id: { $in: [...COSMETIC_IDS, ITEM.customTitle, ITEM.customBadge] } }, { projection: { discordId: 1, item_id: 1, custom: 1 } })
      .toArray(),
  ]);
  const ownedBy = new Map<string, Set<string>>();
  const badges = new Map<string, CustomBadge[]>();
  for (const d of owned) {
    const id = String(d.discordId);
    (ownedBy.get(id) ?? ownedBy.set(id, new Set()).get(id)!).add(String(d.item_id));
    if (d.item_id === ITEM.customBadge) {
      const b = cleanBadge(String(d._id), d.custom);
      if (b) (badges.get(id) ?? badges.set(id, []).get(id)!).push(b);
    }
  }
  for (const id of ids) {
    const account = accounts.find((a) => String(a.discordId) === id);
    const mine = ownedBy.get(id) ?? new Set<string>();
    const raw = cleanFlair(account?.cosmetics);
    const flair: Flair = { frame: null, banner: null, nameplate: null };
    for (const slot of SLOTS) {
      const key = raw[slot];
      const itemId = key ? COSMETIC_IDS.find((i) => COSMETICS[i].slot === slot && COSMETICS[i].key === key) : null;
      if (itemId && mine.has(itemId)) flair[slot] = key;
    }
    const customTitle = mine.has(ITEM.customTitle) ? cleanTitle(account?.customTitle) : null;
    const customBadges = (badges.get(id) ?? []).slice(0, 3);
    if (flair.frame || flair.banner || flair.nameplate || customTitle || customBadges.length) out.set(id, { flair, customTitle, customBadges });
  }
  return out;
}

export async function profileExtras(discordId: string | null | undefined): Promise<ProfileExtras> {
  if (!discordId) return NO_EXTRAS;
  return (await profileExtrasMany([String(discordId)]).catch(() => null))?.get(String(discordId)) ?? NO_EXTRAS;
}

async function owns(discordId: string, itemId: string) {
  return Boolean(await (await getBotCollection("user_inventory")).findOne({ discordId, item_id: itemId }, { projection: { _id: 1 } }));
}

/** Equip a cosmetic (itemId), or clear a slot (itemId null). */
export async function equipCosmetic(discordId: string, siteUserId: ObjectId, slot: CosmeticSlot, itemId: string | null) {
  if (!SLOTS.includes(slot)) throw new PerkError("Unknown slot.");
  let key: string | null = null;
  if (itemId) {
    const c = COSMETICS[itemId];
    if (!c || c.slot !== slot) throw new PerkError("That item doesn't go in that slot.");
    if (!(await owns(discordId, itemId))) throw new PerkError("You don't own that item.", 403);
    key = c.key;
  }
  await (await getUsersCollection()).updateOne({ _id: siteUserId }, { $set: { [`cosmetics.${slot}`]: key, updatedAt: new Date() } });
  return { message: itemId ? "Equipped! It now shows on your profile." : "Removed from your profile." };
}

/** Set (or clear, with empty text) the custom title. */
export async function setCustomTitle(discordId: string, siteUserId: ObjectId, text: unknown, hue: unknown) {
  if (!(await owns(discordId, ITEM.customTitle))) throw new PerkError("Buy a Custom Title in the store first.", 403);
  const value = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  const users = await getUsersCollection();
  if (!value) {
    await users.updateOne({ _id: siteUserId }, { $unset: { customTitle: "" }, $set: { updatedAt: new Date() } });
    return { message: "Custom title removed.", title: null };
  }
  if (value.length < 2 || value.length > 24) throw new PerkError("Titles are 2 to 24 characters.");
  const bad = await checkText(value, { label: "Your title", short: true });
  if (bad) throw new PerkError(bad);
  const title: CustomTitle = { text: value, hue: TITLE_HUES.includes(String(hue)) ? String(hue) : TITLE_HUES[0] };
  await users.updateOne({ _id: siteUserId }, { $set: { customTitle: title, updatedAt: new Date() } });
  return { message: "Title saved!", title };
}

/** Design (or redesign) one of their Custom Badges. */
export async function designBadge(discordId: string, badgeId: string, input: { name?: unknown; desc?: unknown; icon?: unknown; shape?: unknown; hue?: unknown }) {
  if (!ObjectId.isValid(badgeId)) throw new PerkError("Unknown badge.");
  const name = typeof input.name === "string" ? input.name.replace(/\s+/g, " ").trim() : "";
  const desc = typeof input.desc === "string" ? input.desc.replace(/\s+/g, " ").trim() : "";
  if (name.length < 2 || name.length > 24) throw new PerkError("Badge names are 2 to 24 characters.");
  if (desc.length > 80) throw new PerkError("Keep the description under 80 characters.");
  if (!BADGE_ICONS.includes(String(input.icon))) throw new PerkError("Pick an icon.");
  if (!BADGE_SHAPES.includes(String(input.shape))) throw new PerkError("Pick a shape.");
  if (!BADGE_HUES.includes(String(input.hue))) throw new PerkError("Pick a color.");
  const bad = (await checkText(name, { label: "The badge name", short: true })) ?? (desc ? await checkText(desc, { label: "The description" }) : null);
  if (bad) throw new PerkError(bad);
  const res = await (await getBotCollection("user_inventory")).updateOne(
    { _id: new ObjectId(badgeId), discordId, item_id: ITEM.customBadge },
    { $set: { custom: { name, desc, icon: String(input.icon), shape: String(input.shape), hue: String(input.hue), designedAt: new Date() } } },
  );
  if (!res.matchedCount) throw new PerkError("You don't own that badge.", 403);
  return { message: "Badge saved! It shows on your profile now." };
}
