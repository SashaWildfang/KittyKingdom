// Linked partners: members can list who they're with ("Dustin is my partner"), and it only shows on
// their profile once the other person confirms. Requests are keyed by Discord id, so someone without
// a website account (or a dating profile) yet sees the request waiting when they sign up.
//   dating_partners {_id: "lo-hi", users: [lo, hi], from, to, status: "pending"|"accepted", at, acceptedAt?}

import { getMongoClient } from "../mongodb";
import { getCurrentBans } from "../moderation";
import { notify } from "../notifications";
import { canSeeDating } from "./access";
import { blockedIds, pairId } from "./db";

export const MAX_PARTNERS = 8;

async function col() {
  const c = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("dating_partners");
  await c.createIndex({ users: 1 }).catch(() => undefined);
  return c;
}

export type PartnerLink = { id: string; status: "partners" | "sent" | "received"; at: string };

export async function partnersOf(me: string): Promise<PartnerLink[]> {
  const rows = await (await col()).find({ users: me }).sort({ at: -1 }).toArray();
  const banned = (await getCurrentBans().catch(() => null)) ?? new Set<string>();
  return rows
    .map((r) => {
      const id = (r.users as string[]).find((u) => u !== me)!;
      const status = r.status === "accepted" ? ("partners" as const) : r.from === me ? ("sent" as const) : ("received" as const);
      return { id, status, at: ((r.acceptedAt ?? r.at) as Date).toISOString() };
    })
    .filter((p) => !banned.has(p.id));
}

/** Confirmed partners only (what everyone else sees on a profile). */
export async function confirmedPartners(me: string) {
  return (await partnersOf(me)).filter((p) => p.status === "partners").map((p) => p.id);
}

/** Ask someone to confirm you're partners (or confirm theirs, if they already asked). */
export async function requestPartner(me: string, other: string, myName: string): Promise<string | null> {
  if (me === other) return "You can't link yourself.";
  if ((await blockedIds(me)).has(other)) return "You can't link this member.";
  if ((await getCurrentBans().catch(() => null))?.has(other)) return "You can't link this member.";
  const c = await col();
  const id = pairId(me, other);
  const existing = await c.findOne({ _id: id } as never);
  if (existing?.status === "accepted") return null;
  if (existing && existing.from === other) return respondPartner(me, other, true, myName);
  if (!existing && (await c.countDocuments({ users: me })) >= MAX_PARTNERS) return `You can link up to ${MAX_PARTNERS} partners.`;
  await c.updateOne({ _id: id } as never, { $set: { users: [me, other].sort(), from: me, to: other, status: "pending", at: new Date() } }, { upsert: true });
  // Only 18+ Verified members get pinged about dating; anyone else sees it waiting once they can use Dating
  if (await canSeeDating(other).catch(() => false)) {
    await notify(other, { type: "partner", actor: me, title: `${myName} listed you as their partner`, body: "Confirm it to show it on both your profiles.", link: "/social/profile/edit#partners", key: `partner:${me}` });
  }
  return null;
}

export async function respondPartner(me: string, other: string, accept: boolean, myName: string): Promise<string | null> {
  const c = await col();
  const id = pairId(me, other);
  const row = await c.findOne({ _id: id } as never);
  if (!row || row.status !== "pending" || row.to !== me) return "There's no partner request to answer.";
  if (!accept) {
    await c.deleteOne({ _id: id } as never);
    return null;
  }
  await c.updateOne({ _id: id } as never, { $set: { status: "accepted", acceptedAt: new Date() } });
  await notify(other, { type: "partner", actor: me, title: `${myName} confirmed you're partners`, body: "It now shows on both your profiles.", link: `/social/u/${me}`, key: `partner-ok:${me}` });
  return null;
}

/** Unlink (either partner), or cancel a request you sent. */
export async function removePartner(me: string, other: string) {
  await (await col()).deleteOne({ _id: pairId(me, other), users: me } as never);
}
