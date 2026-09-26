// Parsing for the free-text age / date-of-birth answers from the Discord join application,
// e.g. "36 years old, 02/08/1990", "Feb 8th 1990", "1990-02-08" or "8 February 1990".

const monthNames: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

function utcDate(year: number, month: number, day: number) {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month, day));
  // Reject rollovers like Feb 31 -> Mar 3
  return date.getUTCMonth() === month && date.getUTCDate() === day ? date : null;
}

function fullYear(year: number) {
  if (year >= 100) return year;
  // Two-digit years: "90" -> 1990, "05" -> 2005
  const currentTwoDigit = new Date().getUTCFullYear() % 100;
  return year > currentTwoDigit ? 1900 + year : 2000 + year;
}

function isPlausibleBirthDate(date: Date) {
  const age = calculateAge(date);
  return age >= 13 && age <= 120;
}

/** Finds a date of birth anywhere in the text. Numbers are read as US month/day unless the first is over 12. */
export function parseDateOfBirth(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim().toLowerCase();

  const candidates: (Date | null)[] = [];

  // 1990-02-08 or 1990/2/8
  for (const m of Array.from(text.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g))) {
    candidates.push(utcDate(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  // 02/08/1990, 2-8-90, 08.02.1990
  for (const m of Array.from(text.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/g))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = fullYear(Number(m[3]));
    // Day first only when it can't be a month (e.g. 25/12/1990)
    candidates.push(a > 12 ? utcDate(year, b - 1, a) : utcDate(year, a - 1, b));
  }
  // Feb 8th, 1990 / February 8 1990
  for (const m of Array.from(text.matchAll(new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "g")))) {
    candidates.push(utcDate(Number(m[3]), monthNames[m[1]], Number(m[2])));
  }
  // 8 February 1990 / 8th of Feb, 1990
  for (const m of Array.from(text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\.?,?\\s+(\\d{4})\\b`, "g")))) {
    candidates.push(utcDate(Number(m[3]), monthNames[m[2]], Number(m[1])));
  }

  return candidates.find((d): d is Date => d !== null && isPlausibleBirthDate(d)) ?? null;
}

/** Age in whole years today, from a UTC birth date. */
export function calculateAge(birthDate: Date, now = new Date()) {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

/** An age written as a number or in text like "36", "36 years old" or "age: 36". */
export function parseAge(value: unknown): number | null {
  if (typeof value === "number") return value >= 13 && value <= 120 ? Math.floor(value) : null;
  if (typeof value !== "string") return null;
  const match =
    value.match(/\b(\d{2,3})\s*(?:years?|yrs?|y\/?o)\b/i) ??
    value.match(/\bage\s*[:=-]?\s*(\d{2,3})\b/i) ??
    value.trim().match(/^(\d{2,3})$/);
  const age = match ? Number(match[1]) : NaN;
  return age >= 13 && age <= 120 ? age : null;
}

export function formatDateOfBirth(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}
