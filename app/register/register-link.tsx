"use client";

import { Check, Copy, ExternalLink, Mail, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type State =
  | { state: "waiting" | "not-member"; code: string | null; expiresAt: string | null; email: string }
  | { state: "done"; discordName: string; email: string; emailSent: boolean }
  | { state: "gone" };

const DISCORD_INVITE = "https://discord.com/invite/M9XKHFdYQV";

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Step 2 of signing up: link a verified Discord account with /link CODE. The page checks every
 * couple of seconds and moves on by itself the moment the bot links it.
 */
export function RegisterLink() {
  const [data, setData] = useState<State | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "command" | null>(null);
  const [resent, setResent] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/account/register/status", { cache: "no-store" });
      const body = (await res.json()) as State & { ok: boolean };
      if (body.ok) setData(body);
    } catch {
      // keep the last known state
    }
  }, []);

  useEffect(() => {
    void check();
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [check]);

  const waiting = data?.state === "waiting" || data?.state === "not-member";
  useEffect(() => {
    if (!waiting) return;
    const poll = window.setInterval(() => document.visibilityState === "visible" && void check(), 2000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [waiting, check]);

  async function newCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/register/code", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Couldn't get a code.");
      await check();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get a code.");
    } finally {
      setBusy(false);
    }
  }

  async function resend(email: string) {
    const res = await fetch("/api/account/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: email }) }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    setResent(body?.message ?? "If that address needs verifying, a new link is on its way.");
  }

  function copy(what: "code" | "command", code: string) {
    void navigator.clipboard?.writeText(code.replace("-", "")).then(() => {
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1400);
    });
  }

  const step = data?.state === "done" ? 3 : 2;

  return (
    <div className="reg">
      <header className="reg-head">
        <img src="/logo.png" alt="" width={56} height={56} />
        <div>
          <p className="reg-kicker">Create your account</p>
          <h1>{step === 3 ? "You're verified!" : "Verify you're in the server"}</h1>
        </div>
      </header>

      <ol className="reg-steps" aria-label="Sign-up steps">
        <li className="is-done">
          <span>
            <Check size={14} strokeWidth={3} />
          </span>{" "}
          Account details
        </li>
        <li className={step === 2 ? "is-current" : "is-done"}>
          <span>{step > 2 ? <Check size={14} strokeWidth={3} /> : "2"}</span> Link Discord
        </li>
        <li className={step === 3 ? "is-current" : undefined}>
          <span>3</span> Confirm email
        </li>
      </ol>

      {!data ? <div className="reg-skeleton" aria-label="Loading" /> : null}

      {data?.state === "gone" ? (
        <div className="reg-card">
          <p>We couldn&apos;t find your sign-up. It may have expired.</p>
          <div className="reg-actions">
            <a className="reg-btn reg-btn--primary" href="/register">
              Start again
            </a>
            <a className="reg-btn" href="/login">
              Log in
            </a>
          </div>
        </div>
      ) : null}

      {data && (data.state === "waiting" || data.state === "not-member") ? (
        (() => {
          const expires = data.expiresAt ? new Date(data.expiresAt).getTime() : 0;
          const left = expires - now;
          const live = Boolean(data.code && left > 0);
          return (
            <div className="reg-card">
              <p className="reg-lead">
                Only members of the Kitty Kingdom Discord can make an account. Use your code with <code>/link</code> <b>in the server</b> to prove it&apos;s you,
                and this page will move on by itself.
              </p>

              {data.state === "not-member" ? (
                <p className="reg-alert">
                  <ShieldAlert size={16} aria-hidden="true" /> That Discord account isn&apos;t a verified member yet. Finish the join application in the server
                  (wait for staff to accept it), then get a new code and try again.
                </p>
              ) : null}

              {live ? (
                <>
                  <div className="reg-code">
                    <button type="button" className="reg-code-value" onClick={() => copy("code", data.code!)} title="Click to copy the code">
                      {data.code}
                    </button>
                    <span className={`reg-timer${left < 60_000 ? " is-low" : ""}`}>{mmss(left)}</span>
                  </div>
                  <div className="reg-actions">
                    <button type="button" className="reg-btn reg-btn--primary" onClick={() => copy("code", data.code!)}>
                      {copied === "code" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} {copied === "code" ? "Code copied!" : "Copy code"}
                    </button>
                    <a className="reg-btn" href={DISCORD_INVITE} target="_blank" rel="noreferrer">
                      <ExternalLink size={15} aria-hidden="true" /> Open Discord
                    </a>
                  </div>
                  <ol className="reg-how">
                    <li>
                      In the server, type <code>/link</code> and choose the command when it pops up.
                    </li>
                    <li>Paste your code into the <b>code</b> box and press Enter.</li>
                  </ol>
                  <p className="reg-wait" aria-live="polite">
                    <i aria-hidden="true" />
                    <span>Waiting for you to link… this page updates by itself.</span>
                  </p>
                </>
              ) : (
                <div className="reg-expired">
                  <p>{data.code ? "That code expired." : "Get a code to link your Discord."}</p>
                  <button type="button" className="reg-btn reg-btn--primary" onClick={() => void newCode()} disabled={busy}>
                    <RefreshCw size={15} aria-hidden="true" /> {busy ? "Getting a code…" : "Get a new code"}
                  </button>
                </div>
              )}
              {live && data.state !== "not-member" ? (
                <button type="button" className="reg-link" onClick={() => void newCode()} disabled={busy}>
                  Need a different code?
                </button>
              ) : null}
              {error ? <p className="reg-alert">{error}</p> : null}

              <details className="reg-help">
                <summary>Not in the server yet?</summary>
                <p>
                  <a href={DISCORD_INVITE} target="_blank" rel="noreferrer">
                    Join Kitty Kingdom
                  </a>
                  , fill in the verification form and wait for staff to accept it. Then come back here (your sign-up is saved for a day) and run the command.
                </p>
              </details>
            </div>
          );
        })()
      ) : null}

      {data?.state === "done" ? (
        <div className="reg-card reg-card--done">
          <span className="reg-done-check" aria-hidden="true">
            <Check size={30} strokeWidth={3} />
          </span>
          <p className="reg-lead">
            Linked to <b>{data.discordName}</b>. One last step: we sent a confirmation link to <b>{data.email}</b>. Open it, then log in.
          </p>
          <div className="reg-actions">
            <a className="reg-btn reg-btn--primary" href="/login">
              Go to log in
            </a>
            <button type="button" className="reg-btn" onClick={() => void resend(data.email)}>
              <Mail size={15} aria-hidden="true" /> Resend email
            </button>
          </div>
          {resent ? <p className="reg-note">{resent}</p> : !data.emailSent ? <p className="reg-note">Didn&apos;t get it? Check spam, or press Resend email.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
