// Event types and kinds that the browser can use too (no database code here; see lib/events.ts).

export const EVENT_KINDS = [
  { key: "games", label: "Game night", emoji: "🎮" },
  { key: "movie", label: "Movie night", emoji: "🍿" },
  { key: "voice", label: "Voice hangout", emoji: "🎙️" },
  { key: "contest", label: "Contest", emoji: "🏆" },
  { key: "art", label: "Art", emoji: "🎨" },
  { key: "music", label: "Music", emoji: "🎶" },
  { key: "special", label: "Special event", emoji: "✨" },
  { key: "other", label: "Other", emoji: "📅" },
] as const;
export type EventKind = (typeof EVENT_KINDS)[number]["key"];

export type ServerEvent = {
  id: string;
  title: string;
  description: string;
  kind: EventKind;
  startAt: string;
  endAt: string | null;
  /** A Discord channel id, or null with `place` text ("On the website", "Minecraft server"…) */
  channelId: string | null;
  place: string | null;
  hostId: string | null;
  hostName: string | null;
  image: string | null;
  weekly: boolean;
  discord: boolean;
  /** Posted (and kept up to date) as an embed in the events announcement channel */
  post: boolean;
  cancelled: boolean;
  going: number;
  createdBy: string | null;
};

export type PublicEvent = ServerEvent & { channelName: string | null; voice: boolean };
