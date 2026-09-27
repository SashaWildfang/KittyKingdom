import { redirect } from "next/navigation";
import { getAdminUser } from "../../lib/admin";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { SiteNav } from "../site-nav";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin | Kitty Kingdom" };

export default async function AdminPage() {
  const [user, discord] = await Promise.all([getCurrentUser(), getDiscordInviteSummary()]);
  if (!user) redirect("/login?account=login-required");
  const admin = await getAdminUser();

  return (
    <main className="site-shell admin-shell">
      <SiteNav signedIn discordOnline={discord.online} />
      {admin ? (
        <AdminClient adminName={admin.name} />
      ) : (
        <section className="store-gate">
          <div className="store-gate-card">
            <p className="eyebrow">Admin</p>
            <h1>Admins only</h1>
            <p>
              This area is for Kitty Kingdom Admins and the Owner.{" "}
              {user.discordId ? "Your linked Discord account doesn't have an admin role." : "Link your Discord account on My Account first."}
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
