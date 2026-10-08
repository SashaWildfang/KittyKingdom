// Admin → Bots → Discord Server: the server's own settings, read and changed through Discord's API with the
// bot token (the bot needs Manage Server). Every change is logged with the bot settings changes (bot: "server").

import type { PanelUser } from "../admin";
import { DISCORD_API, botToken, getGuildChannelsRaw, getGuildRoles, guildId } from "../discord-member";
import { BotSettingsError, logExternalChanges } from "./store";

export type GuildSettings = {
  name: string;
  description: string | null;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  afk_channel_id: string | null;
  afk_timeout: number;
  system_channel_id: string | null;
  system_channel_flags: number;
  rules_channel_id: string | null;
  public_updates_channel_id: string | null;
  safety_alerts_channel_id: string | null;
  preferred_locale: string;
  premium_progress_bar_enabled: boolean;
};

export type GuildInfo = {
  id: string;
  icon: string | null;
  banner: string | null;
  ownerId: string;
  members: number | null;
  online: number | null;
  boosts: number;
  boostTier: number;
  features: string[];
  roles: number;
  channels: number;
  emojis: number;
  stickers: number;
  community: boolean;
};

export const SETTING_LABELS: Record<keyof GuildSettings, string> = {
  name: "Server name",
  description: "Server description",
  verification_level: "Verification level",
  default_message_notifications: "Default notifications",
  explicit_content_filter: "Explicit media filter",
  afk_channel_id: "AFK channel",
  afk_timeout: "AFK timeout",
  system_channel_id: "System messages channel",
  system_channel_flags: "System message options",
  rules_channel_id: "Rules channel",
  public_updates_channel_id: "Community updates channel",
  safety_alerts_channel_id: "Safety alerts channel",
  preferred_locale: "Server language",
  premium_progress_bar_enabled: "Boost progress bar",
};

const KEYS = Object.keys(SETTING_LABELS) as (keyof GuildSettings)[];
const CHANNEL_KEYS: (keyof GuildSettings)[] = ["afk_channel_id", "system_channel_id", "rules_channel_id", "public_updates_channel_id", "safety_alerts_channel_id"];

async function discord(path: string, init?: RequestInit) {
  const token = botToken();
  const guild = await guildId();
  if (!token || !guild) throw new BotSettingsError("The website doesn't have the bot token or server id, so it can't reach Discord.", 503);
  const res = await fetch(`${DISCORD_API}/guilds/${guild}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.message ? String(body.message) : `HTTP ${res.status}`;
    if (res.status === 403) throw new BotSettingsError(`Discord said no: the bot needs the Manage Server permission (${msg}).`, 403);
    const detail = body?.errors ? ` ${JSON.stringify(body.errors).slice(0, 300)}` : "";
    throw new BotSettingsError(`Discord rejected that: ${msg}.${detail}`, res.status);
  }
  return body as Record<string, unknown>;
}

function pick(g: Record<string, unknown>): GuildSettings {
  return {
    name: String(g.name ?? ""),
    description: g.description ? String(g.description) : null,
    verification_level: Number(g.verification_level ?? 0),
    default_message_notifications: Number(g.default_message_notifications ?? 0),
    explicit_content_filter: Number(g.explicit_content_filter ?? 0),
    afk_channel_id: g.afk_channel_id ? String(g.afk_channel_id) : null,
    afk_timeout: Number(g.afk_timeout ?? 300),
    system_channel_id: g.system_channel_id ? String(g.system_channel_id) : null,
    system_channel_flags: Number(g.system_channel_flags ?? 0),
    rules_channel_id: g.rules_channel_id ? String(g.rules_channel_id) : null,
    public_updates_channel_id: g.public_updates_channel_id ? String(g.public_updates_channel_id) : null,
    safety_alerts_channel_id: g.safety_alerts_channel_id ? String(g.safety_alerts_channel_id) : null,
    preferred_locale: String(g.preferred_locale ?? "en-US"),
    premium_progress_bar_enabled: Boolean(g.premium_progress_bar_enabled),
  };
}

export async function guildSettings() {
  const g = await discord("?with_counts=true");
  const features = Array.isArray(g.features) ? (g.features as string[]) : [];
  const info: GuildInfo = {
    id: String(g.id),
    icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${String(g.icon).startsWith("a_") ? "gif" : "png"}?size=128` : null,
    banner: g.banner ? `https://cdn.discordapp.com/banners/${g.id}/${g.banner}.png?size=600` : null,
    ownerId: String(g.owner_id ?? ""),
    members: typeof g.approximate_member_count === "number" ? g.approximate_member_count : null,
    online: typeof g.approximate_presence_count === "number" ? g.approximate_presence_count : null,
    boosts: Number(g.premium_subscription_count ?? 0),
    boostTier: Number(g.premium_tier ?? 0),
    features,
    roles: Array.isArray(g.roles) ? g.roles.length : 0,
    channels: (await getGuildChannelsRaw()).length,
    emojis: Array.isArray(g.emojis) ? g.emojis.length : 0,
    stickers: Array.isArray(g.stickers) ? g.stickers.length : 0,
    community: features.includes("COMMUNITY"),
  };
  return { settings: pick(g), info };
}

/** Channels (text, voice, categories) and roles for the pickers. */
export async function guildPickers() {
  const [channels, roles] = await Promise.all([getGuildChannelsRaw(), getGuildRoles().catch(() => new Map())]);
  const categories = new Map(channels.filter((c) => c.type === 4).map((c) => [c.id, c.name]));
  return {
    channels: channels
      .filter((c) => c.type !== 4)
      .sort((a, b) => (categories.get(a.parent_id ?? "") ?? "").localeCompare(categories.get(b.parent_id ?? "") ?? "") || a.position - b.position)
      .map((c) => ({ id: c.id, name: c.name, type: c.type, category: c.parent_id ? categories.get(c.parent_id) ?? null : null })),
    categories: Array.from(categories, ([id, name]) => ({ id, name })),
    roles: Array.from(roles.values())
      .filter((r) => r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.colors[0] ?? null, managed: r.managed })),
  };
}

const ALLOWED: Partial<Record<keyof GuildSettings, number[]>> = {
  verification_level: [0, 1, 2, 3, 4],
  default_message_notifications: [0, 1],
  explicit_content_filter: [0, 1, 2],
  afk_timeout: [60, 300, 900, 1800, 3600],
};

/** Changes server settings ({ key: value }); logs every change. */
export async function updateGuildSettings(raw: Record<string, unknown>, admin: PanelUser, reason: string) {
  const { settings: current } = await guildSettings();
  const patch: Record<string, unknown> = {};
  for (const key of KEYS) {
    if (!(key in raw)) continue;
    let v = raw[key];
    if (key === "name") {
      v = String(v ?? "").trim();
      if ((v as string).length < 2 || (v as string).length > 100) throw new BotSettingsError("The server name must be 2 to 100 characters.");
    } else if (key === "description") {
      v = String(v ?? "").trim() || null;
      if (v && (v as string).length > 120) throw new BotSettingsError("The description can be at most 120 characters.");
    } else if (CHANNEL_KEYS.includes(key)) {
      v = v ? String(v) : null;
      if (v && !/^\d{15,25}$/.test(v as string)) throw new BotSettingsError(`${SETTING_LABELS[key]}: pick a channel.`);
    } else if (key === "system_channel_flags") {
      v = Number(v);
      if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 63) throw new BotSettingsError("Invalid system message options.");
    } else if (key === "premium_progress_bar_enabled") {
      v = Boolean(v);
    } else if (key === "preferred_locale") {
      v = String(v);
      if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(v as string)) throw new BotSettingsError("Pick a language.");
    } else {
      v = Number(v);
      if (!ALLOWED[key]?.includes(v as number)) throw new BotSettingsError(`${SETTING_LABELS[key]}: pick one of the options.`);
    }
    if (JSON.stringify(v) !== JSON.stringify(current[key])) patch[key] = v;
  }
  if (!Object.keys(patch).length) throw new BotSettingsError("Nothing changed.");
  const updated = await discord("", {
    method: "PATCH",
    body: JSON.stringify(patch),
    headers: { "X-Audit-Log-Reason": encodeURIComponent(`${admin.name} on the website: ${reason || "Server settings"}`.slice(0, 450)) },
  });
  await logExternalChanges(
    "server",
    Object.keys(patch).map((k) => ({ key: k, label: SETTING_LABELS[k as keyof GuildSettings], section: "server", old: current[k as keyof GuildSettings], new: patch[k] })),
    admin,
  );
  return pick(updated);
}
