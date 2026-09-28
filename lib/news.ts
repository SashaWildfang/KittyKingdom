// News posts, written and managed by admins from the Admin tab (stored in website.news).
import { ObjectId, type Document } from "mongodb";
import { getMongoClient } from "./mongodb";

// The tags the site started with; copied into website.news_tags once so admins can manage them
const STARTER_TAGS = [
  { name: "Update", color: "#f59b2a" },
  { name: "Announcement", color: "#e5484d" },
  { name: "Event", color: "#8e4ec6" },
  { name: "Website", color: "#3e63dd" },
  { name: "Economy", color: "#46a758" },
  { name: "Community", color: "#d6409f" },
];

export type NewsTag = { id: string; name: string; color: string; count: number };

export class NewsError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type NewsStatus = "published" | "draft" | "pending";

export type NewsPost = {
  id: string;
  title: string;
  body: string;
  tag: string;
  tagColor: string;
  pinned: boolean;
  published: boolean;
  /** published = live on the site · draft = unfinished · pending = written and waiting for an admin to approve */
  status: NewsStatus;
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

let orderReady: Promise<unknown> | null = null;

async function collection() {
  const client = await getMongoClient();
  const col = client.db(process.env.MONGODB_DB ?? "website").collection("news");
  // Display order: `sortAt` starts as the publish time and changes when admins drag posts around
  orderReady ??= col.updateMany({ sortAt: { $exists: false } }, [{ $set: { sortAt: "$publishedAt" } }]).catch(() => undefined);
  await orderReady;
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

async function tagsCollection() {
  const client = await getMongoClient();
  const db = client.db(process.env.MONGODB_DB ?? "website");
  const col = db.collection("news_tags");
  if ((await col.estimatedDocumentCount()) === 0) {
    const claimed = await db.collection("site_meta").updateOne({ _id: "news-tags-seeded" as never }, { $setOnInsert: { at: new Date() } }, { upsert: true });
    if (claimed.upsertedCount) await col.insertMany(STARTER_TAGS.map((t, i) => ({ ...t, key: t.name.toLowerCase(), order: i, createdAt: new Date() })));
  }
  return col;
}

/** Every tag, in order, with how many posts use it. */
export async function newsTags(): Promise<NewsTag[]> {
  const [tagCol, postCol] = await Promise.all([tagsCollection(), collection()]);
  const [tags, counts] = await Promise.all([
    tagCol.find({}).sort({ order: 1, createdAt: 1 }).toArray(),
    postCol.aggregate([{ $group: { _id: "$tag", n: { $sum: 1 } } }]).toArray(),
  ]);
  const byName = new Map(counts.map((c) => [String(c._id), c.n as number]));
  return tags.map((t) => ({ id: String(t._id), name: String(t.name), color: String(t.color ?? "#f59b2a"), count: byName.get(String(t.name)) ?? 0 }));
}

const HEX = /^#[0-9a-f]{6}$/i;
const TAG_NAME = new RegExp("^[\\p{L}\\p{N} &'!?+-]+$", "u");

function cleanTag(raw: Record<string, unknown>) {
  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ") : "";
  const color = typeof raw.color === "string" && HEX.test(raw.color) ? raw.color.toLowerCase() : "#f59b2a";
  if (!name || name.length > 24) throw new NewsError("Give the tag a name (up to 24 characters).");
  if (!TAG_NAME.test(name)) throw new NewsError("Tag names can use letters, numbers, spaces and & ' ! ? + -");
  return { name, color, key: name.toLowerCase() };
}

export async function createTag(raw: Record<string, unknown>) {
  const tag = cleanTag(raw);
  const col = await tagsCollection();
  if (await col.findOne({ key: tag.key })) throw new NewsError("There's already a tag with that name.");
  const last = await col.find({}).sort({ order: -1 }).limit(1).toArray();
  await col.insertOne({ ...tag, order: (Number(last[0]?.order) || 0) + 1, createdAt: new Date() });
  return tag.name;
}

/** Renames or recolors a tag; renaming also updates every post that uses it. */
export async function updateTag(id: string, raw: Record<string, unknown>) {
  if (!ObjectId.isValid(id)) throw new NewsError("Tag not found.", 404);
  const tag = cleanTag(raw);
  const col = await tagsCollection();
  const existing = await col.findOne({ _id: new ObjectId(id) });
  if (!existing) throw new NewsError("Tag not found.", 404);
  if (await col.findOne({ key: tag.key, _id: { $ne: existing._id } })) throw new NewsError("There's already a tag with that name.");
  await col.updateOne({ _id: existing._id }, { $set: { ...tag, updatedAt: new Date() } });
  if (existing.name !== tag.name) await (await collection()).updateMany({ tag: existing.name }, { $set: { tag: tag.name } });
  return { before: String(existing.name), after: tag.name };
}

/** Deletes a tag. Posts using it move to `moveTo` (required when any post uses the tag). */
export async function deleteTag(id: string, moveTo?: string) {
  if (!ObjectId.isValid(id)) throw new NewsError("Tag not found.", 404);
  const [col, posts] = await Promise.all([tagsCollection(), collection()]);
  const existing = await col.findOne({ _id: new ObjectId(id) });
  if (!existing) throw new NewsError("Tag not found.", 404);
  if ((await col.countDocuments()) <= 1) throw new NewsError("Keep at least one tag.");
  const used = await posts.countDocuments({ tag: existing.name });
  let target: Document | null = null;
  if (used) {
    target = moveTo && ObjectId.isValid(moveTo) ? await col.findOne({ _id: new ObjectId(moveTo) }) : null;
    if (!target || String(target._id) === id) throw new NewsError(`${used} post${used === 1 ? " uses" : "s use"} this tag. Pick a tag to move ${used === 1 ? "it" : "them"} to.`);
    await posts.updateMany({ tag: existing.name }, { $set: { tag: target.name } });
  }
  await col.deleteOne({ _id: existing._id });
  return { name: String(existing.name), moved: used, movedTo: target ? String(target.name) : null };
}

async function tagColors() {
  return new Map((await newsTags()).map((t) => [t.name, t.color]));
}

function toPost(d: Document, colors: Map<string, string>): NewsPost {
  return {
    id: String(d._id),
    title: String(d.title ?? ""),
    body: String(d.body ?? ""),
    tag: String(d.tag ?? "Update"),
    tagColor: colors.get(String(d.tag)) ?? "#8b8d98",
    pinned: Boolean(d.pinned),
    published: d.published !== false && d.status !== "pending" && d.status !== "draft",
    status: d.status === "pending" ? "pending" : d.published === false || d.status === "draft" ? "draft" : "published",
    publishedAt: (d.publishedAt instanceof Date ? d.publishedAt : new Date()).toISOString(),
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : null,
    authorName: d.authorName ? String(d.authorName) : null,
  };
}

/** Published posts for the public site: pinned first, then newest. */
export async function publishedNews(opts: { limit?: number; tag?: string } = {}) {
  try {
    const [col, colors] = await Promise.all([collection(), tagColors()]);
    const filter: Document = { published: { $ne: false }, status: { $nin: ["pending", "draft"] }, publishedAt: { $lte: new Date() } };
    if (opts.tag && colors.has(opts.tag)) filter.tag = opts.tag;
    const docs = await col.find(filter).sort({ pinned: -1, sortAt: -1, publishedAt: -1 }).limit(opts.limit ?? 100).toArray();
    return docs.map((d) => toPost(d, colors));
  } catch (error) {
    console.error("News lookup failed", error);
    return [];
  }
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function adminNews(q: { sort?: string; status?: string; search?: string; tag?: string }) {
  const [col, colors] = await Promise.all([collection(), tagColors()]);
  const filter: Document = {};
  if (q.status === "published") Object.assign(filter, { published: { $ne: false }, status: { $nin: ["pending", "draft"] } });
  if (q.status === "draft") Object.assign(filter, { published: false, status: { $ne: "pending" } });
  if (q.status === "pending") filter.status = "pending";
  if (q.status === "pinned") filter.pinned = true;
  if (q.tag && colors.has(q.tag)) filter.tag = q.tag;
  if (q.search?.trim()) {
    const regex = new RegExp(escapeRegex(q.search.trim().slice(0, 100)), "i");
    filter.$or = [{ title: regex }, { body: regex }];
  }
  const sort: Record<string, 1 | -1> =
    q.sort === "oldest" ? { publishedAt: 1 } : q.sort === "title" ? { title: 1 } : q.sort === "updated" ? { updatedAt: -1, publishedAt: -1 } : { pinned: -1, sortAt: -1, publishedAt: -1 };
  const docs = await col.find(filter).sort(sort).limit(300).toArray();
  return docs.map((d) => toPost(d, colors));
}

export type NewsInput = { title: string; body: string; tag: string; pinned: boolean; published: boolean; status: NewsStatus; publishedAt: Date };

/** Checks and cleans an admin's post form. */
export async function cleanNewsInput(raw: Record<string, unknown>): Promise<NewsInput | string> {
  const isDraft = raw.status === "draft";
  // Drafts can be saved half-written
  const title = (typeof raw.title === "string" ? raw.title.trim() : "") || (isDraft ? "Untitled draft" : "");
  const body = (typeof raw.body === "string" ? raw.body.trim() : "") || (isDraft ? " " : "");
  const tags = await newsTags();
  const tag = tags.find((t) => t.name === raw.tag)?.name ?? (isDraft ? tags[0]?.name : undefined);
  if (!tag) return "Pick a tag for the post.";
  if (!title || title.length > 120) return "Give the post a title (up to 120 characters).";
  if (!body || body.length > 8000) return "Write the post (up to 8,000 characters).";
  const bad = badMedia(body);
  if (bad) return bad;
  const date = typeof raw.publishedAt === "string" && raw.publishedAt ? new Date(raw.publishedAt) : new Date();
  if (Number.isNaN(date.getTime())) return "That publish date isn't valid.";
  const status: NewsStatus = raw.status === "pending" ? "pending" : raw.status === "draft" ? "draft" : raw.status === "published" ? "published" : raw.published === false ? "draft" : "published";
  return { title, body, tag, pinned: raw.pinned === true, published: status === "published", status, publishedAt: date };
}

export async function createNews(input: NewsInput, author: { name: string; discordId: string }) {
  const col = await collection();
  const res = await col.insertOne({ ...input, sortAt: input.publishedAt, createdAt: new Date(), updatedAt: null, authorName: author.name, authorDiscordId: author.discordId });
  return String(res.insertedId);
}

export async function updateNews(id: string, input: NewsInput) {
  if (!ObjectId.isValid(id)) return false;
  const col = await collection();
  // A new publish date moves the post to match, unless an admin placed it by hand
  const cur = await col.findOne({ _id: new ObjectId(id) }, { projection: { ordered: 1 } });
  const res = await col.updateOne({ _id: new ObjectId(id) }, { $set: { ...input, ...(cur?.ordered ? {} : { sortAt: input.publishedAt }), updatedAt: new Date() } });
  return res.matchedCount > 0;
}

export async function deleteNews(id: string) {
  if (!ObjectId.isValid(id)) return false;
  const col = await collection();
  return (await col.deleteOne({ _id: new ObjectId(id) })).deletedCount > 0;
}

/** Posts waiting for review (the bubble on the News tab). */
export async function pendingNewsCount() {
  return (await collection()).countDocuments({ status: "pending" });
}

/** Media lines (![caption](url)) may only point at https links or our own uploads. */
function badMedia(body: string): string | null {
  for (const m of Array.from(body.matchAll(/^\s*!\[[^\]]*\]\(([^)\s]+)\)\s*$/gm))) {
    const url = m[1];
    if (!/^https:\/\/[^\s]+$/.test(url) && !/^\/api\/news-media\/[a-f0-9]{24}\.[a-z0-9]{2,5}$/.test(url)) return "Images and videos need an https:// link (or use the upload button).";
  }
  return null;
}

/** One published post (for its own page), or null if it doesn't exist or isn't public. */
export async function publishedPost(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const [col, colors] = await Promise.all([collection(), tagColors()]);
  const d = await col.findOne({ _id: new ObjectId(id), published: { $ne: false }, status: { $nin: ["pending", "draft"] }, publishedAt: { $lte: new Date() } });
  return d ? toPost(d, colors) : null;
}

/** Ids and dates of recent public posts, for the unread bubble on the News tab (cheap). */
export async function recentNewsStamps(): Promise<{ id: string; at: string }[]> {
  try {
    const docs = await (await collection())
      .find({ published: { $ne: false }, status: { $nin: ["pending", "draft"] }, publishedAt: { $lte: new Date(), $gte: new Date(Date.now() - 60 * 86_400_000) } }, { projection: { publishedAt: 1 } })
      .sort({ publishedAt: -1 })
      .limit(30)
      .toArray();
    return docs.map((d) => ({ id: String(d._id), at: (d.publishedAt as Date).toISOString() }));
  } catch {
    return [];
  }
}

/**
 * Saves a new display order: `ids` is the list as the admin arranged it (top first). The posts swap
 * their existing sort positions among themselves, so everything else keeps its place and publish
 * dates never change.
 */
export async function reorderNews(ids: string[]) {
  const clean = Array.from(new Set(ids.filter((id) => ObjectId.isValid(id)))).slice(0, 300);
  if (clean.length < 2) return;
  const col = await collection();
  const docs = await col.find({ _id: { $in: clean.map((id) => new ObjectId(id)) } }, { projection: { sortAt: 1, publishedAt: 1 } }).toArray();
  if (docs.length !== clean.length) return;
  const slots = docs.map((d) => ((d.sortAt ?? d.publishedAt) as Date).getTime()).sort((a, b) => b - a);
  // Equal times would make the order ambiguous: nudge them a millisecond apart
  for (let i = 1; i < slots.length; i++) if (slots[i] >= slots[i - 1]) slots[i] = slots[i - 1] - 1;
  await col.bulkWrite(clean.map((id, i) => ({ updateOne: { filter: { _id: new ObjectId(id) }, update: { $set: { sortAt: new Date(slots[i]), ordered: true } } } })));
}
