// The alert admins get in admin-general when someone appeals: a Staff Team ping, then everything needed to decide
// in one embed (the appeal, the punishment, the member, their whole record, past appeals, staff notes) with buttons
// to the appeal and their profile. Built from lib/appeals.ts after an appeal is saved; never blocks the appeal.

import type { Document } from "mongodb";
import { people } from "./admin-people";
import { getMemberBasics, postChannelMessage } from "./discord-member";
import { getCurrentBans, queryPunishments } from "./moderation";
import { getMongoClient } from "./mongodb";
import { getWatch, listNotes } from "./staff-notes";

const CHANNEL_ID = "1358489306691407902"; // admin-general
const STAFF_TEAM_ROLE_ID = "1358470109965979859";
const SITE = "https://bear-nation.net";
const DISCORD_EPOCH = BigInt("1420070400000");

const COLORS: Record<string, number> = { ban: 0xe5484d, kick: 0xf76b15, kick_unverified: 0xf76b15, mute: 0xffb224, tempmute: 0xffb224, timeout: 0xffb224, warn: 0xf5d90a };
const LABEL: Record<string, string> = { ban: "Ban", tempban: "Temp ban", kick: "Kick", kick_unverified: "Kick (unverified)", mute: "Mute", tempmute: "Tempmute", timeout: "Timeout", muzzle: "Muzzle", warn: "Warning", unban: "Unban", unmute: "Unmute" };

const ts = (d: Date | string | null | undefined, style = "D") => {
  const t = d ? new Date(d).getTime() : NaN;
  return Number.isFinite(t) ? `<t:${Math.floor(t / 1000)}:${style}>` : "unknown";
};
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const label = (a: string) => LABEL[a] ?? a.replace(/_/g, " ");

/** Their punishments, newest first: every page (100 per page) up to their latest 1,000. */
async function wholeRecord(discordId: string) {
  const first = await queryPunishments({ userId: discordId, pageSize: 100, page: 1 });
  const rows = [...first.rows];
  for (let page = 2; rows.length < first.total && page <= 10; page += 1) {
    const next = await queryPunishments({ userId: discordId, pageSize: 100, page });
    if (!next.rows.length) break;
    rows.push(...next.rows);
  }
  return { ...first, rows };
}

export type AppealAlertInput = {
  discordId: string;
  username: string;
  name: string;
  avatar: string | null;
  message: string;
  email: boolean;
  ref: string;
  appealId: string;
  punishmentId: string;
  punishment: { action: string; reason: string; at: Date | null; expiresAt: Date | null; issuerId: string | null };
};

export async function sendAppealAlert(a: AppealAlertInput) {
  const site = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
  const safe = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [record, member, bans, pastAppeals, notes, watch, last30] = await Promise.all([
    safe(wholeRecord(a.discordId), { rows: [], total: 0 } as unknown as Awaited<ReturnType<typeof queryPunishments>>),
    safe(getMemberBasics(a.discordId), null),
    safe(getCurrentBans(), null),
    safe(site.collection("appeals").find({ discordId: a.discordId }).sort({ createdAt: -1 }).limit(20).toArray(), [] as Document[]),
    safe(listNotes(a.discordId), []),
    safe(getWatch(a.discordId), null),
    // Counted across their whole record, not just the rows loaded above
    safe(queryPunishments({ userId: a.discordId, from: new Date(Date.now() - 30 * 86_400_000), pageSize: 1 }).then((r) => r.total), null as number | null),
  ]);
  const issuers = await safe(people(record.rows.map((r) => r.issuerId).concat(a.punishment.issuerId)), {} as Awaited<ReturnType<typeof people>>);
  const p = a.punishment;
  const now = Date.now();

  // ── The punishment they're appealing ──
  const byLine = p.issuerId ? `<@${p.issuerId}>${issuers[p.issuerId]?.name ? ` (${issuers[p.issuerId].name})` : ""}` : "AutoMod / the bot";
  // The bot stamps every punishment with an expiry, but only mutes really end (and warnings stop counting):
  // a ban is permanent until it's lifted, and a kick is over the moment it happens
  const timed = ["mute", "tempmute", "timeout", "muzzle", "warn"].includes(p.action);
  const ends =
    p.action === "ban" || p.action === "tempban"
      ? "Permanent until it's lifted"
      : p.action.startsWith("kick")
        ? "One-off (they could rejoin)"
        : timed && p.expiresAt
          ? `${new Date(p.expiresAt).getTime() > now ? (p.action === "warn" ? "Stops counting" : "Ends") : p.action === "warn" ? "Stopped counting" : "Ended"} ${ts(p.expiresAt, "f")} (${ts(p.expiresAt, "R")})`
          : "No end date";
  const appealed = [`**${label(p.action)}** on ${ts(p.at)} (${ts(p.at, "R")})`, `**Reason:** ${cut(p.reason || "No reason given", 300)}`, `**Given by:** ${byLine}`, `**${ends}**`].join("\n");

  // ── The member ──
  const banned = bans ? bans.has(a.discordId) : null;
  const created = new Date(Number((BigInt(a.discordId) >> BigInt(22)) + DISCORD_EPOCH));
  const memberLines = [
    member ? `✅ In the server since ${ts(member.joinedAt)}` : banned ? "🔨 Banned (not in the server)" : "🚪 Not in the server",
    `Account made ${ts(created, "R")}`,
    `Discord ID \`${a.discordId}\``,
  ];

  // ── Their record ──
  const rows = record.rows;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.action, (counts.get(r.action) ?? 0) + 1);
  const recent30 = last30 ?? rows.filter((r) => now - new Date(r.timestamp).getTime() < 30 * 86_400_000).length;
  // Worked out here rather than from the record's status (that leans on Discord's ban list, which can be unavailable):
  // mutes that haven't ended, warnings that still count, and a ban only when the ban list confirms it
  const TIMED = ["mute", "tempmute", "timeout", "muzzle", "warn"];
  const active = [
    ...rows.filter((r) => TIMED.includes(r.action) && r.expiresAt && new Date(r.expiresAt).getTime() > now).map((r) => (r.action === "warn" ? "Warning (still counts)" : label(r.action))),
    ...(banned === true ? ["Ban"] : []),
  ];
  const partial = record.total > rows.length;
  const automod = rows.filter((r) => r.source === "automod").length;
  const recordLines = rows.length
    ? [
        `**${record.total}** total · **${recent30}** in the last 30 days${automod ? ` · ${automod} by AutoMod` : ""}`,
        Array.from(counts)
          .sort((x, y) => y[1] - x[1])
          .map(([k, n]) => `${label(k)} ×${n}`)
          .join(" · ") + (partial ? ` *(of their latest ${rows.length})*` : ""),
        active.length ? `**Active now:** ${Array.from(new Set(active)).join(", ")}` : banned === null ? "Nothing active right now (couldn't check bans)" : "Nothing active right now",
      ]
    : ["Clean record apart from this one"];

  // Most recent first; the appealed punishment is marked
  const history = rows.slice(0, 8).map((r) => {
    const who = r.source === "automod" ? "AutoMod" : r.issuerId ? issuers[r.issuerId]?.name ?? "staff" : "staff";
    const mark = r.id === a.punishmentId ? " ◀ **appealed**" : "";
    return `${ts(r.timestamp, "d")} **${label(r.action)}** · ${cut(r.reason || "no reason", 70)} *(${who})*${mark}`;
  });
  const older = record.total > 8 ? `\n…and ${record.total - 8} older` : "";

  // ── Past appeals ──
  const others = pastAppeals.filter((x) => String(x._id) !== a.appealId);
  const tally = { accepted: 0, denied: 0, pending: 0 } as Record<string, number>;
  for (const x of others) tally[String(x.status)] = (tally[String(x.status)] ?? 0) + 1;
  const lastDecided = others.find((x) => x.decidedAt);
  const appealsLine = others.length
    ? `${others.length} before: ${tally.accepted} accepted, ${tally.denied} denied${tally.pending ? `, ${tally.pending} waiting` : ""}` +
      (lastDecided ? `\nLast: **${String(lastDecided.status)}** ${ts(lastDecided.decidedAt, "R")} for a ${label(String((lastDecided.punishment as Document | undefined)?.action ?? "punishment"))}${lastDecided.decidedBy ? ` by ${lastDecided.decidedBy}` : ""}` : "")
    : "This is their first appeal";

  // ── Staff notes and the watchlist ──
  const staffLines: string[] = [];
  if (watch) staffLines.push(`👁️ **On the watchlist:** ${cut(watch.reason, 150)} *(${watch.byName})*`);
  if (notes.length) {
    staffLines.push(`📝 **${notes.length} staff note${notes.length === 1 ? "" : "s"}**`);
    for (const n of notes.slice(0, 2)) staffLines.push(`> ${cut(n.text.replace(/\s+/g, " "), 140)} *(${n.byName}, ${ts(n.at, "R")})*`);
  }

  const quoted = cut(a.message.trim(), 1400)
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

  const fields = [
    { name: "⚖️ Appealing", value: cut(appealed, 1024), inline: false },
    { name: "👤 Member", value: memberLines.join("\n"), inline: true },
    { name: "📋 Record", value: cut(recordLines.join("\n"), 1024), inline: true },
    { name: "🕑 Recent history", value: cut(history.join("\n") + older || "Nothing else on record", 1024), inline: false },
    { name: "📨 Past appeals", value: cut(appealsLine, 1024), inline: true },
    ...(staffLines.length ? [{ name: "🛡️ Staff notes", value: cut(staffLines.join("\n"), 1024), inline: false }] : []),
  ];

  const embed = {
    author: { name: `${a.name} (@${a.username})`, ...(a.avatar ? { icon_url: a.avatar } : {}) },
    title: `📨 Appeal for a ${label(p.action).toLowerCase()} · ${a.ref}`,
    url: `${SITE}/admin?tab=appeals`,
    description: `**What they wrote**\n${quoted}`,
    color: COLORS[p.action] ?? 0x5865f2,
    fields,
    footer: { text: `${a.email ? "They left an email for the answer" : "No email given: they'll see the answer on the appeals page"} · Ref ${a.ref}` },
    timestamp: new Date().toISOString(),
  };
  const buttons = {
    type: 1,
    components: [
      { type: 2, style: 5, label: "Review appeal", url: `${SITE}/admin?tab=appeals` },
      { type: 2, style: 5, label: "Open their profile", url: `${SITE}/admin?member=${a.discordId}` },
    ],
  };

  return postChannelMessage(
    CHANNEL_ID,
    { content: `<@&${STAFF_TEAM_ROLE_ID}> New appeal from <@${a.discordId}> for a **${label(p.action).toLowerCase()}**.`, embeds: [embed], components: [buttons] },
    [],
    [STAFF_TEAM_ROLE_ID],
  );
}
