import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { adminConversations, adminThread } from "../../../../../lib/dating/messages";
import { getMongoClient } from "../../../../../lib/mongodb";

export const dynamic = "force-dynamic";

const snowflake = (v: string | null) => (v && /^\d{15,21}$/.test(v) ? v : null);

/**
 * Admins only (Admin → Messages):
 *   ?[member=][&before=<iso>]            conversations across the site (or one member's), newest first
 *   ?member=&with=[&before=id|&after=id] one conversation (after = only new messages, for the live view)
 * Opening a conversation (not paging or live updates) is written to the admin audit log.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const params = new URL(request.url).searchParams;
  const member = snowflake(params.get("member"));
  const other = snowflake(params.get("with"));
  try {
    if (!member || !other) {
      const before = params.get("before");
      const list = await adminConversations({ member, before: before && !Number.isNaN(Date.parse(before)) ? before : null, limit: Number(params.get("limit")) || 40 });
      const who = await people(list.conversations.flatMap((c) => c.users)).catch(() => ({}));
      return NextResponse.json({ ok: true, ...list, people: who }, { headers: { "Cache-Control": "no-store" } });
    }
    const before = params.get("before");
    const after = params.get("after");
    const thread = await adminThread(member, other, { before, after });
    if (!before && !after) {
      await (await getMongoClient())
        .db(process.env.MONGODB_DB ?? "website")
        .collection("admin_audit")
        .insertOne({ at: new Date(), action: "view-social-messages", targetDiscordId: member, otherDiscordId: other, adminDiscordId: admin.discordId, adminName: admin.name })
        .catch(() => undefined);
    }
    const who = await people([member, other]).catch(() => ({}));
    return NextResponse.json({ ok: true, ...thread, people: who }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin messages failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load messages." }, { status: 500 });
  }
}
