import { requireTwoFactorForAction } from "../../../../../../lib/admin-2fa";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin";
import { deleteTag, newsTags, updateTag } from "../../../../../../lib/news";
import { readJson } from "../../../../../../lib/store-auth";
import { audit, tagError } from "../../../../../../lib/news-admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, props: { params: Promise<{ tagId: string }> }) {
  const params = await props.params;
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const change = await updateTag(params.tagId, await readJson(request));
    await audit("news-tag-edit", change, admin);
    const message = change.before === change.after ? `Tag “${change.after}” saved.` : `Renamed “${change.before}” to “${change.after}”.`;
    return NextResponse.json({ ok: true, message, tags: await newsTags() });
  } catch (error) {
    return tagError(error);
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ tagId: string }> }) {
  const params = await props.params;
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const twoFactor = await requireTwoFactorForAction();
  if (twoFactor) return twoFactor;
  try {
    const body = await readJson(request);
    const result = await deleteTag(params.tagId, typeof body.moveTo === "string" ? body.moveTo : undefined);
    await audit("news-tag-delete", result, admin);
    const message = result.moved ? `Deleted “${result.name}” and moved ${result.moved} post${result.moved === 1 ? "" : "s"} to “${result.movedTo}”.` : `Deleted “${result.name}”.`;
    return NextResponse.json({ ok: true, message, tags: await newsTags() });
  } catch (error) {
    return tagError(error);
  }
}
