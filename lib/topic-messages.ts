// The topic map's "see my messages" window. The activity tracker keeps pointers (channel + message
// ids, never the text) to a member's newest messages for each topic keyword and topic
// (member_activity.topicMsgs); the messages themselves are fetched from Discord only when the
// member opens one, with a few messages around it for context. Messages in channels the member
// can no longer see are skipped, and deleted messages simply don't come back.

import { DISCORD_API, botToken, getGuildChannelsRaw, guildId, viewableChannelIds } from "./discord-member";
import { getBotCollection } from "./mongodb";
import { stripEmojis } from "./names";
import { TOPICS } from "./topics";

type Ref = { m: number | string; c: number | string; p?: number | string };
type RawMessage = {
  id: string;
  content: string;
  timestamp: string;
  edited_timestamp?: string | null;
  author: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  mentions?: { id: string; username: string; global_name?: string | null }[];
  attachments?: { filename: string; content_type?: string }[];
  embeds?: unknown[];
  sticker_items?: { name: string }[];
};

export type ContextMessage = {
  id: string;
  mine: boolean;
  hit: boolean;
  author: string;
  avatar: string | null;
  content: string;
  at: string;
  edited: boolean;
  attachments: string[];
};

export type TopicMessagePage = {
  total: number;
  index: number;
  deleted: boolean;
  channel: string | null;
  jumpUrl: string | null;
  messages: ContextMessage[];
};

export const WORD_RE = /^[a-z0-9']{1,40}$/;

// Discord responses, keyed by channel:message (a few minutes; small so memory stays tiny)
const cache = new Map<string, { at: number; data: RawMessage[] | null }>();
const CACHE_MS = 5 * 60_000;

async function around(channelId: string, messageId: string): Promise<RawMessage[] | null> {
  const key = `${channelId}:${messageId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const token = botToken();
  if (!token) return null;
  let data: RawMessage[] | null = null;
  try {
    const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages?around=${messageId}&limit=7`, {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    });
    if (response.ok) data = (await response.json()) as RawMessage[];
    else if (response.status !== 403 && response.status !== 404) return null; // try again next time
  } catch {
    return null;
  }
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 400) cache.delete(cache.keys().next().value as string);
  return data;
}

function displayName(user: { username: string; global_name?: string | null }) {
  return stripEmojis(user.global_name ?? "") || user.username;
}

/** Readable text: user, role and channel mentions become names, custom emojis become :name:. */
function readable(message: RawMessage, channelNames: Map<string, string>) {
  const users = new Map((message.mentions ?? []).map((u) => [u.id, displayName(u)]));
  return (message.content ?? "")
    .replace(/<@!?(\d{15,21})>/g, (_, id: string) => `@${users.get(id) ?? "someone"}`)
    .replace(/<@&\d{15,21}>/g, "@role")
    .replace(/<#(\d{15,21})>/g, (_, id: string) => `#${channelNames.get(id) ?? "channel"}`)
    .replace(/<a?:(\w{2,32}):\d{15,21}>/g, ":$1:")
    .replace(/<t:(\d{1,12})(?::\w)?>/g, (_, s: string) => new Date(Number(s) * 1000).toISOString().slice(0, 10));
}

export async function topicMessage(discordId: string, kind: "word" | "topic", key: string, index: number): Promise<TopicMessagePage | null> {
  if (kind === "word" ? !WORD_RE.test(key) : !TOPICS[key]) return null;
  const path = `topicMsgs.${kind === "word" ? "words" : "topics"}.${key}`;
  const doc = (await (await getBotCollection("member_activity")).findOne({ _id: discordId } as never, { projection: { [path]: 1 } })) as
    | { topicMsgs?: { words?: Record<string, Ref[]>; topics?: Record<string, Ref[]> } }
    | null;
  const raw = (kind === "word" ? doc?.topicMsgs?.words?.[key] : doc?.topicMsgs?.topics?.[key]) ?? [];

  // Only channels they can still see (the context shows other people's messages too)
  const [visible, channels, guild] = await Promise.all([viewableChannelIds(discordId), getGuildChannelsRaw(), guildId()]);
  const refs = raw
    .map((r) => ({ m: String(r.m), c: String(r.c), p: String(r.p ?? r.c) }))
    .filter((r) => visible.has(r.p) || visible.has(r.c))
    .reverse(); // newest first
  const empty = { total: refs.length, index: 0, deleted: false, channel: null, jumpUrl: null, messages: [] };
  if (!refs.length) return empty;

  const at = Math.min(Math.max(0, index), refs.length - 1);
  const ref = refs[at];
  const names = new Map(channels.map((c) => [c.id, c.name]));
  const channel = names.get(ref.c) ?? names.get(ref.p) ?? null;
  const list = await around(ref.c, ref.m);
  if (list === null && !cache.has(`${ref.c}:${ref.m}`)) throw new Error("Discord didn't answer");
  const sorted = [...(list ?? [])].sort((x, y) => (BigInt(x.id) < BigInt(y.id) ? -1 : 1));
  const pos = sorted.findIndex((m) => m.id === ref.m);
  // The message must still exist and be theirs
  if (pos < 0 || sorted[pos].author.id !== discordId) return { ...empty, index: at, deleted: true, channel };

  const window = sorted.slice(Math.max(0, pos - 2), pos + 3);
  return {
    total: refs.length,
    index: at,
    deleted: false,
    channel,
    jumpUrl: guild ? `https://discord.com/channels/${guild}/${ref.c}/${ref.m}` : null,
    messages: window.map((m) => ({
      id: m.id,
      mine: m.author.id === discordId,
      hit: m.id === ref.m,
      author: displayName(m.author),
      avatar: m.author.avatar ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64` : null,
      content: readable(m, names).slice(0, 1500),
      at: m.timestamp,
      edited: Boolean(m.edited_timestamp),
      attachments: [
        ...(m.attachments ?? []).map((a) => a.filename),
        ...(m.sticker_items ?? []).map((s) => `Sticker: ${s.name}`),
      ].slice(0, 6),
    })),
  };
}
