// Discord names and avatars for leaderboard rows, cached in Mongo so a page load never
// needs one Discord call per member (that got rate limited and left raw ids on screen).
// The whole server member list is pulled in bulk at most every 15 minutes; members who
// left are looked up one by one, a few per request, and remembered for a day.

import { getMongoClient } from "./mongodb";
import { DISCORD_API, botToken, guildId } from "./discord-member";

const REFRESH_MS = 15 * 60 * 1000;
const LEFT_MEMBER_RETRY_MS = 24 * 60 * 60 * 1000;
const MAX_SINGLE_LOOKUPS = 8;
const META_ID = "__meta";

export type DirectoryEntry = {
  _id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  inServer: boolean;
  updatedAt: Date;
};

type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
type DiscordMember = { nick?: string | null; avatar?: string | null; user: DiscordUser };

async function directory() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website").collection<DirectoryEntry | { _id: string; refreshedAt: Date; lockedUntil?: Date }>(
    "member_directory",
  );
}

function avatarUrl(user: DiscordUser) {
  return user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96` : null;
}

function entryFromMember(member: DiscordMember, now: Date): DirectoryEntry {
  return {
    _id: member.user.id,
    username: member.user.username,
    displayName: member.nick ?? member.user.global_name ?? member.user.username,
    avatar: avatarUrl(member.user),
    inServer: true,
    updatedAt: now,
  };
}

async function discordGet<T>(path: string): Promise<{ status: number; data: T | null }> {
  const token = botToken();
  if (!token) return { status: 0, data: null };
  try {
    const response = await fetch(`${DISCORD_API}${path}`, {
      headers: { Authorization: `Bot ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    return { status: response.status, data: response.ok ? ((await response.json()) as T) : null };
  } catch {
    return { status: 0, data: null };
  }
}

/** Pulls the full member list (1000 per call). Needs the bot's Server Members intent. */
async function refreshAllMembers() {
  const guild = await guildId();
  if (!guild) return false;

  const col = await directory();
  const now = new Date();
  let after = "0";
  for (let pageCount = 0; pageCount < 50; pageCount += 1) {
    const { data } = await discordGet<DiscordMember[]>(`/guilds/${guild}/members?limit=1000&after=${after}`);
    if (!data) return false;
    const humans = data.filter((m) => !m.user.bot);
    if (humans.length) {
      await col.bulkWrite(
        humans.map((m) => ({
          replaceOne: { filter: { _id: m.user.id }, replacement: entryFromMember(m, now), upsert: true },
        })),
        { ordered: false },
      );
    }
    if (data.length < 1000) break;
    after = data[data.length - 1].user.id;
  }

  // Anyone not seen in this sweep has left the server
  await col.updateMany(
    { _id: { $ne: META_ID }, inServer: true, updatedAt: { $lt: now } } as never,
    { $set: { inServer: false } },
  );
  return true;
}

/** Refreshes the directory when it's stale. Only one request at a time does the work. */
async function refreshIfStale() {
  const col = await directory();
  const now = new Date();
  await col.updateOne({ _id: META_ID }, { $setOnInsert: { refreshedAt: new Date(0) } }, { upsert: true });
  const claimed = await col.findOneAndUpdate(
    {
      _id: META_ID,
      refreshedAt: { $lt: new Date(now.getTime() - REFRESH_MS) },
      $or: [{ lockedUntil: { $lt: now } }, { lockedUntil: { $exists: false } }],
    } as never,
    { $set: { lockedUntil: new Date(now.getTime() + 60_000) } },
  );
  if (!claimed) return;

  const ok = await refreshAllMembers().catch(() => false);
  await col.updateOne(
    { _id: META_ID },
    ok ? { $set: { refreshedAt: new Date() }, $unset: { lockedUntil: "" } } : { $unset: { lockedUntil: "" } },
  );
}

async function lookupSingle(id: string, guild: string | null, now: Date): Promise<DirectoryEntry | null> {
  if (guild) {
    const member = await discordGet<DiscordMember>(`/guilds/${guild}/members/${id}`);
    if (member.data) return entryFromMember(member.data, now);
    if (member.status !== 404) return null;
  }
  const user = await discordGet<DiscordUser>(`/users/${id}`);
  if (user.status === 404) {
    // Deleted account: remember that so we don't ask again until the daily re-check
    return { _id: id, username: null, displayName: null, avatar: null, inServer: false, updatedAt: now };
  }
  if (!user.data) return null;
  return {
    _id: id,
    username: user.data.username,
    displayName: user.data.global_name ?? user.data.username,
    avatar: avatarUrl(user.data),
    inServer: false,
    updatedAt: now,
  };
}

/** Names for every id (from the cache), refreshing the cache first when needed. */
export async function loadDirectory(ids: string[]): Promise<Map<string, DirectoryEntry>> {
  const map = new Map<string, DirectoryEntry>();
  if (!ids.length) return map;

  await refreshIfStale().catch((error) => console.error("Member directory refresh failed", error));

  const col = await directory();
  const docs = (await col.find({ _id: { $in: ids } }).toArray()) as DirectoryEntry[];
  for (const doc of docs) map.set(doc._id, doc);
  return map;
}

/** Fills in a few ids that the directory doesn't know yet (or that left and are due a re-check). */
export async function resolveMissing(ids: string[], known: Map<string, DirectoryEntry>) {
  const now = new Date();
  const due = ids
    .filter((id) => {
      const entry = known.get(id);
      return !entry || (!entry.inServer && now.getTime() - new Date(entry.updatedAt).getTime() > LEFT_MEMBER_RETRY_MS);
    })
    .slice(0, MAX_SINGLE_LOOKUPS);
  if (!due.length) return;

  const guild = await guildId();
  const found = (await Promise.all(due.map((id) => lookupSingle(id, guild, now)))).filter(Boolean) as DirectoryEntry[];
  if (!found.length) return;

  const col = await directory();
  await col.bulkWrite(
    found.map((entry) => ({ replaceOne: { filter: { _id: entry._id }, replacement: entry, upsert: true } })),
    { ordered: false },
  );
  for (const entry of found) known.set(entry._id, entry);
}
