import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { dateRange, listParam, people } from "../../../../lib/admin-people";
import { queryLogs, syncLogs } from "../../../../lib/bot-logs";
import { resolveMentions } from "../../../../lib/discord-mentions";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/** The bot log channel for staff: pulls anything new, then filters from the mirrored copy. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    await syncLogs().catch((error) => console.error("Log sync failed", error));
    const params = new URL(request.url).searchParams;
    const { from, to } = dateRange(params);
    const result = await queryLogs({
      types: listParam(params, "types"),
      userId: params.get("userId") ?? undefined,
      search: params.get("search") ?? undefined,
      from,
      to,
      order: params.get("order") === "asc" ? "asc" : "desc",
      before: params.get("before") ?? undefined,
      after: params.get("after") ?? undefined,
      limit: Number(params.get("limit") ?? 40),
    });
    const texts = result.rows.flatMap((r) => [r.description, r.content, ...r.fields.map((f) => f.value)]);
    const { mentions, userIds } = await resolveMentions(texts);
    const who = await people([...result.rows.flatMap((r) => r.userIds), ...userIds]);
    return NextResponse.json({ ok: true, ...result, people: who, mentions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bot logs failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the bot logs." }, { status: 500 });
  }
}
