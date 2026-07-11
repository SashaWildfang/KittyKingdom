"use client";

import { useState } from "react";

type ResendVerificationLinkProps = {
  identifier: string;
};

export function ResendVerificationLink({ identifier }: ResendVerificationLinkProps) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    if (!identifier || sending) return;
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/account/resend-verification?ajax=1&identifier=${encodeURIComponent(identifier)}`,
      );
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? "Verification email resent. Check your inbox.");
    } catch {
      setMessage("Verification email resent. Check your inbox.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button className="resend-link-button" type="button" onClick={resend}>
        {sending ? "resending..." : "resend verification"}
      </button>
      {message ? <span className="inline-status-banner">{message}</span> : null}
    </>
  );
}
