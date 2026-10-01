import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { adminConversations, adminThread } from "../../../../../lib/dating/messages";
import { getMongoClient } from "../../../../../lib/mongodb";

export const dynamic = "force-dynamic";

const snowflake = (v: string | null) => (v && /^\d{15,21}$/.test(v) ? v : null);

/**
 * Admins only: a member's Social conversations (?member=), or one conversation (?member=&with=[&before=]).
 * Opening a conversation is written to the admin audit log.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const params = new URL(request.url).searchParams;
  const member = snowflake(params.get("member"));
  if (!member) return NextResponse.json({ ok: false, error: "Unknown member." }, { status: 400 });
  const other = snowflake(params.get("with"));
  try {
    if (!other) {
      const list = await adminConversations(member);
      const who = await people([member, ...list.map((c) => c.other)]).catch(() => ({}));
      return NextResponse.json({ ok: true, conversations: list, people: who }, { headers: { "Cache-Control": "no-store" } });
    }
    const before = params.get("before");
    const thread = await adminThread(member, other, before);
    if (!before) {
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
