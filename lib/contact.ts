// Validation for the optional contact details on an account: social links and a phone number.
// Every social is stored as a handle plus a canonical https URL we build ourselves, so a
// link can never point anywhere other than the network it claims to be.

export type SocialKey = "telegram" | "youtube" | "twitter" | "steam";

export type SocialLink = { handle: string; url: string };

export const SOCIALS: { key: SocialKey; label: string; placeholder: string }[] = [
  { key: "twitter", label: "Twitter / X", placeholder: "@handle or x.com link" },
  { key: "telegram", label: "Telegram", placeholder: "@username or t.me link" },
  { key: "youtube", label: "YouTube", placeholder: "@channel or youtube.com link" },
  { key: "steam", label: "Steam", placeholder: "Custom ID or profile link" },
];

function stripUrl(raw: string, hosts: string[]) {
  let text = raw.trim();
  const match = text.match(/^(?:https?:\/\/)?(?:www\.|m\.)?([a-z0-9.-]+)(\/.*)?$/i);
  if (match && hosts.includes(match[1].toLowerCase())) text = (match[2] ?? "").replace(/^\/+/, "");
  else if (/^(?:https?:\/\/|www\.)/i.test(text) || /^[a-z0-9-]+\.[a-z]{2,}\//i.test(text)) return null; // a link to another site
  return text.replace(/[?#].*$/, "").replace(/\/+$/, "");
}

/** Returns the saved link, null for an empty value, or "invalid". */
export function normalizeSocial(key: SocialKey, raw: string): SocialLink | null | "invalid" {
  const value = raw.trim();
  if (!value) return null;

  if (key === "twitter") {
    const path = stripUrl(value, ["twitter.com", "x.com", "mobile.twitter.com"]);
    const handle = path?.split("/")[0].replace(/^@/, "") ?? ""; // x.com/name/status/... -> name
    return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? { handle: `@${handle}`, url: `https://x.com/${handle}` } : "invalid";
  }

  if (key === "telegram") {
    const path = stripUrl(value, ["t.me", "telegram.me"]);
    const handle = path?.split("/")[0].replace(/^@/, "") ?? "";
    return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(handle) ? { handle: `@${handle}`, url: `https://t.me/${handle}` } : "invalid";
  }

  if (key === "youtube") {
    const path = stripUrl(value, ["youtube.com", "youtu.be"]) ?? "";
    const channel = path.match(/^channel\/(UC[A-Za-z0-9_-]{22})$/);
    if (channel) return { handle: "YouTube channel", url: `https://www.youtube.com/channel/${channel[1]}` };
    const legacy = path.match(/^(c|user)\/([A-Za-z0-9._-]{2,50})$/);
    if (legacy) return { handle: legacy[2], url: `https://www.youtube.com/${legacy[1]}/${legacy[2]}` };
    const handle = path.split("/")[0].replace(/^@/, ""); // youtube.com/@name/videos -> name
    return /^[A-Za-z0-9._-]{3,30}$/.test(handle) ? { handle: `@${handle}`, url: `https://www.youtube.com/@${handle}` } : "invalid";
  }

  // Steam: custom URL (/id/name), numeric profile (/profiles/7656...), or just the name / number
  const path = stripUrl(value, ["steamcommunity.com"]) ?? "";
  const profile = path.match(/^(?:profiles\/)?(7656119\d{10})$/);
  if (profile) return { handle: "Steam profile", url: `https://steamcommunity.com/profiles/${profile[1]}` };
  const custom = path.match(/^(?:id\/)?([A-Za-z0-9_-]{2,32})$/);
  return custom ? { handle: custom[1], url: `https://steamcommunity.com/id/${custom[1]}` } : "invalid";
}

/** Normalizes a phone number to +<country><number>. Returns null for empty, or "invalid". */
export function normalizePhone(raw: string): string | null | "invalid" {
  const value = raw.trim();
  if (!value) return null;
  if (!/^\+?[\d\s().-]+$/.test(value)) return "invalid";
  const digits = value.replace(/\D/g, "");
  if (value.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "invalid";
  // No country code: assume US/Canada for 10-digit numbers
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "invalid";
}

export function formatPhone(phone: string) {
  const us = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return us ? `+1 (${us[1]}) ${us[2]}-${us[3]}` : phone;
}
