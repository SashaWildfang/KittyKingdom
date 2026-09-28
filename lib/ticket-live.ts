// Admin → Tickets → Open now: tickets that are open right now (zeo_bot.activeTickets) and a
// read-only live view of each ticket channel, fetched from Discord with the bot token.

import { DISCORD_API, botToken, guildId } from "./discord-member";
import { resolveMentions, type Mentions } from "./discord-mentions";
import { getBotCollection } from "./mongodb";
import { people, type Person } from "./admin-people";

export type OpenTicket = {
  ticketId: number;
  type: string;
  topic: string;
  openedBy: string | null;
  claimedBy: string | null;
  created: string | null;
  lastUpdated: string | null;
  channelId: string | null;
};

export async function openTickets(): Promise<OpenTicket[]> {
  const docs = await (await getBotCollection("activeTickets")).find({}).sort({ created: -1 }).limit(100).toArray();
  return docs.map((d) => ({
    ticketId: Number(d.ticket_id),
    type: String(d.ticket_type ?? "support"),
    topic: String(d.topic ?? ""),
    openedBy: d.opened_by ? String(d.opened_by) : null,
    claimedBy: d.claimed_by ? String(d.claimed_by) : null,
    created: d.created instanceof Date ? d.created.toISOString() : null,
    lastUpdated: d.last_updated instanceof Date ? d.last_updated.toISOString() : null,
    channelId: d.channel_id ? String(d.channel_id) : null,
  }));
}

type RawMessage = {
  id: string;
  content: string;
  timestamp: string;
  edited_timestamp?: string | null;
  author: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  attachments?: { id: string; filename: string; url: string; content_type?: string; width?: number; height?: number }[];
  embeds?: { title?: string; description?: string; color?: number; image?: { url: string }; thumbnail?: { url: string }; fields?: { name: string; value: string }[] }[];
  sticker_items?: { name: string }[];
  reactions?: { emoji: { name: string | null }; count: number }[];
};

export type TicketLiveMessage = {
  id: string;
  at: string;
  edited: boolean;
  authorId: string;
  author: string;
  avatar: string | null;
  bot: boolean;
  content: string;
  attachments: { name: string; url: string; image: boolean; video: boolean }[];
  embeds: { title: string | null; description: string | null; color: string | null; image: string | null; fields: { name: string; value: string }[] }[];
  reactions: { emoji: string; count: number }[];
};

export async function ticketLive(ticketId: number, after: string | null) {
  const doc = await (await getBotCollection("activeTickets")).findOne({ ticket_id: { $in: [ticketId, String(ticketId)] } } as never);
  if (!doc?.channel_id) return null;
  const channelId = String(doc.channel_id);
  const token = botToken();
  if (!token) throw new Error("The bot token isn't set up on the website.");
  const q = after && /^\d{15,21}$/.test(after) ? `after=${after}&limit=100` : "limit=100";
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages?${q}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
  if (res.status === 404) return { channelId, gone: true, messages: [] as TicketLiveMessage[], mentions: { channels: {}, roles: {} } as Mentions, people: {} as Record<string, Person>, guildId: await guildId() };
  if (!res.ok) throw new Error("Discord didn't answer. Trying again shortly.");
  const raw = ((await res.json()) as RawMessage[]).sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  const texts = raw.flatMap((m) => [m.content, ...(m.embeds ?? []).flatMap((e) => [e.description ?? "", ...(e.fields ?? []).map((f) => f.value)])]);
  const { mentions, userIds } = await resolveMentions(texts);
  // Names for every @person mentioned (and every author), so no raw ids show
  const who: Record<string, Person> = await people([...userIds, ...raw.map((m) => m.author.id)]).catch(() => ({}));
  const messages: TicketLiveMessage[] = raw.map((m) => ({
    id: m.id,
    at: m.timestamp,
    edited: Boolean(m.edited_timestamp),
    authorId: m.author.id,
    author: m.author.global_name || m.author.username,
    avatar: m.author.avatar ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64` : null,
    bot: Boolean(m.author.bot),
    content: m.content ?? "",
    attachments: (m.attachments ?? []).map((a) => ({
      name: a.filename,
      url: a.url,
      image: (a.content_type ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(a.filename),
      video: (a.content_type ?? "").startsWith("video/") || /\.(mp4|webm|mov)$/i.test(a.filename),
    })),
    embeds: (m.embeds ?? []).map((e) => ({
      title: e.title ?? null,
      description: e.description ?? null,
      color: typeof e.color === "number" ? `#${e.color.toString(16).padStart(6, "0")}` : null,
      image: e.image?.url ?? e.thumbnail?.url ?? null,
      fields: (e.fields ?? []).slice(0, 10),
    })),
    reactions: (m.reactions ?? []).filter((r) => r.emoji.name).map((r) => ({ emoji: r.emoji.name!, count: r.count })),
  }));
  return { channelId, gone: false, messages, mentions, people: who, guildId: await guildId() };
}
