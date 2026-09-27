import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { createTag, newsTags } from "../../../../../lib/news";
import { audit, tagError } from "../../../../../lib/news-admin";
import { readJson } from "../../../../../lib/store-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json({ ok: true, tags: await newsTags() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const name = await createTag(await readJson(request));
    await audit("news-tag-create", { tag: name }, admin);
    return NextResponse.json({ ok: true, message: `Tag “${name}” added.`, tags: await newsTags() });
  } catch (error) {
    return tagError(error);
  }
}
