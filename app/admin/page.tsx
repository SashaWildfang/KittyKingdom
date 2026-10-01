import { redirect } from "next/navigation";
import { getPanelUser } from "../../lib/admin";
import { getCurrentUser, getRealUser } from "../../lib/auth";
import { ShieldAlert } from "lucide-react";
import { getDiscordInviteSummary } from "../../lib/discord";
import { SiteNav } from "../site-nav";
import { canDeleteNsfwTickets } from "../../lib/ticket-delete";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin | Kitty Kingdom" };

export default async function AdminPage() {
  const [user, discord] = await Promise.all([getCurrentUser(), getDiscordInviteSummary()]);
  if (!user) redirect("/login?account=login-required");
  const panel = await getPanelUser();

  return (
    <main className="site-shell admin-shell">
      <SiteNav signedIn discordOnline={discord.online} />
      {panel ? (
        <>
          {/* Destructive actions need the admin's own 2FA (checked on the server too) */}
          {!(await getRealUser())?.twoFactor?.enabled ? (
            <div className="adm-2fa-banner" role="note">
              <ShieldAlert size={18} aria-hidden="true" />
              <p>
                <b>Two-factor authentication is off.</b> You can view everything, but deleting, removing, resetting and banning need it turned on.{" "}
                <a href="/account#security">Turn it on in My Account → Security</a>.
              </p>
            </div>
          ) : null}
          <AdminClient adminName={panel.name} level={panel.level} canDeleteNsfw={canDeleteNsfwTickets(panel.discordId)} />
        </>
      ) : (
        <section className="store-gate">
          <div className="store-gate-card">
            <p className="eyebrow">Admin</p>
            <h1>Staff only</h1>
            <p>
              This area is for the Kitty Kingdom staff team.{" "}
              {user.discordId ? "Your linked Discord account isn't on the Staff Team." : "Link your Discord account on My Account first."}
            </p>
            <div className="store-gate-actions">
              <a className="store-ghost-button" href="/account">
                Back to My Account
              </a>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
