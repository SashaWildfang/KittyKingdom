import { NextResponse } from "next/server";
import { RoleError, getRoleState, setSelfRole } from "../../../../lib/member-roles";
import { StoreError, equipRole, unequipRole } from "../../../../lib/store";
import { readJson, requireStoreUser } from "../../../../lib/store-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// A few quick clicks are fine; stops scripts from hammering Discord's role API
const recent = new Map<string, number[]>();
function allowChange(discordId: string) {
  const now = Date.now();
  const hits = (recent.get(discordId) ?? []).filter((t) => now - t < 10_000);
  if (hits.length >= 12) return false;
  hits.push(now);
  recent.set(discordId, hits);
  return true;
}

function errorResponse(error: unknown) {
  if (error instanceof RoleError || error instanceof StoreError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  console.error("Role request failed", error);
  return NextResponse.json({ ok: false, error: "Roles are having trouble right now. Please try again." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const user = await requireStoreUser(request);
    return NextResponse.json({ ok: true, state: await getRoleState(user.discordId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** { roleId, add } for selector roles, or { itemId, equip } for shop color roles. */
export async function POST(request: Request) {
  try {
    const user = await requireStoreUser(request);
    if (!allowChange(user.discordId)) throw new RoleError("Slow down a little, then try again.", 429);
    const body = await readJson(request);
    let message: string;
    if (typeof body.itemId === "string") {
      message = (body.equip ? await equipRole(user.discordId, body.itemId) : await unequipRole(user.discordId, body.itemId)).message;
    } else if (typeof body.roleId === "string") {
      await setSelfRole(user.discordId, body.roleId, Boolean(body.add));
      message = body.add ? "Role added." : "Role removed.";
    } else {
      throw new RoleError("Nothing to change.");
    }
    return NextResponse.json({ ok: true, message, state: await getRoleState(user.discordId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
