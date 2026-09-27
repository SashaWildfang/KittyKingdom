import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { postChannelMessage } from "../../../../../lib/discord-member";
import { LiveChatError, deleteLiveMessage } from "../../../../../lib/live-chat";
import { getMongoClient } from "../../../../../lib/mongodb";
import { readJson } from "../../../../../lib/store-auth";

export const dynamic = "force-dynamic";

const STAFF_LOG_CHANNEL_ID = "1360344042705256660";

// A few quick deletes are fine; stops a runaway script
const recent = new Map<string, number[]>();
function allowed(id: string) {
  const now = Date.now();
  const hits = (recent.get(id) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= 30) return false;
  hits.push(now);
  recent.set(id, hits);
  return true;
}

/** { messageId } - deletes it in Discord, logs who did it. */
export async function POST(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    if (!allowed(panel.discordId)) throw new LiveChatError("Slow down a little and try again in a minute.", 429);
    const body = await readJson(request);
    const messageId = typeof body.messageId === "string" ? body.messageId : "";
    const message = await deleteLiveMessage({ discordId: panel.discordId, name: panel.name }, messageId);

    const client = await getMongoClient();
    await client
      .db(process.env.MONGODB_DB ?? "website")
      .collection("admin_audit")
      .insertOne({ at: new Date(), action: "live-message-delete", messageId, channelId: message.channelId, authorId: message.authorId, content: message.content.slice(0, 1000), adminDiscordId: panel.discordId, adminName: panel.name });
    await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
      embeds: [
        {
          title: "🗑️ Message deleted from the website",
          color: 0xe5484d,
          description: message.content ? message.content.slice(0, 1500) : message.attachments.length ? `*${message.attachments.length} file(s)*` : "*No text*",
          fields: [
            { name: "Author", value: `<@${message.authorId}>`, inline: true },
            { name: "Channel", value: `<#${message.channelId}>`, inline: true },
            { name: "Deleted by", value: `<@${panel.discordId}>`, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }).catch(() => false);
    return NextResponse.json({ ok: true, message: "Message deleted.", item: message });
  } catch (error) {
    if (error instanceof LiveChatError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Live delete failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
  }
}
