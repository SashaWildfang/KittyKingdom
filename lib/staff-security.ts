// Team → Security: does every staff member have a linked website account with two-factor on, and which devices
// are signed in. Admins can sign a staff member out everywhere.

import type { PanelUser } from "./admin";
import { getMongoClient, getStaffCollection, getUsersCollection } from "./mongodb";
import { sessionsCollection } from "./sessions";

export type StaffSecurity = {
  id: string;
  name: string;
  role: string;
  rank: number;
  account: boolean;
  emailVerified: boolean;
  twoFactor: boolean;
  sessions: { id: string; device: string; where: string; lastSeen: string; created: string }[];
};

export async function staffSecurity(): Promise<StaffSecurity[]> {
  const staff = (await (await getStaffCollection()).find({}).toArray()).filter((d) => d.role !== "Content Creator");
  const ids = staff.map((s) => String(s.discord_id ?? s._id));
  const users = await (await getUsersCollection()).find({ discordId: { $in: ids } }, { projection: { discordId: 1, emailVerified: 1, "twoFactor.enabled": 1 } }).toArray();
  const byDiscord = new Map(users.map((u) => [String(u.discordId), u]));
  const sessions = await (await sessionsCollection())
    .find({ userId: { $in: users.map((u) => u._id) }, revokedAt: { $exists: false }, lastSeenAt: { $gte: new Date(Date.now() - 30 * 86_400_000) } } as never)
    .sort({ lastSeenAt: -1 })
    .toArray();
  return staff
    .map((s) => {
      const id = String(s.discord_id ?? s._id);
      const u = byDiscord.get(id);
      return {
        id,
        name: String(s.display_name ?? s.username ?? "Staff member"),
        role: String(s.role ?? "Staff"),
        rank: typeof s.rank === "number" ? s.rank : 99,
        account: Boolean(u),
        emailVerified: Boolean(u?.emailVerified),
        twoFactor: Boolean(u?.twoFactor?.enabled),
        sessions: u
          ? sessions
              .filter((x) => String(x.userId) === String(u._id))
              .slice(0, 10)
              .map((x) => ({
                id: String(x._id),
                device: [x.device?.browser, x.device?.os].filter(Boolean).join(" on ") || "Unknown device",
                where: [x.location?.city, x.location?.region, x.location?.country].filter(Boolean).join(", ") || "Unknown place",
                lastSeen: x.lastSeenAt instanceof Date ? x.lastSeenAt.toISOString() : "",
                created: x.createdAt instanceof Date ? x.createdAt.toISOString() : "",
              }))
          : [],
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

/** Signs a staff member out of every device (they'll need to sign in again). */
export async function signOutEverywhere(panel: PanelUser, discordId: string) {
  const u = await (await getUsersCollection()).findOne({ discordId }, { projection: { _id: 1 } });
  if (!u) throw new Error("They don't have a website account.");
  const r = await (await sessionsCollection()).updateMany({ userId: u._id, revokedAt: { $exists: false } } as never, { $set: { revokedAt: new Date(), revokedBy: panel.name } });
  await (await getMongoClient())
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: "staff-sign-out-everywhere", targetDiscordId: discordId, count: r.modifiedCount, adminDiscordId: panel.discordId, adminName: panel.name })
    .catch(() => undefined);
  return r.modifiedCount;
}
