import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { getMongoClient } from "../../../../../lib/mongodb";
import { reorderNews } from "../../../../../lib/news";

export const dynamic = "force-dynamic";

/** { ids: [...] } in the order the admin dragged them into (top first). */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  if (!Array.isArray(body?.ids)) return NextResponse.json({ ok: false, error: "Invalid order." }, { status: 400 });
  await reorderNews(body!.ids.map(String));
  await (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("admin_audit").insertOne({ at: new Date(), action: "news-reorder", count: body!.ids.length, adminDiscordId: admin.discordId, adminName: admin.name });
  return NextResponse.json({ ok: true });
}
