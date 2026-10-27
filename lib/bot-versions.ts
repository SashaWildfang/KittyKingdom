// Bot upkeep for Admin → Bots → Consoles:
//   • Up to date?  Each bot reports a hash of its code files (events/fingerprint.py); lib/bot-manifest.json has
//     the hashes of the latest copies (scripts/bot-manifest.py). Any difference is a file that needs uploading.
//   • Uptime timeline: minute-by-minute up/down from zeo_bot.status_days (the status page's history).
//   • Issue hints: plain-English causes for the errors bots print most.

import manifest from "./bot-manifest.json";
import { getBotCollection } from "./mongodb";

type Manifest = { generatedAt: string; bots: Record<string, Record<string, string>> };
const M = manifest as Manifest;

export type VersionReport = {
  bot: string;
  reportedAt: string | null;
  startedAt: string | null;
  latestAt: string;
  /** Files whose uploaded copy isn't the latest */
  outdated: string[];
  /** Files the latest version has that the bot doesn't */
  missing: string[];
  /** Files on the bot that aren't in the latest version (old leftovers, usually harmless) */
  extra: string[];
  total: number;
};

export async function botVersions(): Promise<VersionReport[]> {
  const rows = await (await getBotCollection("bot_fingerprints")).find({}).toArray();
  const byBot = new Map(rows.map((r) => [String(r._id), r]));
  return Object.entries(M.bots).map(([bot, latest]) => {
    const r = byBot.get(bot);
    const files = (r?.files ?? {}) as Record<string, string>;
    const reported = Boolean(r);
    return {
      bot,
      reportedAt: r?.at instanceof Date ? r.at.toISOString() : null,
      startedAt: r?.startedAt instanceof Date ? r.startedAt.toISOString() : null,
      latestAt: M.generatedAt,
      outdated: reported ? Object.keys(latest).filter((f) => files[f] && files[f] !== latest[f]).sort() : [],
      missing: reported ? Object.keys(latest).filter((f) => !files[f]).sort() : [],
      extra: reported ? Object.keys(files).filter((f) => !latest[f]).sort() : [],
      total: Object.keys(latest).length,
    };
  });
}

/**
 * Up/down per hour for the last `days` days. A bot marks itself up every minute, so a past minute with no record
 * means it was offline (down). Minutes before tracking started, and minutes still to come, are "unknown".
 */
export async function uptimeTimeline(part: string, days = 7) {
  const out: { day: string; hours: { up: number; down: number }[] }[] = [];
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) keys.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  const col = await getBotCollection("status_days");
  const [docs, first] = await Promise.all([
    col.find({ part, day: { $in: keys } }, { projection: { day: 1, up: 1, down: 1 } }).toArray(),
    col.find({ part }, { projection: { day: 1, up: 1, down: 1 } }).sort({ day: 1 }).limit(1).next(),
  ]);
  // The first minute ever recorded for this part
  const firstMinutes = first ? [...((first.up as number[]) ?? []), ...((first.down as number[]) ?? [])] : [];
  const trackedFrom = first ? Date.parse(`${first.day}T00:00:00Z`) + (firstMinutes.length ? Math.min(...firstMinutes) : 0) * 60_000 : Infinity;
  const now = Date.now();
  const byDay = new Map(docs.map((d) => [String(d.day), d]));
  for (const day of keys) {
    const d = byDay.get(day);
    const up = new Set<number>((d?.up as number[] | undefined) ?? []);
    const dayStart = Date.parse(`${day}T00:00:00Z`);
    const hours = Array.from({ length: 24 }, (_, h) => {
      let u = 0;
      let dn = 0;
      for (let m = h * 60; m < h * 60 + 60; m += 1) {
        const at = dayStart + m * 60_000;
        if (up.has(m)) u += 1;
        else if (at >= trackedFrom && at < now - 60_000) dn += 1;
      }
      return { up: u, down: dn };
    });
    out.push({ day, hours });
  }
  return out;
}

const HINTS: { test: RegExp; cause: string; fix: string }[] = [
  { test: /ServerSelectionTimeout|AutoReconnect|NetworkTimeout|connection pool|No servers found|ECONNRESET.*27017/i, cause: "The database (DigitalOcean) was briefly unreachable.", fix: "Usually fixes itself within a minute. If it keeps happening, check the database's status in DigitalOcean." },
  { test: /\b429\b|rate.?limit/i, cause: "Discord asked the bot to slow down (rate limit).", fix: "Harmless if it's occasional. Lots of these means something is sending messages or edits in a loop." },
  { test: /50035|Invalid Form Body/i, cause: "The bot sent Discord something it won't accept (text too long, a bad emoji, an empty field).", fix: "The line under the error says which field. Send it to Claude to fix." },
  { test: /50013|Missing Permissions|Forbidden.*403|403 Forbidden/i, cause: "The bot isn't allowed to do that in that channel (or the target's role is above the bot's).", fix: "Check the bot's role position and that channel's permissions (Server checks can help)." },
  { test: /10008|10003|10007|10062|Unknown (Message|Channel|Member|interaction)|NotFound.*404/i, cause: "Something was deleted (or the member left) before the bot got to it.", fix: "Harmless. Nothing to do." },
  { test: /ImportError|ModuleNotFoundError|cannot import name/i, cause: "A file is missing or out of date on the bot's server.", fix: "Open Up to date? and upload the files it lists, then restart the bot." },
  { test: /SyntaxError|IndentationError|TabError/i, cause: "A code file is broken, usually from a partial or mixed-up upload.", fix: "Re-upload the file it names (Up to date? lists it), then restart." },
  { test: /ClientConnectorError|ServerDisconnectedError|TimeoutError|asyncio\.Timeout|Cannot connect to host/i, cause: "A request to an outside website timed out or failed.", fix: "Usually temporary. If one service keeps failing, it may be down or have changed." },
  { test: /\b(401|403)\b.*(api|http)|Unauthorized/i, cause: "An outside service refused the bot (bad key or blocked).", fix: "Check that service's API key, or whether it now needs one." },
  { test: /MemoryError|Killed|OOM/i, cause: "The bot ran out of memory.", fix: "See Resources for a memory suggestion." },
  { test: /KeyError|TypeError|AttributeError|ValueError|IndexError|NameError/i, cause: "A bug in the bot's code.", fix: "Send the error to Claude to fix." },
];

export function issueHint(title: string, detail: string) {
  const text = `${title}\n${detail}`;
  const h = HINTS.find((x) => x.test.test(text));
  return h ? { cause: h.cause, fix: h.fix } : null;
}
