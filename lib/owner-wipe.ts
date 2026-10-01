// Owner only: wipe one member's data from every website and bot collection, except safety records
// (punishments, AutoMod catches, tickets and transcripts, join applications and staff actions, the
// admin audit log, bot logs, the Live Chat mirror, VC rules signatures) so bans and appeals still work.
// Their bot user record is reset to a fresh member's, keeping only who verified them (incl. NSFW).
// Always previewed first; the run is logged to admin_audit and the bot logs channel.

import { Long, type Collection, type Document, type Filter } from "mongodb";
import type { PanelUser } from "./admin";
import { isStaffDiscordId } from "./admin";
import { postChannelMessage } from "./discord-member";
import { getBotCollection, getMongoClient } from "./mongodb";
import { OWNER_DISCORD_ID } from "./ticket-delete";

const STAFF_LOG_CHANNEL_ID = "1360344042705256660";

export class WipeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type Step = { db: "website" | "bot"; collection: string; label: string; filter: Filter<Document> };

/** Every form the id is stored in (text in some collections, a 64-bit number in others). */
function idForms(discordId: string) {
  return { $in: [discordId, Long.fromString(discordId)] } as unknown as Document;
}

async function website() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
}

async function plan(discordId: string) {
  const ids = idForms(discordId);
  const site = await website();
  const account = await site.collection("users").findOne({ discordId }, { projection: { _id: 1 } });
  const accountId = account?._id ?? null;
  const accountIdText = accountId ? String(accountId) : "__none__";
  const steps: Step[] = [
    // Website
    { db: "website", collection: "users", label: "Website account", filter: { discordId } },
    ...(accountId
      ? ([
          { db: "website", collection: "sessions", label: "Signed-in devices", filter: { userId: accountId } },
          { db: "website", collection: "link_codes", label: "Discord link codes", filter: { userId: accountId } },
        ] as Step[])
      : []),
    { db: "website", collection: "notifications", label: "Notifications", filter: { $or: [{ to: discordId }, { actor: discordId }] } },
    { db: "website", collection: "badge_history", label: "Badge history", filter: { _id: discordId } as Document },
    { db: "website", collection: "news_reads", label: "News read marks", filter: { _id: { $in: [discordId, accountIdText] } } as Document },
    { db: "website", collection: "dating_settings", label: "Social settings", filter: { _id: discordId } as Document },
    { db: "website", collection: "dating_profile_views", label: "Profile views", filter: { $or: [{ viewer: discordId }, { viewed: discordId }] } },
    { db: "website", collection: "dating_partners", label: "Partner links", filter: { users: discordId } },
    { db: "website", collection: "dating_conversations", label: "Social chats", filter: { users: discordId } },
    { db: "website", collection: "dating_media.files", label: "Social photos", filter: { "metadata.owner": { $in: [discordId] } } },
    { db: "website", collection: "admin_prefs", label: "Admin panel preferences", filter: { _id: discordId } as Document },
    { db: "website", collection: "vc_rewards", label: "Voice reward history", filter: { userId: discordId } },
    { db: "website", collection: "member_directory", label: "Cached name", filter: { _id: discordId } as Document },
    // Bots
    { db: "bot", collection: "user_inventory", label: "Inventory", filter: { discordId: ids } },
    { db: "bot", collection: "store_sales", label: "Store purchases", filter: { buyerId: ids } },
    { db: "bot", collection: "gift_log", label: "Gifts sent and received", filter: { $or: [{ sender_id: ids }, { recipient_id: ids }] } },
    { db: "bot", collection: "gift_cooldowns", label: "Gift cooldown", filter: { _id: ids } },
    { db: "bot", collection: "gambling", label: "Gambling stats", filter: { discordId: ids } },
    { db: "bot", collection: "gambling_logs", label: "Gambling history", filter: { discordId: ids } },
    { db: "bot", collection: "wordle", label: "Wordle", filter: { discordId: ids } },
    { db: "bot", collection: "qotd", label: "Question of the Day stats", filter: { user_id: ids } },
    { db: "bot", collection: "qotdAnswers", label: "Question of the Day answers", filter: { user_id: ids } },
    { db: "bot", collection: "member_activity", label: "Activity stats", filter: { _id: ids } },
    { db: "bot", collection: "temporary_boosters", label: "Active boosters", filter: { $or: [{ discordId: ids }, { user_id: ids }] } },
    { db: "bot", collection: "profile_drafts", label: "Profile drafts", filter: { _id: ids } },
    { db: "bot", collection: "dating_profiles", label: "Social profile", filter: { _id: ids } },
    { db: "bot", collection: "dating_vectors", label: "Matching data", filter: { _id: ids } },
    { db: "bot", collection: "dating_activity", label: "Like counter", filter: { _id: ids } },
    { db: "bot", collection: "profile_likes", label: "Likes they received", filter: { _id: ids } },
    { db: "bot", collection: "profile_passes", label: "Profiles they passed", filter: { _id: ids } },
    { db: "bot", collection: "dating_matches", label: "Matches", filter: { users: ids } },
    { db: "bot", collection: "dating_friends", label: "Friends", filter: { users: ids } },
    { db: "bot", collection: "dating_blocks", label: "Blocks", filter: { $or: [{ blocker: ids }, { blocked: ids }] } },
  ];
  return { steps, accountId };
}

async function collectionFor(step: Step): Promise<Collection<Document>> {
  return step.db === "website" ? (await website()).collection(step.collection) : getBotCollection(step.collection);
}

async function guard(discordId: string, actor: PanelUser) {
  if (actor.discordId !== OWNER_DISCORD_ID) throw new WipeError("Only the owner can wipe a member's data.", 403);
  if (!/^\d{15,21}$/.test(discordId)) throw new WipeError("That isn't a Discord id.");
  if (discordId === OWNER_DISCORD_ID) throw new WipeError("You can't wipe your own account.");
  if (await isStaffDiscordId(discordId).catch(() => false)) throw new WipeError("Staff can't be wiped. Remove their staff role in Discord first.", 409);
}

/** What a wipe would remove, per collection (nothing is changed). */
export async function previewWipe(discordId: string, actor: PanelUser) {
  await guard(discordId, actor);
  const { steps } = await plan(discordId);
  const rows = await Promise.all(steps.map(async (s) => ({ label: s.label, count: await (await collectionFor(s)).countDocuments(s.filter).catch(() => 0) })));
  const economy = await (await getBotCollection("users")).countDocuments({ discordId: idForms(discordId) });
  rows.push({ label: "Leaves, level and XP (reset to a new member's)", count: economy });
  return { rows: rows.filter((r) => r.count > 0), total: rows.reduce((n, r) => n + r.count, 0) };
}

/** Wipes everything in the preview. Returns what was removed. */
export async function executeWipe(discordId: string, actor: PanelUser) {
  await guard(discordId, actor);
  const { steps } = await plan(discordId);
  const ids = idForms(discordId);
  const removed: { label: string; count: number }[] = [];

  // Social chats: their messages go with the conversations
  const site = await website();
  const convIds = (await site.collection("dating_conversations").find({ users: discordId }, { projection: { _id: 1 } }).toArray()).map((c) => c._id);
  if (convIds.length) {
    const r = await site.collection("dating_messages").deleteMany({ conv: { $in: convIds } });
    removed.push({ label: "Social messages", count: r.deletedCount });
  }
  // Photos are stored in pieces: drop the pieces with the files
  const photoIds = (await site.collection("dating_media.files").find({ "metadata.owner": discordId }, { projection: { _id: 1 } }).toArray()).map((f) => f._id);
  if (photoIds.length) await site.collection("dating_media.chunks").deleteMany({ files_id: { $in: photoIds } });

  for (const s of steps) {
    const r = await (await collectionFor(s)).deleteMany(s.filter).catch(() => ({ deletedCount: 0 }));
    if (r.deletedCount) removed.push({ label: s.label, count: r.deletedCount });
  }

  // Their likes and passes inside other members' records
  const likes = await getBotCollection("profile_likes");
  await likes.updateMany({}, { $pull: { likes: { liker_id: ids }, historical_likers: ids } } as Document).catch(() => undefined);
  const passes = await getBotCollection("profile_passes");
  await passes.updateMany({}, { $pull: { passed_users: { user_id: ids } } } as Document).catch(() => undefined);
  await passes.updateMany({}, { $pull: { passed_users: ids } } as Document).catch(() => undefined);

  // Economy record: back to a brand-new member's, keeping only who verified them
  const users = await getBotCollection("users");
  const old = await users.findOne({ discordId: ids });
  if (old) {
    const now = new Date();
    await users.replaceOne(
      { _id: old._id },
      {
        discordId: old.discordId,
        balance: 0,
        level: 1,
        xp: 0,
        xpNeeded: 100,
        streak: 0,
        lastDaily: null,
        lastMessage: null,
        xpMultiplier: 1.0,
        multiplier: 1.0,
        createdAt: now,
        updatedAt: now,
        msgCount: 0,
        verifiedBy: old.verifiedBy ?? null,
        nsfwVerifiedBy: old.nsfwVerifiedBy ?? null,
        wipedAt: now,
      },
    );
    removed.push({ label: "Leaves, level and XP (reset)", count: 1 });
  }

  const total = removed.reduce((n, r) => n + r.count, 0);
  await site
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: "wipe-member", targetDiscordId: discordId, removed, adminDiscordId: actor.discordId, adminName: actor.name })
    .catch(() => undefined);
  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: "🧹 Member data wiped (owner)",
        color: 0xe5484d,
        description: removed.length ? removed.map((r) => `• ${r.label}: **${r.count}**`).join("\n").slice(0, 3500) : "Nothing was stored for them.",
        fields: [
          { name: "Member", value: `<@${discordId}>\n\`${discordId}\``, inline: true },
          { name: "Wiped by", value: `<@${actor.discordId}>`, inline: true },
          { name: "Kept", value: "Punishments, AutoMod, tickets, join applications, logs and verification", inline: false },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  }).catch(() => false);
  return { removed, total };
}
