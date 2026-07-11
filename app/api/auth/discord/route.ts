import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth";

function getCanonicalOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL;
  if (configured) {
    const candidates = configured.split(/[|,\s]+/).filter(Boolean);
    const preferred =
      candidates.find((value) => value === "https://kittykingdom.net") ??
      candidates[0];
    if (preferred) {
      const clean = preferred.replace(/\/$/, "");
      try {
        if (new URL(clean).hostname === "www.kittykingdom.net") {
          return "https://kittykingdom.net";
        }
      } catch {
        // Fall through and use the cleaned configured value.
      }
      return clean;
    }
  }

  const url = new URL(request.url);
  if (url.hostname === "www.kittykingdom.net") return "https://kittykingdom.net";
  return url.origin.replace(/\/$/, "");
}

export const maxDuration = 10;

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  const origin = getCanonicalOrigin(request);

  if (!userId) {
    return NextResponse.redirect(`${origin}/login?discord=login-required`, 303);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = `${origin}/api/auth/callback/discord`;

  if (!clientId) {
    return NextResponse.json(
      {
        error: "Discord OAuth is not configured yet.",
        requiredEnv: [
          "DISCORD_CLIENT_ID",
          "DISCORD_CLIENT_SECRET",
          "DISCORD_GUILD_ID",
        ],
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

  return NextResponse.redirect(
    `https://discord.com/api/oauth2/authorize?${params.toString()}`,
  );
}
