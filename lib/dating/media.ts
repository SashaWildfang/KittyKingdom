// Dating photos: SFW images only, stored in MongoDB (GridFS bucket "dating_media"), served only to
// 18+ Verified members. Location and camera data (EXIF/XMP) is stripped before saving so a selfie
// can't reveal where someone lives.

import { GridFSBucket, ObjectId } from "mongodb";
import { getMongoClient } from "../mongodb";
import { sniff } from "../news-media";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

async function bucket() {
  const client = await getMongoClient();
  return new GridFSBucket(client.db(process.env.MONGODB_DB ?? "website"), { bucketName: "dating_media" });
}

export async function savePhoto(data: Buffer, owner: string) {
  const type = sniff(data);
  if (!type || !TYPES[type]) throw new Error("Photos must be PNG, JPG, GIF or WebP images.");
  if (data.length > MAX_PHOTO_BYTES) throw new Error("That photo is over 4 MB. Try a smaller one.");
  const clean = stripMetadata(data, type);
  const id = new ObjectId();
  const b = await bucket();
  await new Promise<void>((resolve, reject) => {
    const up = b.openUploadStreamWithId(id, `${owner}.${TYPES[type]}`, { metadata: { contentType: type, owner, uploadedAt: new Date() } });
    up.on("error", reject);
    up.on("finish", () => resolve());
    up.end(clean);
  });
  return { id: String(id), ext: TYPES[type] };
}

export async function readPhoto(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const b = await bucket();
  const file = (await b.find({ _id: new ObjectId(id) }).limit(1).toArray())[0];
  if (!file) return null;
  const chunks: Buffer[] = [];
  for await (const c of b.openDownloadStream(file._id)) chunks.push(c as Buffer);
  return { data: Buffer.concat(chunks), type: String(file.metadata?.contentType ?? "application/octet-stream"), owner: String(file.metadata?.owner ?? "") };
}

/** Who uploaded a file (without downloading it). */
export async function photoOwner(id: string): Promise<string | null> {
  if (!ObjectId.isValid(id)) return null;
  const file = (await (await bucket()).find({ _id: new ObjectId(id) }).limit(1).toArray())[0];
  return file ? String(file.metadata?.owner ?? "") : null;
}

export async function deletePhoto(id: string) {
  if (!ObjectId.isValid(id)) return;
  await (await bucket()).delete(new ObjectId(id)).catch(() => undefined);
}

// ---------- Metadata stripping ----------
function stripMetadata(b: Buffer, type: string): Buffer {
  try {
    if (type === "image/jpeg") return stripJpeg(b);
    if (type === "image/png") return stripPng(b);
    if (type === "image/webp") return stripWebp(b);
  } catch {
    // Malformed file: keep it as is rather than breaking the upload (the type was already checked)
  }
  return b;
}

/** JPEG: drop APP1 (EXIF/XMP), APP13 (Photoshop/IPTC) and comment segments. */
function stripJpeg(b: Buffer): Buffer {
  const out: Buffer[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xda) {
      out.push(b.subarray(i)); // start of scan: the rest is image data
      return Buffer.concat(out);
    }
    const len = b.readUInt16BE(i + 2);
    const seg = b.subarray(i, i + 2 + len);
    if (!(marker === 0xe1 || marker === 0xed || marker === 0xfe)) out.push(seg);
    i += 2 + len;
  }
  out.push(b.subarray(i));
  return Buffer.concat(out);
}

/** PNG: drop eXIf and text chunks. */
function stripPng(b: Buffer): Buffer {
  const out: Buffer[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = b.readUInt32BE(i);
    const name = b.toString("ascii", i + 4, i + 8);
    const chunk = b.subarray(i, i + 12 + len);
    if (!["eXIf", "tEXt", "iTXt", "zTXt"].includes(name)) out.push(chunk);
    i += 12 + len;
    if (name === "IEND") break;
  }
  return Buffer.concat(out);
}

/** WebP: drop EXIF / XMP chunks and clear their flags. */
function stripWebp(b: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const name = b.toString("ascii", i, i + 4);
    const len = b.readUInt32LE(i + 4);
    const total = 8 + len + (len % 2);
    let chunk = Buffer.from(b.subarray(i, i + total));
    if (name === "VP8X") {
      chunk[8] &= ~0x0c; // EXIF (0x08) and XMP (0x04) flags
    }
    if (name !== "EXIF" && name !== "XMP ") chunks.push(chunk);
    i += total;
  }
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "ascii");
  head.writeUInt32LE(body.length + 4, 4);
  head.write("WEBP", 8, "ascii");
  return Buffer.concat([head, body]);
}
