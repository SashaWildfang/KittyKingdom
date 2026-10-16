// Who can run giveaways: admins, and Community Managers within limits (Admin → Bots → Main Bot → Giveaways).
// A Community Manager's giveaway that goes over a limit waits for an admin to approve it.

import { NextResponse } from "next/server";
import { COMMUNITY_MANAGER_ROLE_ID, getPanelUser, requirePanel, type PanelUser } from "./admin";
import { botNumber, botValue } from "./bot-settings/live";
import { memberRoleIdsCached } from "./discord-member";

export type GiveawayManager = PanelUser & { isAdmin: boolean };

async function isCommunityManager(discordId: string) {
  const roles = await memberRoleIdsCached(discordId).catch(() => null);
  return Boolean(roles?.includes(COMMUNITY_MANAGER_ROLE_ID));
}

/** For pages: whether the signed-in member can manage giveaways (admin or Community Manager). */
export async function canManageGiveaways(panel?: PanelUser | null) {
  const p = panel === undefined ? await getPanelUser().catch(() => null) : panel;
  if (!p) return false;
  return p.level === "admin" || (await isCommunityManager(p.discordId));
}

/** For API routes: the admin or Community Manager, or an error response to return. */
export async function requireGiveawayManager(request: Request): Promise<GiveawayManager | NextResponse> {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  if (panel.level === "admin") return { ...panel, isAdmin: true };
  if (await isCommunityManager(panel.discordId)) return { ...panel, isAdmin: false };
  return NextResponse.json({ ok: false, error: "Only admins and Community Managers can manage giveaways." }, { status: 403 });
}

export type CmLimits = {
  maxLeaves: number;
  maxXp: number;
  maxItemPrice: number;
  maxWinners: number;
  maxTotal: number;
  weeklyBudget: number;
  customNeedsApproval: boolean;
};

export const CM_DEFAULTS: CmLimits = { maxLeaves: 10_000, maxXp: 2_500, maxItemPrice: 15_000, maxWinners: 10, maxTotal: 25_000, weeklyBudget: 75_000, customNeedsApproval: true };

/** The limits for Community Managers' giveaways (set in Admin → Bots → Main Bot → Giveaways). */
export async function cmLimits(): Promise<CmLimits> {
  const [maxLeaves, maxXp, maxItemPrice, maxWinners, maxTotal, weeklyBudget, custom] = await Promise.all([
    botNumber("main", "giveaways.cmMaxLeaves", CM_DEFAULTS.maxLeaves),
    botNumber("main", "giveaways.cmMaxXp", CM_DEFAULTS.maxXp),
    botNumber("main", "giveaways.cmMaxItemPrice", CM_DEFAULTS.maxItemPrice),
    botNumber("main", "giveaways.cmMaxWinners", CM_DEFAULTS.maxWinners),
    botNumber("main", "giveaways.cmMaxTotal", CM_DEFAULTS.maxTotal),
    botNumber("main", "giveaways.cmWeeklyBudget", CM_DEFAULTS.weeklyBudget),
    botValue("main", "giveaways.cmCustomApproval"),
  ]);
  return { maxLeaves, maxXp, maxItemPrice, maxWinners, maxTotal, weeklyBudget, customNeedsApproval: custom !== false };
}
