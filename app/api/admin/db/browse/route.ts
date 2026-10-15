import { NextResponse } from "next/server";
import { NO_STORE, dbFail, requireDbOwner } from "../../../../../lib/db-manager/guard";
import { browse, parseDb } from "../../../../../lib/db-manager/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** { db, coll, filter: "<json>", sort, dir: "asc" | "desc", skip, limit } (POST: filters can be long) */
export async function POST(request: Request) {
  const owner = await requireDbOwner(request);
  if (owner instanceof NextResponse) return owner;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const result = await browse(parseDb(body.db), String(body.coll ?? ""), {
      filter: String(body.filter ?? ""),
      sort: String(body.sort ?? ""),
      dir: String(body.dir ?? "desc"),
      skip: Number(body.skip ?? 0),
      limit: Number(body.limit ?? 25),
    });
    return NextResponse.json({ ok: true, ...result }, NO_STORE);
  } catch (error) {
    return dbFail(error);
  }
}
