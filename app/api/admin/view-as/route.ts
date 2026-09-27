import { ObjectId, type Document } from "mongodb";
import { NextResponse } from "next/server";
import { VIEW_AS_COOKIE, VIEW_AS_MS, getRealUser, getViewAs, viewAsCookieValue, viewAsEligible } from "../../../../lib/auth";
import { panelLevel } from "../../../../lib/admin";
import { getMongoClient, getUsersCollection } from "../../../../lib/mongodb";
import { accountName } from "../../../../lib/names";

export const dynamic = "force-dynamic";

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

/** The real signed-in admin (never the member being viewed). */
async function realAdmin() {
  const user = await getRealUser();
  if (!user?.discordId) return null;
  return (await panelLevel(String(user.discordId)).catch(() => null)) === "admin" ? user : null;
}

async function audit(admin: Document, action: string, target: Document | null) {
  const client = await getMongoClient();
  await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({
      at: new Date(),
      action,
      accountId: target ? String(target._id) : null,
      targetName: target ? accountName(target) : null,
      adminDiscordId: String(admin.discordId),
      adminName: accountName(admin),
      adminAccountId: String(admin._id),
    })
    .catch(() => undefined);
}

const summary = (u: Document) => ({
  id: String(u._id),
  name: accountName(u),
  username: u.username ? String(u.username) : null,
  discordId: String(u.discordId),
  avatar: `/api/discord/avatar/${String(u.discordId)}`,
});

/** ?q= search accounts that can be viewed as, plus who is being viewed now. */
export async function GET(request: Request) {
  const admin = await realAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  const users = await getUsersCollection();
  const filter: Document = { discordId: { $nin: [null, ""] }, emailVerified: true, _id: { $ne: admin._id } };
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ displayName: rx }, { username: rx }, { email: rx }, { "discord.username": rx }, { discordId: q }];
  }
  const rows = await users.find(filter, { projection: { displayName: 1, username: 1, email: 1, discord: 1, discordId: 1 } }).sort({ lastActiveAt: -1 }).limit(8).toArray();
  const current = await getViewAs();
  return NextResponse.json({ ok: true, accounts: rows.map(summary), current: current ? summary(current.target) : null }, { headers: { "Cache-Control": "no-store" } });
}

/** { accountId } or { discordId }: start (or switch) viewing the site as that member. */
export async function POST(request: Request) {
  const admin = await realAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { accountId?: unknown; discordId?: unknown };
  const users = await getUsersCollection();
  let target: Document | null = null;
  if (typeof body.accountId === "string" && ObjectId.isValid(body.accountId)) target = await users.findOne({ _id: new ObjectId(body.accountId) });
  else if (typeof body.discordId === "string" && /^\d{15,21}$/.test(body.discordId)) target = await users.findOne({ discordId: body.discordId });
  if (!target) return NextResponse.json({ ok: false, error: "That member doesn't have a website account." }, { status: 404 });
  if (String(target._id) === String(admin._id)) return NextResponse.json({ ok: false, error: "That's your own account." }, { status: 400 });
  if (!viewAsEligible(target)) {
    return NextResponse.json({ ok: false, error: "Only accounts with a linked Discord and a verified email can be viewed." }, { status: 400 });
  }
  // Other admins' accounts stay private
  if ((await panelLevel(String(target.discordId)).catch(() => null)) === "admin") {
    return NextResponse.json({ ok: false, error: "You can't view the site as another admin." }, { status: 403 });
  }
  await audit(admin, "view-as", target);
  const res = NextResponse.json({ ok: true, viewing: summary(target), redirect: "/account" });
  res.cookies.set(VIEW_AS_COOKIE, viewAsCookieValue(String(admin._id), String(target._id)), { ...cookieOptions, maxAge: Math.floor(VIEW_AS_MS / 1000) });
  // Readable flag so the page knows to show the "Viewing as" bar (the real check is the signed cookie)
  res.cookies.set("kk_view_as_on", "1", { ...cookieOptions, httpOnly: false, maxAge: Math.floor(VIEW_AS_MS / 1000) });
  return res;
}

/** Stop viewing as someone. */
export async function DELETE() {
  const current = await getViewAs();
  const admin = await getRealUser();
  if (admin && current) await audit(admin, "view-as-exit", current.target);
  const res = NextResponse.json({ ok: true, redirect: "/admin?tab=accounts" });
  res.cookies.set(VIEW_AS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  res.cookies.set("kk_view_as_on", "", { ...cookieOptions, httpOnly: false, maxAge: 0 });
  return res;
}
