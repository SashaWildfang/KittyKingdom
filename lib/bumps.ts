// Monthly stats from the bot (bumps and voice time). Months are Mountain time, the same clock as the
// bot's end-of-month payout. Each member has a current-month counter (`monthly_bumps` / `vc_time_monthly`,
// with its month in `last_bump_month` / `vc_month`) that only resets on their next bump or VC session, and
// a per-month history (`bumps_by_month` / `vc_by_month`). A count from an earlier month reads as 0.

export const MONTH_TIMEZONE = "America/Denver";

/** This month's key, e.g. "2026-10". */
export function currentMonth(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MONTH_TIMEZONE, year: "numeric", month: "2-digit" }).format(now).slice(0, 7);
}

/** @deprecated use currentMonth */
export const currentBumpMonth = currentMonth;

function positive(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** A monthly stat for this month: the larger of the history entry and the current-month counter. */
function monthStat(doc: Record<string, unknown> | null | undefined, history: string, monthField: string, counter: string, month: string) {
  if (!doc) return 0;
  const fromHistory = positive((doc[history] as Record<string, unknown> | undefined)?.[month]);
  const fromCounter = doc[monthField] === month ? positive(doc[counter]) : 0;
  return Math.max(fromHistory, fromCounter);
}

/** A member's bumps this month. */
export function monthlyBumps(doc: Record<string, unknown> | null | undefined, month = currentMonth()) {
  return monthStat(doc, "bumps_by_month", "last_bump_month", "monthly_bumps", month);
}

/** A member's voice seconds this month. */
export function monthlyVcSeconds(doc: Record<string, unknown> | null | undefined, month = currentMonth()) {
  return monthStat(doc, "vc_by_month", "vc_month", "vc_time_monthly", month);
}
