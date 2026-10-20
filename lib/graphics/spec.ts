// Admin → Graphics: what a stat graphic is made of. The server works the numbers out (lib/graphics/stats.ts) and
// sends one of these; the page draws it (app/admin/graphics). Shared by both, so no server-only imports here.

export type Fmt = "number" | "hours" | "leaves" | "percent" | "minutes";

export type Row = { label: string; value: number; note?: string; muted?: boolean };
export type Tile = { label: string; value: string; note?: string };

export type Block =
  | { kind: "bars"; title: string; rows: Row[]; total?: number; format?: Fmt; colorful?: boolean }
  | { kind: "leaderboard"; title: string; rows: Row[]; format?: Fmt }
  | { kind: "columns"; title: string; rows: Row[]; format?: Fmt }
  | { kind: "line"; title: string; labels: string[]; series: { name: string; values: number[] }[]; format?: Fmt }
  | { kind: "heat"; title: string; rows: string[]; cols: string[]; cells: number[][]; totals?: number[]; format?: Fmt; /** Colour each column on its own scale (for scorecards) */ byColumn?: boolean }
  | { kind: "strip"; title: string; rows: Row[] }
  | { kind: "tiles"; tiles: Tile[] };

export type Spec = {
  title: string;
  subtitle: string;
  footnote: string;
  eyebrow?: string;
  hero?: { label: string; big: string; small?: string; caption: string };
  tiles?: Tile[];
  main: Block;
  side?: Block;
  bottom?: Block;
};

export type ParamKind = "range" | "tz" | "top" | "group" | "among" | "channel" | "rolesA" | "rolesB" | "rowGroup" | "colGroup" | "months" | "game";
export type StatMeta = { id: string; category: string; title: string; blurb: string; params: ParamKind[]; tags?: string[] };
export type Params = Partial<Record<ParamKind, string>>;

/** Each category's icon is a lucide icon name (drawn by the Graphics page). */
export const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: "staff", label: "Staff activity", icon: "ShieldCheck" },
  { key: "members", label: "Members & roles", icon: "Users" },
  { key: "chat", label: "Chat", icon: "MessageCircle" },
  { key: "voice", label: "Voice", icon: "Mic" },
  { key: "levels", label: "Levels & economy", icon: "Leaf" },
  { key: "casino", label: "Casino", icon: "Dices" },
  { key: "store", label: "Store & gifts", icon: "ShoppingBag" },
  { key: "community", label: "QOTD, Wordle, events & giveaways", icon: "PartyPopper" },
  { key: "social", label: "Social", icon: "HeartHandshake" },
  { key: "moderation", label: "Moderation & tickets", icon: "Gavel" },
  { key: "website", label: "Website", icon: "Globe" },
  { key: "server", label: "Server logs", icon: "ScrollText" },
];

export const RANGES: [string, string][] = [
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
  ["365", "Last year"],
  ["all", "All time"],
];
export const ZONES: [string, string][] = [
  ["America/New_York", "Eastern (US)"],
  ["America/Chicago", "Central (US)"],
  ["America/Denver", "Mountain (US)"],
  ["America/Los_Angeles", "Pacific (US)"],
  ["Europe/London", "UK"],
  ["Europe/Berlin", "Central Europe"],
  ["Australia/Sydney", "Australia (East)"],
  ["UTC", "UTC"],
];

export function formatValue(v: number, f: Fmt = "number") {
  if (f === "hours") return v >= 100 ? `${Math.round(v).toLocaleString("en-US")}h` : `${v.toFixed(1)}h`;
  if (f === "minutes") return `${Math.round(v).toLocaleString("en-US")}m`;
  if (f === "percent") return `${v.toFixed(v < 10 ? 1 : 0)}%`;
  if (f === "leaves") return Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e4 ? `${(v / 1e3).toFixed(1)}K` : Math.round(v).toLocaleString("en-US");
  return Math.round(v).toLocaleString("en-US");
}
