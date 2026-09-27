// What to call a website account: the display name they set, else their Discord server nickname,
// else their Discord username, else their website username / email. Emojis are stripped first, and
// a name that's nothing but emojis falls through to the next choice.

type AccountLike = {
  displayName?: unknown;
  username?: unknown;
  email?: unknown;
  discord?: unknown;
};

// Pictographs and emoji symbols, plus the pieces that glue emojis together (variation selectors,
// zero-width joiner, skin tones, flag letters, keycaps, tag characters)
const EMOJI = new RegExp(
  "[\\p{Extended_Pictographic}\\u{1F1E6}-\\u{1F1FF}\\u{1F3FB}-\\u{1F3FF}\\u{FE0E}\\u{FE0F}\\u{200D}\\u{20E3}\\u{E0020}-\\u{E007F}]",
  "gu",
);

/** A name without emojis and with tidy spacing (empty if nothing is left). */
export function stripEmojis(value: string) {
  return value.replace(EMOJI, "").replace(/\s{2,}/g, " ").trim();
}

const text = (v: unknown) => {
  if (typeof v !== "string") return null;
  const clean = stripEmojis(v);
  return clean ? clean : null;
};

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
