import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { getBotCollection, getMongoClient } from "../../../../lib/mongodb";

export const dynamic = "force-dynamic";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Name / ID suggestions for the panel's search boxes, from the cached member directory. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().replace(/^@/, "").replace(/[<@!>]/g, "").slice(0, 64);
  if (q.length < 2) return NextResponse.json({ ok: true, members: [] });

  const client = await getMongoClient();
  const directory = client.db(process.env.MONGODB_DB ?? "website").collection("member_directory");
  const prefix = new RegExp(`^${escapeRegex(q)}`, "i");
  const anywhere = new RegExp(escapeRegex(q), "i");
  const filter = /^\d{3,21}$/.test(q)
    ? { _id: { $regex: `^${q}` } }
    : { $or: [{ username: anywhere }, { displayName: anywhere }] };
  const docs = (await directory.find(filter as never).limit(40).toArray()) as unknown as {
    _id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    inServer: boolean;
  }[];

  // Names that start with what you typed come first, then members still in the server
  const score = (d: (typeof docs)[number]) =>
    (prefix.test(d.displayName ?? "") || prefix.test(d.username ?? "") ? 0 : 2) + (d.inServer ? 0 : 1);
  const top = docs.sort((a, b) => score(a) - score(b) || (a.displayName ?? "").localeCompare(b.displayName ?? "")).slice(0, 8);

  // How many punishments each suggestion has, so staff can spot repeat offenders at a glance
  const punishments = await getBotCollection("punishments");
  const counts = await punishments
    .aggregate([
      { $project: { u: { $toString: { $ifNull: ["$user_discord_id", "$discordId"] } } } },
      { $match: { u: { $in: top.map((d) => d._id) } } },
      { $group: { _id: "$u", n: { $sum: 1 } } },
    ])
    .toArray();
  const countOf = new Map(counts.map((c) => [String(c._id), c.n as number]));

  return NextResponse.json({
    ok: true,
    members: top.map((d) => ({
      id: d._id,
      name: d.displayName ?? d.username ?? "Unknown",
      username: d.username,
      avatar: d.avatar,
      inServer: d.inServer,
      punishments: countOf.get(d._id) ?? 0,
    })),
  });
}
