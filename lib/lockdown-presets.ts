// Admin → Moderation → Lockdown: what a lockdown can do. Must match PRESETS in Moderation/db/locks.py.
// Client-safe.

export type LockdownOptions = {
  pauseInvites: boolean;
  pauseDms: boolean;
  joinAction: "kick" | "none";
  raiseVerification: boolean;
  lockChats: boolean;
  slowmode: number;
};

export const LOCKDOWN_PRESETS: Record<string, { label: string; about: string } & LockdownOptions> = {
  raid: { label: "Raid", about: "Everything: no invites, no DMs, no new joins, top verification and the main chats locked.", pauseInvites: true, pauseDms: true, joinAction: "kick", raiseVerification: true, lockChats: true, slowmode: 0 },
  invites: { label: "Invites only", about: "Stop new people getting in. Chat carries on as normal.", pauseInvites: true, pauseDms: false, joinAction: "kick", raiseVerification: false, lockChats: false, slowmode: 0 },
  chats: { label: "Chats only", about: "Lock the main chats so only staff can talk. People can still join.", pauseInvites: false, pauseDms: false, joinAction: "none", raiseVerification: false, lockChats: true, slowmode: 0 },
  slow: { label: "Slow down", about: "Slowmode on the main chats, nothing else.", pauseInvites: false, pauseDms: false, joinAction: "none", raiseVerification: false, lockChats: false, slowmode: 30 },
};

export const LOCKDOWN_OPTION_LABELS: { key: keyof LockdownOptions; label: string; about: string }[] = [
  { key: "pauseInvites", label: "Pause invites", about: "Nobody can use an invite link." },
  { key: "joinAction", label: "Block new joins", about: "Anyone who still gets in is DMed and removed." },
  { key: "pauseDms", label: "Pause DMs", about: "Members who aren't friends can't DM each other (Discord's own raid tool)." },
  { key: "raiseVerification", label: "Highest verification", about: "A verified phone number is needed to talk." },
  { key: "lockChats", label: "Lock the main chats", about: "The channels in Admin → Bots → Moderation Bot → Lockdown." },
  { key: "slowmode", label: "Slowmode", about: "On the slowmode channels set there too." },
];

export const LOCK_DURATIONS: [string, number][] = [
  ["Until unlocked", 0],
  ["5 minutes", 300],
  ["15 minutes", 900],
  ["30 minutes", 1800],
  ["1 hour", 3600],
  ["2 hours", 7200],
  ["6 hours", 21600],
  ["12 hours", 43200],
  ["1 day", 86400],
  ["3 days", 259200],
  ["1 week", 604800],
];
