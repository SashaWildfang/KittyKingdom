// Staff applications pipeline: every staff-application ticket, moved through stages by admins, with votes.
// The ticket itself (and its transcript) stays the source of truth; this only adds where it's at.
//
// website.staff_app_stages {_id: ticketKey, stage, by, byName, at, votes: {discordId: "yes" | "no"}, history: [{stage, byName, at}]}

import type { Document } from "mongodb";
import type { PanelUser } from "./admin";
import { getBotCollection, getMongoClient } from "./mongodb";

export const STAGES = ["new", "reviewing", "interview", "trial", "accepted", "declined"] as const;
export type Stage = (typeof STAGES)[number];

export type StaffApp = {
  key: string;
  ticketId: number;
  applicant: string | null;
  created: string | null;
  open: boolean;
  transcript: boolean;
  stage: Stage;
  stageAt: string | null;
  stageBy: string | null;
  votes: { yes: string[]; no: string[] };
  myVote: "yes" | "no" | null;
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
const site = async () => (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
const APP = { ticket_type: "staff-application" };

export async function listStaffApps(panel: PanelUser, days = 120): Promise<StaffApp[]> {
  const from = new Date(Date.now() - days * 86_400_000);
  const fields = { ticket_id: 1, opened_by: 1, created: 1, transcript_id: 1, status: 1 };
  const [open, closed] = await Promise.all([
    getBotCollection("activeTickets").then((c) => c.find(APP, { projection: fields }).toArray()),
    getBotCollection("resolvedTickets").then((c) => c.find({ ...APP, created: { $gte: from } }, { projection: fields }).sort({ created: -1 }).limit(200).toArray()),
  ]);
  const tickets = [...open.map((t) => ({ t, open: true })), ...closed.map((t) => ({ t, open: false }))];
  const stages = await (await site()).collection("staff_app_stages").find({ _id: { $in: tickets.map(({ t }) => String(t._id)) } as never }).toArray();
  const byKey = new Map(stages.map((s) => [String(s._id), s as Document]));
  return tickets
    .map(({ t, open }) => {
      const s = byKey.get(String(t._id));
      const votes = (s?.votes ?? {}) as Record<string, string>;
      return {
        key: String(t._id),
        ticketId: Number(t.ticket_id),
        applicant: t.opened_by ? String(t.opened_by) : null,
        created: iso(t.created),
        open,
        transcript: Boolean(t.transcript_id),
        stage: (STAGES.includes(s?.stage) ? s!.stage : "new") as Stage,
        stageAt: iso(s?.at),
        stageBy: s?.byName ? String(s.byName) : null,
        votes: { yes: Object.keys(votes).filter((k) => votes[k] === "yes"), no: Object.keys(votes).filter((k) => votes[k] === "no") },
        myVote: (votes[panel.discordId] as "yes" | "no" | undefined) ?? null,
      };
    })
    .sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""));
}

async function ticketExists(key: string) {
  const { ObjectId } = await import("mongodb");
  if (!ObjectId.isValid(key)) return false;
  const id = new ObjectId(key);
  return Boolean((await (await getBotCollection("activeTickets")).findOne({ _id: id, ...APP })) ?? (await (await getBotCollection("resolvedTickets")).findOne({ _id: id, ...APP })));
}

export async function setStage(panel: PanelUser, key: string, stage: string) {
  if (!STAGES.includes(stage as Stage)) throw new Error("Unknown stage.");
  if (!(await ticketExists(key))) throw new Error("That application wasn't found.");
  const now = new Date();
  await (await site()).collection("staff_app_stages").updateOne({ _id: key as never }, { $set: { stage, by: panel.discordId, byName: panel.name, at: now }, $push: { history: { stage, byName: panel.name, at: now } } } as never, { upsert: true });
}

export async function vote(panel: PanelUser, key: string, v: string | null) {
  if (!(await ticketExists(key))) throw new Error("That application wasn't found.");
  const c = (await site()).collection("staff_app_stages");
  if (v === "yes" || v === "no") await c.updateOne({ _id: key as never }, { $set: { [`votes.${panel.discordId}`]: v } }, { upsert: true });
  else await c.updateOne({ _id: key as never }, { $unset: { [`votes.${panel.discordId}`]: "" } });
}
