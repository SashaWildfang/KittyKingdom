import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../lib/admin";
import { people } from "../../../../../../lib/admin-people";
import { automodEvent } from "../../../../../../lib/automod";
import { getGuildChannelsRaw, guildId } from "../../../../../../lib/discord-member";

export const dynamic = "force-dynamic";

/** One AutoMod catch: the conversation around it and the member's AutoMod history (staff). */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const data = await automodEvent(params.id);
  if (!data) return NextResponse.json({ ok: false, error: "That catch wasn't found." }, { status: 404 });
  const ids = [data.event.userId, ...data.before.map((m) => m.authorId), ...data.after.map((m) => m.authorId)];
  const [who, channels, guild] = await Promise.all([people(ids).catch(() => ({})), getGuildChannelsRaw().catch(() => []), guildId().catch(() => null)]);
  const channel = channels.find((c) => c.id === data.event.channelId);
  return NextResponse.json(
    {
      ok: true,
      ...data,
      people: who,
      channelName: channel?.name ?? null,
      jumpUrl: guild && data.event.channelId ? `https://discord.com/channels/${guild}/${data.event.channelId}${data.event.messageId ? `/${data.event.messageId}` : ""}` : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
