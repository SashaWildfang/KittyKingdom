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

const monthNames: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function normalizeDate(value: unknown) {
  if (!value) return null;
  const text = String(value).trim();
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/i,
  );
  if (!match) return null;

  const month = monthNames[match[1].toLowerCase().replace(/\.$/, "")];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month === undefined || !day || !year) return null;

  const parsed = new Date(Date.UTC(year, month, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculateAge(value: unknown) {
  const date = normalizeDate(value);
  if (!date) return null;

  const now = new Date();
  let age = now.getFullYear() - date.getUTCFullYear();
  const monthDiff = now.getMonth() - date.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getUTCDate()))
    age -= 1;
  return age;
}

function toIsoDate(value: unknown) {
  const date = normalizeDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function getAgeAndDob(application: Record<string, unknown> | null) {
  if (!application) return { age: null as number | null, dob: null as string | null };

  const rawAgeAndDob =
    application.ageAndDob ??
    application.age_and_dob ??
    application.ageDOB ??
    application.ageDob ??
    null;
  const rawDob =
    application.dateOfBirth ??
    application.date_of_birth ??
    application.dob ??
    application.DoB ??
    application.DOB ??
    application.birthdate ??
    rawAgeAndDob;
  const rawAge = application.age ?? application.Age;

  const dob = toIsoDate(rawDob);
  const calculatedAge = calculateAge(dob ?? rawDob);
  const storedAge = typeof rawAge === "number" ? rawAge : rawAge ? Number(rawAge) : null;

  return {
    age: calculatedAge ?? (Number.isFinite(storedAge) ? storedAge : null),
    dob,
  };
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

    const { age, dob } = getAgeAndDob(application);

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
