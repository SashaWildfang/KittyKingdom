import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { discordRequest, getGuildRoles, guildId } from "../../../../lib/discord-member";
import { getMongoClient } from "../../../../lib/mongodb";
import { CatalogError, DEFAULT_CATEGORIES, cleanCatalog, getRoleCatalogDoc, saveRoleCatalog } from "../../../../lib/role-catalog";

export const dynamic = "force-dynamic";

const fail = (error: unknown) => {
  if (error instanceof CatalogError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Role catalog request failed", error);
  return NextResponse.json({ ok: false, error: "That didn't work right now. Please try again." }, { status: 500 });
};

async function audit(admin: { discordId: string; name: string }, action: string, extra: Record<string, unknown> = {}) {
  await (await getMongoClient())
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({ at: new Date(), action, adminDiscordId: admin.discordId, adminName: admin.name, ...extra })
    .catch(() => undefined);
}

/** Admins: the role picker's categories and roles, plus the server's roles to link them to. */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const [doc, guildRoles] = await Promise.all([getRoleCatalogDoc(true), getGuildRoles()]);
    const roles = Array.from(guildRoles.values())
      .filter((r) => !r.managed && r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.colors[0] ?? null, position: r.position }));
    return NextResponse.json({ ok: true, ...doc, guildRoles: roles }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: save the whole list ({categories, version}). The Main Bot updates its panels within a few seconds. */
export async function PUT(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const body = (await request.json().catch(() => ({}))) as { categories?: unknown; version?: number };
    const categories = cleanCatalog(body.categories);
    // Every role has to be a real role in the server (and not a bot's own managed role)
    const guildRoles = await getGuildRoles();
    if (guildRoles.size) {
      for (const c of categories) {
        for (const r of c.roles) {
          const g = guildRoles.get(r.id);
          if (!g) throw new CatalogError(`"${r.name}" in ${c.title} isn't linked to a role that exists in the server any more.`);
          if (g.managed) throw new CatalogError(`"${r.name}" is linked to a bot's own role, which can't be given out.`);
        }
      }
    }
    const version = await saveRoleCatalog(categories, admin, typeof body.version === "number" ? body.version : null);
    await audit(admin, "role-catalog-save", { version, categories: categories.length, roles: categories.reduce((n, c) => n + c.roles.length, 0) });
    return NextResponse.json({ ok: true, version });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: {action: "create-role", name, color} makes a new Discord role to add to the picker; {action: "reset"} goes back to the built-in list. */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string; name?: string; color?: string; version?: number };
    if (body.action === "reset") {
      const version = await saveRoleCatalog(DEFAULT_CATEGORIES, admin, typeof body.version === "number" ? body.version : null);
      await audit(admin, "role-catalog-reset", { version });
      return NextResponse.json({ ok: true, version });
    }
    if (body.action === "create-role") {
      const name = String(body.name ?? "").trim().slice(0, 100);
      if (!name) throw new CatalogError("Give the new role a name.");
      const color = /^#[0-9a-fA-F]{6}$/.test(String(body.color ?? "")) ? parseInt(String(body.color).slice(1), 16) : 0;
      const guild = await guildId();
      if (!guild) throw new CatalogError("The server isn't set up yet.", 503);
      // No permissions, not shown separately, not mentionable: just a label members can pick
      const res = await discordRequest<{ id: string; name: string }>("POST", `/guilds/${guild}/roles`, { name, color, permissions: "0", hoist: false, mentionable: false });
      if (!res.ok || !res.data?.id) throw new CatalogError(`Discord didn't create the role (error ${res.status || "network"}). Check the bot can Manage Roles.`, 502);
      await audit(admin, "role-catalog-create-role", { roleId: res.data.id, name });
      return NextResponse.json({ ok: true, role: { id: res.data.id, name: res.data.name, color: body.color ?? null } });
    }
    throw new CatalogError("Unknown action.");
  } catch (error) {
    return fail(error);
  }
}
