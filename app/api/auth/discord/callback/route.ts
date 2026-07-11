import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../../lib/auth";
import {
  getJoinApplicationsCollection,
  getUsersCollection,
} from "../../../../../lib/mongodb";

export const maxDuration = 10;

function getCanonicalOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL;
  if (configured) {
    const candidates = configured.split(/[|,\s]+/).filter(Boolean);
    const preferred =
      candidates.find((value) => value.includes("kittykingdom.net")) ?? candidates[0];
    const match = preferred?.match(/https?:\/\/[^\s)\]]+/);
    const clean = (match?.[0] ?? preferred ?? "").replace(/\/$/, "");

    try {
      const parsed = new URL(clean);
      if (parsed.hostname === "www.kittykingdom.net") return "https://kittykingdom.net";
      return parsed.origin;
    } catch {
      // Fall through to the request origin.
    }
  }

  const url = new URL(request.url);
  if (url.hostname === "www.kittykingdom.net") return "https://kittykingdom.net";
  return url.origin.replace(/\/$/, "");
}

function calculateAge(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate()))
    age -= 1;
  return age;
}

function getDob(application: Record<string, unknown> | null) {
  if (!application) return null;
  return (
    application.dateOfBirth ??
    application.date_of_birth ??
    application.dob ??
    application.DoB ??
    application.DOB ??
    application.birthdate ??
    null
  );
}

function getStoredAge(application: Record<string, unknown> | null) {
  if (!application) return null;
  const raw = application.age ?? application.Age;
  return typeof raw === "number" ? raw : raw ? Number(raw) : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getCanonicalOrigin(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  try {
    const sessionUserId = await getSessionUserId();

    if (
      !code ||
      !state ||
      !sessionUserId ||
      String(sessionUserId) !== state ||
      !ObjectId.isValid(state)
    ) {
      return NextResponse.redirect(`${origin}/account?discord=invalid`, 303);
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = `${origin}/api/auth/callback/discord`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${origin}/account?discord=not-configured`,
        303,
      );
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
      return NextResponse.redirect(
        `${origin}/account?discord=token-failed`,
        303,
      );
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(
        `${origin}/account?discord=user-failed`,
        303,
      );
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
      const memberResponse = await fetch(
        `https://discord.com/api/users/@me/guilds/${guildId}/member`,
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );

      if (!memberResponse.ok) {
        return NextResponse.redirect(
          `${origin}/account?discord=guild-required`,
          303,
        );
      }

      guildMember = await memberResponse.json();
    }

    const joinApplications = await getJoinApplicationsCollection();
    const application = (await joinApplications.findOne({
      $or: [
        { discordId: discordUser.id },
        { discord_id: discordUser.id },
        { userId: discordUser.id },
        { user_id: discordUser.id },
        { id: discordUser.id },
      ],
    })) as Record<string, unknown> | null;

    const dob = getDob(application);
    const age = calculateAge(dob) ?? getStoredAge(application);

    const users = await getUsersCollection();
    const existingUser = await users.findOne({ _id: new ObjectId(state) });
    const profileUpdate: Record<string, unknown> = {};

    if (!existingUser?.dateOfBirth && dob) {
      profileUpdate.dateOfBirth = String(dob);
    }

    if (age !== null && Number.isFinite(age)) {
      profileUpdate.age = age;
    }

    await users.updateOne(
      { _id: new ObjectId(state) },
      {
        $set: {
          discordId: discordUser.id,
          discord: {
            id: discordUser.id,
            username: discordUser.username,
            globalName: discordUser.global_name ?? null,
            avatar: discordUser.avatar ?? null,
            guildMember,
            linkedAt: new Date(),
          },
          ...profileUpdate,
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.redirect(`${origin}/account?discord=linked`, 303);
  } catch (error) {
    console.error("Discord linking failed", error);
    return NextResponse.redirect(
      `${origin}/account?discord=service-unavailable`,
      303,
    );
  }
}
