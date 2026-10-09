import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { requireTwoFactorForAction } from "../../../../../lib/admin-2fa";
import { RemovedError, deleteArchive, getArchive } from "../../../../../lib/removed-messages";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fail(error: unknown) {
  if (error instanceof RemovedError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Removed messages failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Admins: one archive's messages (?channel=&search=&media=1&page=). */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const u = new URL(request.url);
  try {
    const data = await getArchive(params.id, {
      channel: u.searchParams.get("channel") || undefined,
      search: u.searchParams.get("search") || undefined,
      media: u.searchParams.get("media") === "1",
      page: Number(u.searchParams.get("page") ?? 1),
    });
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Admins with 2FA: delete an archive and its stored media for good. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const twoFactor = await requireTwoFactorForAction();
  if (twoFactor) return twoFactor;
  try {
    return NextResponse.json({ ok: true, ...(await deleteArchive(params.id)) });
  } catch (error) {
    return fail(error);
  }
}
