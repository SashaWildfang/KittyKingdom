import { redirect } from "next/navigation";
import { getPanelUser } from "../../lib/admin";
import { getCurrentUser } from "../../lib/auth";
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
        <AdminClient adminName={panel.name} level={panel.level} canDeleteNsfw={canDeleteNsfwTickets(panel.discordId)} />
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
