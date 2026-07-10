import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const fallback = new URL("/logo.png", "https://kittykingdom.net");

function getToken() {
  return (
    process.env.DISCORD_BOT_TOKEN ??
    process.env.DISCORD_TOKEN ??
    process.env.BOT_TOKEN ??
    process.env.DISCORDPY_TOKEN ??
    process.env.DISCORD_PY_TOKEN
  );
}

function avatarCdnUrl(userId: string, avatarHash: string) {
  const extension = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${extension}?size=128`;
}

function guildAvatarCdnUrl(
  guildId: string,
  userId: string,
  avatarHash: string,
) {
  const extension = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${avatarHash}.${extension}?size=128`;
}

async function discordFetch(path: string, token: string) {
  return fetch(`https://discord.com/api/v10${path}`, {
    headers: {
      Authorization: `Bot ${token}`,
      "User-Agent": "KittyKingdomBot/1.0 (+https://kittykingdom.net)",
    },
    cache: "no-store",
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const token = getToken();
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token) {
    return NextResponse.redirect(fallback);
  }

  try {
    if (guildId) {
      const memberResponse = await discordFetch(
        `/guilds/${guildId}/members/${params.id}`,
        token,
      );
      if (memberResponse.ok) {
        const member = (await memberResponse.json()) as {
          avatar?: string | null;
          user?: { id: string; avatar: string | null };
        };

        if (member.avatar) {
          return NextResponse.redirect(
            guildAvatarCdnUrl(guildId, params.id, member.avatar),
          );
        }

        if (member.user?.avatar) {
          return NextResponse.redirect(
            avatarCdnUrl(member.user.id, member.user.avatar),
          );
        }
      }
    }

    const userResponse = await discordFetch(`/users/${params.id}`, token);
    if (!userResponse.ok) {
      return NextResponse.redirect(fallback);
    }

    const user = (await userResponse.json()) as {
      id: string;
      avatar: string | null;
    };
    if (!user.avatar) {
      return NextResponse.redirect(fallback);
    }

    return NextResponse.redirect(avatarCdnUrl(user.id, user.avatar));
  } catch {
    return NextResponse.redirect(fallback);
  }
}
