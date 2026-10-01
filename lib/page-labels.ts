// What someone is doing on the site, in plain words, from the page they have open
// (Admin → Website → Online now).

const ADMIN_TABS: Record<string, string> = {
  overview: "Overview", punishments: "Punishments", automod: "AutoMod", join: "Join Apps", logs: "Logs", live: "Live Chat",
  tickets: "Tickets", accounts: "Website", news: "News", traffic: "Traffic", appeals: "Appeals", dating: "Social", messages: "Messages",
};
const STATS_TABS: Record<string, string> = {
  stats: "their stats", social: "their friendship map", activity: "their activity stats", topics: "their topic map", voice: "their voice stats",
  economy: "their Leaves & store stats", badges: "their badges",
};

const SOCIAL_PAGES: Record<string, string> = {
  "/social": "On Social", "/social/discover": "Discovering on Social", "/social/browse": "Browsing Social profiles", "/social/likes": "Checking their Social likes",
  "/social/matches": "Checking their Social matches", "/social/friends": "On Social: Friends", "/social/profile": "Editing their Social profile",
  "/social/messages": "Reading their messages", "/social/setup": "Setting up a Social profile", "/social/hidden": "On Social: hidden & blocked",
};

/** The Discord ids a page is about (a Social profile or a message thread), so their names can be shown. */
export function pageDiscordId(path: string | null | undefined): string | null {
  if (!path) return null;
  const m = /^\/social\/(?:u|messages)\/(\d{15,21})/.exec(new URL(path, "https://x").pathname);
  return m ? m[1] : null;
}

export function describePage(path: string | null | undefined, names: Record<string, string> = {}): { label: string; icon: string } {
  if (!path) return { label: "Browsing", icon: "globe" };
  const url = new URL(path, "https://x");
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const hash = url.hash.slice(1);
  if (p === "/" || p === "/home") return { label: "On the home page", icon: "home" };
  if (p === "/store") return { label: url.searchParams.get("item") ? "Looking at an item in the Store" : "Browsing the Store", icon: "store" };
  if (p === "/leaderboards") return { label: "Checking the Leaderboards", icon: "trophy" };
  if (p.startsWith("/news/")) return { label: "Reading a news post", icon: "news" };
  if (p === "/news") return { label: "Reading the News", icon: "news" };
  if (p === "/staff") return { label: "Viewing the Staff page", icon: "staff" };
  if (p === "/faq") return { label: hash ? `Reading the FAQ (${hash.replace(/-/g, " ")})` : "Reading the FAQ & Guide", icon: "help" };
  if (p === "/support") return { label: "On the Support page", icon: "help" };
  if (p === "/privacy") return { label: "Reading the Privacy Policy", icon: "legal" };
  if (p === "/terms") return { label: "Reading the Terms of Service", icon: "legal" };
  if (p === "/login") return { label: "Logging in", icon: "login" };
  if (p === "/register") return { label: "Signing up", icon: "login" };
  if (p.startsWith("/forgot-password") || p.startsWith("/reset-password")) return { label: "Resetting their password", icon: "login" };
  if (p === "/account") {
    if (hash && STATS_TABS[hash]) return { label: `Looking at ${STATS_TABS[hash]}`, icon: "stats" };
    const sections: Record<string, string> = { daily: "claiming their Daily Reward", inventory: "their inventory", roles: "their server roles", profile: "editing their profile", security: "account security", "discord-account": "linking Discord", punishments: "their punishments" };
    return { label: hash && sections[hash] ? `My Account: ${sections[hash]}` : "On My Account", icon: "account" };
  }
  if (p === "/admin") {
    const tab = url.searchParams.get("tab");
    return { label: `Admin panel${tab && ADMIN_TABS[tab] ? `: ${ADMIN_TABS[tab]}` : ""}`, icon: "admin" };
  }
  if (p.startsWith("/reviews")) return { label: "Reading reviews", icon: "star" };
  if (p === "/appeals") return { label: "On the Appeals page", icon: "legal" };
  if (p === "/settings") return { label: "In Settings", icon: "account" };
  if (p === "/notifications") return { label: "Reading their notifications", icon: "account" };
  const other = pageDiscordId(p);
  if (other) {
    const name = names[other] ?? "another member";
    return p.startsWith("/social/messages/") ? { label: `Messaging ${name}`, icon: "account" } : { label: `Viewing ${name}'s Social profile`, icon: "account" };
  }
  if (SOCIAL_PAGES[p]) return { label: SOCIAL_PAGES[p], icon: "account" };
  return { label: `On ${p}`, icon: "globe" };
}
