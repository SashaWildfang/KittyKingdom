// The Discord tip / ad catalog (keys match Main_Bot db/ads.py). Shared by the server and Admin → Ads.

export const AD_CATALOG: { key: string; label: string; about: string }[] = [
  { key: "patreon", label: "Patreon tiers", about: "All three tiers with live perk numbers, buttons to the perks page and Patreon." },
  { key: "custom_role", label: "Custom roles", about: "Design your own role from Prince / Princess ($10)." },
  { key: "boost", label: "Server boosting", about: "Booster perks: Leaves per boost, monthly Leaves, XP and streak bonuses." },
  { key: "website", label: "The website", about: "Make an account and link Discord: stats, Store, games, leaderboards." },
  { key: "daily", label: "Daily Reward", about: "Claim daily, booster streaks, Patreon bonus and Streak Shields." },
  { key: "store", label: "Store", about: "Rotating stock, on the website or /store view, Patreon discount." },
  { key: "slots", label: "Slots jackpot", about: "Shows the live progressive jackpot." },
  { key: "blackjack", label: "Blackjack", about: "Blackjack in the casino channel or on the website." },
  { key: "roulette", label: "Roulette", about: "/roulette and the website's live roulette table." },
  { key: "bump", label: "Bumping", about: "/bump every 2 hours and the monthly bump prizes." },
  { key: "wordle", label: "Wordle", about: "The daily Wordle and its reward." },
  { key: "leaderboards", label: "Leaderboards", about: "The website leaderboards (levels, Leaves, bumps, QOTD)." },
  { key: "news", label: "Latest news", about: "Links the newest published news post by title." },
  { key: "review", label: "Disboard review", about: "5,000 Leaves for a Disboard review." },
  { key: "help", label: "Help & guide", about: "/help, the Server Guide and support tickets." },
  { key: "levelups", label: "Level-up settings", about: "/levelups to make level-up messages quiet or off." },
];

export type AdSettings = {
  enabled: boolean;
  threshold: number;
  windowMinutes: number;
  minChatters: number;
  channelCooldown: number;
  globalCooldown: number;
  deleteAfter: number;
  disabled: string[];
  weights: Record<string, number>;
  excludedChannels: string[];
  excludedCategories: string[];
};

/** Number settings: [min, max]. */
export const AD_LIMITS: Record<"threshold" | "windowMinutes" | "minChatters" | "channelCooldown" | "globalCooldown" | "deleteAfter", [number, number]> = {
  threshold: [5, 500],
  windowMinutes: [5, 240],
  minChatters: [1, 20],
  channelCooldown: [5, 1440],
  globalCooldown: [0, 720],
  deleteAfter: [0, 1440],
};
