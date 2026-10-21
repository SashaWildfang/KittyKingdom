// Tickets from the KK Ticket System (activeTickets + resolvedTickets) and their transcripts,
// which the ticket bot posts as a zipped web page in the transcript log channel (read by
// ./transcript-store).

import { ObjectId, type Document } from "mongodb";
import { getBotCollection, getMongoClient } from "./mongodb";
import { userTimeZone } from "./timezone";

export type Ticket = {
  ticketId: number;
  /** The ticket's database id: never changes (the number can, when tickets are renumbered) */
  key: string;
  type: string;
  topic: string;
  status: string;
  openedBy: string | null;
  claimedBy: string | null;
  resolvedBy: string | null;
  created: string | null;
  resolvedAt: string | null;
  transcriptId: string | null;
  escalated: boolean;
};

export type TicketQuery = {
  search?: string;
  types?: string[];
  statuses?: string[];
  userId?: string;
  staffId?: string;
  from?: Date | null;
  to?: Date | null;
  hasTranscript?: boolean;
  sort?: "ticketId" | "created" | "resolvedAt" | "type";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  /** Also count statuses, handlers, openers and time to close across every match */
  summary?: boolean;
  /** Leave out NSFW verification tickets (staff who aren't admins never see them) */
  excludeNsfw?: boolean;
  /** Who opened it: still in the server, left, or a deleted Discord account */
  opener?: "in" | "left" | "deleted";
  /** Only these ticket numbers (e.g. the ones with a description tag) */
  ticketIds?: number[] | null;
};

/** NSFW verification tickets hold ID photos: only admins can see them. */
export const NSFW_TICKET = /nsfw/i;
export const isNsfwTicket = (type: string | null | undefined) => NSFW_TICKET.test(String(type ?? ""));

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const snowflake = (value: unknown) => (typeof value === "string" && /^\d{15,21}$/.test(value) ? value : null);

function toTicket(doc: Document): Ticket {
  return {
    ticketId: Number(doc.ticket_id),
    key: String(doc._id),
    type: String(doc.ticket_type ?? "support"),
    topic: String(doc.topic ?? ""),
    status: String(doc.status ?? "Unknown"),
    openedBy: doc.opened_by ? String(doc.opened_by) : null,
    claimedBy: doc.claimed_by ? String(doc.claimed_by) : null,
    resolvedBy: doc.resolved_by ? String(doc.resolved_by) : null,
    created: doc.created instanceof Date ? doc.created.toISOString() : null,
    resolvedAt: doc.resolved_at instanceof Date ? doc.resolved_at.toISOString() : null,
    // Only Discord message ids point at a transcript upload
    transcriptId: snowflake(typeof doc.transcript_id === "string" ? doc.transcript_id : null),
    escalated: Boolean(doc.is_escalated),
  };
}

/** Discord ids in the member directory by state: still in the server, left, or a deleted Discord account. */
async function openersBy(state: "in" | "left" | "deleted"): Promise<string[]> {
  const client = await getMongoClient();
  const dir = client.db(process.env.MONGODB_DB ?? "website").collection("member_directory");
  const deleted = { $or: [{ username: null }, { username: { $regex: /^deleted_user_/i } }, { displayName: { $regex: /^deleted user$/i } }] };
  const filter =
    state === "in" ? { inServer: true } : state === "deleted" ? { ...deleted, _id: { $regex: /^\d{15,21}$/ } } : { inServer: false, _id: { $regex: /^\d{15,21}$/ }, username: { $nin: [null], $not: /^deleted_user_/i } };
  const docs = await dir.find(filter as never, { projection: { _id: 1 } }).toArray();
  return docs.map((d) => String(d._id));
}

async function idsMatchingName(search: string): Promise<string[]> {
  if (search.length < 2) return [];
  const client = await getMongoClient();
  const regex = new RegExp(escapeRegex(search), "i");
  const docs = await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection("member_directory")
    .find({ $or: [{ username: regex }, { displayName: regex }] }, { projection: { _id: 1 } })
    .limit(200)
    .toArray();
  return docs.map((d) => String(d._id));
}

// Ticket search: every word has to match something about the ticket (its topic, type, the people on it, or
// its description on the dashboard), so "kai refund" finds Kai's ticket about a refund. Words like "18+" or
// "apply" also match the ticket type they mean.
const SEARCH_SKIP = new Set(["ticket", "tickets", "the", "a", "an", "about", "for", "with", "and", "of", "to", "in", "on", "by", "from", "was", "is"]);
const TYPE_WORDS: [RegExp, RegExp][] = [
  [/^(18\+?|nsfw|verify|verification|verified|age|id)$/i, NSFW_TICKET],
  [/^(staff|apply|applying|application|applications|applied)$/i, /staff/i],
  [/^(help|question|questions|support)$/i, /support/i],
  [/^(partner|partnership|partnerships)$/i, /partner/i],
];

async function summaryIdsMatching(regex: RegExp): Promise<number[]> {
  const client = await getMongoClient();
  const docs = await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection<{ _id: number }>("ticket_summaries")
    .find({ $or: [{ headline: regex }, { summary: regex }, { flags: regex }] }, { projection: { _id: 1 } })
    .limit(3000)
    .toArray();
  return docs.map((d) => Number(d._id));
}

async function searchClauses(raw: string): Promise<Document[]> {
  const text = raw.trim();
  // Just a ticket number ("31" or "#31"): exactly that ticket, not every id with "31" in it
  if (/^#?\d{1,7}$/.test(text)) return [{ ticket_id: { $in: [Number(text.replace("#", "")), text.replace("#", "")] } }];
  // "#31" or "31": that ticket number (still matched as text too, in case it's in a topic)
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/^[#"'(]+|[)"',.!?]+$/g, ""))
    .filter((w) => w && !SEARCH_SKIP.has(w.toLowerCase()));
  if (!words.length) return [];
  const clauses: Document[] = [];
  for (const word of words.slice(0, 6)) {
    // Dashes, underscores and spaces count as the same ("staff app" finds "staff-application")
    const regex = new RegExp(escapeRegex(word).replace(/[-_\s]+/g, "[-_\\s]*"), "i");
    const [nameIds, summaryIds] = await Promise.all([idsMatchingName(word), summaryIdsMatching(regex)]);
    const or: Document[] = [{ topic: regex }, { ticket_type: regex }];
    if (/^\d{1,7}$/.test(word)) or.push({ ticket_id: Number(word) });
    if (/^\d{15,21}$/.test(word)) or.push({ opened_by: word }, { claimed_by: word }, { resolved_by: word });
    for (const [match, type] of TYPE_WORDS) if (match.test(word)) or.push({ ticket_type: type });
    if (nameIds.length) or.push({ opened_by: { $in: nameIds } }, { claimed_by: { $in: nameIds } }, { resolved_by: { $in: nameIds } });
    if (summaryIds.length) or.push({ ticket_id: { $in: summaryIds } });
    clauses.push({ $or: or });
  }
  return clauses;
}

/**
 * activeTickets and resolvedTickets as one list. Only tickets in activeTickets are open: a few old
 * tickets were moved to resolvedTickets without their status changing, so those read as closed.
 */
async function ticketsPipelineBase(): Promise<{ col: Awaited<ReturnType<typeof getBotCollection>>; union: Document[] }> {
  const col = await getBotCollection("resolvedTickets");
  return {
    col,
    union: [
      { $unionWith: { coll: "activeTickets", pipeline: [{ $addFields: { _active: true } }] } },
      {
        $addFields: {
          status: {
            $cond: [
              { $eq: ["$_active", true] },
              { $ifNull: ["$status", "Open"] },
              // The bot calls a finished ticket whose channel was removed "Deleted"; staff see "Finalized"
              { $switch: { branches: [{ case: { $eq: ["$status", "Open"] }, then: "Closed" }, { case: { $eq: ["$status", "Deleted"] }, then: "Finalized" }], default: "$status" } },
            ],
          },
        },
      },
    ],
  };
}

/** Tickets open right now (whatever the date range). */
export async function openTicketCount() {
  return (await getBotCollection("activeTickets")).countDocuments();
}

export async function queryTickets(q: TicketQuery) {
  const { col, union } = await ticketsPipelineBase();
  const and: Document[] = [];
  if (q.types?.length) and.push({ ticket_type: { $in: q.types } });
  if (q.excludeNsfw) and.push({ ticket_type: { $not: NSFW_TICKET } });
  if (q.statuses?.length) and.push({ status: { $in: q.statuses.map((st) => (st === "Deleted" ? "Finalized" : st)) } });
  if (q.userId) and.push({ opened_by: q.userId });
  if (q.staffId) and.push({ $or: [{ claimed_by: q.staffId }, { resolved_by: q.staffId }, { escalated_by: q.staffId }] });
  if (q.from || q.to) and.push({ created: { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) } });
  if (q.hasTranscript) and.push({ transcript_id: { $type: "string", $regex: /^\d{15,21}$/ } });
  if (q.ticketIds) and.push({ ticket_id: { $in: q.ticketIds } });
  if (q.opener) {
    and.push({ opened_by: { $in: await openersBy(q.opener) } });
  }

  const search = q.search?.trim().slice(0, 100);
  if (search) and.push(...(await searchClauses(search)));

  const sortField = { ticketId: "ticket_id", created: "created", resolvedAt: "resolved_at", type: "ticket_type" }[q.sort ?? "ticketId"] ?? "ticket_id";
  const order = q.order === "asc" ? 1 : -1;
  const pageSize = Math.min(100, Math.max(10, q.pageSize ?? 25));
  const page = Math.max(1, q.page ?? 1);

  const [result] = await col
    .aggregate([
      ...union,
      ...(and.length ? [{ $match: { $and: and } }] : []),
      {
        $facet: {
          rows: [{ $sort: { [sortField]: order, ticket_id: order } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }],
          total: [{ $count: "n" }],
          statusCounts: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
          ...(q.summary
            ? {
                byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
                handlers: [
                  { $project: { staff: { $ifNull: ["$claimed_by", "$resolved_by"] } } },
                  { $match: { staff: { $ne: null } } },
                  { $group: { _id: "$staff", n: { $sum: 1 } } },
                  { $sort: { n: -1 } },
                  { $limit: 8 },
                ],
                openers: [{ $match: { opened_by: { $ne: null } } }, { $group: { _id: "$opened_by", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }],
                extra: [
                  {
                    $group: {
                      _id: null,
                      escalated: { $sum: { $cond: ["$is_escalated", 1, 0] } },
                      transcripts: { $sum: { $cond: [{ $regexMatch: { input: { $toString: { $ifNull: ["$transcript_id", ""] } }, regex: /^\d{15,21}$/ } }, 1, 0] } },
                      avgClose: { $avg: { $cond: [{ $and: [{ $eq: [{ $type: "$resolved_at" }, "date"] }, { $eq: [{ $type: "$created" }, "date"] }] }, { $subtract: ["$resolved_at", "$created"] }, null] } },
                    },
                  },
                ],
              }
            : {}),
        },
      },
    ])
    .toArray();

  const extra = result?.extra?.[0];
  return {
    rows: ((result?.rows ?? []) as Document[]).map(toTicket) as Ticket[],
    total: result?.total?.[0]?.n ?? 0,
    statusCounts: Object.fromEntries(((result?.statusCounts ?? []) as Document[]).map((d) => [String(d._id ?? "Unknown"), d.n as number])) as Record<string, number>,
    page,
    pageSize,
    summary: q.summary
      ? {
          byStatus: Object.fromEntries(((result?.byStatus ?? []) as Document[]).map((d) => [String(d._id ?? "Unknown"), d.n as number])) as Record<string, number>,
          handlers: ((result?.handlers ?? []) as Document[]).map((d) => ({ id: String(d._id), count: d.n as number })),
          openers: ((result?.openers ?? []) as Document[]).map((d) => ({ id: String(d._id), count: d.n as number })),
          escalated: (extra?.escalated as number) ?? 0,
          transcripts: (extra?.transcripts as number) ?? 0,
          avgCloseMs: (extra?.avgClose as number | null) ?? null,
        }
      : null,
  };
}

export async function getTicket(ticketId: number): Promise<Ticket | null> {
  const { col, union } = await ticketsPipelineBase();
  const [doc] = await col.aggregate([...union, { $match: { ticket_id: ticketId } }, { $limit: 1 }]).toArray();
  return doc ? toTicket(doc) : null;
}

/** A ticket by its database id, whatever its number is now (numbers move when tickets are renumbered). */
export async function getTicketByKey(key: string | null | undefined): Promise<Ticket | null> {
  if (!key || !ObjectId.isValid(key)) return null;
  const { col, union } = await ticketsPipelineBase();
  const [doc] = await col.aggregate([...union, { $match: { _id: new ObjectId(key) } }, { $limit: 1 }]).toArray();
  return doc ? toTicket(doc) : null;
}

/** By key when the page sent one (safe even if numbers changed since it loaded), else by number. */
export async function findTicket(ticketId: number, key?: string | null): Promise<Ticket | null> {
  if (key) return getTicketByKey(key);
  return Number.isInteger(ticketId) && ticketId > 0 ? getTicket(ticketId) : null;
}

export async function ticketStats(q: { from?: Date | null; to?: Date | null; unit: "day" | "week" | "month" }) {
  const { col, union } = await ticketsPipelineBase();
  const match: Document = {};
  if (q.from || q.to) match.created = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  const [result] = await col
    .aggregate([
      ...union,
      { $match: match },
      {
        $facet: {
          total: [{ $count: "n" }],
          byType: [{ $group: { _id: "$ticket_type", n: { $sum: 1 } } }, { $sort: { n: -1 } }],
          byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
          timeline: [
            { $group: { _id: { t: { $dateTrunc: { date: "$created", unit: q.unit, timezone: userTimeZone() } }, a: "$ticket_type" }, n: { $sum: 1 } } },
            { $sort: { "_id.t": 1 } },
          ],
          // The staff member who handled it: whoever claimed it, else whoever closed it
          topStaff: [
            { $project: { staff: { $ifNull: ["$claimed_by", "$resolved_by"] } } },
            { $match: { staff: { $ne: null } } },
            { $group: { _id: "$staff", n: { $sum: 1 } } },
            { $sort: { n: -1 } },
            { $limit: 10 },
          ],
          topOpeners: [{ $group: { _id: "$opened_by", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 10 }],
          resolveTime: [
            { $match: { resolved_at: { $type: "date" }, created: { $type: "date" } } },
            { $group: { _id: null, avg: { $avg: { $subtract: ["$resolved_at", "$created"] } }, n: { $sum: 1 } } },
          ],
        },
      },
    ])
    .toArray();

  return {
    total: result?.total?.[0]?.n ?? 0,
    open: await openTicketCount(),
    byType: (result?.byType ?? []).map((d: Document) => ({ type: String(d._id ?? "unknown"), count: d.n as number })),
    byStatus: Object.fromEntries((result?.byStatus ?? []).map((d: Document) => [String(d._id), d.n as number])),
    timeline: (result?.timeline ?? [])
      .filter((d: Document) => d._id.t)
      .map((d: Document) => ({ bucket: (d._id.t as Date).toISOString(), action: String(d._id.a ?? "unknown"), count: d.n as number })),
    topStaff: ((result?.topStaff ?? []) as Document[]).map((d) => ({ id: String(d._id), count: d.n as number })) as { id: string; count: number }[],
    topOpeners: ((result?.topOpeners ?? []) as Document[]).filter((d) => d._id).map((d) => ({ id: String(d._id), count: d.n as number })) as { id: string; count: number }[],
    avgResolveMs: (result?.resolveTime?.[0]?.avg as number | undefined) ?? null,
  };
}

export async function ticketTypes(excludeNsfw = false): Promise<string[]> {
  const col = await getBotCollection("resolvedTickets");
  return ((await col.distinct("ticket_type")) as string[]).filter((t) => t && !(excludeNsfw && isNsfwTicket(t))).sort();
}

/** The ticket a transcript upload belongs to. */
/** Several tickets at once (in no particular order). */
export async function getTickets(ticketIds: number[]): Promise<Ticket[]> {
  if (!ticketIds.length) return [];
  const { col, union } = await ticketsPipelineBase();
  const docs = await col.aggregate([...union, { $match: { ticket_id: { $in: ticketIds } } }, { $limit: ticketIds.length * 2 }]).toArray();
  const seen = new Set<number>();
  return docs.map(toTicket).filter((t) => !seen.has(t.ticketId) && Boolean(seen.add(t.ticketId)));
}

export async function getTicketByTranscript(transcriptId: string): Promise<Ticket | null> {
  if (!/^\d{15,21}$/.test(transcriptId)) return null;
  const doc = await (await getBotCollection("resolvedTickets")).findOne({ transcript_id: transcriptId });
  return doc ? toTicket(doc) : null;
}
