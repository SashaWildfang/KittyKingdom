// Small text helpers for dating profiles. Old Discord answers can contain raw mentions such as
// "<@952393233232>" (people pasted their Discord tag into a socials field); on the website those are
// shown as "@name" instead.

import type { ProfileDoc } from "./schema";

const USER = /<@!?(\d{15,21})>/g;

/** Discord ids mentioned anywhere in a profile's text. */
export function mentionIds(doc: ProfileDoc): string[] {
  const out = new Set<string>();
  const scan = (v: unknown) => {
    if (typeof v === "string") v.replace(USER, (_, id: string) => (out.add(id), ""));
    else if (Array.isArray(v)) v.forEach(scan);
    else if (v && typeof v === "object" && !(v instanceof Date)) Object.values(v).forEach(scan);
  };
  for (const [k, v] of Object.entries(doc)) if (k !== "_id" && k !== "photos") scan(v);
  return Array.from(out);
}

/** Replaces Discord mention / emoji markup with readable text. */
export function cleanMentions(text: string, names: Map<string, string> | Record<string, string>): string {
  const get = (id: string) => (names instanceof Map ? names.get(id) : names[id]);
  return text
    .replace(USER, (_, id: string) => `@${get(id) ?? "member"}`)
    .replace(/<@&\d{15,21}>/g, "@role")
    .replace(/<#\d{15,21}>/g, "#channel")
    .replace(/<a?:(\w{1,32}):\d{15,21}>/g, ":$1:");
}

/** A Discord CDN avatar at a sharper size (the member directory stores small 96px ones). */
export function bigAvatar(url: string | null | undefined, size = 512): string | null {
  if (!url) return null;
  if (!/^https:\/\/cdn\.discordapp\.com\//.test(url)) return url;
  return /[?&]size=\d+/.test(url) ? url.replace(/([?&]size=)\d+/, `$1${size}`) : `${url}${url.includes("?") ? "&" : "?"}size=${size}`;
}
