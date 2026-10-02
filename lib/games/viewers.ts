// Who's watching a table: each look is a row in `web_game_viewers` that expires on its own, and a table's
// viewer count is how many rows were refreshed in the last few seconds.

import { getBotCollection } from "../mongodb";
import { num } from "./core";

const VIEWER_TTL_MS = 12_000;

let indexed: Promise<unknown> | null = null;
async function viewersCol() {
  const col = await getBotCollection("web_game_viewers");
  indexed ??= col.createIndex({ at: 1 }, { expireAfterSeconds: 120 }).catch(() => undefined);
  await indexed;
  return col;
}

/** How many people are watching each table right now. */
export async function viewerCounts(tables: string[]) {
  if (!tables.length) return {} as Record<string, number>;
  const col = await viewersCol();
  const rows = await col.aggregate([{ $match: { table: { $in: tables }, at: { $gt: new Date(Date.now() - VIEWER_TTL_MS) } } }, { $group: { _id: "$table", n: { $sum: 1 } } }]).toArray();
  return Object.fromEntries(rows.map((r) => [String(r._id), num(r.n)])) as Record<string, number>;
}

/** Counts `viewer` as watching `table` for the next few seconds. */
export async function checkInTable(table: string, viewer: string) {
  const col = await viewersCol();
  await col.updateOne({ _id: `${table}:${viewer}` } as never, { $set: { table, viewer, at: new Date() } }, { upsert: true });
}
