import { Heart, Link2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { datingAccess } from "../../lib/dating/access";
import { getDiscordInviteSummary } from "../../lib/discord";
import { FallingLeaves } from "../fall-effects";
import { SiteNav } from "../site-nav";
import { DatingNav } from "./dating-nav";
import "./dating.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dating | Kitty Kingdom", robots: { index: false } };

/** Every Dating page: 18+ Verified members only, with the Dating tabs on top. */
export default async function DatingLayout({ children }: { children: ReactNode }) {
  const [access, discord] = await Promise.all([datingAccess(), getDiscordInviteSummary()]);
  const signedIn = !(!access.ok && access.reason === "signed-out");
  return (
    <main className="site-shell dt-shell">
      <FallingLeaves foreground={false} />
      <SiteNav signedIn={signedIn} discordOnline={discord.online} />
      {access.ok ? (
        <div className="dt">
          <DatingNav />
          {children}
        </div>
      ) : (
        <Gate reason={access.reason} />
      )}
    </main>
  );
}

function Gate({ reason }: { reason: "signed-out" | "unlinked" | "not-adult" | "not-member" }) {
  const copy = {
    "signed-out": { icon: <Heart size={34} />, title: "Find your someone in the kingdom", text: "Log in to browse profiles, match and chat with other 18+ verified members.", cta: { href: "/login", label: "Log in" } },
    unlinked: { icon: <Link2 size={34} />, title: "Link your Discord first", text: "Dating is tied to your Discord account so everyone here is a real, verified member. Grab a code on My Account and run /link in the server.", cta: { href: "/account#discord-account", label: "Link Discord" } },
    "not-member": { icon: <Link2 size={34} />, title: "Join the server first", text: "Dating is for members of the Kitty Kingdom Discord.", cta: { href: "/join?via=dating", label: "Join the Discord" } },
    "not-adult": { icon: <ShieldCheck size={34} />, title: "18+ Verified members only", text: "To keep everyone safe, Dating is only open to members with the 18+ Verified role. Open a verification ticket in #nsfw-verify in the server, then come back here.", cta: { href: "/faq#start", label: "How to get verified" } },
  }[reason];
  return (
    <section className="dt-gate">
      <span className="dt-gate-icon">{copy.icon}</span>
      <h1>{copy.title}</h1>
      <p>{copy.text}</p>
      <a className="dt-btn dt-btn--big" href={copy.cta.href}>
        {copy.cta.label}
      </a>
    </section>
  );
}
