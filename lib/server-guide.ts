// Where the #server-guide channel's sections are posted. The main bot's /serverguide post saves the channel and
// one message per section in bot_config "server_guide", so the site can link straight to a section.

import { getBotCollection } from "./mongodb";

export type GuideSection = "welcome" | "join" | "rules" | "nsfw" | "roles" | "earn" | "levels" | "multipliers" | "daily" | "vc" | "store" | "casino" | "boost" | "patreon" | "website" | "social" | "tickets" | "staff" | "commands";

/** The channel part of the link (`<channelId>/<messageId>` for a section, or just the channel), or null if the guide isn't posted. */
export async function serverGuidePath(section?: GuideSection) {
  const doc = await (await getBotCollection("bot_config")).findOne({ _id: "server_guide" } as never).catch(() => null);
  if (!doc?.channel_id) return null;
  const channel = String(doc.channel_id);
  const keys: string[] = Array.isArray(doc.keys) ? doc.keys : [];
  const i = section ? keys.indexOf(section) : -1;
  return i >= 0 && doc.message_ids?.[i] ? `${channel}/${String(doc.message_ids[i])}` : channel;
}
