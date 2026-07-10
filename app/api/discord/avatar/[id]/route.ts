import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    return NextResponse.redirect(
      new URL("/logo.png", "https://kittykingdom.net"),
    );
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/users/${params.id}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
          "User-Agent": "KittyKingdomBot/1.0 (+https://kittykingdom.net)",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.redirect(
        new URL("/logo.png", "https://kittykingdom.net"),
      );
    }

    const user = (await response.json()) as {
      id: string;
      avatar: string | null;
    };
    if (!user.avatar) {
      return NextResponse.redirect(
        new URL("/logo.png", "https://kittykingdom.net"),
      );
    }

    const extension = user.avatar.startsWith("a_") ? "gif" : "png";
    return NextResponse.redirect(
      `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=128`,
    );
  } catch {
    return NextResponse.redirect(
      new URL("/logo.png", "https://kittykingdom.net"),
    );
  }
}
