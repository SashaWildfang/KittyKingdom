import { NextResponse } from "next/server";
import { NO_STORE, dbFail, requireDbOwner, requireDbWrite } from "../../../../../lib/db-manager/guard";
import { deleteBackup, listBackups, restoreBatch } from "../../../../../lib/db-manager/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const owner = await requireDbOwner(request);
  if (owner instanceof NextResponse) return owner;
  try {
    return NextResponse.json({ ok: true, backups: await listBackups() }, NO_STORE);
  } catch (error) {
    return dbFail(error);
  }
}

/** { id } puts everything in that backup back */
export async function POST(request: Request) {
  const owner = await requireDbWrite(request);
  if (owner instanceof NextResponse) return owner;
  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  try {
    return NextResponse.json({ ok: true, ...(await restoreBatch(String(body.id ?? ""), owner)) });
  } catch (error) {
    return dbFail(error);
  }
}

/** { id } removes a backup early */
export async function DELETE(request: Request) {
  const owner = await requireDbWrite(request);
  if (owner instanceof NextResponse) return owner;
  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  try {
    await deleteBackup(String(body.id ?? ""), owner);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbFail(error);
  }
}
