// Images and short videos for news posts, stored in MongoDB (GridFS bucket "news_media") so no
// extra service is needed. Uploads are admin-only; files are served publicly by id with long caching.

import { GridFSBucket, ObjectId } from "mongodb";
import { getMongoClient } from "./mongodb";

export const MEDIA_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
// Vercel caps request bodies at ~4.5 MB; bigger videos can be linked (YouTube or a direct link)
export const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

async function bucket() {
  const client = await getMongoClient();
  return new GridFSBucket(client.db(process.env.MONGODB_DB ?? "website"), { bucketName: "news_media" });
}

/** Stores a file after checking its real type from the first bytes (not just what the browser said). */
export async function saveNewsMedia(data: Buffer, declaredType: string, name: string, by: string) {
  const type = sniff(data) ?? null;
  if (!type || !MEDIA_TYPES[type] || (declaredType && declaredType !== type && !(type === "video/mp4" && declaredType.startsWith("video/")))) {
    throw new Error("Only PNG, JPG, GIF, WebP images and MP4 or WebM videos can be uploaded.");
  }
  if (data.length > MAX_MEDIA_BYTES) throw new Error("That file is over 4 MB. For big videos, upload to YouTube and use Embed link.");
  const b = await bucket();
  const id = new ObjectId();
  await new Promise<void>((resolve, reject) => {
    const stream = b.openUploadStreamWithId(id, name.slice(0, 120) || "upload", { metadata: { contentType: type, uploadedBy: by, uploadedAt: new Date() } });
    stream.on("error", reject);
    stream.on("finish", () => resolve());
    stream.end(data);
  });
  return { id: String(id), ext: MEDIA_TYPES[type], type };
}

export async function readNewsMedia(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const b = await bucket();
  const file = (await b.find({ _id: new ObjectId(id) }).limit(1).toArray())[0];
  if (!file) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of b.openDownloadStream(file._id)) chunks.push(chunk as Buffer);
  return { data: Buffer.concat(chunks), type: String(file.metadata?.contentType ?? "application/octet-stream") };
}

export function sniff(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.toString("ascii", 4, 8) === "ftyp") return "video/mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  return null;
}
