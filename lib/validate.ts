// Input checks for the account forms. Values arrive as form fields (never JSON objects),
// and everything is length-limited before it reaches the database or the password hasher.

export const MAX_EMAIL = 254;
export const MAX_IDENTIFIER = 254;
export const MAX_PASSWORD = 128;

const EMAIL = /^[^\s@"'<>()[\]\\,;:]+@[^\s@"'<>()[\]\\,;:]+\.[a-z]{2,}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;

export function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL || CONTROL.test(email) || !EMAIL.test(email)) return null;
  return email;
}

/** Email or username for logging in / resets. */
export function cleanIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim().toLowerCase();
  if (!id || id.length > MAX_IDENTIFIER || CONTROL.test(id) || id.startsWith("$")) return null;
  if (id.includes("@")) return cleanEmail(id);
  return /^[a-z0-9_.-]{1,40}$/.test(id) ? id : null;
}

export function cleanPassword(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > MAX_PASSWORD) return null;
  return value;
}

/** Account forms only accept real form posts; JSON bodies are refused outright. */
export function isFormPost(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  return type.startsWith("application/x-www-form-urlencoded") || type.startsWith("multipart/form-data");
}

/** Rejects JSON bodies that try to smuggle Mongo operators ("$ne", "$gt", ...) in any key. */
export function hasOperatorKeys(value: unknown, depth = 0): boolean {
  if (depth > 6 || value === null || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([k, v]) => k.startsWith("$") || k.includes(".") || hasOperatorKeys(v, depth + 1));
}

/** A page on this site to go back to after logging in ("/account/transcripts/12"), or null. */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  if (next.length > 200 || !/^\/(?![/\\])[A-Za-z0-9/_\-.?=&#%]*$/.test(next)) return null;
  return next;
}
