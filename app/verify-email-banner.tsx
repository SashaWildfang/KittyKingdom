"use client";

import { Mail } from "lucide-react";
import { useState } from "react";

export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    if (state === "sending") return;
    setState("sending");
    try {
      const response = await fetch("/api/account/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? "Verification email sent. Check your inbox.");
    } catch {
      setMessage("Couldn't send the email right now. Please try again in a moment.");
    }
    setState("done");
  }

  return (
    <div className="acct-verify-banner" role="status">
      <span className="acct-verify-icon" aria-hidden="true"><Mail size={22} /></span>
      <div>
        <strong>Please verify your email address</strong>
        <p>{message ?? `We sent a confirmation link to ${email}. Didn't get it? Check spam, or send a new one.`}</p>
      </div>
      <button className="acct-button" type="button" onClick={resend} disabled={state === "sending"}>
        {state === "sending" ? "Sending..." : state === "done" ? "Send again" : "Resend email"}
      </button>
    </div>
  );
}
