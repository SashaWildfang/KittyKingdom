// Purchase history: what a member bought in the Leaf Shop (website and Discord) plus the gifts
// they sent and received, newest first, searchable by item name.

import { type Document } from "mongodb";
import { people } from "./admin-people";
import { getBotCollection } from "./mongodb";
import { iconFor } from "./store";

export type HistoryKind = "purchase" | "gift-sent" | "gift-received";
export type HistoryEntry = {
  id: string;
  kind: HistoryKind;
  itemId: string;
  name: string;
  itemType: string;
  icon: string | null;
  quantity: number;
  price: number | null;
  at: string | null;
  source: "website" | "discord";
  otherId: string | null;
  otherName: string | null;
  message: string | null;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v ?? 0) || 0);

export async function purchaseHistory(discordId: string, q: { search?: string; kind?: string; page?: number }) {
  const [sales, catalogCol] = await Promise.all([getBotCollection("store_sales"), getBotCollection("store_inventory")]);
  const catalogDocs = await catalogCol.find({}, { projection: { item_id: 1, name: 1, type: 1 } }).toArray();
  const catalog = new Map(catalogDocs.map((d) => [String(d.item_id), d]));

  const match: Document = {};
  if (q.kind && ["purchase", "gift-sent", "gift-received"].includes(q.kind)) match.kind = q.kind;
  const search = q.search?.trim().slice(0, 60);
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const ids = catalogDocs.filter((d) => regex.test(String(d.name ?? "")) || regex.test(String(d.item_id))).map((d) => String(d.item_id));
    match.item_id = { $in: ids };
  }

  const pageSize = 20;
  const page = Math.max(1, q.page ?? 1);
  const [result] = await sales
    .aggregate([
      { $match: { buyerId: { $in: [discordId, Number.isSafeInteger(Number(discordId)) ? Number(discordId) : discordId] } } },
      { $project: { kind: { $literal: "purchase" }, item_id: 1, quantity: 1, price: "$price_paid", ts: "$timestamp", source: 1, otherId: null, message: null } },
      {
        $unionWith: {
          coll: "gift_log",
          pipeline: [
            { $match: { $or: [{ sender_id: discordId }, { recipient_id: discordId }] } },
            {
              $project: {
                kind: { $cond: [{ $eq: ["$sender_id", discordId] }, "gift-sent", "gift-received"] },
                item_id: 1,
                quantity: { $literal: 1 },
                price: null,
                ts: "$timestamp",
                source: 1,
                otherId: { $cond: [{ $eq: ["$sender_id", discordId] }, "$recipient_id", "$sender_id"] },
                message: 1,
              },
            },
          ],
        },
      },
      { $match: match },
      {
        $facet: {
          rows: [{ $sort: { ts: -1 } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }],
          total: [{ $count: "n" }],
          totals: [
            {
              $group: {
                _id: null,
                spent: { $sum: { $cond: [{ $eq: ["$kind", "purchase"] }, { $ifNull: ["$price", 0] }, 0] } },
                purchases: { $sum: { $cond: [{ $eq: ["$kind", "purchase"] }, 1, 0] } },
                sent: { $sum: { $cond: [{ $eq: ["$kind", "gift-sent"] }, 1, 0] } },
                received: { $sum: { $cond: [{ $eq: ["$kind", "gift-received"] }, 1, 0] } },
              },
            },
          ],
        },
      },
    ])
    .toArray();

  const rows = (result?.rows ?? []) as Document[];
  const who = await people(rows.map((r) => (r.otherId ? String(r.otherId) : null)));
  const entries: HistoryEntry[] = rows.map((r) => {
    const item = catalog.get(String(r.item_id));
    const otherId = r.otherId ? String(r.otherId) : null;
    return {
      id: String(r._id),
      kind: r.kind as HistoryKind,
      itemId: String(r.item_id),
      name: String(item?.name ?? r.item_id ?? "Unknown item"),
      itemType: String(item?.type ?? "item"),
      icon: item ? iconFor(item) : null,
      quantity: num(r.quantity) || 1,
      price: r.price === null || r.price === undefined ? null : num(r.price),
      at: r.ts instanceof Date ? r.ts.toISOString() : null,
      source: r.source === "website" ? "website" : "discord",
      otherId,
      otherName: otherId ? who[otherId]?.name ?? null : null,
      message: typeof r.message === "string" && r.message ? r.message.slice(0, 300) : null,
    };
  });
  const totals = result?.totals?.[0];
  return {
    entries,
    total: (result?.total?.[0]?.n as number) ?? 0,
    page,
    pageSize,
    totals: { spent: num(totals?.spent), purchases: num(totals?.purchases), sent: num(totals?.sent), received: num(totals?.received) },
  };
}
