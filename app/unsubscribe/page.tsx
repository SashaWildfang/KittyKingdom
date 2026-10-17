import type { Metadata } from "next";
import Link from "next/link";
import { checkUnsubscribe } from "../../lib/email-prefs";
import { EMAIL_PREF_LABELS, type EmailPrefKey } from "../../lib/email-prefs-shared";
import { SiteLogo } from "../ui-icons";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata: Metadata = { title: "Unsubscribe | Bear Nation", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Where the "Turn off … emails" link in a notification email lands. Needs a press, so link scanners can't unsubscribe anyone. */
export default async function UnsubscribePage({ searchParams }: { searchParams: { u?: string; k?: string; s?: string } }) {
  const u = searchParams.u ?? "";
  const k = searchParams.k ?? "";
  const s = searchParams.s ?? "";
  const valid = checkUnsubscribe(u, k, s);
  const what = k === "all" ? "all notification emails" : `${(EMAIL_PREF_LABELS[k as EmailPrefKey] ?? "these").toLowerCase()} emails`;
  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card minehut-card">
        <Link className="auth-logo" href="/" aria-label="Bear Nation home">
          <SiteLogo className="auth-logo-img" alt="Bear Nation logo" />
        </Link>
        <h1>Email settings</h1>
        {valid ? (
          <UnsubscribeButton query={`u=${encodeURIComponent(u)}&k=${encodeURIComponent(k)}&s=${encodeURIComponent(s)}`} what={what} />
        ) : (
          <p className="auth-status">That link isn&apos;t valid any more. You can change every email in Settings after logging in.</p>
        )}
        <Link className="auth-help" href="/settings#email">
          Choose exactly which emails you get in Settings → Email
        </Link>
      </section>
    </main>
  );
}
