import { AuthCard, type AuthStatus } from "../auth-card";

const statusMessages: Record<string, string> = {
  "check-email":
    "Check your inbox for the confirmation link before logging in.",
  "terms-required":
    "You must accept the Terms of Service and Privacy Policy before signing up.",
  "password-requirements":
    "Password must be 8+ characters and include at least one number and one symbol.",
  "email-exists": "An account already exists for that email.",
  "email-provider-needed":
    "The account was created, but the confirmation email could not be sent. Check the email provider settings.",
  "service-unavailable":
    "Registration is temporarily unavailable. Please try again shortly.",
  "database-unreachable":
    "The account database is not reachable right now. Please try again after the database network settings are updated.",
};

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { register?: string };
}) {
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
