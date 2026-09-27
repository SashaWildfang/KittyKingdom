import { redirect } from "next/navigation";
import { pendingTwoFactorUser } from "../../../lib/two-factor-login";
import { TwoFactorForm } from "./two-factor-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Two-factor sign in | Kitty Kingdom" };

const ERRORS: Record<string, string> = {
  wrong: "That code didn't work. Check your authenticator app and try the newest code.",
  locked: "Too many wrong codes. Please wait a few minutes before trying again.",
  unavailable: "Sign-in is having trouble right now. Please try again.",
};

export default async function TwoFactorPage({ searchParams }: { searchParams: { error?: string; mode?: string } }) {
  const user = await pendingTwoFactorUser();
  if (!user) redirect("/login?login=2fa-expired");
  const email = String(user.email ?? "");
  const masked = email.replace(/^(.)(.*)(@.*)$/, (_m, a: string, b: string, c: string) => `${a}${"•".repeat(Math.min(6, b.length))}${c}`);
  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <TwoFactorForm account={masked} error={searchParams.error ? ERRORS[searchParams.error] ?? null : null} startMode={searchParams.mode === "backup" ? "backup" : "app"} />
    </main>
  );
}
