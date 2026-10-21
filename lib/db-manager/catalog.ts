// Admin → Database: what each collection is, in plain words, and how the tool may treat it.
// Client-safe (no database code).

export type DbName = "website" | "bot";
export type Group = "members" | "economy" | "social" | "moderation" | "logs" | "cache" | "system" | "content";

export const GROUPS: Record<Group, { label: string; about: string }> = {
  members: { label: "Members & accounts", about: "Website accounts, the member list and per-member stats" },
  economy: { label: "Economy & games", about: "Balances, inventory, the store, games and gambling" },
  social: { label: "Social", about: "Profiles, photos, likes, matches and chats" },
  moderation: { label: "Moderation & safety", about: "Punishments, tickets, applications and appeals (kept for safety)" },
  logs: { label: "Logs & history", about: "Records that only grow: logs, archives and histories" },
  cache: { label: "Caches & temporary", about: "Copies the site or bots can rebuild, and short-lived data" },
  content: { label: "Site content", about: "News, events, giveaways, polls and rules" },
  system: { label: "Settings & system", about: "Bot and site configuration" },
};

export type CollectionInfo = {
  label: string;
  group: Group;
  about?: string;
  /** Never cleaned automatically and never deleted in bulk (moderation records, settings) */
  protected?: boolean;
  /** Old-record cleanup: the date field and the suggested age (days) */
  retention?: { field: string; days: number; filter?: Record<string, unknown> };
};

// Keyed "website.name" / "bot.name"
export const CATALOG: Record<string, CollectionInfo> = {
  // ---------- Website ----------
  "website.users": { label: "Website accounts", group: "members", protected: true, about: "Sign-in accounts (passwords and secrets are hidden here)" },
  "website.sessions": { label: "Signed-in devices", group: "members", retention: { field: "lastSeenAt", days: 90 } },
  "website.member_directory": { label: "Member list (cached)", group: "members", about: "Names, avatars and who's in the server, refreshed from Discord" },
  "website.panel_access": { label: "Admin panel access", group: "system", protected: true },
  "website.admin_prefs": { label: "Admin panel preferences", group: "system" },
  "website.job_state": { label: "Background job state", group: "system", about: "Progress of automatic jobs, e.g. deleting tickets from members who left" },
  "website.admin_audit": { label: "Admin action log", group: "moderation", protected: true, about: "Who did what in the admin panel" },
  "website.staff": { label: "Staff page", group: "content", protected: true },
  "website.news": { label: "News posts", group: "content", protected: true },
  "website.news_tags": { label: "News tags", group: "content" },
  "website.news_reads": { label: "News read marks", group: "members" },
  "website.notifications": { label: "Bell notifications", group: "members", about: "Removed automatically after 60 days" },
  "website.badge_history": { label: "Badge history", group: "members" },
  "website.appeals": { label: "Punishment appeals", group: "moderation", protected: true },
  "website.join_actions": { label: "Join form actions", group: "moderation", protected: true },
  "website.bot_logs": { label: "Bot log mirror", group: "logs", about: "A copy of the bot logs channel for the Logs tab", retention: { field: "ts", days: 365 } },
  "website.bot_logs_meta": { label: "Bot log sync state", group: "system", protected: true },
  "website.live_messages": { label: "Live Chat mirror", group: "cache", about: "Removed automatically after 72 hours" },
  "website.live_voice": { label: "Live voice list", group: "cache" },
  "website.live_meta": { label: "Live Chat state", group: "system", protected: true },
  "website.page_views": { label: "Traffic stats", group: "logs", about: "Removed automatically" },
  "website.invite_clicks": { label: "Discord invite clicks", group: "logs", retention: { field: "at", days: 365 } },
  "website.email_log": { label: "Sent emails", group: "logs", retention: { field: "at", days: 180 } },
  "website.transcript_cache": { label: "Transcript links (cache)", group: "cache", retention: { field: "at", days: 30 } },
  "website.dating_settings": { label: "Social settings", group: "social" },
  "website.dating_profile_views": { label: "Social profile views", group: "social", retention: { field: "at", days: 180 } },
  "website.dating_conversations": { label: "Social chats", group: "social" },
  "website.dating_messages": { label: "Social messages", group: "social" },
  "website.dating_partners": { label: "Social partner links", group: "social" },
  "website.dating_reports": { label: "Social reports", group: "moderation", protected: true },
  "website.dating_media.files": { label: "Social photos (index)", group: "social" },
  "website.dating_media.chunks": { label: "Social photos (data)", group: "social", protected: true, about: "Photo bytes; cleaned together with the photo index" },
  "website.news_media.files": { label: "News images (index)", group: "content", protected: true },
  "website.news_media.chunks": { label: "News images (data)", group: "content", protected: true },
  "website.vc_rewards": { label: "Voice reward history", group: "economy", retention: { field: "ts", days: 365 } },
  "website.vc_rewards_meta": { label: "Voice reward sync state", group: "system", protected: true },
  "website.message_dm_queue": { label: "Website message DMs (queue)", group: "cache" },
  "website.rate_limits": { label: "Rate limits", group: "cache" },
  "website.link_codes": { label: "Discord link codes", group: "cache" },
  "website.website_presence": { label: "Who's on the website", group: "cache" },
  "website.site_meta": { label: "Site state", group: "system", protected: true },
  "website.server_stats": { label: "Server stats (cache)", group: "cache" },
  "website.trades": { label: "Store trades", group: "economy" },
  "website.db_snapshots": { label: "Database size history", group: "system", about: "Used by this page for growth over time" },
  "website.dbm_backups": { label: "Database manager backups", group: "system", protected: true, about: "Copies of everything this page changed or deleted (30 days)" },

  // ---------- Bots ----------
  "bot.users": { label: "Economy (leaves, level, XP)", group: "economy" },
  "bot.member_activity": { label: "Activity stats", group: "members", about: "Messages, channels and voice time per member (the stats page)" },
  "bot.user_inventory": { label: "Inventory", group: "economy" },
  "bot.store_inventory": { label: "Store catalog", group: "economy", protected: true },
  "bot.store_sales": { label: "Store purchases", group: "economy", retention: { field: "timestamp", days: 730 } },
  "bot.gift_log": { label: "Gifts", group: "economy", retention: { field: "timestamp", days: 365 } },
  "bot.gift_cooldowns": { label: "Gift cooldowns", group: "cache" },
  "bot.gambling": { label: "Gambling stats", group: "economy" },
  "bot.gambling_logs": { label: "Gambling history", group: "logs", retention: { field: "timestamp", days: 180 } },
  "bot.roulette_rounds": { label: "Roulette rounds", group: "logs", retention: { field: "at", days: 90 } },
  "bot.roulette_stakes": { label: "Roulette bets", group: "economy" },
  "bot.wordle": { label: "Wordle", group: "economy" },
  "bot.web_game_sessions": { label: "Website game sessions", group: "logs", retention: { field: "updatedAt", days: 90 } },
  "bot.web_game_viewers": { label: "Website game viewers", group: "cache" },
  "bot.temporary_boosters": { label: "Active boosters", group: "economy" },
  "bot.qotd": { label: "Question of the Day stats", group: "economy" },
  "bot.qotdAnswers": { label: "Question of the Day answers", group: "logs", retention: { field: "answered_at", days: 365 } },
  "bot.qotdHistory": { label: "Question of the Day history", group: "content" },
  "bot.qotdState": { label: "Question of the Day state", group: "system", protected: true },
  "bot.dating_profiles": { label: "Social profiles", group: "social" },
  "bot.dating_vectors": { label: "Social matching data", group: "social" },
  "bot.dating_activity": { label: "Social like counters", group: "social" },
  "bot.profile_likes": { label: "Social likes", group: "social" },
  "bot.profile_passes": { label: "Social passes", group: "social" },
  "bot.dating_matches": { label: "Social matches", group: "social" },
  "bot.dating_friends": { label: "Social friends", group: "social" },
  "bot.dating_friend_skips": { label: "Social friend skips", group: "social" },
  "bot.dating_blocks": { label: "Social blocks", group: "social" },
  "bot.profile_drafts": { label: "Social profile drafts", group: "social" },
  "bot.punishments": { label: "Punishments", group: "moderation", protected: true },
  "bot.automod_events": { label: "AutoMod catches", group: "moderation", protected: true, about: "Removed automatically after 90 days" },
  "bot.automod_config": { label: "AutoMod settings", group: "system", protected: true },
  "bot.automod_changes": { label: "AutoMod setting changes", group: "moderation", protected: true },
  "bot.pending_unmutes": { label: "Pending unmutes", group: "moderation", protected: true },
  "bot.join_applications": { label: "Join applications", group: "moderation", protected: true },
  "bot.resolvedTickets": { label: "Closed tickets", group: "moderation", protected: true },
  "bot.activeTickets": { label: "Open tickets", group: "moderation", protected: true },
  "bot.vc_signatures": { label: "Voice rules signatures", group: "moderation", protected: true },
  "bot.message_index": { label: "Message index", group: "logs", about: "Who posted what where, used to clean up leavers' messages" },
  "bot.cleanup_archive_messages": { label: "Archived messages (leavers)", group: "logs", about: "Text of messages removed by the leaver cleanup", retention: { field: "at", days: 365 } },
  "bot.cleanup_archives": { label: "Cleanup archives", group: "logs", retention: { field: "at", days: 365 } },
  "bot.cleanup_jobs": { label: "Cleanup jobs", group: "logs", retention: { field: "finishedAt", days: 180, filter: { status: { $in: ["done", "cancelled", "error"] } } } },
  "bot.cleanup_state": { label: "Cleanup crawl progress", group: "system", protected: true },
  "bot.cleanup_deleted": { label: "Recently deleted messages", group: "cache" },
  "bot.ad_log": { label: "Server tips posted", group: "logs", retention: { field: "at", days: 180 } },
  "bot.bot_health": { label: "Bot health samples", group: "logs", about: "Removed automatically after 14 days" },
  "bot.bot_issues": { label: "Bot console issues", group: "logs", about: "Removed automatically after 30 days" },
  "bot.status_days": { label: "Status page history", group: "logs", about: "Removed automatically" },
  "bot.bot_settings": { label: "Bot settings", group: "system", protected: true },
  "bot.bot_settings_log": { label: "Bot setting changes", group: "system", protected: true },
  "bot.bot_config": { label: "Bot state", group: "system", protected: true },
  "bot.globals": { label: "Global settings", group: "system", protected: true },
  "bot.settings": { label: "Legacy settings", group: "system", protected: true },
  "bot.shop_settings": { label: "Store settings", group: "system", protected: true },
  "bot.counters": { label: "Counters", group: "system", protected: true },
  "bot.season_assets": { label: "Season images", group: "content", protected: true },
  "bot.events": { label: "Events", group: "content", protected: true },
  "bot.event_rsvps": { label: "Event RSVPs", group: "content" },
  "bot.event_polls": { label: "Polls", group: "content" },
  "bot.event_poll_votes": { label: "Poll votes (website)", group: "content" },
  "bot.giveaways": { label: "Giveaways", group: "content", protected: true },
  "bot.giveaway_entries": { label: "Giveaway entries", group: "content" },
  "bot.patreon_members": { label: "Patreon supporters", group: "members", protected: true },
  "bot.patreon_overrides": { label: "Patreon manual perks", group: "members", protected: true },
  "bot.patreon_thanks": { label: "Patreon thank-yous sent", group: "logs" },
  "bot.custom_roles": { label: "Custom roles", group: "economy", protected: true },
  "bot.supporter_prefs": { label: "Supporter preferences", group: "members" },
  "bot.rules_content": { label: "Server rules (edited)", group: "content", protected: true },
  "bot.vc_info": { label: "Voice channel info", group: "cache" },
};

export function infoFor(db: DbName, name: string): CollectionInfo {
  return CATALOG[`${db}.${name}`] ?? { label: name, group: name.endsWith("_log") || name.endsWith("_logs") ? "logs" : "system" };
}

/** Field names whose values are never shown or changed here */
export const SENSITIVE_KEY = /password|passwordhash|salt|secret|token|totp|backupcodes|twofactor|apikey|access_?token|refresh_?token|recovery|otp/i;
export const HIDDEN = "•••hidden•••";

/** What a leaver cleanup can remove (matches the member steps in owner-wipe) */
export const LEAVER_KINDS: { kind: "economy" | "history" | "activity" | "social" | "website" | "directory"; label: string; about: string; default: boolean }[] = [
  { kind: "economy", label: "Economy", about: "Leaves, level, XP, inventory, game stats and boosters. If they come back they start fresh and verify again.", default: true },
  { kind: "history", label: "Purchase & game history", about: "Store purchases, gifts, gambling, QOTD answers, voice rewards", default: true },
  { kind: "activity", label: "Activity stats", about: "Message counts, channels and voice time", default: true },
  { kind: "social", label: "Social", about: "Profile, photos, likes, matches, chats and blocks", default: true },
  { kind: "website", label: "Website extras", about: "Notifications, badge history and read marks", default: true },
  { kind: "directory", label: "Cached name", about: "Their name and avatar in the member list. Without it, logs show their id instead of a name.", default: false },
];
