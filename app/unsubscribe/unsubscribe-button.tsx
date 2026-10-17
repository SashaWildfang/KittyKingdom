"use client";

import { useState } from "react";

export function UnsubscribeButton({ query, what }: { query: string; what: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  if (state === "done") {
    return (
      <p className="auth-status">
        Done. You won&apos;t get {what} any more. Security and account emails (like password resets) still come through.
      </p>
    );
  }
  return (
    <>
      <p>Turn off {what}? You can turn them back on any time in Settings.</p>
      {error ? <p className="auth-status">{error}</p> : null}
      <div className="auth-form">
      <button
        type="button"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const res = await fetch(`/api/email/unsubscribe?${query}`, { method: "POST" }).then((r) => r.json()).catch(() => null);
          if (res?.ok) setState("done");
          else {
            setError(res?.error ?? "That didn't work. Try again.");
            setState("error");
          }
        }}
      >
        {state === "busy" ? "Turning off…" : `Turn off ${what}`}
      </button>
      </div>
    </>
  );
}
