"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Status = { linked: boolean; discordName?: string; code?: string | null; expiresAt?: string | null };

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "Get code" → type /link CODE in Discord → this card notices and flips to linked by itself. */
export function DiscordLinkCode() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [total, setTotal] = useState(10 * 60_000);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedAs, setLinkedAs] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "command" | null>(null);

  const expired = expiresAt !== null && now >= expiresAt;
  const waiting = Boolean(code && expiresAt && !expired && !linkedAs);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/account/link-code", { cache: "no-store" });
      const body = (await res.json()) as Status & { ok: boolean };
      if (!body.ok) return;
      if (body.linked) {
        setLinkedAs(body.discordName ?? "your Discord");
        window.setTimeout(() => router.refresh(), 1400);
      } else if (body.code && body.expiresAt) {
        setCode(body.code);
        setExpiresAt(new Date(body.expiresAt).getTime());
      }
    } catch {
      // keep waiting
    }
  }, [router]);

  // Pick up a code made earlier (e.g. after a refresh)
  useEffect(() => {
    void check();
  }, [check]);

  // Countdown + live check while a code is waiting to be used
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!waiting) return;
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 2500);
    return () => window.clearInterval(poll);
  }, [waiting, check]);

  async function getCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/link-code", { method: "POST" });
      const body = (await res.json()) as { ok: boolean; code?: string; expiresAt?: string; error?: string };
      if (!res.ok || !body.ok || !body.code || !body.expiresAt) throw new Error(body.error ?? "Couldn't get a code.");
      const exp = new Date(body.expiresAt).getTime();
      setCode(body.code);
      setExpiresAt(exp);
      setTotal(exp - Date.now());
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get a code.");
    } finally {
      setBusy(false);
    }
  }

  function copy(what: "code" | "command") {
    if (!code) return;
    void navigator.clipboard?.writeText(what === "code" ? code : `/link ${code}`).then(() => {
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1400);
    });
  }

  if (linkedAs) {
    return (
      <div className="link-code link-code--done" role="status">
        <span className="link-code-check" aria-hidden="true" />
        <div>
          <strong>Linked as {linkedAs}!</strong>
          <p>Unlocking your Store, Leaderboards and roles…</p>
        </div>
      </div>
    );
  }

  const left = expiresAt ? expiresAt - now : 0;
  const fraction = expiresAt ? Math.max(0, Math.min(1, left / total)) : 0;

  return (
    <div className="link-code">
      {!code || expired ? (
        <>
          {expired ? <p className="link-code-expired">That code expired. Get a new one to keep going.</p> : null}
          <ol className="link-code-steps">
            <li>Press <strong>Get code</strong>.</li>
            <li>
              In the Kitty Kingdom Discord, type <code>/link</code> and paste your code.
            </li>
            <li>This page updates by itself once you&apos;re linked.</li>
          </ol>
          <button type="button" className="link-code-get" onClick={() => void getCode()} disabled={busy}>
            {busy ? "Getting your code…" : expired ? "Get a new code" : "Get code"}
          </button>
        </>
      ) : (
        <>
          <div className="link-code-box">
            <button type="button" className="link-code-value" onClick={() => copy("code")} title="Copy code">
              {code}
            </button>
            <div className="link-code-timer" style={{ "--p": fraction } as React.CSSProperties}>
              <span>{mmss(left)}</span>
            </div>
          </div>
          <div className="link-code-row">
            <button type="button" className="acct-button" onClick={() => copy("command")}>
              {copied === "command" ? "Copied!" : `Copy /link ${code}`}
            </button>
            <button type="button" className="link-code-regen" onClick={() => void getCode()} disabled={busy}>
              New code
            </button>
          </div>
          <p className="link-code-wait">
            <i aria-hidden="true" /> Waiting for you to run <code>/link {code}</code> in the Discord…
          </p>
        </>
      )}
      {error ? <p className="link-code-error">{error}</p> : null}
      <a className="link-code-alt" href="/api/auth/discord">
        Prefer to sign in with Discord instead?
      </a>
    </div>
  );
}
