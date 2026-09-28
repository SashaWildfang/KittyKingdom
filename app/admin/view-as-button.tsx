"use client";

import { Eye } from "lucide-react";
import { useState } from "react";

/** "View site as this member" for admins, on a member's full profile. */
export function ViewAsButton({ accountId, discordId }: { accountId?: string; discordId?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="adm-viewas">
      <button
        type="button"
        className="adm-viewas-btn"
        disabled={busy}
        title="See the site exactly as they do, read only. Switch members or exit from the bar at the bottom."
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/admin/view-as", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(accountId ? { accountId } : { discordId }),
          });
          const body = await res.json().catch(() => ({}));
          if (body.ok) window.location.href = body.redirect ?? "/account";
          else {
            setBusy(false);
            setError(body.error ?? "That didn't work.");
          }
        }}
      >
        <Eye size={13} aria-hidden="true" /> {busy ? "Opening…" : "View as"}
      </button>
      {error ? <p className="adm-error">{error}</p> : null}
    </div>
  );
}
