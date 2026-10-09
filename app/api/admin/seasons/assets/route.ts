import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { SeasonError, uploadAsset } from "../../../../../lib/season-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Admins: upload a season's logo, banner or currency emote (form fields: season, kind, file). It's used right away. */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ ok: false, error: "Pick an image to upload." }, { status: 400 });
  try {
    const saved = await uploadAsset(String(form?.get("season") ?? ""), String(form?.get("kind") ?? ""), Buffer.from(await file.arrayBuffer()), file.name, panel.discordId);
    return NextResponse.json({ ok: true, ...saved });
  } catch (error) {
    if (error instanceof SeasonError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Season upload failed", error);
    return NextResponse.json({ ok: false, error: "Upload failed." }, { status: 500 });
  }
}
