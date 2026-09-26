import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { getStoreState, type StoreState } from "../../lib/store";
import { SiteNav } from "../site-nav";
import { StoreClient } from "./store-client";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

function DiscordIcon() {
  return (
    <svg viewBox="0 0 127.14 96.36" width="22" height="22" aria-hidden="true" fill="currentColor">
      <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z" />
    </svg>
  );
}

export default async function StorePage() {
  const [user, discord] = await Promise.all([getCurrentUser(), getDiscordInviteSummary()]);
  if (!user) redirect("/login?account=login-required");

  const discordId = user.discordId ? String(user.discordId) : null;
  let state: StoreState | null = null;
  let loadError = false;
  if (discordId) {
    try {
      state = await getStoreState(discordId);
    } catch (error) {
      console.error("Store failed to load", error);
      loadError = true;
    }
  }

  return (
    <main className="site-shell store-shell">
      <div className="leaf-field" aria-hidden="true" />
      <SiteNav signedIn discordOnline={discord.online} />

      {!discordId ? (
        // Signed in, but Discord isn't linked: the store needs it for balances, roles and inventory
        <section className="store-gate">
          <div className="store-gate-card">
            <span className="store-gate-icon">
              <DiscordIcon />
            </span>
            <p className="eyebrow">Leaf Shop</p>
            <h1>Link Discord to start shopping</h1>
            <p>
              The store uses your Discord account for your leaf balance, roles, boosters and gifts. Link it once and
              everything you buy here shows up in the server too.
            </p>
            <div className="store-gate-actions">
              <a className="discord-link-button" href="/api/auth/discord">
                <DiscordIcon /> Link Discord
              </a>
              <a className="store-ghost-button" href="/account">
                Back to My Account
              </a>
            </div>
          </div>
        </section>
      ) : loadError || !state ? (
        <section className="store-gate">
          <div className="store-gate-card">
            <p className="eyebrow">Leaf Shop</p>
            <h1>The store is taking a nap</h1>
            <p>We couldn&apos;t load the store right now. Please refresh in a moment.</p>
          </div>
        </section>
      ) : !state.inServer ? (
        <section className="store-gate">
          <div className="store-gate-card">
            <p className="eyebrow">Leaf Shop</p>
            <h1>Join the server to shop</h1>
            <p>Your linked Discord account isn&apos;t in the Kitty Kingdom server. Join it to use the store.</p>
            <div className="store-gate-actions">
              <a className="discord-link-button" href="https://discord.com/invite/M9XKHFdYQV">
                <DiscordIcon /> Join Kitty Kingdom
              </a>
            </div>
          </div>
        </section>
      ) : (
        <StoreClient initialState={state} />
      )}
    </main>
  );
}
