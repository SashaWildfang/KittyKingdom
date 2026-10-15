import { NextResponse } from "next/server";
import { dbFail, requireDbOwner, requireDbWrite } from "../../../../../lib/db-manager/guard";
import { deleteMatching, parseDb } from "../../../../../lib/db-manager/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** { db, coll, filter, run?: true, confirm?: <count> }: without run, how many match; with run, deletes them (backed up) */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const run = body.run === true;
  const user = run ? await requireDbWrite(request) : await requireDbOwner(request);
  if (user instanceof NextResponse) return user;
  try {
    const db = parseDb(body.db);
    const coll = String(body.coll ?? "");
    if (!run) return NextResponse.json({ ok: true, ...(await deleteMatching(db, coll, body.filter, false, user)) });
    const preview = await deleteMatching(db, coll, body.filter, false, user);
    if (Number(body.confirm) !== preview.count) {
      return NextResponse.json({ ok: false, error: `Type the number of records (${preview.count.toLocaleString()}) to confirm. It may have changed since the preview.` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await deleteMatching(db, coll, body.filter, true, user)) });
  } catch (error) {
    return dbFail(error);
  }
}
