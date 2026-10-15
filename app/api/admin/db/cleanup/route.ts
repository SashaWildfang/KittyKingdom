import { NextResponse } from "next/server";
import {
  parseLeaverOptions,
  previewLeavers,
  previewOrphans,
  previewRetention,
  runLeavers,
  runOrphans,
  runRetention,
} from "../../../../../lib/db-manager/cleanup";
import { LEAVER_KINDS } from "../../../../../lib/db-manager/catalog";
import { NO_STORE, dbFail, requireDbOwner, requireDbWrite } from "../../../../../lib/db-manager/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * { kind: "leavers" | "old" | "orphans", run?: true, ... }
 * leavers: days, kinds[], includeNoActivity, includeAccounts, (run) ids[]
 * old: overrides { "db.coll": days }, (run) targets [{ key, days }]
 * orphans: (run) keys[]
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const run = body.run === true;
  const user = run ? await requireDbWrite(request) : await requireDbOwner(request);
  if (user instanceof NextResponse) return user;
  try {
    if (body.kind === "leavers") {
      const opts = parseLeaverOptions(body);
      if (!run) return NextResponse.json({ ok: true, kinds: LEAVER_KINDS, ...(await previewLeavers(opts)) }, NO_STORE);
      return NextResponse.json({ ok: true, ...(await runLeavers(opts, body.ids, user)) });
    }
    if (body.kind === "old") {
      if (!run) {
        const overrides = (body.overrides && typeof body.overrides === "object" ? body.overrides : {}) as Record<string, number>;
        return NextResponse.json({ ok: true, targets: await previewRetention(overrides) }, NO_STORE);
      }
      return NextResponse.json({ ok: true, ...(await runRetention(body.targets, user)) });
    }
    if (body.kind === "orphans") {
      if (!run) return NextResponse.json({ ok: true, sets: await previewOrphans() }, NO_STORE);
      return NextResponse.json({ ok: true, ...(await runOrphans(body.keys, user)) });
    }
    return NextResponse.json({ ok: false, error: "Unknown cleanup." }, { status: 400 });
  } catch (error) {
    return dbFail(error);
  }
}
