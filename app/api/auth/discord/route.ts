import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth";

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  const origin = new URL(request.url).origin;

  if (!userId) {
    return NextResponse.redirect(`${origin}/?discord=login-required#login`, 303);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "Discord OAuth is not configured yet.",
        requiredEnv: ["DISCORD_CLIENT_ID", "DISCORD_REDIRECT_URI", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID"],
      },
      { status: 501 },
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify email guilds.members.read",
    prompt: "consent",
    state: String(userId),
  });

  return NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
}
