// One renumber at a time across every server instance and every admin. Renumbering reads all tickets and then
// moves some of them down, so two running at once (two deletes at the same moment, or a delete during the
// leaver clean-up) could hand out the same number twice. Anything that writes by ticket number waits its turn.

import { randomUUID } from "node:crypto";
import { getMongoClient } from "./mongodb";

const LOCK_ID = "ticket_renumber_lock";
const HOLD_MS = 60_000; // a crashed holder's lock expires on its own

async function col() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection<{ _id: string; owner?: string; until?: Date }>("job_state");
}

/** Runs fn while holding the ticket lock (waits up to `waitMs` for it). */
export async function withTicketLock<T>(fn: () => Promise<T>, waitMs = 30_000): Promise<T> {
  const c = await col();
  const owner = randomUUID();
  const deadline = Date.now() + waitMs;
  await c.updateOne({ _id: LOCK_ID }, { $setOnInsert: { until: new Date(0) } }, { upsert: true }).catch(() => undefined);
  for (;;) {
    const now = new Date();
    const got = await c.findOneAndUpdate({ _id: LOCK_ID, $or: [{ until: { $lt: now } }, { until: { $exists: false } }] }, { $set: { owner, until: new Date(now.getTime() + HOLD_MS) } });
    if (got) break;
    if (Date.now() > deadline) throw new Error("Tickets are being renumbered right now. Try again in a moment.");
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 250));
  }
  try {
    return await fn();
  } finally {
    await c.updateOne({ _id: LOCK_ID, owner }, { $set: { until: new Date(0) }, $unset: { owner: "" } }).catch(() => undefined);
  }
}
