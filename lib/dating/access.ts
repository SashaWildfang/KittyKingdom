// Who can use Dating on the website: signed in, Discord linked, and holding the 18+ Verified role
// (the same rule the dating bot uses). Boosters (Nitro role) get unlimited likes and see every liker.

import { getCurrentUser } from "../auth";
import { memberRoleIdsCached } from "../discord-member";
import { ADULT_ROLE_ID, NITRO_ROLE_ID } from "./schema-data";

export type DatingAccess =
  | { ok: true; discordId: string; booster: boolean; userId: string; name: string }
  | { ok: false; reason: "signed-out" | "unlinked" | "not-adult" | "not-member" };

export async function datingAccess(): Promise<DatingAccess> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { ok: false, reason: "signed-out" };
  if (!user.discordId) return { ok: false, reason: "unlinked" };
  const discordId = String(user.discordId);
  const roles = await memberRoleIdsCached(discordId).catch(() => null);
  if (!roles) return { ok: false, reason: "not-member" };
  if (!roles.includes(ADULT_ROLE_ID)) return { ok: false, reason: "not-adult" };
  return {
    ok: true,
    discordId,
    booster: roles.includes(NITRO_ROLE_ID),
    userId: String(user._id),
    name: String(user.displayName ?? user.username ?? "Member"),
  };
}

/** Quick yes/no for the Dating tab in the site header. */
export async function canSeeDating(discordId: string | null | undefined) {
  if (!discordId) return false;
  const roles = await memberRoleIdsCached(String(discordId)).catch(() => null);
  return Boolean(roles?.includes(ADULT_ROLE_ID));
}
