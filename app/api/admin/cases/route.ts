import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { CaseError, createCase, getCase, listCases, myOpenCaseCount, updateCase } from "../../../../lib/cases";

export const dynamic = "force-dynamic";

const fail = (error: unknown) => {
  if (error instanceof CaseError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Cases request failed", error);
  return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
};

/** Staff: ?id=<case> for one case · ?status=open|closed&member=<id>&mine=1 for the list · ?count=1 */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const q = new URL(request.url).searchParams;
  try {
    if (q.get("count") === "1") return NextResponse.json({ ok: true, mine: await myOpenCaseCount(panel.discordId) }, { headers: { "Cache-Control": "no-store" } });
    const id = q.get("id");
    if (id) {
      const c = await getCase(id);
      return NextResponse.json({ ok: true, case: c, people: await people([...c.members, c.owner, ...c.entries.map((e) => e.by)]), me: panel.discordId }, { headers: { "Cache-Control": "no-store" } });
    }
    const cases = await listCases({ status: q.get("status") ?? "open", member: q.get("member") ?? undefined, mine: q.get("mine") === "1", me: panel.discordId });
    return NextResponse.json({ ok: true, cases, people: await people(cases.flatMap((c) => [...c.members, c.owner])), me: panel.discordId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Staff: {op: "create", title, members, note?, ref?} or {id, op: note|link|status|owner|member|title, …} */
export async function POST(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { op?: string; id?: string; title?: unknown; members?: unknown; note?: unknown; ref?: unknown; text?: unknown; status?: unknown; owner?: unknown; member?: unknown; remove?: unknown };
    if (body.op === "create") return NextResponse.json({ ok: true, case: await createCase(panel, body) });
    return NextResponse.json({ ok: true, case: await updateCase(panel, String(body.id ?? ""), body) });
  } catch (error) {
    return fail(error);
  }
}
