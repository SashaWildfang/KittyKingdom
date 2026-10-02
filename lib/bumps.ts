// Monthly bump counts. The bot keeps `monthly_bumps` with the month it belongs to in `last_bump_month`
// ("YYYY-MM", Mountain time, the same clock as the end-of-month payout). The count only resets when that
// member bumps again, so a count from an earlier month must read as 0.

export const BUMP_TIMEZONE = "America/Denver";

/** This month's key, e.g. "2026-10". */
export function currentBumpMonth(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUMP_TIMEZONE, year: "numeric", month: "2-digit" }).format(now).slice(0, 7);
}

/** A member's bumps this month (0 if their stored count is from an earlier month). */
export function monthlyBumps(doc: Record<string, unknown> | null | undefined, month = currentBumpMonth()) {
  if (!doc || doc.last_bump_month !== month) return 0;
  const n = Number(doc.monthly_bumps);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
