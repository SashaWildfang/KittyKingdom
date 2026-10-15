import { NextResponse } from "next/server";
import { NO_STORE, dbFail, requireDbOwner, requireDbWrite } from "../../../../../lib/db-manager/guard";
import { deleteDocs, getDoc, parseDb, saveDoc } from "../../../../../lib/db-manager/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** ?db=…&coll=…&id=<EJSON id> */
export async function GET(request: Request) {
  const owner = await requireDbOwner(request);
  if (owner instanceof NextResponse) return owner;
  const q = new URL(request.url).searchParams;
  try {
    return NextResponse.json({ ok: true, doc: await getDoc(parseDb(q.get("db")), q.get("coll") ?? "", q.get("id")) }, NO_STORE);
  } catch (error) {
    return dbFail(error);
  }
}

/** { db, coll, id, doc: "<EJSON text>" } replaces one record (backed up first) */
export async function PUT(request: Request) {
  const owner = await requireDbWrite(request);
  if (owner instanceof NextResponse) return owner;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    return NextResponse.json({ ok: true, ...(await saveDoc(parseDb(body.db), String(body.coll ?? ""), body.id, body.doc, owner)) });
  } catch (error) {
    return dbFail(error);
  }
}

/** { db, coll, ids: ["<EJSON id>", …] } deletes those records (backed up first) */
export async function DELETE(request: Request) {
  const owner = await requireDbWrite(request);
  if (owner instanceof NextResponse) return owner;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const ids = Array.isArray(body.ids) ? body.ids : [];
    return NextResponse.json({ ok: true, ...(await deleteDocs(parseDb(body.db), String(body.coll ?? ""), ids, owner)) });
  } catch (error) {
    return dbFail(error);
  }
}
