import { NextResponse } from "next/server";
import { browse, type BrowseQuery } from "../../../../lib/dating/discover";
import { requireDating } from "../../../../lib/dating/route-helpers";

export const dynamic = "force-dynamic";

const list = (v: string | null) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12) : undefined);
const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

/** Everyone, with filters: q, genders, ageMin, ageMax, dating, photos, active, new, looking, sort, page. */
export async function GET(request: Request) {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const p = new URL(request.url).searchParams;
  const sorts = ["best", "active", "new", "age-asc", "age-desc", "name"] as const;
  const sort = sorts.find((s) => s === p.get("sort"));
  const q: BrowseQuery = {
    q: (p.get("q") ?? "").slice(0, 60),
    genders: list(p.get("genders")),
    ageMin: num(p.get("ageMin")),
    ageMax: num(p.get("ageMax")),
    datingOnly: p.get("dating") === "1",
    photosOnly: p.get("photos") === "1",
    activeDays: num(p.get("active")),
    newOnly: p.get("new") === "1",
    lookingFor: list(p.get("looking")),
    sort,
    page: num(p.get("page")),
  };
  return NextResponse.json({ ok: true, ...(await browse(me.discordId, q)) }, { headers: { "Cache-Control": "no-store" } });
}
