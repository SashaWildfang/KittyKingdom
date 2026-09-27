import { AuthCard, type AuthStatus } from "../auth-card";

const statusMessages: Record<string, string> = {
  invalid:
    "We couldn't sign you in. Check your email/username and password.",
  success: "You are signed in.",
  "verification-sent": "Verification email sent. Check your inbox, then log in after verifying.",
  "already-verified": "Your email address is already verified. You can log in now.",
  "email-provider-needed": "The verification email could not be sent. Please contact staff.",
  "missing-identifier": "Enter your email or username before requesting a new verification email.",
  "login-required": "Please log in before opening account settings.",
  "service-unavailable":
    "Login is temporarily unavailable. Please try again shortly.",
  "database-unreachable":
    "The account database is not reachable right now. Please try again after the database network settings are updated.",
  "missing-token": "The verification link is missing its token.",
  "invalid-or-expired":
    "That verification link has expired. Use the resend option below to get a fresh one.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: {
    login?: string;
    account?: string;
    discord?: string;
    verify?: string;
    identifier?: string;
  };
}) {
  const status =
    searchParams.login ??
    searchParams.account ??
    searchParams.discord ??
    searchParams.verify;
  const identifier = searchParams.identifier ?? "";

  const tone = status && ["success", "verification-sent", "already-verified"].includes(status) ? "success" : "error";
  const loginStatus: AuthStatus =
    status === "unverified"
      ? { text: "You haven't verified your email yet. Check your inbox or", tone: "info", unverified: true }
      : status === "login-required"
        ? { text: statusMessages[status], tone: "info" }
        : status && statusMessages[status]
          ? { text: statusMessages[status], tone }
          : null;

  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <AuthCard initialMode="login" loginStatus={loginStatus} registerStatus={null} identifier={identifier} />
    </main>
  );
}
