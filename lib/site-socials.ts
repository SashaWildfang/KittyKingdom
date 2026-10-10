/** Kitty Kingdom's social accounts (footer, homepage, structured data). */
export const SITE_SOCIALS = [
  { key: "x", label: "X (Twitter)", href: "https://x.com/KittyKingdomHub" },
  { key: "youtube", label: "YouTube", href: "https://www.youtube.com/@kittykingdom-q9f" },
  { key: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@sashasneppy" },
] as const;

export type SiteSocialKey = (typeof SITE_SOCIALS)[number]["key"] | "patreon";
