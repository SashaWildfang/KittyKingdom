// What to call a website account: the display name they set, else their Discord server nickname,
// else their Discord username, else their website username / email.

type AccountLike = {
  displayName?: unknown;
  username?: unknown;
  email?: unknown;
  discord?: unknown;
};

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function accountName(account: AccountLike | Record<string, unknown>, discord?: { nick?: string | null; username?: string | null } | null) {
  const a = account as AccountLike;
  return (
    text(a.displayName) ??
    text(discord?.nick) ??
    text(discord?.username) ??
    text((a.discord as { username?: unknown } | null | undefined)?.username) ??
    text(a.username) ??
    (text(a.email)?.split("@")[0] || "Member")
  );
}
