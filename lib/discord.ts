export type DiscordInviteSummary = {
  online: number | null;
  members?: number | null;
};

const inviteCode = process.env.DISCORD_INVITE_CODE ?? "M9XKHFdYQV";

export async function getDiscordInviteSummary(): Promise<DiscordInviteSummary> {
  try {
    const response = await fetch(
      `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "KittyKingdomBot/1.0 (+https://kittykingdom.net)",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) return { online: null };

    const data = (await response.json()) as {
      approximate_presence_count?: number;
      approximate_member_count?: number;
    };
    return {
      online:
        typeof data.approximate_presence_count === "number"
          ? data.approximate_presence_count
          : null,
      members: typeof data.approximate_member_count === "number" ? data.approximate_member_count : null,
    };
  } catch {
    return { online: null };
  }
}
