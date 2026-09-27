import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin";
import { postChannelMessage } from "../../../../../../lib/discord-member";
import { getMongoClient } from "../../../../../../lib/mongodb";
import { StoreError, adminInventory, adminSetInventory } from "../../../../../../lib/store";

export const dynamic = "force-dynamic";

const STAFF_LOG_CHANNEL_ID = "1360344042705256660";

/** A member's inventory and the item catalog (admins). */
export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  if (!/^\d{15,21}$/.test(params.userId)) return NextResponse.json({ ok: false, error: "Invalid member." }, { status: 400 });
  return NextResponse.json({ ok: true, ...(await adminInventory(params.userId)) }, { headers: { "Cache-Control": "no-store" } });
}

/** { itemId, count } — sets how many of an item they have. Logged to the audit log and staff log. */
export async function POST(request: Request, { params }: { params: { userId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  if (!/^\d{15,21}$/.test(params.userId)) return NextResponse.json({ ok: false, error: "Invalid member." }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as { itemId?: unknown; count?: unknown };
  if (typeof body.itemId !== "string" || typeof body.count !== "number") return NextResponse.json({ ok: false, error: "Pick an item and an amount." }, { status: 400 });

  try {
    const change = await adminSetInventory(params.userId, body.itemId, body.count);
    if (change.before === change.after) {
      return NextResponse.json({ ok: true, message: `${change.name}: nothing changed.`, ...(await adminInventory(params.userId)) });
    }
    const client = await getMongoClient();
    await client
      .db(process.env.MONGODB_DB ?? "website")
      .collection("admin_audit")
      .insertOne({ at: new Date(), action: "inventory-set", targetDiscordId: params.userId, itemId: body.itemId, before: change.before, after: change.after, adminDiscordId: admin.discordId, adminName: admin.name });
    await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
      embeds: [
        {
          title: change.after > change.before ? "📦 Items added from the website" : "🗑️ Items removed from the website",
          color: change.after > change.before ? 0x46a758 : 0xe5484d,
          fields: [
            { name: "Member", value: `<@${params.userId}>\n\`${params.userId}\``, inline: true },
            { name: "Item", value: `${change.name}\n${change.before} → **${change.after}**`, inline: true },
            { name: "By", value: `<@${admin.discordId}>`, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }).catch(() => false);
    return NextResponse.json({ ok: true, message: change.after > change.before ? `Gave ${change.after - change.before}× ${change.name} (now ${change.after}).` : `Removed ${change.before - change.after}× ${change.name} (now ${change.after}).`, ...(await adminInventory(params.userId)) });
  } catch (error) {
    if (error instanceof StoreError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Admin inventory change failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't change the inventory." }, { status: 500 });
  }
}
