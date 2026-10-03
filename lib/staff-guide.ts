// The Staff Guide on the server side: working out someone's rank and the admins' team notes.
// The content itself (commands, how-tos) is in staff-guide-data.ts.

import { memberRoleIdsCached } from "./discord-member";
import { getMongoClient, getStaffCollection } from "./mongodb";
import { RANKS, SR_ADMIN_EXTRA, STAFF_TEAM, type RankName } from "./staff-guide-data";

export * from "./staff-guide-data";

/** A staff member's rank, from their Discord roles (or the synced staff list if Discord is unreachable). */
export async function staffRank(discordId: string): Promise<RankName | null> {
  const roles = await memberRoleIdsCached(discordId).catch(() => null);
  if (roles) {
    if (roles.includes(SR_ADMIN_EXTRA) && !roles.includes(RANKS[6].id)) return "Sr Admin";
    const found = [...RANKS].reverse().find((r) => roles.includes(r.id));
    if (found) return found.name;
    if (roles.includes(STAFF_TEAM)) return "Helper";
  }
  const staff = await getStaffCollection().then((c) => c.findOne({ discord_id: discordId })).catch(() => null);
  const name = String(staff?.role ?? "");
  return (RANKS.find((r) => r.name.toLowerCase() === name.toLowerCase())?.name as RankName | undefined) ?? null;
}

// ---------- team notes (written by admins) ----------

async function notesCol() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website").collection<{ _id: string; text: string; updatedAt: Date; updatedBy: string }>("staff_guide");
}

export async function getNotes() {
  const doc = await (await notesCol()).findOne({ _id: "notes" });
  return doc ? { text: doc.text, updatedAt: doc.updatedAt.toISOString(), updatedBy: doc.updatedBy } : { text: "", updatedAt: null, updatedBy: null };
}

export async function saveNotes(text: string, by: string) {
  const clean = text.replace(/\r/g, "").slice(0, 20_000);
  await (await notesCol()).updateOne({ _id: "notes" }, { $set: { text: clean, updatedAt: new Date(), updatedBy: by } }, { upsert: true });
  return getNotes();
}
