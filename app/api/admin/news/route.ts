import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { adminNews, cleanNewsInput, createNews, pendingNewsCount } from "../../../../lib/news";
import { getMongoClient } from "../../../../lib/mongodb";
import { hasOperatorKeys } from "../../../../lib/validate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const p = new URL(request.url).searchParams;
  const posts = await adminNews({ sort: p.get("sort") ?? undefined, status: p.get("status") ?? undefined, search: p.get("search") ?? undefined, tag: p.get("tag") ?? undefined });
  return NextResponse.json({ ok: true, posts, pending: await pendingNewsCount() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || hasOperatorKeys(body)) return NextResponse.json({ ok: false, error: "Invalid post." }, { status: 400 });
  const input = await cleanNewsInput(body);
  if (typeof input === "string") return NextResponse.json({ ok: false, error: input }, { status: 400 });
  const id = await createNews(input, { name: admin.name, discordId: admin.discordId });
  const client = await getMongoClient();
  await client.db(process.env.MONGODB_DB ?? "website").collection("admin_audit").insertOne({ at: new Date(), action: "news-create", newsId: id, title: input.title, adminDiscordId: admin.discordId, adminName: admin.name });
  return NextResponse.json({ ok: true, id, message: input.status === "published" ? "Post published." : input.status === "pending" ? "Sent for review. An admin can approve it from the Pending list." : "Draft saved." });
}
