import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { cleanNewsInput, deleteNews, updateNews } from "../../../../../lib/news";
import { getMongoClient } from "../../../../../lib/mongodb";
import { hasOperatorKeys } from "../../../../../lib/validate";

export const dynamic = "force-dynamic";

async function audit(action: string, id: string, admin: { discordId: string; name: string }, title?: string) {
  const client = await getMongoClient();
  await client.db(process.env.MONGODB_DB ?? "website").collection("admin_audit").insertOne({ at: new Date(), action, newsId: id, title, adminDiscordId: admin.discordId, adminName: admin.name });
}

export async function PATCH(request: Request, { params }: { params: { newsId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || hasOperatorKeys(body)) return NextResponse.json({ ok: false, error: "Invalid post." }, { status: 400 });
  const input = await cleanNewsInput(body);
  if (typeof input === "string") return NextResponse.json({ ok: false, error: input }, { status: 400 });
  if (!(await updateNews(params.newsId, input))) return NextResponse.json({ ok: false, error: "Post not found." }, { status: 404 });
  await audit(input.status === "published" ? "news-publish" : "news-edit", params.newsId, admin, input.title);
  return NextResponse.json({ ok: true, message: input.status === "published" ? "Post saved and live." : input.status === "pending" ? "Saved. It's waiting for review." : "Draft saved." });
}

export async function DELETE(request: Request, { params }: { params: { newsId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  if (!(await deleteNews(params.newsId))) return NextResponse.json({ ok: false, error: "Post not found." }, { status: 404 });
  await audit("news-delete", params.newsId, admin);
  return NextResponse.json({ ok: true, message: "Post deleted." });
}
