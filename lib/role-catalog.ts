// Self-assignable roles: what members can pick in Discord (the Main Bot's "Edit my roles" button) and on the
// website (My Account → Roles). One list for both, kept in zeo_bot.role_catalog {_id: "catalog"} and edited in
// Admin → Roles. Until it's saved for the first time, the built-in list (role-catalog-default.json, the same
// file as the Main Bot's db/role_catalog_default.json) is used.

import DEFAULT_CATALOG from "./role-catalog-default.json";
import { getBotCollection } from "./mongodb";

export type SelfRole = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Hidden from the pickers (kept on members who already have it) */
  hidden?: boolean;
  /** The Discord role is renamed to this (e.g. clearer time zone names) */
  roleName?: string;
  /** Stable word the Social profile setup matches on (so renaming the label doesn't break it) */
  hint?: string;
};
export type SelfRoleCategory = {
  key: string;
  title: string;
  description: string;
  color: string;
  /** 18+ categories: only members with the 18+ Verified role can use them (and lose them when it's removed). */
  adult: boolean;
  /** "single": picking one replaces the others in the category; "multi": pick as many as you like */
  mode: "single" | "multi";
  hidden?: boolean;
  roles: SelfRole[];
};

/** The built-in list (also what an admin can reset to). */
export const DEFAULT_CATEGORIES = DEFAULT_CATALOG as SelfRoleCategory[];
/** Kept for code that needs the list right away (names for hints, etc.): the built-in one. */
export const ROLE_CATEGORIES = DEFAULT_CATEGORIES;

const CATALOG_ID = "catalog";
const TTL_MS = 20_000;
let cache: { at: number; categories: SelfRoleCategory[]; version: number } | null = null;

async function col() {
  return getBotCollection("role_catalog");
}

/** The current list (cached for a few seconds). */
export async function getRoleCatalog(fresh = false): Promise<SelfRoleCategory[]> {
  return (await getRoleCatalogDoc(fresh)).categories;
}

export async function getRoleCatalogDoc(fresh = false): Promise<{ categories: SelfRoleCategory[]; version: number; updatedAt: string | null; updatedBy: string | null; custom: boolean }> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return { categories: cache.categories, version: cache.version, updatedAt: null, updatedBy: null, custom: cache.version > 0 };
  const doc = (await (await col()).findOne({ _id: CATALOG_ID } as never).catch(() => null)) as { categories?: SelfRoleCategory[]; version?: number; updatedAt?: Date; updatedByName?: string } | null;
  // Once saved, the saved list is used even if it's empty (an admin can turn the picker off by removing everything)
  const categories = Array.isArray(doc?.categories) ? doc!.categories : DEFAULT_CATEGORIES;
  const version = Number(doc?.version ?? 0);
  cache = { at: Date.now(), categories, version };
  return { categories, version, updatedAt: doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null, updatedBy: doc?.updatedByName ?? null, custom: Array.isArray(doc?.categories) };
}

/** Every role id a member may pick (including hidden ones, so they can still remove them). */
export async function selfRoleIds() {
  const cats = await getRoleCatalog();
  return new Set(cats.flatMap((c) => c.roles.map((r) => r.id)));
}

export async function adultRoleIds() {
  const cats = await getRoleCatalog();
  return new Set(cats.filter((c) => c.adult).flatMap((c) => c.roles.map((r) => r.id)));
}

export class CatalogError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const KEY = /^[A-Za-z0-9_-]{1,40}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** Checks and tidies a list sent from Admin → Roles. */
export function cleanCatalog(input: unknown): SelfRoleCategory[] {
  if (!Array.isArray(input)) throw new CatalogError("That isn't a list of categories.");
  if (input.length > 25) throw new CatalogError("Up to 25 categories.");
  const keys = new Set<string>();
  const ids = new Set<string>();
  return input.map((raw, i) => {
    const c = (raw ?? {}) as Record<string, unknown>;
    const title = clip(c.title, 60);
    if (!title) throw new CatalogError(`Category ${i + 1} needs a name.`);
    let key = clip(c.key, 40) || title.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    if (!KEY.test(key)) key = `Category_${i + 1}`;
    if (keys.has(key)) throw new CatalogError(`Two categories are both called "${title}".`);
    keys.add(key);
    const roles = Array.isArray(c.roles) ? (c.roles as Record<string, unknown>[]) : [];
    if (roles.length > 25) throw new CatalogError(`"${title}" can have up to 25 roles (Discord's limit for one menu).`);
    return {
      key,
      title,
      description: clip(c.description, 200),
      color: HEX.test(String(c.color ?? "")) ? String(c.color) : "#d56300",
      adult: Boolean(c.adult),
      mode: c.mode === "single" ? "single" : "multi",
      ...(c.hidden ? { hidden: true } : {}),
      roles: roles.map((r) => {
        const id = clip(r.id, 25);
        if (!/^\d{15,21}$/.test(id)) throw new CatalogError(`A role in "${title}" isn't linked to a Discord role.`);
        if (ids.has(id)) throw new CatalogError(`A Discord role is used twice (in "${title}"). Each role can only be in one place.`);
        ids.add(id);
        const name = clip(r.name, 80);
        if (!name) throw new CatalogError(`A role in "${title}" needs a name.`);
        return {
          id,
          name,
          emoji: clip(r.emoji, 16),
          description: clip(r.description, 100),
          ...(r.hidden ? { hidden: true } : {}),
          ...(clip(r.roleName, 100) ? { roleName: clip(r.roleName, 100) } : {}),
          ...(clip(r.hint, 40) ? { hint: clip(r.hint, 40).toLowerCase() } : {}),
        };
      }),
    } satisfies SelfRoleCategory;
  });
}

/** Saves the list; the Main Bot picks it up within a few seconds (it watches the version). */
export async function saveRoleCatalog(categories: SelfRoleCategory[], by: { discordId: string; name: string }, expectVersion: number | null) {
  const c = await col();
  const current = Number(((await c.findOne({ _id: CATALOG_ID } as never)) as { version?: number } | null)?.version ?? 0);
  if (expectVersion !== null && expectVersion !== current) throw new CatalogError("Someone else changed the roles while you were editing. Reload to see their changes.", 409);
  const conflict = () => new CatalogError("Someone else changed the roles at the same moment. Reload and try again.", 409);
  let res;
  try {
    // The very first save creates the document: two at once can't both win (the second hits the duplicate id)
    res = await c.updateOne(
      { _id: CATALOG_ID, version: current ? current : { $exists: false } } as never,
      { $set: { categories, updatedAt: new Date(), updatedBy: by.discordId, updatedByName: by.name }, $inc: { version: 1 } },
      { upsert: !current },
    );
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) throw conflict();
    throw error;
  }
  if (!res.matchedCount && !res.upsertedCount) throw conflict();
  cache = null;
  return current + 1;
}
