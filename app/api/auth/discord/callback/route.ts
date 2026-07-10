import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../../lib/auth";
import { getUsersCollection } from "../../../../../lib/mongodb";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const sessionUserId = await getSessionUserId();

  if (!code || !state || !sessionUserId || String(sessionUserId) !== state || !ObjectId.isValid(state)) {
    return NextResponse.redirect(`${origin}/?discord=invalid#account`, 303);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(`${origin}/?discord=not-configured#account`, 303);
  }

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(`${origin}/?discord=token-failed#account`, 303);
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userResponse.ok) {
    return NextResponse.redirect(`${origin}/?discord=user-failed#account`, 303);
  }

  const discordUser = (await userResponse.json()) as {
    id: string;
    username: string;
    global_name?: string;
    avatar?: string;
  };

  const guildId = process.env.DISCORD_GUILD_ID;
  let guildMember = null;

  if (guildId) {
    const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!memberResponse.ok) {
      return NextResponse.redirect(`${origin}/?discord=guild-required#account`, 303);
    }

    guildMember = await memberResponse.json();
  }

  const users = await getUsersCollection();
  await users.updateOne(
    { _id: new ObjectId(state) },
    {
      $set: {
        discord: {
          id: discordUser.id,
          username: discordUser.username,
          globalName: discordUser.global_name ?? null,
          avatar: discordUser.avatar ?? null,
          guildMember,
          linkedAt: new Date(),
        },
        updatedAt: new Date(),
      },
    },
  );

  return NextResponse.redirect(`${origin}/?discord=linked#account`, 303);
}
