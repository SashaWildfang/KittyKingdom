// The viewer's time zone. The browser reports it once (TimeZoneSync sets the kk_tz cookie), so
// times rendered on the server, emails and chart buckets use the viewer's clock instead of one
// fixed zone.

import { cookies } from "next/headers";

export const TZ_COOKIE = "kk_tz";
export const DEFAULT_TIME_ZONE = "America/Denver";

export function validTimeZone(value: string | null | undefined): string | null {
  if (!value || value.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

/** From a request's cookie header (route handlers that get the Request). */
export function requestTimeZone(request: Request): string {
  const match = /(?:^|;\s*)kk_tz=([^;]+)/.exec(request.headers.get("cookie") ?? "");
  return validTimeZone(match ? decodeURIComponent(match[1]) : null) ?? DEFAULT_TIME_ZONE;
}

/** In server components and route handlers (anywhere next/headers works). */
export async function userTimeZone(): Promise<string> {
  try {
    return validTimeZone((await cookies()).get(TZ_COOKIE)?.value) ?? DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Minutes the zone is ahead of UTC at a moment (e.g. -360 for Denver in summer). */
export function zoneOffsetMinutes(timeZone: string, at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** Short zone name for labels, like "MDT" or "GMT+1". */
export function zoneLabel(timeZone: string, at = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}
