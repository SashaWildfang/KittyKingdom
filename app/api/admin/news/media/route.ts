import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { saveNewsMedia } from "../../../../../lib/news-media";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Uploads an image or short video for a news post; returns the line to put in the post. */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ ok: false, error: "Pick a file to upload." }, { status: 400 });
  try {
    const saved = await saveNewsMedia(Buffer.from(await file.arrayBuffer()), file.type, file.name, admin.discordId);
    return NextResponse.json({ ok: true, url: `/api/news-media/${saved.id}.${saved.ext}`, type: saved.type });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
