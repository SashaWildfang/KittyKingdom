import { redirect } from "next/navigation";
import { canViewStaffPage, getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { getStaffDirectory } from "../../lib/staff";
import { SiteNav } from "../site-nav";
import { StaffView } from "./staff-view";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  // Members only: signed in, email verified and Discord linked
  const user = await getCurrentUser();
  if (!user) redirect("/login?account=login-required");
  if (user.emailVerified === false) redirect("/account?account=staff-verify-required");
  if (!canViewStaffPage(user)) redirect("/account?account=staff-link-required#discord-account");
  const [discord, directory] = await Promise.all([getDiscordInviteSummary(), getStaffDirectory()]);

  return <StaffView directory={directory} nav={<SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />} />;
}
