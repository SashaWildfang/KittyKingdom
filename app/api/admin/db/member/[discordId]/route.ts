import { NextResponse } from "next/server";
import { memberReport } from "../../../../../../lib/db-manager/cleanup";
import { NO_STORE, dbFail, requireDbOwner } from "../../../../../../lib/db-manager/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Everything stored about one member, per collection */
export async function GET(request: Request, { params }: { params: { discordId: string } }) {
  const owner = await requireDbOwner(request);
  if (owner instanceof NextResponse) return owner;
  try {
    return NextResponse.json({ ok: true, ...(await memberReport(params.discordId)) }, NO_STORE);
  } catch (error) {
    return dbFail(error);
  }
}
