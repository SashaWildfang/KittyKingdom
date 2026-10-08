// Admin → Bots: every setting an admin can change, per bot, like a plugin's config.yml.
// Values are saved in zeo_bot.bot_settings {_id: bot, values: {key: value}} (only changed keys; a reset
// removes the key so the bot falls back to its default). The bots read them through db/settings.py
// (Main_Bot) with the same keys. Defaults here must match the defaults in the bot code.
//
// Client-safe: no database code in this file.

export type FieldType = "toggle" | "number" | "text" | "textarea" | "list" | "channel" | "channels" | "role" | "roles" | "select" | "timezone";

export type Field = {
  key: string;
  label: string;
  help: string;
  type: FieldType;
  default: unknown;
  min?: number;
  max?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  /** For lists: what each line is, and the placeholders it may use */
  itemHint?: string;
  maxItems?: number;
  maxLength?: number;
  /** Shown as a warning next to the field */
  warn?: string;
};

export type Section = { key: string; title: string; icon: string; about: string; fields: Field[]; link?: { href: string; label: string } };

export type BotDef = { key: string; name: string; about: string; ready: boolean; sections: Section[] };

const HUGS = [
  "{sender} wraps their arms around {target} in a warm, cozy hug.",
  "{sender} gives {target} a big, squishy bear hug!",
  "{sender} pulls {target} into a long, comforting embrace.",
  "{sender} leans in and gives {target} a soft, gentle hug.",
  "{sender} tackles {target} with a surprise cuddle!",
  "{sender} gives {target} a friendly squeeze!",
  "{sender} wraps a wing/arm around {target} for a quick side-hug.",
  "{sender} gives {target} a hug that feels like home.",
  "{sender} nestles closer to {target} for a brief, sweet hug.",
  "{sender} offers {target} a hug to brighten their day.",
  "{sender} refuses to let go and keeps hugging {target}!",
  "{sender} boops {target} on the nose before pulling them into a hug.",
];
const BOOPS = [
  "{sender} booped {target} on the nose.",
  "{sender} gave {target} a soft boop.",
  "{sender} reached out and booped {target}.",
  "{sender} gently booped {target}.",
  "{sender} looked at {target}, then booped them.",
  "{sender} launched a surprise boop at {target}.",
  "{sender} used Boop! It was super effective on {target}.",
  "{sender} gave {target} a boop and vanished.",
  "{sender} delivered a critical boop to {target}.",
];
const EIGHT_BALL = [
  "🎱 It is certain.", "🎱 Without a doubt.", "🎱 Yes – definitely.", "🎱 You may rely on it.", "🎱 Most likely.", "🎱 Outlook good.",
  "🎱 Yes.", "🎱 Signs point to yes.", "🎱 Reply hazy, try again.", "🎱 Ask again later.", "🎱 Better not tell you now.", "🎱 Cannot predict now.",
  "🎱 Concentrate and ask again.", "🎱 Don’t count on it.", "🎱 My reply is no.", "🎱 My sources say no.", "🎱 Outlook not so good.", "🎱 Very doubtful.",
];

const MAIN: BotDef = {
  key: "main",
  name: "Main Bot",
  about: "Logging, Patreon, custom roles, the Store, media perms, staff sync, fun commands and more.",
  ready: true,
  sections: [
    {
      key: "general",
      title: "Status",
      icon: "activity",
      about: "What the bot shows under its name in the member list.",
      fields: [
        { key: "general.statusEnabled", label: "Rotate statuses", help: "Turn off to leave the bot's status alone.", type: "toggle", default: true },
        {
          key: "general.activityType",
          label: "Activity type",
          help: "The word Discord shows before the status.",
          type: "select",
          default: "watching",
          options: [
            { value: "watching", label: "Watching …" },
            { value: "playing", label: "Playing …" },
            { value: "listening", label: "Listening to …" },
            { value: "competing", label: "Competing in …" },
          ],
        },
        { key: "general.statusInterval", label: "Change every", help: "How long each status shows before the next one.", type: "number", default: 60, min: 15, max: 3600, unit: "seconds" },
        {
          key: "general.statuses",
          label: "Statuses",
          help: "One per line. They rotate in order.",
          type: "list",
          default: ["kittykingdom.net", "Check your stats /stats", "Hit the jackpot /slots", "Need help? /help", "Patreon perks /patreon", "Spend your Leaves in /store"],
          maxItems: 30,
          maxLength: 128,
          itemHint: "Up to 128 characters",
        },
      ],
    },
    {
      key: "logging",
      title: "Server log",
      icon: "scroll",
      about: "What the bot posts in the server log channel.",
      fields: [
        { key: "logging.channel", label: "Log channel", help: "Where deletes, edits, role changes and boosts are logged.", type: "channel", default: "1360344042705256660" },
        { key: "logging.deletes", label: "Deleted messages", help: "Log deleted messages (with what they contained).", type: "toggle", default: true },
        { key: "logging.archiveMedia", label: "Save deleted media", help: "Re-upload pictures and videos from deleted messages into the log.", type: "toggle", default: true },
        { key: "logging.edits", label: "Edited messages", help: "Log the before and after of edited messages.", type: "toggle", default: true },
        { key: "logging.roles", label: "Role changes", help: "Log roles added or removed (batched every few seconds).", type: "toggle", default: true },
        { key: "logging.members", label: "Member changes", help: "Nicknames, roles, timeouts and boosts ending. Turning this off also stops role-change logs.", type: "toggle", default: true },
        { key: "logging.profiles", label: "Avatar and username changes", help: "Log when members change their avatar or username.", type: "toggle", default: true },
        { key: "logging.boosts", label: "Server boosts", help: "Log new server boosts.", type: "toggle", default: true },
        { key: "logging.ignoredChannels", label: "Don't log these channels", help: "Deletes and edits here aren't logged (e.g. spam or bot channels).", type: "channels", default: [] },
      ],
    },
    {
      key: "media",
      title: "Media perms",
      icon: "image",
      about: "Members unlock pictures, GIFs and reactions once they're active enough.",
      fields: [
        { key: "media.role", label: "Media role", help: "The role that unlocks media.", type: "role", default: "1502679664894677063" },
        { key: "media.memberRole", label: "Required role", help: "Only members with this role can earn it (verified members).", type: "role", default: "1358469854725931038" },
        { key: "media.level", label: "Level needed", help: "Earned at this level…", type: "number", default: 5, min: 0, max: 200 },
        { key: "media.messages", label: "…or messages sent", help: "…or after this many messages, whichever comes first.", type: "number", default: 100, min: 0, max: 100000, unit: "messages" },
        { key: "media.channel", label: "Announcement channel", help: "Where the bot congratulates them.", type: "channel", default: "1358485891361804358" },
      ],
    },
    {
      key: "patreon",
      title: "Patreon",
      icon: "crown",
      about: "The Patreon sync, thank-you board and welcome DMs. Tiers and perks themselves live in the bots' perks file.",
      link: { href: "/admin?tab=patreon", label: "Open Admin → Patreon" },
      fields: [
        { key: "patreon.syncMinutes", label: "Sync every", help: "How often the bot reads Patreon and fixes tier roles.", type: "number", default: 5, min: 1, max: 120, unit: "minutes" },
        { key: "patreon.thankYouBoard", label: "Thank-you board posts", help: "Post a thank-you for new patrons and upgrades.", type: "toggle", default: true },
        { key: "patreon.thankYouChannel", label: "Thank-you channel", help: "Where those thank-yous go.", type: "channel", default: "1362519485650833468" },
        { key: "patreon.welcomeDm", label: "Welcome DM", help: "DM new patrons their perks.", type: "toggle", default: true },
        { key: "patreon.catchUpDays", label: "First-run catch-up", help: "The very first sync thanks pledges that started this recently.", type: "number", default: 120, min: 0, max: 3650, unit: "days" },
      ],
    },
    {
      key: "customRoles",
      title: "Custom roles",
      icon: "palette",
      about: "Patreon custom roles members design on My Account or with /myrole.",
      fields: [
        { key: "customRoles.anchorRole", label: "Place custom roles above", help: "Leave empty to put them just above the highest Patreon tier role.", type: "role", default: null },
        { key: "customRoles.stripShopRoles", label: "Replace Store color roles", help: "Take Store color roles off members who have a custom role (they keep owning them).", type: "toggle", default: true },
        {
          key: "customRoles.reserved",
          label: "Reserved words",
          help: "Custom role names can't contain these words (on top of AutoMod's word list).",
          type: "list",
          default: ["admin", "administrator", "mod", "moderator", "staff", "owner", "helper", "everyone", "here", "discord", "kitty kingdom", "bot"],
          maxItems: 200,
          maxLength: 40,
        },
      ],
    },
    {
      key: "store",
      title: "Store & gifts",
      icon: "bag",
      about: "Gifting between members. Items and prices are edited in the Store admin.",
      fields: [
        { key: "gifts.cooldownMinutes", label: "Gift cooldown", help: "How long members wait between gifts.", type: "number", default: 5, min: 0, max: 1440, unit: "minutes" },
        { key: "gifts.logChannel", label: "Gift log channel", help: "Where gifts are logged for staff.", type: "channel", default: "1360344042705256660" },
      ],
    },
    {
      key: "royal",
      title: "Royal perks",
      icon: "gem",
      about: "Patron-only /chest and /wheel.",
      fields: [{ key: "royal.chestDays", label: "Royal Chest cooldown", help: "How often patrons can open /chest.", type: "number", default: 7, min: 1, max: 60, unit: "days" }],
    },
    {
      key: "link",
      title: "Account linking",
      icon: "link",
      about: "The /link command that connects Discord to website accounts.",
      fields: [
        { key: "link.maxAttempts", label: "Wrong codes allowed", help: "Wrong or expired codes before /link pauses for that member.", type: "number", default: 5, min: 1, max: 50 },
        { key: "link.windowSeconds", label: "…within", help: "The time window for those attempts.", type: "number", default: 600, min: 60, max: 86400, unit: "seconds" },
      ],
    },
    {
      key: "staff",
      title: "Staff list",
      icon: "shield",
      about: "Who shows on the website's Staff page.",
      fields: [
        { key: "staff.teamRole", label: "Staff team role", help: "Everyone with this role is listed on the website.", type: "role", default: "1358470109965979859" },
        { key: "staff.syncMinutes", label: "Sync every", help: "How often the list is refreshed (changes also sync shortly after they happen).", type: "number", default: 10, min: 1, max: 1440, unit: "minutes" },
      ],
    },
    {
      key: "social",
      title: "Social DMs",
      icon: "heart",
      about: "Discord DM reminders for unread Social messages on the website.",
      fields: [
        { key: "social.dmEnabled", label: "Send reminders", help: "Members still choose whether they want them in Social settings.", type: "toggle", default: true },
        { key: "social.dmWaitMinutes", label: "Remind after", help: "How long a message stays unread before the reminder.", type: "number", default: 10, min: 1, max: 1440, unit: "minutes" },
      ],
    },
    {
      key: "vc",
      title: "Voice chat",
      icon: "mic",
      about: "The Voice Channel Terms (VC role sign-up).",
      fields: [
        { key: "vc.role", label: "VC role", help: "Given when members sign the Voice Channel Terms.", type: "role", default: "1503200525527810269" },
        { key: "vc.timezone", label: "Time zone", help: "Used for the date members type when they sign.", type: "timezone", default: "US/Mountain" },
      ],
    },
    {
      key: "fun",
      title: "Fun commands",
      icon: "sparkles",
      about: "The messages /hug, /boop and /8ball pick from.",
      fields: [
        { key: "fun.hugs", label: "/hug messages", help: "One per line, picked at random.", type: "list", default: HUGS, maxItems: 100, maxLength: 300, itemHint: "Use {sender} and {target}" },
        { key: "fun.boops", label: "/boop messages", help: "One per line, picked at random.", type: "list", default: BOOPS, maxItems: 100, maxLength: 300, itemHint: "Use {sender} and {target}" },
        { key: "fun.eightBall", label: "/8ball answers", help: "One per line, picked at random.", type: "list", default: EIGHT_BALL, maxItems: 100, maxLength: 200 },
      ],
    },
    {
      key: "ads",
      title: "Tips & ads",
      icon: "megaphone",
      about: "The server tips have their own page with stats and per-tip settings.",
      link: { href: "/admin?tab=ads", label: "Open Admin → Ads" },
      fields: [],
    },
  ],
};

const soon = (key: string, name: string, about: string): BotDef => ({ key, name, about, ready: false, sections: [] });

export const BOTS: BotDef[] = [
  MAIN,
  soon("economy", "Economy Bot", "Leaves, levels, the casino, Wordle, daily rewards and monthly payouts."),
  soon("moderation", "Moderation Bot", "AutoMod, punishments, join applications, rules and QOTD."),
  soon("ticketing", "Ticket Bot", "Support tickets, transcripts and NSFW verification."),
];

export const botDef = (key: string) => BOTS.find((b) => b.key === key) ?? null;

export function allFields(bot: BotDef) {
  return bot.sections.flatMap((s) => s.fields.map((f) => ({ ...f, section: s.key })));
}
