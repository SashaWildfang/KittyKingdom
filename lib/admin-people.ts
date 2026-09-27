import { loadDirectory, resolveMissing } from "./member-directory";

export type Person = { name: string; username: string | null; nick?: string | null; avatar: string | null; inServer: boolean };

/** Names and avatars for the Discord ids shown in an admin view. */
export async function people(ids: (string | null | undefined)[]): Promise<Record<string, Person>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id && /^\d{15,21}$/.test(id)))));
  if (!unique.length) return {};
  const { entries } = await loadDirectory(unique);
  await resolveMissing(unique, entries);
  const out: Record<string, Person> = {};
  for (const id of unique) {
    const entry = entries.get(id);
    out[id] = {
      name: entry?.displayName ?? entry?.username ?? "Unknown user",
      username: entry?.username ?? null,
      nick: entry?.nick ?? null,
      avatar: entry?.avatar ?? null,
      inServer: entry?.inServer ?? false,
    };
  }
  return out;
}

/** Parses the common ?from=&to=&range= filters. */
export function dateRange(params: URLSearchParams) {
  const range = params.get("range");
  const now = Date.now();
  const days = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365 }[range ?? ""] as number | undefined;
  const from = params.get("from") ? new Date(params.get("from")!) : days ? new Date(now - days * 86_400_000) : null;
  const to = params.get("to") ? new Date(params.get("to")!) : null;
  return {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  };
}

export const listParam = (params: URLSearchParams, key: string) =>
  (params.get(key) ?? "").split(",").map((v) => v.trim()).filter(Boolean).slice(0, 30);
