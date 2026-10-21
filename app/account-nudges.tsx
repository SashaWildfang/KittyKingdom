"use client";

// A gentle reminder after signing in, one at a time and at most once per visit: pick a username (it can be
// set right here), or refresh a Social profile that hasn't changed in months. "Later" hides it for a week,
// "Don't ask again" for good (saved on the account by /api/account/nudges).

import "./account-nudges.css";
import { AtSign, HeartHandshake, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Due = { kind: "username" | "social"; updatedAt?: string | null };
const SESSION_KEY = "kk-nudges-shown";
// Pages where a popup would get in the way
const QUIET = /^\/(login|register|verify|password|account\/delete|join)/;

function ago(iso: string | null | undefined) {
  if (!iso) return "a long time ago";
  const months = Math.floor((Date.now() - new Date(iso).getTime()) / (30 * 86_400_000));
  return months >= 12 ? `over ${Math.floor(months / 12)} year${months >= 24 ? "s" : ""} ago` : `${months} month${months === 1 ? "" : "s"} ago`;
}

export function AccountNudges() {
  const [due, setDue] = useState<Due | null>(null);

  useEffect(() => {
    if (QUIET.test(window.location.pathname)) return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // private mode: just check
    }
    const t = window.setTimeout(() => {
      fetch("/api/account/nudges", { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => {
          const next = (r?.due as Due[] | undefined)?.[0];
          if (!next) return;
          try {
            window.sessionStorage.setItem(SESSION_KEY, "1");
          } catch {
            // fine
          }
          setDue(next);
        })
        .catch(() => undefined);
    }, 2500);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = (action: "later" | "never") => {
    if (due) void fetch("/api/account/nudges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: due.kind, action }) }).catch(() => null);
    setDue(null);
  };

  useEffect(() => {
    if (!due) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && dismiss("later");
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due]);

  if (!due) return null;
  return createPortal(
    <div className="nudge-wrap" onMouseDown={(e) => e.target === e.currentTarget && dismiss("later")}>
      <div className="nudge" role="dialog" aria-modal="true" aria-labelledby="nudge-title">
        <button type="button" className="nudge-close" onClick={() => dismiss("later")} aria-label="Close">
          <X size={18} />
        </button>
        {due.kind === "username" ? <UsernameNudge onDone={() => setDue(null)} onLater={() => dismiss("later")} onNever={() => dismiss("never")} /> : null}
        {due.kind === "social" ? (
          <>
            <span className="nudge-icon" aria-hidden="true">
              <HeartHandshake size={24} />
            </span>
            <h2 id="nudge-title">Time to freshen up your Social profile?</h2>
            <p>You last updated it {ago(due.updatedAt)}. New photos, prompts or a quick bio refresh help people find you and know what you&apos;re into now.</p>
            <div className="nudge-actions">
              <a className="nudge-primary" href="/social/profile" onClick={() => dismiss("later")}>
                Update my profile
              </a>
              <button type="button" className="nudge-ghost" onClick={() => dismiss("later")}>
                Later
              </button>
            </div>
            <button type="button" className="nudge-never" onClick={() => dismiss("never")}>
              Don&apos;t remind me again
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function UsernameNudge({ onDone, onLater, onNever }: { onDone: () => void; onLater: () => void; onNever: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const clean = name.trim().toLowerCase();
  const valid = /^[a-z0-9_]{3,20}$/.test(clean);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const form = new FormData();
    form.set("newUsername", clean);
    form.set("confirmUsername", clean);
    // The username form answers with a redirect to /account?account=<status>
    const res = await fetch("/api/account/username", { method: "POST", body: form }).catch(() => null);
    const status = res ? new URL(res.url).searchParams.get("account") : null;
    setBusy(false);
    if (status === "username-saved") {
      setMsg({ ok: true, text: `Saved! You're @${clean} now.` });
      window.setTimeout(onDone, 1400);
    } else {
      setMsg({ ok: false, text: status === "username-taken" ? "That username is taken. Try another." : status === "username-locked" ? "You already have a username." : "Use 3 to 20 letters, numbers or underscores." });
    }
  };

  return (
    <>
      <span className="nudge-icon" aria-hidden="true">
        <AtSign size={24} />
      </span>
      <h2 id="nudge-title">Pick a username</h2>
      <p>It&apos;s how people find and mention you around the site. You can only set it once, so choose one you like.</p>
      <form
        className="nudge-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) void save();
        }}
      >
        <label className="nudge-input">
          <span>@</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value.replace(/\s/g, ""))} maxLength={20} placeholder="your_username" aria-label="Username" autoComplete="username" />
        </label>
        <small className={valid || !name ? "" : "is-bad"}>3–20 letters, numbers or underscores</small>
        {msg ? <p className={msg.ok ? "nudge-ok" : "nudge-bad"}>{msg.text}</p> : null}
        <div className="nudge-actions">
          <button type="submit" className="nudge-primary" disabled={!valid || busy}>
            {busy ? "Saving…" : "Save username"}
          </button>
          <button type="button" className="nudge-ghost" onClick={onLater}>
            Skip for now
          </button>
        </div>
      </form>
      <button type="button" className="nudge-never" onClick={onNever}>
        Don&apos;t ask me again
      </button>
    </>
  );
}
