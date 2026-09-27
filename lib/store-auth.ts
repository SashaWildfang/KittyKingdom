import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { StoreError, getStoreState } from "./store";
import { hasOperatorKeys } from "./validate";

/** The signed-in user with a linked Discord account, or a StoreError (401 / 403). */
export async function requireStoreUser(request: Request) {
  // Reject cross-site requests (the session cookie is SameSite=Lax, this is a second layer)
  const origin = request.headers.get("origin");
  if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) {
    throw new StoreError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) throw new StoreError("Please log in to use the store.", 401);
  if (!user.discordId) throw new StoreError("Link your Discord account to use the store.", 403);
  const name = typeof user.displayName === "string" ? user.displayName : String(user.discord?.username ?? user.username ?? "A member");
  return { discordId: String(user.discordId), name };
}

export async function readJson(request: Request) {
  const body = (await request.json().catch(() => ({}))) as unknown;
  // Only plain objects, and never Mongo operator keys like "$ne"
  if (!body || typeof body !== "object" || Array.isArray(body) || hasOperatorKeys(body)) return {} as Record<string, unknown>;
  return body as Record<string, unknown>;
}

/** Runs a store action and responds with its message plus the fresh store state. */
export async function storeAction(request: Request, action: (user: { discordId: string; name: string }, body: Record<string, unknown>) => Promise<{ message: string }>) {
  try {
    const user = await requireStoreUser(request);
    const result = await action(user, await readJson(request));
    return NextResponse.json({ ok: true, ...result, state: await getStoreState(user.discordId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return storeErrorResponse(error);
  }
}

export function storeErrorResponse(error: unknown) {
  if (error instanceof StoreError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Store request failed", error);
  return NextResponse.json({ ok: false, error: "The store is having trouble right now. Please try again." }, { status: 500 });
}
