// Stats-page badges: each has its own shape and color, four tiers (Bronze → Diamond), or is a
// one-off "special" badge. Worked out from a member's stats, so the site and the profile card agree.

import type { MemberStats } from "./member-stats";

export type BadgeCategory = "chat" | "social" | "voice" | "economy" | "loyalty" | "events" | "website" | "special";
export type BadgeShape = "circle" | "hex" | "shield" | "diamond" | "squircle" | "star" | "octagon" | "burst";

/** Website-side facts (from the member's site account) used by the website badges. */
export type SiteContext = {
  accountCreated: string | null;
  emailVerified: boolean;
  twoFactor: boolean;
  socials: number;
  statsViews: number;
  signIns: number;
  pinned: number;
  hasTitle: boolean;
};
const NO_SITE: SiteContext = { accountCreated: null, emailVerified: false, twoFactor: false, socials: 0, statsViews: 0, signIns: 0, pinned: 0, hasTitle: false };

export type BadgeDef = {
  id: string;
  name: string;
  category: BadgeCategory;
  /** lucide icon name, mapped in the UI */
  icon: string;
  shape: BadgeShape;
  /** Main color of this badge (the tier adds its own metal rim) */
  hue: string;
  desc: string;
  /** Tier thresholds; a single value means a special, one-tier badge */
  tiers: number[];
  unit?: "duration" | "days" | "percent" | "chars" | "years";
  value: (s: MemberStats, site: SiteContext) => number;
};

export const TIER_NAMES = ["Bronze", "Silver", "Gold", "Diamond"];
export const MAX_SHOWCASE = 3;

const H = 3600;
const hourShare = (s: MemberStats, from: number, to: number) => {
  const hours = s.when.hours;
  const total = hours.reduce((a, b) => a + b, 0);
  if (total < 50) return 0; // too few messages to say
  let n = 0;
  for (let h = from; h !== to; h = (h + 1) % 24) n += hours[h];
  return Math.round((n / total) * 100);
};
const daysSince = (iso: string | null) => (iso ? (Date.now() - Date.parse(iso)) / 86400000 : 0);
const yes = (v: unknown) => (v ? 1 : 0);
const cmd = (s: MemberStats, name: string) => s.records.commandCounts?.[name] ?? 0;
// Joined within the server's first 30 days
const founding = (s: MemberStats) =>
  s.server?.created && s.profile.joinedServer ? yes(Date.parse(s.profile.joinedServer) - Date.parse(s.server.created) <= 30 * 86400000) : 0;

export const BADGES: BadgeDef[] = [
  // Chat
  { id: "chatterbox", name: "Chatterbox", category: "chat", icon: "MessageCircle", shape: "circle", hue: "#f59b2a", desc: "Messages sent in the server", tiers: [1000, 5000, 15000, 40000], value: (s) => s.messages.total },
  { id: "wordsmith", name: "Wordsmith", category: "chat", icon: "PenLine", shape: "circle", hue: "#e0701e", desc: "Words written", tiers: [5000, 25000, 100000, 300000], value: (s) => s.messages.words },
  { id: "novelist", name: "Novelist", category: "chat", icon: "ScrollText", shape: "circle", hue: "#b45309", desc: "Longest single message", tiers: [400, 900, 1500, 1990], unit: "chars", value: (s) => s.records.longestMessage },
  { id: "curious", name: "Curious Cat", category: "chat", icon: "HelpCircle", shape: "circle", hue: "#0ea5e9", desc: "Questions asked (messages with a ?)", tiers: [50, 250, 1000, 3000], value: (s) => s.records.questions },
  { id: "streak", name: "Streak Keeper", category: "chat", icon: "Flame", shape: "circle", hue: "#ef4444", desc: "Longest run of days chatting in a row", tiers: [7, 30, 100, 365], unit: "days", value: (s) => s.messages.longestStreak },
  { id: "regular", name: "Daily Regular", category: "chat", icon: "CalendarCheck", shape: "circle", hue: "#22c55e", desc: "Days you've chatted", tiers: [30, 100, 250, 365], unit: "days", value: (s) => s.messages.activeDays },
  { id: "nightowl", name: "Night Owl", category: "chat", icon: "Moon", shape: "circle", hue: "#6366f1", desc: "Share of your messages sent 10 PM – 5 AM", tiers: [25, 35, 50, 65], unit: "percent", value: (s) => hourShare(s, 22, 5) },
  { id: "earlybird", name: "Early Bird", category: "chat", icon: "Sunrise", shape: "circle", hue: "#facc15", desc: "Share of your messages sent 5 – 11 AM", tiers: [20, 30, 45, 60], unit: "percent", value: (s) => hourShare(s, 5, 11) },
  { id: "shutterbug", name: "Shutterbug", category: "chat", icon: "Camera", shape: "circle", hue: "#14b8a6", desc: "Images shared", tiers: [25, 100, 500, 1500], value: (s) => s.messages.images },
  { id: "giflord", name: "GIF Lord", category: "chat", icon: "Clapperboard", shape: "circle", hue: "#a855f7", desc: "GIFs sent", tiers: [25, 100, 500, 1500], value: (s) => s.messages.gifs },
  { id: "emoji", name: "Emoji Artist", category: "chat", icon: "Smile", shape: "circle", hue: "#f472b6", desc: "Emojis used in messages", tiers: [100, 500, 2500, 10000], value: (s) => s.messages.emojis },
  { id: "stickers", name: "Sticker Collector", category: "chat", icon: "Sticker", shape: "circle", hue: "#fb923c", desc: "Stickers sent", tiers: [10, 50, 200, 600], value: (s) => s.messages.stickers },

  // Social
  { id: "socialstar", name: "Social Star", category: "social", icon: "Users", shape: "hex", hue: "#ec4899", desc: "Different members you've talked with", tiers: [10, 30, 75, 150], value: (s) => s.social.count },
  { id: "mutuals", name: "Well Connected", category: "social", icon: "Network", shape: "hex", hue: "#db2777", desc: "Mutual friendships (you both reach out)", tiers: [5, 15, 40, 80], value: (s) => s.social.mutual },
  { id: "convo", name: "Conversationalist", category: "social", icon: "MessagesSquare", shape: "hex", hue: "#f43f5e", desc: "Back-and-forth exchanges", tiers: [100, 1000, 5000, 20000], value: (s) => s.records.conversations },
  { id: "icebreaker", name: "Icebreaker", category: "social", icon: "Snowflake", shape: "hex", hue: "#38bdf8", desc: "Conversations you started after a quiet spell", tiers: [10, 50, 250, 1000], value: (s) => s.social.starts },
  { id: "replyguy", name: "Reply Machine", category: "social", icon: "Reply", shape: "hex", hue: "#fb7185", desc: "Replies sent", tiers: [50, 250, 1000, 5000], value: (s) => s.messages.repliesSent },
  { id: "popular", name: "Popular", category: "social", icon: "Megaphone", shape: "hex", hue: "#e879f9", desc: "Replies you received", tiers: [50, 250, 1000, 5000], value: (s) => s.messages.repliesReceived },
  { id: "talkoftown", name: "Talk of the Town", category: "social", icon: "AtSign", shape: "hex", hue: "#c084fc", desc: "Times members mentioned you", tiers: [25, 100, 500, 2000], value: (s) => s.records.mentionsReceived },
  { id: "magnet", name: "Reaction Magnet", category: "social", icon: "Heart", shape: "hex", hue: "#f43f5e", desc: "Reactions your messages received", tiers: [100, 1000, 5000, 20000], value: (s) => s.emojis.reactionsReceived },
  { id: "hype", name: "Hype Machine", category: "social", icon: "PartyPopper", shape: "hex", hue: "#f97316", desc: "Reactions you gave", tiers: [100, 1000, 5000, 20000], value: (s) => s.emojis.reactionsGiven },
  { id: "rideordie", name: "Ride or Die", category: "social", icon: "HeartHandshake", shape: "hex", hue: "#be185d", desc: "Friendship score with your bestie", tiers: [100, 500, 2000, 8000], value: (s) => s.circle[0]?.score ?? 0 },

  // Voice
  { id: "voice", name: "Voice Regular", category: "voice", icon: "Headphones", shape: "squircle", hue: "#6366f1", desc: "Time spent in voice chat", tiers: [10 * H, 50 * H, 200 * H, 1000 * H], unit: "duration", value: (s) => s.voice.totalSeconds },
  { id: "marathon", name: "Marathoner", category: "voice", icon: "Timer", shape: "squircle", hue: "#4f46e5", desc: "Longest single voice session", tiers: [2 * H, 4 * H, 8 * H, 12 * H], unit: "duration", value: (s) => s.voice.longestSession },
  { id: "streamer", name: "Streamer", category: "voice", icon: "MonitorUp", shape: "squircle", hue: "#8b5cf6", desc: "Time spent streaming", tiers: [H, 10 * H, 50 * H, 200 * H], unit: "duration", value: (s) => s.voice.streamSeconds },
  { id: "oncamera", name: "On Camera", category: "voice", icon: "Video", shape: "squircle", hue: "#7c3aed", desc: "Time with your camera on", tiers: [1800, 5 * H, 25 * H, 100 * H], unit: "duration", value: (s) => s.voice.cameraSeconds },
  { id: "party", name: "Party Animal", category: "voice", icon: "Music", shape: "squircle", hue: "#a78bfa", desc: "Different VC buddies", tiers: [3, 10, 25, 50], value: (s) => s.social.everyone.filter((p) => p.voiceSeconds > 0).length },

  // Economy
  { id: "hoarder", name: "Leaf Hoarder", category: "economy", icon: "Leaf", shape: "diamond", hue: "#65a30d", desc: "Leaves in your balance", tiers: [10000, 50000, 250000, 1000000], value: (s) => s.economy.balance },
  { id: "spender", name: "Big Spender", category: "economy", icon: "ShoppingBag", shape: "diamond", hue: "#d97706", desc: "Leaves spent in the store", tiers: [5000, 25000, 100000, 500000], value: (s) => s.economy.spent },
  { id: "generous", name: "Generous", category: "economy", icon: "Gift", shape: "diamond", hue: "#e11d48", desc: "Gifts sent to other members", tiers: [1, 5, 20, 50], value: (s) => s.economy.giftsSent },
  { id: "beloved", name: "Beloved", category: "economy", icon: "HeartHandshake", shape: "diamond", hue: "#f472b6", desc: "Gifts received", tiers: [1, 5, 20, 50], value: (s) => s.economy.giftsReceived },
  { id: "bumper", name: "Bumper", category: "economy", icon: "Rocket", shape: "diamond", hue: "#0ea5e9", desc: "Times you bumped the server", tiers: [10, 50, 200, 500], value: (s) => s.economy.bumps },
  { id: "devotee", name: "Daily Devotee", category: "economy", icon: "CalendarHeart", shape: "diamond", hue: "#10b981", desc: "Daily reward streak", tiers: [7, 30, 100, 365], unit: "days", value: (s) => s.economy.dailyStreak },
  { id: "highroller", name: "High Roller", category: "economy", icon: "Dices", shape: "diamond", hue: "#9333ea", desc: "Slot spins", tiers: [50, 250, 1000, 5000], value: (s) => s.economy.gambling?.spins ?? 0 },
  { id: "luckycat", name: "Lucky Cat", category: "economy", icon: "Clover", shape: "diamond", hue: "#16a34a", desc: "Biggest slots win", tiers: [1000, 5000, 25000, 100000], value: (s) => s.economy.gambling?.biggestWin ?? 0 },
  { id: "thinker", name: "Thinker", category: "economy", icon: "Lightbulb", shape: "diamond", hue: "#eab308", desc: "Question of the Day answers", tiers: [5, 25, 100, 300], value: (s) => s.economy.qotdAnswers },

  // Loyalty
  { id: "veteran", name: "Veteran", category: "loyalty", icon: "Crown", shape: "shield", hue: "#ca8a04", desc: "Time since you joined the server", tiers: [90, 365, 730, 1460], unit: "days", value: (s) => daysSince(s.profile.joinedServer) },
  { id: "climber", name: "Climber", category: "loyalty", icon: "TrendingUp", shape: "shield", hue: "#16a34a", desc: "Level reached", tiers: [10, 25, 50, 75], value: (s) => s.level.level },
  { id: "elder", name: "Discord Elder", category: "loyalty", icon: "Hourglass", shape: "shield", hue: "#78716c", desc: "Age of your Discord account", tiers: [2, 4, 6, 8], unit: "years", value: (s) => daysSince(s.profile.discordCreated) / 365.25 },

  // Chat (more)
  { id: "linksharer", name: "Link Sharer", category: "chat", icon: "Link", shape: "circle", hue: "#0284c7", desc: "Links shared", tiers: [25, 100, 500, 2000], value: (s) => s.messages.links },
  { id: "perfectionist", name: "Perfectionist", category: "chat", icon: "Eraser", shape: "circle", hue: "#64748b", desc: "Messages you went back and edited", tiers: [25, 100, 500, 2000], value: (s) => s.messages.edited },
  { id: "voicenoter", name: "Voice Noter", category: "chat", icon: "AudioLines", shape: "circle", hue: "#0891b2", desc: "Voice notes and audio clips sent", tiers: [5, 25, 100, 300], value: (s) => s.messages.audio },
  { id: "busybee", name: "Busy Bee", category: "chat", icon: "Zap", shape: "circle", hue: "#eab308", desc: "Messages on your busiest day", tiers: [100, 250, 500, 1000], value: (s) => s.messages.busiestDay?.n ?? 0 },
  { id: "consistent", name: "Consistent", category: "chat", icon: "Repeat", shape: "circle", hue: "#22c55e", desc: "Your current chat streak", tiers: [3, 7, 14, 30], unit: "days", value: (s) => s.messages.currentStreak },
  { id: "explorer", name: "Explorer", category: "chat", icon: "Compass", shape: "circle", hue: "#f59e0b", desc: "Different channels you've chatted in", tiers: [5, 10, 20, 35], value: (s) => s.activity.channelsUsed },

  // Social (more)
  { id: "fanclub", name: "Fan Club", category: "social", icon: "Star", shape: "hex", hue: "#fbbf24", desc: "Different members who react to your messages", tiers: [5, 15, 40, 80], value: (s) => s.social.everyone.filter((p) => p.in.reactions > 0).length },
  { id: "cuddlebug", name: "Cuddle Bug", category: "social", icon: "HeartHandshake", shape: "hex", hue: "#fb7185", desc: "Hugs given with /hug", tiers: [5, 25, 100, 300], value: (s) => cmd(s, "hug") },
  { id: "booper", name: "Booper", category: "social", icon: "Hand", shape: "hex", hue: "#f9a8d4", desc: "Boops given with /boop", tiers: [5, 25, 100, 300], value: (s) => cmd(s, "boop") },
  { id: "pingpong", name: "Ping Pong", category: "social", icon: "ArrowLeftRight", shape: "hex", hue: "#e11d48", desc: "Replies you received for every reply you sent (×100)", tiers: [50, 80, 100, 150], value: (s) => Math.round((s.social.replyRatio ?? 0) * 100) },
  { id: "speedy", name: "Speedy Replier", category: "social", icon: "Gauge", shape: "hex", hue: "#06b6d4", desc: "Replies on average within this many minutes (lower is better)", tiers: [1], value: (s) => (s.social.avgReplySeconds !== null && s.social.avgReplySeconds <= 120 && s.messages.repliesSent >= 25 ? 1 : 0) },

  // Voice (more)
  { id: "nightcaller", name: "Night Caller", category: "voice", icon: "MoonStar", shape: "squircle", hue: "#4338ca", desc: "Share of your voice joins between 10 PM and 5 AM", tiers: [25, 35, 50, 65], unit: "percent", value: (s) => s.activity.voiceNightShare },
  { id: "sessionpro", name: "Session Pro", category: "voice", icon: "Radio", shape: "squircle", hue: "#6d28d9", desc: "Voice sessions", tiers: [10, 50, 200, 500], value: (s) => s.voice.sessions || s.voice.joins },
  { id: "monthlyvoice", name: "Voice of the Month", category: "voice", icon: "Mic", shape: "squircle", hue: "#818cf8", desc: "Voice time this month", tiers: [5 * H, 20 * H, 50 * H, 100 * H], unit: "duration", value: (s) => s.voice.monthSeconds },

  // Economy (more)
  { id: "shopaholic", name: "Shopaholic", category: "economy", icon: "ShoppingCart", shape: "diamond", hue: "#c2410c", desc: "Store purchases", tiers: [5, 20, 50, 100], value: (s) => s.economy.purchases },
  { id: "hoardthings", name: "Treasure Chest", category: "economy", icon: "Package", shape: "diamond", hue: "#a16207", desc: "Items in your inventory", tiers: [5, 15, 30, 60], value: (s) => s.economy.items },
  { id: "commander", name: "Command Master", category: "economy", icon: "Terminal", shape: "diamond", hue: "#475569", desc: "Bot commands used", tiers: [50, 250, 1000, 5000], value: (s) => s.records.commandsUsed },
  { id: "wordler", name: "Wordler", category: "economy", icon: "Grid3x3", shape: "diamond", hue: "#16a34a", desc: "Wordle games started", tiers: [5, 25, 100, 300], value: (s) => cmd(s, "wordle") },
  { id: "bumpmonth", name: "Bump Squad", category: "economy", icon: "ArrowBigUp", shape: "diamond", hue: "#0369a1", desc: "Bumps this month", tiers: [3, 10, 25, 50], value: (s) => s.economy.monthlyBumps },

  // Loyalty (more)
  { id: "anniversary", name: "Kingdom Anniversary", category: "loyalty", icon: "Cake", shape: "shield", hue: "#db2777", desc: "Years since you joined the server", tiers: [1, 2, 3, 4], unit: "years", value: (s) => daysSince(s.profile.joinedServer) / 365.25 },
  { id: "founding", name: "Founding Member", category: "loyalty", icon: "Castle", shape: "shield", hue: "#b45309", desc: "Joined in the server's first month", tiers: [1], value: (s) => founding(s) },
  { id: "boostvet", name: "Booster Veteran", category: "loyalty", icon: "Gem", shape: "shield", hue: "#ec4899", desc: "Days you've been boosting the server", tiers: [30, 90, 180, 365], unit: "days", value: (s) => daysSince(s.profile.boostingSince) },
  { id: "dedicated", name: "Dedicated", category: "loyalty", icon: "Target", shape: "shield", hue: "#15803d", desc: "Share of days you've chatted since you started", tiers: [25, 40, 60, 80], unit: "percent", value: (s) => Math.round((s.activity.activeShare ?? 0) * 100) },

  // Events and occasions
  { id: "hollyjolly", name: "Holly Jolly", category: "events", icon: "TreePine", shape: "octagon", hue: "#15803d", desc: "Chatted on Christmas Day", tiers: [1], value: (s) => yes(s.events.christmas) },
  { id: "spooky", name: "Spooky", category: "events", icon: "Ghost", shape: "octagon", hue: "#ea580c", desc: "Chatted on Halloween", tiers: [1], value: (s) => yes(s.events.halloween) },
  { id: "newyear", name: "New Year, New Me", category: "events", icon: "PartyPopper", shape: "octagon", hue: "#eab308", desc: "Chatted on New Year's Day", tiers: [1], value: (s) => yes(s.events.newYear) },
  { id: "bemine", name: "Be Mine", category: "events", icon: "HeartPulse", shape: "octagon", hue: "#e11d48", desc: "Chatted on Valentine's Day", tiers: [1], value: (s) => yes(s.events.valentines) },
  { id: "luckycharm", name: "Lucky Charm", category: "events", icon: "Clover", shape: "octagon", hue: "#16a34a", desc: "Chatted on St. Patrick's Day", tiers: [1], value: (s) => yes(s.events.stPatricks) },
  { id: "foolsgold", name: "Fool's Gold", category: "events", icon: "Laugh", shape: "octagon", hue: "#f59e0b", desc: "Chatted on April Fools' Day", tiers: [1], value: (s) => yes(s.events.aprilFools) },
  { id: "leapday", name: "Leap of Faith", category: "events", icon: "Rabbit", shape: "octagon", hue: "#0d9488", desc: "Chatted on Leap Day (February 29)", tiers: [1], value: (s) => yes(s.events.leapDay) },
  { id: "friday13", name: "Unlucky Paws", category: "events", icon: "Skull", shape: "octagon", hue: "#57534e", desc: "Chatted on a Friday the 13th", tiers: [1], value: (s) => yes(s.events.fridayThe13th) },
  { id: "spookyseason", name: "Spooky Season", category: "events", icon: "Candy", shape: "octagon", hue: "#f97316", desc: "Days you chatted in October", tiers: [3, 10, 20, 31], unit: "days", value: (s) => s.events.october },
  { id: "winter", name: "Winter Wonderland", category: "events", icon: "Snowflake", shape: "octagon", hue: "#38bdf8", desc: "Days you chatted in December", tiers: [3, 10, 20, 31], unit: "days", value: (s) => s.events.december },
  { id: "summer", name: "Summer Vibes", category: "events", icon: "Sun", shape: "octagon", hue: "#fbbf24", desc: "Days you chatted in June, July and August", tiers: [10, 30, 60, 90], unit: "days", value: (s) => s.events.summer },
  { id: "spring", name: "Spring Bloom", category: "events", icon: "Flower2", shape: "octagon", hue: "#f472b6", desc: "Days you chatted in March, April and May", tiers: [10, 30, 60, 90], unit: "days", value: (s) => s.events.spring },
  { id: "pride", name: "Pride", category: "events", icon: "Rainbow", shape: "octagon", hue: "#a855f7", desc: "Days you chatted during Pride Month (June)", tiers: [3, 10, 20, 30], unit: "days", value: (s) => s.events.june },
  { id: "weekend", name: "Weekend Warrior", category: "events", icon: "Sofa", shape: "octagon", hue: "#0ea5e9", desc: "Share of your messages sent on weekends", tiers: [30, 40, 50, 60], unit: "percent", value: (s) => (s.messages.total >= 50 ? Math.round(s.activity.weekendShare * 100) : 0) },
  { id: "witching", name: "Witching Hour", category: "events", icon: "Wand2", shape: "octagon", hue: "#7c3aed", desc: "Share of your messages sent between 3 and 5 AM", tiers: [3, 6, 10, 15], unit: "percent", value: (s) => s.activity.witchingShare },

  // Website
  { id: "pioneer", name: "Web Pioneer", category: "website", icon: "Globe", shape: "burst", hue: "#f59b2a", desc: "Made a website account in 2026", tiers: [1], value: (_s, w) => yes(w.accountCreated && w.accountCreated < "2027-01-01") },
  { id: "linkedup", name: "Linked Up", category: "website", icon: "Link2", shape: "burst", hue: "#5865f2", desc: "Linked your Discord to the website", tiers: [1], value: () => 1 },
  { id: "verified", name: "Verified", category: "website", icon: "MailCheck", shape: "burst", hue: "#22c55e", desc: "Verified your email", tiers: [1], value: (_s, w) => yes(w.emailVerified) },
  { id: "lockeddown", name: "Locked Down", category: "website", icon: "Lock", shape: "burst", hue: "#0f766e", desc: "Turned on two-factor authentication", tiers: [1], value: (_s, w) => yes(w.twoFactor) },
  { id: "socialite", name: "Socialite", category: "website", icon: "Share2", shape: "burst", hue: "#8b5cf6", desc: "Social links on your profile", tiers: [1, 2, 3, 4], value: (_s, w) => w.socials },
  { id: "statnerd", name: "Stat Nerd", category: "website", icon: "BarChart3", shape: "burst", hue: "#06b6d4", desc: "Times you've opened your stats", tiers: [1, 10, 50, 200], value: (_s, w) => w.statsViews },
  { id: "regularweb", name: "Frequent Visitor", category: "website", icon: "MousePointerClick", shape: "burst", hue: "#f97316", desc: "Times you've signed in on the website", tiers: [5, 25, 100, 250], value: (_s, w) => w.signIns },
  { id: "showoff", name: "Show-Off", category: "website", icon: "Pin", shape: "burst", hue: "#eab308", desc: "Pinned 3 badges to your profile", tiers: [1], value: (_s, w) => yes(w.pinned >= 3) },
  { id: "titled", name: "Titled", category: "website", icon: "Type", shape: "burst", hue: "#ec4899", desc: "Picked a badge title", tiers: [1], value: (_s, w) => yes(w.hasTitle) },

  // Special (one tier)
  { id: "booster", name: "Server Booster", category: "special", icon: "Gem", shape: "star", hue: "#f472b6", desc: "Boosting the server", tiers: [1], value: (s) => (s.multipliers.booster ? 1 : 0) },
  { id: "patron", name: "Patron", category: "special", icon: "HandHeart", shape: "star", hue: "#f97316", desc: "Supporting Kitty Kingdom on Patreon", tiers: [1], value: (s) => (s.multipliers.patreon ? 1 : 0) },
  { id: "royalguard", name: "Royal Guard", category: "special", icon: "ShieldCheck", shape: "star", hue: "#3b82f6", desc: "Part of the staff team", tiers: [1], value: (s) => (s.profile.isStaff ? 1 : 0) },
];

export type EarnedBadge = {
  id: string;
  name: string;
  category: BadgeCategory;
  icon: string;
  shape: BadgeShape;
  hue: string;
  desc: string;
  tiers: number[];
  unit: BadgeDef["unit"] | null;
  value: number;
  /** 0 = locked; 1..4 for Bronze..Diamond (special badges are 4 when earned) */
  tier: number;
  /** 0..1 toward the next tier */
  progress: number;
};

// Badges about collecting badges (worked out after the others)
const META: Omit<BadgeDef, "value">[] = [
  { id: "collector", name: "Collector", category: "special", icon: "Library", shape: "star", hue: "#facc15", desc: "Badges earned", tiers: [10, 25, 40, 60] },
  { id: "diamondhands", name: "Diamond Hands", category: "special", icon: "Diamond", shape: "star", hue: "#67e8f9", desc: "Badges at Diamond tier", tiers: [1, 3, 6, 10] },
];

export const BADGE_COUNT = BADGES.length + META.length;

function earnedFrom(b: Omit<BadgeDef, "value">, raw: number): EarnedBadge {
  const value = Math.max(0, Number(raw) || 0);
  const special = b.tiers.length === 1;
  const reached = b.tiers.filter((t) => value >= t).length;
  const tier = special ? (reached ? 4 : 0) : reached;
  const next = special ? (reached ? null : b.tiers[0]) : b.tiers[reached] ?? null;
  const prev = reached && !special ? b.tiers[reached - 1] : 0;
  const progress = next === null ? 1 : Math.min(1, Math.max(0, (value - prev) / Math.max(1, next - prev)));
  return { id: b.id, name: b.name, category: b.category, icon: b.icon, shape: b.shape, hue: b.hue, desc: b.desc, tiers: b.tiers, unit: b.unit ?? null, value, tier, progress };
}

export function computeBadges(s: MemberStats, site: SiteContext = NO_SITE): EarnedBadge[] {
  const base = BADGES.map((b) => {
    let raw = 0;
    try {
      raw = b.value(s, site);
    } catch {
      raw = 0;
    }
    return earnedFrom(b, raw);
  });
  const earnedCount = base.filter((b) => b.tier > 0).length;
  const diamonds = base.filter((b) => b.tier === 4 && b.tiers.length > 1).length;
  return [...base, earnedFrom(META[0], earnedCount), earnedFrom(META[1], diamonds)];
}

/** What a member saved to show off: badge ids (in order) plus an optional title badge. */
export type BadgeShowcase = { pinned: { id: string; tier: number }[]; title: { id: string; tier: number } | null };

export function badgeById(id: string) {
  return BADGES.find((b) => b.id === id) ?? META.find((b) => b.id === id) ?? null;
}
