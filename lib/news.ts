// News posts, written and managed by admins from the Admin tab (stored in website.news).
import { ObjectId, type Document } from "mongodb";
import { getMongoClient } from "./mongodb";

export const NEWS_TAGS = ["Update", "Announcement", "Event", "Website", "Economy", "Community"] as const;

export type NewsPost = {
  id: string;
  title: string;
  body: string;
  tag: string;
  pinned: boolean;
  published: boolean;
  publishedAt: string;
  updatedAt: string | null;
  authorName: string | null;
};

// The first three posts the site shipped with; copied into the database once so admins can edit them
const STARTER_POSTS = [
  { title: "Fall Update", body: "We permanently moved Kitty Kingdom over to a cozy fall theme.", tag: "Update", daysAgo: 60 },
  { title: "Discord Website", body: "We started work on the Discord website and account portal.", tag: "Website", daysAgo: 45 },
  { title: "Leaves Currency", body: "We changed the server currency to leaves.", tag: "Economy", daysAgo: 30 },
];

async function collection() {
  const client = await getMongoClient();
  const col = client.db(process.env.MONGODB_DB ?? "website").collection("news");
  if ((await col.estimatedDocumentCount()) === 0) {
    const meta = client.db(process.env.MONGODB_DB ?? "website").collection("site_meta");
    // Only seed once, even if every post is later deleted
    const claimed = await meta.updateOne({ _id: "news-seeded" as never }, { $setOnInsert: { at: new Date() } }, { upsert: true });
    if (claimed.upsertedCount) {
      await col.insertMany(
        STARTER_POSTS.map((p) => ({
          title: p.title,
          body: p.body,
          tag: p.tag,
          pinned: false,
          published: true,
          publishedAt: new Date(Date.now() - p.daysAgo * 86_400_000),
          createdAt: new Date(),
          updatedAt: null,
          authorName: "Kitty Kingdom",
        })),
      );
    }
  }
  return col;
}

function toPost(d: Document): NewsPost {
  return {
    id: String(d._id),
    title: String(d.title ?? ""),
    body: String(d.body ?? ""),
    tag: String(d.tag ?? "Update"),
    pinned: Boolean(d.pinned),
    published: d.published !== false,
    publishedAt: (d.publishedAt instanceof Date ? d.publishedAt : new Date()).toISOString(),
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : null,
    authorName: d.authorName ? String(d.authorName) : null,
  };
}

/** Published posts for the public site: pinned first, then newest. */
export async function publishedNews(opts: { limit?: number; tag?: string } = {}) {
  try {
    const col = await collection();
    const filter: Document = { published: { $ne: false }, publishedAt: { $lte: new Date() } };
    if (opts.tag && (NEWS_TAGS as readonly string[]).includes(opts.tag)) filter.tag = opts.tag;
    const docs = await col.find(filter).sort({ pinned: -1, publishedAt: -1 }).limit(opts.limit ?? 100).toArray();
    return docs.map(toPost);
  } catch (error) {
    console.error("News lookup failed", error);
    return [];
  }
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function adminNews(q: { sort?: string; status?: string; search?: string; tag?: string }) {
  const col = await collection();
  const filter: Document = {};
  if (q.status === "published") filter.published = { $ne: false };
  if (q.status === "draft") filter.published = false;
  if (q.status === "pinned") filter.pinned = true;
  if (q.tag && (NEWS_TAGS as readonly string[]).includes(q.tag)) filter.tag = q.tag;
  if (q.search?.trim()) {
    const regex = new RegExp(escapeRegex(q.search.trim().slice(0, 100)), "i");
    filter.$or = [{ title: regex }, { body: regex }];
  }
  const sort: Record<string, 1 | -1> =
    q.sort === "oldest" ? { publishedAt: 1 } : q.sort === "title" ? { title: 1 } : q.sort === "updated" ? { updatedAt: -1, publishedAt: -1 } : { pinned: -1, publishedAt: -1 };
  const docs = await col.find(filter).sort(sort).limit(300).toArray();
  return docs.map(toPost);
}

export type NewsInput = { title: string; body: string; tag: string; pinned: boolean; published: boolean; publishedAt: Date };

/** Checks and cleans an admin's post form. */
export function cleanNewsInput(raw: Record<string, unknown>): NewsInput | string {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const tag = typeof raw.tag === "string" && (NEWS_TAGS as readonly string[]).includes(raw.tag) ? raw.tag : "Update";
  if (!title || title.length > 120) return "Give the post a title (up to 120 characters).";
  if (!body || body.length > 8000) return "Write the post (up to 8,000 characters).";
  const date = typeof raw.publishedAt === "string" && raw.publishedAt ? new Date(raw.publishedAt) : new Date();
  if (Number.isNaN(date.getTime())) return "That publish date isn't valid.";
  return { title, body, tag, pinned: raw.pinned === true, published: raw.published !== false, publishedAt: date };
}

export async function createNews(input: NewsInput, author: { name: string; discordId: string }) {
  const col = await collection();
  const res = await col.insertOne({ ...input, createdAt: new Date(), updatedAt: null, authorName: author.name, authorDiscordId: author.discordId });
  return String(res.insertedId);
}

export async function updateNews(id: string, input: NewsInput) {
  if (!ObjectId.isValid(id)) return false;
  const col = await collection();
  const res = await col.updateOne({ _id: new ObjectId(id) }, { $set: { ...input, updatedAt: new Date() } });
  return res.matchedCount > 0;
}

export async function deleteNews(id: string) {
  if (!ObjectId.isValid(id)) return false;
  const col = await collection();
  return (await col.deleteOne({ _id: new ObjectId(id) })).deletedCount > 0;
}
