// Tickets from the KK Ticket System (activeTickets + resolvedTickets) and their transcripts,
// which the ticket bot posts as a zipped web page in the transcript log channel (read by
// ./transcript-store).

import type { Document } from "mongodb";
import { getBotCollection, getMongoClient } from "./mongodb";
import { userTimeZone } from "./timezone";

export type Ticket = {
  ticketId: number;
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
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const snowflake = (value: unknown) => (typeof value === "string" && /^\d{15,21}$/.test(value) ? value : null);

function toTicket(doc: Document): Ticket {
  return {
    ticketId: Number(doc.ticket_id),
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
  if (q.statuses?.length) and.push({ status: { $in: q.statuses.map((st) => (st === "Deleted" ? "Finalized" : st)) } });
  if (q.userId) and.push({ opened_by: q.userId });
  if (q.staffId) and.push({ $or: [{ claimed_by: q.staffId }, { resolved_by: q.staffId }, { escalated_by: q.staffId }] });
  if (q.from || q.to) and.push({ created: { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) } });
  if (q.hasTranscript) and.push({ transcript_id: { $type: "string", $regex: /^\d{15,21}$/ } });

  const search = q.search?.trim().replace(/^#/, "").slice(0, 100);
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const nameIds = await idsMatchingName(search);
    const or: Document[] = [
      { topic: regex },
      { ticket_type: regex },
      { opened_by: regex },
      { claimed_by: regex },
      { resolved_by: regex },
    ];
    if (/^\d{1,7}$/.test(search)) or.push({ ticket_id: Number(search) });
    if (nameIds.length) or.push({ opened_by: { $in: nameIds } }, { claimed_by: { $in: nameIds } }, { resolved_by: { $in: nameIds } });
    and.push({ $or: or });
  }

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

export async function ticketTypes(): Promise<string[]> {
  const col = await getBotCollection("resolvedTickets");
  return ((await col.distinct("ticket_type")) as string[]).filter(Boolean).sort();
}

/** The ticket a transcript upload belongs to. */
export async function getTicketByTranscript(transcriptId: string): Promise<Ticket | null> {
  if (!/^\d{15,21}$/.test(transcriptId)) return null;
  const doc = await (await getBotCollection("resolvedTickets")).findOne({ transcript_id: transcriptId });
  return doc ? toTicket(doc) : null;
}
