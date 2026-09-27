// Reads ticket transcripts straight out of their Discord uploads, one file at a time.
//
// A transcript is a zip in the transcript log channel (plus, when media didn't fit, numbered .bin
// pieces listed in the zip's manifest.json). Zips can be 50 MB+, so instead of downloading and
// unzipping the whole thing for every image, this reads the zip's directory once with an HTTP range
// request and then fetches only the bytes of the file that was asked for. Discord's CDN supports
// ranges. The download links and the directory are shared through the database, so the ~60
// requests a transcript page makes at once don't each have to ask Discord.

import { inflateSync, unzipSync } from "fflate";
import { DISCORD_API, botToken } from "./discord-member";
import { getMongoClient } from "./mongodb";

export const TRANSCRIPT_CHANNEL_ID = "1445923851178610718";

type Attachment = { id?: string; url: string; filename: string; size: number };
type Entry = { lho: number; csize: number; size: number; method: number };
type ManifestChunk = { c: string; m: string; f: string };
type Manifest = { files?: Record<string, { size?: number; chunks?: ManifestChunk[] }> };

export type TranscriptFile = {
  size: number;
  /** Bytes start..end (inclusive). */
  read(start: number, end: number): Promise<ReadableStream<Uint8Array> | Uint8Array>;
};

const isSnowflake = (v: string) => /^\d{15,21}$/.test(v);

async function cache() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website").collection<{ _id: string } & Record<string, unknown>>("transcript_cache");
}

// ------------------------------------------------------------------
// Discord: message attachments (fresh signed links), shared via the DB
// ------------------------------------------------------------------
/** Discord's signed CDN links say when they expire (?ex=, hex seconds). */
function linkExpiry(url: string) {
  try {
    const ex = new URL(url).searchParams.get("ex");
    if (ex) return parseInt(ex, 16) * 1000 - 30 * 60 * 1000;
  } catch {
    // not a URL we understand
  }
  return Date.now() + 30 * 60 * 1000;
}

const memAttachments = new Map<string, { list: Attachment[]; expires: number }>();
const attachmentsInFlight = new Map<string, Promise<Attachment[] | null>>();

async function fetchMessageAttachments(channelId: string, messageId: string): Promise<Attachment[] | null> {
  const token = botToken();
  if (!token) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      });
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    if (response.ok) {
      const message = (await response.json()) as { attachments?: Attachment[] };
      return message.attachments ?? [];
    }
    if (response.status === 429 || response.status >= 500) {
      const body = (await response.json().catch(() => ({}))) as { retry_after?: number };
      const wait = Math.min(5000, Math.max(250, (body.retry_after ?? 1) * 1000));
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return null;
  }
  return null;
}

async function messageAttachments(channelId: string, messageId: string, fresh = false): Promise<Attachment[] | null> {
  if (channelId !== TRANSCRIPT_CHANNEL_ID || !isSnowflake(messageId)) return null;
  const key = `att:${channelId}/${messageId}`;
  const now = Date.now();
  if (!fresh) {
    const mem = memAttachments.get(key);
    if (mem && mem.expires > now) return mem.list;
    const doc = await (await cache()).findOne({ _id: key }).catch(() => null);
    if (doc && typeof doc.expires === "number" && doc.expires > now && Array.isArray(doc.list)) {
      memAttachments.set(key, { list: doc.list as Attachment[], expires: doc.expires });
      return doc.list as Attachment[];
    }
  }
  const pending = attachmentsInFlight.get(key);
  if (pending) return pending;
  const job = (async () => {
    const list = await fetchMessageAttachments(channelId, messageId);
    if (!list) return null;
    const expires = list.length ? Math.min(...list.map((a) => linkExpiry(a.url))) : now + 30 * 60 * 1000;
    memAttachments.set(key, { list, expires });
    await (await cache())
      .updateOne({ _id: key }, { $set: { list, expires, at: new Date() } }, { upsert: true })
      .catch(() => undefined);
    return list;
  })().finally(() => attachmentsInFlight.delete(key));
  attachmentsInFlight.set(key, job);
  return job;
}

/** The transcript zip attachment on a log message. */
async function zipAttachment(messageId: string, fresh = false) {
  const list = await messageAttachments(TRANSCRIPT_CHANNEL_ID, messageId, fresh);
  return list?.find((a) => a.filename.toLowerCase().endsWith(".zip")) ?? null;
}

/** GET with a byte range, refreshing the signed link once if it has expired. */
async function rangeFetch(getUrl: (fresh: boolean) => Promise<string | null>, start: number, end: number) {
  for (const fresh of [false, true]) {
    const url = await getUrl(fresh);
    if (!url) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, cache: "no-store" });
        if (response.status === 206 || response.status === 200) return response;
        if (response.status === 403 || response.status === 404 || response.status === 410) break; // link expired
      } catch {
        // network hiccup: retry
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return null;
}

async function rangeBytes(getUrl: (fresh: boolean) => Promise<string | null>, start: number, end: number, total: number) {
  const response = await rangeFetch(getUrl, start, end);
  if (!response) return null;
  const data = new Uint8Array(await response.arrayBuffer());
  // A server that ignores ranges sends everything
  if (response.status === 200 && data.length === total && (start > 0 || end < total - 1)) return data.subarray(start, end + 1);
  return data;
}

// ------------------------------------------------------------------
// Zip directory
// ------------------------------------------------------------------
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

function parseDirectory(cd: Uint8Array) {
  const entries: Record<string, Entry> = {};
  const decoder = new TextDecoder();
  let o = 0;
  while (o + 46 <= cd.length && u32(cd, o) === 0x02014b50) {
    const method = u16(cd, o + 10);
    let csize = u32(cd, o + 20);
    let size = u32(cd, o + 24);
    const nameLen = u16(cd, o + 28);
    const extraLen = u16(cd, o + 30);
    const commentLen = u16(cd, o + 32);
    let lho = u32(cd, o + 42);
    const name = decoder.decode(cd.subarray(o + 46, o + 46 + nameLen));
    // Zip64 sizes/offsets live in the extra field
    if (size === 0xffffffff || csize === 0xffffffff || lho === 0xffffffff) {
      let e = o + 46 + nameLen;
      const endExtra = e + extraLen;
      while (e + 4 <= endExtra) {
        const id = u16(cd, e);
        const len = u16(cd, e + 2);
        if (id === 1) {
          let p = e + 4;
          const read64 = () => {
            const v = u32(cd, p) + u32(cd, p + 4) * 2 ** 32;
            p += 8;
            return v;
          };
          if (size === 0xffffffff) size = read64();
          if (csize === 0xffffffff) csize = read64();
          if (lho === 0xffffffff) lho = read64();
        }
        e += 4 + len;
      }
    }
    if (!name.endsWith("/")) entries[name] = { lho, csize, size, method };
    o += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

type ZipIndex = { entries: Record<string, Entry>; zipSize: number; whole?: Record<string, Uint8Array> };
const memIndex = new Map<string, ZipIndex>();
const indexInFlight = new Map<string, Promise<ZipIndex | null>>();

async function buildIndex(messageId: string): Promise<ZipIndex | null> {
  const zip = await zipAttachment(messageId);
  if (!zip) return null;
  const getUrl = async (fresh: boolean) => (await zipAttachment(messageId, fresh))?.url ?? null;
  const total = zip.size;
  const tailLen = Math.min(total, 65557 + 1024);
  const tail = await rangeBytes(getUrl, total - tailLen, total - 1, total);
  if (!tail) return null;
  if (tail.length === total && tailLen < total) {
    // Ranges not supported: fall back to unzipping everything
    return { entries: {}, zipSize: total, whole: unzipSync(tail) };
  }
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  let cdSize = u32(tail, eocd + 12);
  let cdOffset = u32(tail, eocd + 16);
  // Zip64 end record
  if ((cdOffset === 0xffffffff || cdSize === 0xffffffff) && eocd >= 20 && u32(tail, eocd - 20) === 0x07064b50) {
    const recOffset = u32(tail, eocd - 12) + u32(tail, eocd - 8) * 2 ** 32;
    const rec = await rangeBytes(getUrl, recOffset, recOffset + 55, total);
    if (!rec) return null;
    cdSize = u32(rec, 40) + u32(rec, 44) * 2 ** 32;
    cdOffset = u32(rec, 48) + u32(rec, 52) * 2 ** 32;
  }
  const tailStart = total - tailLen;
  const cd = cdOffset >= tailStart
    ? tail.subarray(cdOffset - tailStart, cdOffset - tailStart + cdSize)
    : await rangeBytes(getUrl, cdOffset, cdOffset + cdSize - 1, total);
  if (!cd) return null;
  return { entries: parseDirectory(cd), zipSize: total };
}

async function zipIndex(messageId: string): Promise<ZipIndex | null> {
  const mem = memIndex.get(messageId);
  if (mem) return mem;
  const key = `zip:${messageId}`;
  const doc = await (await cache()).findOne({ _id: key }).catch(() => null);
  if (doc && Array.isArray(doc.entries) && typeof doc.zipSize === "number") {
    const entries: Record<string, Entry> = {};
    for (const [name, lho, csize, size, method] of doc.entries as [string, number, number, number, number][]) entries[name] = { lho, csize, size, method };
    const index = { entries, zipSize: doc.zipSize };
    memIndex.set(messageId, index);
    return index;
  }
  const pending = indexInFlight.get(messageId);
  if (pending) return pending;
  const job = buildIndex(messageId)
    .then(async (index) => {
      if (!index) return null;
      memIndex.set(messageId, index);
      while (memIndex.size > 50) memIndex.delete(memIndex.keys().next().value as string);
      if (!index.whole) {
        const list = Object.entries(index.entries).map(([n, e]) => [n, e.lho, e.csize, e.size, e.method]);
        await (await cache())
          .updateOne({ _id: key }, { $set: { entries: list, zipSize: index.zipSize, at: new Date() } }, { upsert: true })
          .catch(() => undefined);
      }
      return index;
    })
    .finally(() => indexInFlight.delete(messageId));
  indexInFlight.set(messageId, job);
  return job;
}

// ------------------------------------------------------------------
// Reading files
// ------------------------------------------------------------------
const dataStarts = new Map<string, number>();
const inflated = new Map<string, Uint8Array>();
const MAX_INFLATED_BYTES = 160 * 1024 * 1024;

function remember(key: string, data: Uint8Array) {
  inflated.set(key, data);
  let total = 0;
  for (const v of Array.from(inflated.values())) total += v.length;
  while (total > MAX_INFLATED_BYTES && inflated.size > 1) {
    const oldest = inflated.keys().next().value as string;
    total -= inflated.get(oldest)?.length ?? 0;
    inflated.delete(oldest);
  }
}

function zipFile(messageId: string, name: string, entry: Entry, zipSize: number): TranscriptFile {
  const getUrl = async (fresh: boolean) => (await zipAttachment(messageId, fresh))?.url ?? null;
  const key = `${messageId}/${name}`;

  async function dataStart() {
    const known = dataStarts.get(key);
    if (known !== undefined) return known;
    const header = await rangeBytes(getUrl, entry.lho, entry.lho + 29, zipSize);
    if (!header || u32(header, 0) !== 0x04034b50) throw new Error("Bad zip entry");
    const start = entry.lho + 30 + u16(header, 26) + u16(header, 28);
    dataStarts.set(key, start);
    return start;
  }

  async function whole() {
    const cached = inflated.get(key);
    if (cached) return cached;
    const start = await dataStart();
    const raw = entry.csize ? await rangeBytes(getUrl, start, start + entry.csize - 1, zipSize) : new Uint8Array(0);
    if (!raw) throw new Error("Download failed");
    const data = entry.method === 8 ? inflateSync(raw) : raw;
    remember(key, data);
    return data;
  }

  return {
    size: entry.size,
    async read(start, end) {
      // Stored (uncompressed) media is streamed straight from the requested byte range
      if (entry.method === 0 && entry.size > 2 * 1024 * 1024) {
        const base = await dataStart();
        const response = await rangeFetch(getUrl, base + start, base + end);
        if (!response?.body) throw new Error("Download failed");
        if (response.status === 206) return response.body;
        return (await whole()).subarray(start, end + 1);
      }
      return (await whole()).subarray(start, end + 1);
    },
  };
}

function piecedFile(messageId: string, name: string, chunks: ManifestChunk[], sizes: number[]): TranscriptFile {
  const size = sizes.reduce((a, b) => a + b, 0);
  return {
    size,
    async read(start, end) {
      const parts: { chunk: ManifestChunk; from: number; to: number }[] = [];
      let offset = 0;
      chunks.forEach((chunk, i) => {
        const cStart = offset;
        const cEnd = offset + sizes[i] - 1;
        offset += sizes[i];
        if (cEnd < start || cStart > end) return;
        parts.push({ chunk, from: Math.max(start, cStart) - cStart, to: Math.min(end, cEnd) - cStart });
      });
      let i = 0;
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      return new ReadableStream<Uint8Array>({
        async pull(controller) {
          for (;;) {
            if (!reader) {
              if (i >= parts.length) return controller.close();
              const { chunk, from, to } = parts[i++];
              const getUrl = async (fresh: boolean) =>
                (await messageAttachments(chunk.c, chunk.m, fresh))?.find((a) => a.filename === chunk.f)?.url ?? null;
              const response = await rangeFetch(getUrl, from, to);
              if (!response?.body) return controller.error(new Error(`Missing piece ${chunk.f} of ${name}`));
              if (response.status === 200) {
                const all = new Uint8Array(await response.arrayBuffer());
                controller.enqueue(all.subarray(from, to + 1));
                return;
              }
              reader = response.body.getReader();
            }
            const { done, value } = await reader.read();
            if (done) {
              reader = null;
              continue;
            }
            controller.enqueue(value);
            return;
          }
        },
      });
    },
  };
}

const manifests = new Map<string, Manifest>();

async function manifestFor(messageId: string, index: ZipIndex): Promise<Manifest> {
  const known = manifests.get(messageId);
  if (known) return known;
  let manifest: Manifest = {};
  const entry = index.entries["manifest.json"];
  if (entry) {
    const data = await zipFile(messageId, "manifest.json", entry, index.zipSize).read(0, Math.max(0, entry.size - 1));
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(await new Response(data).arrayBuffer());
    try {
      manifest = JSON.parse(new TextDecoder().decode(bytes)) as Manifest;
    } catch {
      manifest = {};
    }
  }
  manifests.set(messageId, manifest);
  return manifest;
}

/** Opens one file of a transcript (from the zip or its uploaded pieces), or null if it isn't there. */
export async function openTranscriptFile(messageId: string, name: string): Promise<TranscriptFile | null> {
  if (!isSnowflake(messageId)) return null;
  const index = await zipIndex(messageId);
  if (!index) return null;
  if (index.whole) {
    const data = index.whole[name];
    return data ? { size: data.length, read: async (s, e) => data.subarray(s, e + 1) } : null;
  }
  const entry = index.entries[name];
  if (entry) return zipFile(messageId, name, entry, index.zipSize);

  const listed = (await manifestFor(messageId, index)).files?.[name];
  const chunks = listed?.chunks ?? [];
  if (!chunks.length || chunks.some((c) => c.c !== TRANSCRIPT_CHANNEL_ID || !isSnowflake(c.m))) return null;
  const sizes: number[] = [];
  for (const chunk of chunks) {
    const att = (await messageAttachments(chunk.c, chunk.m))?.find((a) => a.filename === chunk.f);
    if (!att) return null;
    sizes.push(att.size);
  }
  return piecedFile(messageId, name, chunks, sizes);
}

/**
 * Called when a transcript is opened: loads the links and zip directory into the shared cache so
 * the page's many parallel requests don't each ask Discord. Returns the zip download (or null).
 */
export async function warmTranscript(messageId: string) {
  const zip = await zipAttachment(messageId);
  if (!zip) return null;
  const index = await zipIndex(messageId).catch(() => null);
  if (index && !index.whole) {
    // Links for the media pieces too (one Discord call per piece message, one at a time)
    const manifest = await manifestFor(messageId, index).catch(() => ({}) as Manifest);
    const pieceMessages = new Set<string>();
    for (const file of Object.values(manifest.files ?? {})) for (const c of file.chunks ?? []) if (c.c === TRANSCRIPT_CHANNEL_ID) pieceMessages.add(c.m);
    for (const m of Array.from(pieceMessages)) await messageAttachments(TRANSCRIPT_CHANNEL_ID, m).catch(() => null);
  }
  return { url: zip.url, filename: zip.filename, size: zip.size };
}
