"use client";

import { useState } from "react";

export type DbName = "website" | "bot";

export type CollRow = {
  db: DbName;
  name: string;
  label: string;
  group: string;
  about: string | null;
  count: number;
  size: number;
  storage: number;
  indexes: number;
  indexSize: number;
  avg: number;
  ttl: { field: string; days: number }[];
  protected: boolean;
  locked: boolean;
  known: boolean;
  retention: { field: string; days: number } | null;
  growth: { count: number; bytes: number } | null;
};

export const GROUP_LABELS: Record<string, string> = {
  members: "Members & accounts",
  economy: "Economy & games",
  social: "Social",
  moderation: "Moderation & safety",
  logs: "Logs & history",
  cache: "Caches & temporary",
  content: "Site content",
  system: "Settings & system",
};

export const GROUP_COLORS: Record<string, string> = {
  members: "#3e63dd",
  economy: "#e2b203",
  social: "#d6409f",
  moderation: "#e5484d",
  logs: "#8e4ec6",
  cache: "#12a594",
  content: "#46a758",
  system: "#8b8d98",
};

export function fmtBytes(n: number) {
  const abs = Math.abs(n);
  if (abs < 1024) return `${n} B`;
  if (abs < 1024 ** 2) return `${(n / 1024).toFixed(abs < 10 * 1024 ? 1 : 0)} KB`;
  if (abs < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(abs < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function signed(n: number, format: (n: number) => string = (x) => x.toLocaleString()) {
  return n > 0 ? `+${format(n)}` : n < 0 ? `−${format(-n)}` : "±0";
}

export function dbLabel(db: DbName) {
  return db === "website" ? "Website" : "Bots";
}

/** JSON calls that always come back as { ok, error?, … } */
export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<T & { ok: boolean; error?: string; code?: string }> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    cache: "no-store",
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  }).catch(() => null);
  const body = res ? await res.json().catch(() => null) : null;
  if (!body) return { ok: false, error: "Couldn't reach the server." } as T & { ok: boolean; error?: string };
  return body;
}

export function dateText(value: unknown) {
  const d = value ? new Date(String(value)) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function agoText(value: unknown) {
  const d = value ? new Date(String(value)) : null;
  if (!d || Number.isNaN(d.getTime())) return "never";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 60) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 730) return `${Math.round(days / 30.4)} months ago`;
  return `${(days / 365).toFixed(1)} years ago`;
}

// ---------- Record viewer ----------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** EJSON wrappers shown as plain values: dates, ids and 64-bit numbers */
function special(v: { [k: string]: Json }): { text: string; kind: string } | null {
  const keys = Object.keys(v);
  if (keys.length !== 1) return keys.length === 2 && "$binary" in v ? { text: "binary data", kind: "bin" } : null;
  const k = keys[0];
  const x = v[k];
  if (k === "$date") {
    const raw = typeof x === "object" && x && "$numberLong" in (x as object) ? Number((x as { $numberLong: string }).$numberLong) : (x as string | number);
    const d = new Date(raw);
    return { text: Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleString(), kind: "date" };
  }
  if (k === "$oid") return { text: String(x), kind: "oid" };
  if (k === "$numberLong" || k === "$numberInt" || k === "$numberDouble" || k === "$numberDecimal") return { text: String(x), kind: "num" };
  if (k === "$binary") return { text: "binary data", kind: "bin" };
  return null;
}

export function ValueView({ value, depth = 0 }: { value: Json; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);
  if (value === null) return <span className="dbm-v dbm-v--null">null</span>;
  if (typeof value === "boolean") return <span className="dbm-v dbm-v--bool">{String(value)}</span>;
  if (typeof value === "number") return <span className="dbm-v dbm-v--num">{value.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>;
  if (typeof value === "string") {
    if (value === "•••hidden•••") return <span className="dbm-v dbm-v--hidden">hidden</span>;
    return <span className="dbm-v dbm-v--str">{value.length > 400 ? `${value.slice(0, 400)}…` : value}</span>;
  }
  if (!Array.isArray(value)) {
    const s = special(value);
    if (s) return <span className={`dbm-v dbm-v--${s.kind}`}>{s.text}</span>;
  }
  const entries: [string, Json][] = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value);
  if (!entries.length) return <span className="dbm-v dbm-v--null">{Array.isArray(value) ? "[ ]" : "{ }"}</span>;
  return (
    <span className="dbm-tree">
      <button type="button" className="dbm-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "▾" : "▸"} {Array.isArray(value) ? `${entries.length} item${entries.length === 1 ? "" : "s"}` : `${entries.length} field${entries.length === 1 ? "" : "s"}`}
      </button>
      {open ? (
        <dl className="dbm-fields">
          {entries.slice(0, 200).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                <ValueView value={v} depth={depth + 1} />
              </dd>
            </div>
          ))}
          {entries.length > 200 ? <p className="adm-muted">…and {entries.length - 200} more (open the editor to see everything)</p> : null}
        </dl>
      ) : null}
    </span>
  );
}

/** A one-line summary of a record for lists */
export function summary(doc: Record<string, Json>) {
  const prefer = ["label", "name", "displayName", "username", "title", "discordId", "userId", "user_id", "buyerId", "action", "type", "kind", "subject", "status", "rule", "item_id", "channelName"];
  const parts: string[] = [];
  for (const k of prefer) {
    if (k in doc && parts.length < 3) parts.push(`${k}: ${short(doc[k])}`);
  }
  for (const [k, v] of Object.entries(doc)) {
    if (parts.length >= 3) break;
    if (k === "_id" || prefer.includes(k) || (v && typeof v === "object" && !special(v as { [k: string]: Json }))) continue;
    parts.push(`${k}: ${short(v)}`);
  }
  return parts.join(" · ");
}

export function short(v: Json): string {
  if (v === null) return "null";
  if (typeof v === "string") return v.length > 40 ? `${v.slice(0, 40)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.length}]`;
  const s = special(v);
  return s ? s.text : "{…}";
}

export function idText(id: Json) {
  if (id && typeof id === "object" && !Array.isArray(id)) {
    const s = special(id);
    if (s) return s.text;
  }
  return typeof id === "string" ? id : JSON.stringify(id);
}

export type { Json };
