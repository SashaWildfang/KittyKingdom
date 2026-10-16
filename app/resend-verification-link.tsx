"use client";

import { useState } from "react";
import { showNotice } from "./confirm-dialog";

type ResendVerificationLinkProps = {
  identifier: string;
};

export function ResendVerificationLink({ identifier }: ResendVerificationLinkProps) {
  const [sending, setSending] = useState(false);

  async function resend() {
    if (!identifier || sending) return;
    setSending(true);
    try {
      const response = await fetch("/api/account/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier }),
      });
      const data = (await response.json()) as { message?: string };
      await showNotice(data.message ?? "Verification email resent. Check your inbox.");
    } catch {
      await showNotice("Verification email resent. Check your inbox.");
    } finally {
      setSending(false);
    }
  }

  return (
    <button className="resend-link-button" type="button" onClick={resend}>
      {sending ? "resending..." : "resend verification"}
    </button>
  );
}
