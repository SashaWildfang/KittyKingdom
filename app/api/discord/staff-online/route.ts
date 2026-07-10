import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const staffRoleId = process.env.DISCORD_STAFF_ROLE_ID ?? "1358470109965979859";
const guildId = process.env.DISCORD_GUILD_ID;

function getToken() {
  return (
    process.env.DISCORD_BOT_TOKEN ??
    process.env.DISCORD_TOKEN ??
    process.env.BOT_TOKEN ??
    process.env.DISCORDPY_TOKEN ??
    process.env.DISCORD_PY_TOKEN
  );
}

export async function GET() {
  const token = getToken();

  if (!token || !guildId) {
    return NextResponse.json({
      online: null,
      reason: "missing-bot-token-or-guild",
    });
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/preview`,
      {
        headers: {
          Authorization: `Bot ${token}`,
          "User-Agent": "KittyKingdomBot/1.0 (+https://kittykingdom.net)",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.json({
        online: null,
        reason: "discord-preview-unavailable",
      });
    }

    // Discord REST does not expose role-filtered online presence for all members.
    // Keep this endpoint explicit so the frontend can show a safe fallback until
    // the Discord.py bot publishes role presence counts to the website/database.
    return NextResponse.json({
      online: null,
      roleId: staffRoleId,
      reason: "role-presence-not-available-via-rest",
    });
  } catch {
    return NextResponse.json({ online: null, reason: "request-failed" });
  }
}
