import { Long } from "mongodb";
import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { getGuildRoles, getMemberRoleIds } from "../../../../../lib/discord-member";
import { resolveMentions } from "../../../../../lib/discord-mentions";
import { getCurrentBans, queryPunishments } from "../../../../../lib/moderation";
import { getBotCollection, getUsersCollection } from "../../../../../lib/mongodb";
import { viewAsEligible } from "../../../../../lib/auth";
import { queryTickets } from "../../../../../lib/tickets";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

async function canViewAs(discordId: string) {
  const account = await (await getUsersCollection()).findOne({ discordId }, { projection: { discordId: 1, emailVerified: 1 } }).catch(() => null);
  return viewAsEligible(account);
}

/** Everything about one member for the admin panel's member drawer. */
export async function GET(request: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const isAdmin = panel.level === "admin";
  const userId = params.userId;
  if (!/^\d{15,21}$/.test(userId)) return NextResponse.json({ ok: false, error: "Invalid Discord ID." }, { status: 400 });

  try {
    const users = await getBotCollection("users");
    const [punishments, tickets, roleIds, guildRoles, bans, stats] = await Promise.all([
      queryPunishments({ userId, pageSize: 100 }),
      // Tickets are admin-only
      isAdmin ? queryTickets({ userId, pageSize: 100 }) : Promise.resolve({ rows: [], total: 0 }),
      getMemberRoleIds(userId),
      getGuildRoles(),
      getCurrentBans(),
      users.findOne({ discordId: { $in: [Long.fromString(userId), userId] } } as never),
    ]);
    const roles = (roleIds ?? [])
      .map((id) => guildRoles.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      // Highest role first, the same order Discord shows
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, colors: r.colors, position: r.position }));
    const { mentions, userIds } = await resolveMentions(punishments.rows.flatMap((p) => [p.reason, p.messageContent]));
    const who = await people([
      ...userIds,
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
        ? {
            level: num(stats.level),
            // Leaf balance is economy/inventory detail: admins only
            balance: isAdmin ? num(stats.balance) : null,
            messages: num(stats.msgCount),
            xp: num(stats.totalXp ?? stats.xp),
          }
        : null,
      punishments: punishments.rows,
      punishmentTotal: punishments.total,
      tickets: isAdmin ? tickets.rows : null,
      // Admins can view the site as members who linked Discord and verified their email
      canViewAs: isAdmin ? await canViewAs(userId) : false,
      ticketTotal: isAdmin ? tickets.total : null,
      people: who,
      mentions,
    });
  } catch (error) {
    console.error("Admin user lookup failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load that member." }, { status: 500 });
  }
}
