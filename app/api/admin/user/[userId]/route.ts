import { Long } from "mongodb";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { getGuildRoles, getMemberRoleIds } from "../../../../../lib/discord-member";
import { getCurrentBans, queryPunishments } from "../../../../../lib/moderation";
import { getBotCollection } from "../../../../../lib/mongodb";
import { queryTickets } from "../../../../../lib/tickets";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Everything about one member for the admin panel's member drawer. */
export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const userId = params.userId;
  if (!/^\d{15,21}$/.test(userId)) return NextResponse.json({ ok: false, error: "Invalid Discord ID." }, { status: 400 });

  try {
    const users = await getBotCollection("users");
    const [punishments, tickets, roleIds, guildRoles, bans, stats] = await Promise.all([
      queryPunishments({ userId, pageSize: 100 }),
      queryTickets({ userId, pageSize: 100 }),
      getMemberRoleIds(userId),
      getGuildRoles(),
      getCurrentBans(),
      users.findOne({ discordId: { $in: [Long.fromString(userId), userId] } } as never),
    ]);
    const roles = (roleIds ?? [])
      .map((id) => guildRoles.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({ id: r.id, name: r.name, colors: r.colors }));
    const who = await people([
      userId,
      ...punishments.rows.map((p) => p.issuerId),
      ...tickets.rows.flatMap((t) => [t.claimedBy, t.resolvedBy]),
    ]);
    const num = (v: unknown) => (typeof v === "number" ? v : v ? Number(v) : 0);
    return NextResponse.json({
      ok: true,
      userId,
      inServer: roleIds !== null,
      banned: bans ? bans.has(userId) : null,
      roles,
      stats: stats
        ? { level: num(stats.level), balance: num(stats.balance), messages: num(stats.msgCount), xp: num(stats.totalXp ?? stats.xp) }
        : null,
      punishments: punishments.rows,
      punishmentTotal: punishments.total,
      tickets: tickets.rows,
      ticketTotal: tickets.total,
      people: who,
    });
  } catch (error) {
    console.error("Admin user lookup failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load that member." }, { status: 500 });
  }
}
