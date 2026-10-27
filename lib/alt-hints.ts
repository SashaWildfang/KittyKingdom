// "Might be an alt of…" hints for the member profile. These are leads for staff to look into, never proof:
//   • signed in to the website from the same network as another account (admins only; the IP itself is never shown)
//   • a name very close to someone who is banned
//   • the same birthday on their join application as someone banned, kicked or matched another way

import type { PanelUser } from "./admin";
import { bannedUsers } from "./appeals";
import { applicationBirthday } from "./join-application";
import { getBotCollection, getMongoClient, getUsersCollection } from "./mongodb";
import { sessionsCollection } from "./sessions";

export type AltSignal = { kind: "network" | "name" | "birthday"; label: string; strength: "strong" | "medium" };
export type AltHint = { discordId: string; banned: boolean; signals: AltSignal[] };

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s" };
/** "xX_Sh4dow.Wolf_99Xx" -> "shadowwolf" */
export function normName(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[01345789@$]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, "")
    .replace(/^(?:xx+|the|real|its|im|official)+(?=[a-z]{4})/, "")
    .replace(/(?<=[a-z]{4})(?:xx+|alt|main|backup|new)+$/, "")
    .replace(/(.)\1{2,}/g, "$1$1");
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** Two names that are the same once you ignore numbers, symbols, leetspeak and small typos. */
export function similarNames(a: string, b: string) {
  if (a.length < 4 || b.length < 4) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 5 && long.includes(short)) return true;
  // Short names differ by one letter all the time (sunny / bunny); only longer ones allow typos
  if (short.length < 6) return false;
  return distance(a, b) <= (short.length >= 9 ? 2 : 1);
}

const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i;

async function networkMatches(discordId: string): Promise<Map<string, number>> {
  const users = await getUsersCollection();
  const me = await users.find({ discordId }, { projection: { _id: 1 } }).toArray();
  if (!me.length) return new Map();
  const sessions = await sessionsCollection();
  const myIds = me.map((u) => u._id);
  const mine = new Set(myIds.map(String));
  const ips = (await sessions.distinct("ip", { userId: { $in: myIds } } as never)).filter((ip): ip is string => typeof ip === "string" && !!ip && !PRIVATE_IP.test(ip));
  if (!ips.length) return new Map();
  // A shared IP used by lots of accounts is a school, VPN or mobile carrier, not a lead
  const groups = await sessions.aggregate([{ $match: { ip: { $in: ips.slice(0, 50) } } }, { $group: { _id: "$ip", users: { $addToSet: "$userId" } } }]).toArray();
  const others = new Map<string, { id: unknown; n: number }>();
  for (const g of groups) {
    const list = (g.users as unknown[]).filter((u) => !mine.has(String(u)));
    if (!list.length || list.length > 4) continue;
    for (const u of list) others.set(String(u), { id: u, n: (others.get(String(u))?.n ?? 0) + 1 });
  }
  if (!others.size) return new Map();
  const accounts = await users
    .find({ _id: { $in: Array.from(others.values()).map((o) => o.id) }, discordId: { $type: "string", $ne: discordId } } as never, { projection: { discordId: 1 } })
    .toArray();
  return new Map(accounts.map((a) => [String(a.discordId), others.get(String(a._id))?.n ?? 1]));
}

let birthdayCache: { at: number; byDay: Map<string, string[]> } | null = null;
/** Every join application's birthday ("2001-12-27" -> applicant ids), cached for 10 minutes. */
async function birthdays() {
  if (birthdayCache && Date.now() - birthdayCache.at < 10 * 60_000) return birthdayCache.byDay;
  const rows = await (await getBotCollection("join_applications"))
    .find({}, { projection: { discordId: 1, discord_id: 1, userId: 1, ageAndDob: 1, age_and_dob: 1, ageDOB: 1, ageDob: 1, dateOfBirth: 1, date_of_birth: 1, dob: 1, DOB: 1, birthdate: 1, age: 1 } })
    .limit(20_000)
    .toArray();
  const byDay = new Map<string, string[]>();
  for (const r of rows) {
    const id = String(r.discordId ?? r.discord_id ?? r.userId ?? "");
    const day = applicationBirthday(r as Record<string, unknown>).birthDate?.toISOString().slice(0, 10);
    if (!id || !day) continue;
    const list = byDay.get(day) ?? [];
    if (!list.includes(id)) list.push(id);
    byDay.set(day, list);
  }
  birthdayCache = { at: Date.now(), byDay };
  return byDay;
}

export async function altHints(panel: PanelUser, discordId: string): Promise<AltHint[]> {
  const db = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
  const [me, banned, network, days, myApp] = await Promise.all([
    db.collection("member_directory").findOne({ _id: discordId as never }).catch(() => null),
    bannedUsers().catch(() => []),
    panel.level === "admin" ? networkMatches(discordId).catch(() => new Map<string, number>()) : Promise.resolve(new Map<string, number>()),
    birthdays().catch(() => new Map<string, string[]>()),
    getBotCollection("join_applications")
      .then((c) => c.findOne({ $or: [{ discordId }, { discord_id: discordId }, { userId: discordId }] }, { sort: { submittedAt: -1 } }))
      .catch(() => null),
  ]);

  const hints = new Map<string, AltHint>();
  const bannedIds = new Set(banned.map((b) => b.id));
  const add = (id: string, signal: AltSignal) => {
    if (id === discordId) return;
    const h = hints.get(id) ?? { discordId: id, banned: bannedIds.has(id), signals: [] };
    if (!h.signals.some((s) => s.kind === signal.kind)) h.signals.push(signal);
    hints.set(id, h);
  };

  network.forEach((n, id) => add(id, { kind: "network", label: n > 1 ? `Signed in to the website from the same network (${n} times)` : "Signed in to the website from the same network", strength: "strong" }));

  const myNames = Array.from(new Set([me?.username, me?.displayName, me?.nick].map((n) => normName(n as string | null)).filter((n) => n.length >= 4)));
  if (myNames.length) {
    for (const b of banned) {
      const theirs = [b.username, b.global_name].map((n) => normName(n));
      if (myNames.some((m) => theirs.some((t) => similarNames(m, t)))) add(b.id, { kind: "name", label: `Name close to banned “${b.global_name || b.username}”`, strength: "medium" });
    }
  }

  const day = myApp ? applicationBirthday(myApp as Record<string, unknown>).birthDate?.toISOString().slice(0, 10) : null;
  const sameDay = day ? (days.get(day) ?? []).filter((id) => id !== discordId) : [];
  if (sameDay.length && sameDay.length <= 25) {
    // A shared birthday on its own is common; it only counts next to something else
    const kicked = new Set(
      (
        await (await getBotCollection("punishments"))
          .distinct("discordId", { action: { $in: ["ban", "kick"] }, discordId: { $in: sameDay } })
          .catch(() => [] as unknown[])
      ).map(String),
    );
    for (const id of sameDay) {
      if (bannedIds.has(id) || kicked.has(id) || hints.has(id)) add(id, { kind: "birthday", label: "Same birthday on their join application", strength: "medium" });
    }
  }

  const rank = (h: AltHint) => h.signals.reduce((n, s) => n + (s.strength === "strong" ? 3 : 1), 0) + (h.banned ? 1 : 0);
  return Array.from(hints.values())
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 8);
}
