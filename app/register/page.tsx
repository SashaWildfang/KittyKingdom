import { AuthCard, type AuthStatus } from "../auth-card";
import { pendingRegistration } from "../../lib/registration";
import { RegisterLink } from "./register-link";
import { BLOCKED_EMAIL_MESSAGE } from "../../lib/validate";

export const dynamic = "force-dynamic";

const statusMessages: Record<string, string> = {
  "check-email":
    "Check your inbox for the confirmation link before logging in.",
  "terms-required":
    "You must accept the Terms of Service and Privacy Policy before signing up.",
  "password-requirements":
    "Password must be 8+ characters and include at least one number and one symbol.",
  "email-exists": "An account already exists for that email.",
  "discord-required": "Accounts are for members of the Kitty Kingdom Discord. After confirming your email, you'll link yours with /link.",
  "email-required": "Enter a valid email address.",
  "email-blocked": BLOCKED_EMAIL_MESSAGE,
  "too-many": "Too many sign-ups from your network. Please try again in an hour.",
  "email-provider-needed":
    "The account was created, but the confirmation email could not be sent. Check the email provider settings.",
  "service-unavailable":
    "Registration is temporarily unavailable. Please try again shortly.",
  "database-unreachable":
    "The account database is not reachable right now. Please try again after the database network settings are updated.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { register?: string; step?: string };
}) {
  // Steps 2 and 3: confirm the email, then link Discord with /link (only verified server members can finish signing up)
  if (searchParams.step === "link" && (await pendingRegistration().catch(() => null))) {
    return (
      <main className="auth-screen">
        <div className="auth-backdrop" />
        <RegisterLink />
      </main>
    );
  }
  const status = searchParams.register;

  const registerStatus: AuthStatus =
    status && statusMessages[status] ? { text: statusMessages[status], tone: status === "check-email" ? "info" : "error" } : null;

  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <AuthCard initialMode="register" loginStatus={null} registerStatus={registerStatus} identifier="" />
    </main>
  );
}
