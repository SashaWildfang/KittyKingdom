// Labels for the email log (shared by the server and Admin → Emails).

export const EMAIL_KINDS: Record<string, string> = {
  verification: "Confirm email",
  "verification-reminder": "Confirm-email reminder",
  "password-reset": "Password reset",
  security: "Security notice",
  "discord-reminder": "Link Discord reminder",
  "appeal-received": "Appeal received",
  "appeal-decision": "Appeal decision",
  "ban-closed": "Ban: account closed",
  other: "Other",
};

export type EmailRow = { id: string; to: string; subject: string; kind: string; sent: boolean; error: string | null; at: string };
