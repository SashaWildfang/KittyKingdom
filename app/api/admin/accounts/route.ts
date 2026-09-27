import { NextResponse } from "next/server";
import { listAccounts } from "../../../../lib/accounts-admin";
import { requireAdmin } from "../../../../lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const params = new URL(request.url).searchParams;
  try {
    const result = await listAccounts({
      search: params.get("search") ?? undefined,
      filter: params.get("filter") ?? undefined,
      sort: params.get("sort") ?? undefined,
      order: params.get("order") === "asc" ? "asc" : "desc",
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 25),
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin accounts failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load accounts." }, { status: 500 });
  }
}
