"use client";

import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock, Gavel, Loader2, LogOut, Mail, Search, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type Account = { id: string; username: string; name: string; avatar: string | null; banned: boolean };
type Me = { discordId: string; username: string; name: string; avatar: string | null };
type Punishment = {
  id: string;
  action: string;
  reason: string;
  at: string | null;
  expiresAt: string | null;
  active: boolean;
  appeal: { id: string; status: "pending" | "accepted" | "denied"; at: string; canAppealAgainAt: string | null } | null;
};
type MyAppeal = { id: string; reference: string; action: string; status: "pending" | "accepted" | "denied"; createdAt: string; decidedAt: string | null; response: string | null };

const ACTION: Record<string, string> = { ban: "Ban", kick: "Kick", kick_unverified: "Kick", tempmute: "Mute", mute: "Mute", timeout: "Timeout", warn: "Warning" };
const PICKED_KEY = "kk-appeal-picked";
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Unknown date");

function Face({ src, name, size = 44 }: { src: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="apl-face apl-face--letter" style={{ width: size, height: size }} aria-hidden="true">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="apl-face" src={src} alt="" width={size} height={size} onError={() => setFailed(true)} />;
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const items = ["Find your account", "Confirm it's you", "Send your appeal"];
  return (
    <ol className="apl-steps">
      {items.map((label, i) => (
        <li key={label} className={i + 1 < step ? "is-done" : i + 1 === step ? "is-on" : undefined}>
          <b>{i + 1 < step ? <Check size={13} aria-hidden="true" /> : i + 1}</b>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function StatusChip({ status }: { status: "pending" | "accepted" | "denied" }) {
  const map = { pending: { icon: Clock, label: "Under review" }, accepted: { icon: CheckCircle2, label: "Accepted" }, denied: { icon: XCircle, label: "Denied" } };
  const s = map[status];
  return (
    <span className={`apl-chip apl-chip--${status}`}>
      <s.icon size={13} aria-hidden="true" /> {s.label}
    </span>
  );
}

/** Step 1 and 2: search your name, pick your account, then sign in with Discord to prove it. */
function FindAccount() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Account[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Account | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const t = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/appeals/search?q=${encodeURIComponent(term)}`).catch(() => null);
      const body = res ? await res.json().catch(() => null) : null;
      setLoading(false);
      if (!body?.ok) {
        setError(body?.error ?? "Search isn't working right now.");
        return;
      }
      setResults(body.accounts);
    }, 350);
    return () => window.clearTimeout(t);
  }, [q]);

  if (picked) {
    return (
      <>
        <Steps step={2} />
        <section className="apl-card apl-confirm">
          <div className="apl-who">
            <Face src={picked.avatar} name={picked.name} size={64} />
            <span>
              <strong>{picked.name}</strong>
              <small>@{picked.username}</small>
            </span>
          </div>
          <h2>Confirm it&apos;s you</h2>
          <p>
            To keep everyone&apos;s record private, sign in with Discord as <b>@{picked.username}</b>. We only ask Discord for your username and avatar. You
            don&apos;t need a Kitty Kingdom account, and it works even if you&apos;re banned.
          </p>
          <a
            className="kb-btn kb-btn--primary apl-discord"
            href="/api/appeals/discord"
            onClick={() => {
              try {
                sessionStorage.setItem(PICKED_KEY, picked.id);
              } catch {
                // ignore
              }
            }}
          >
            <ShieldCheck size={17} aria-hidden="true" /> Continue with Discord
          </a>
          <button type="button" className="apl-link" onClick={() => setPicked(null)}>
            <ArrowLeft size={14} aria-hidden="true" /> That&apos;s not me
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      <Steps step={1} />
      <section className="apl-card">
        <h2>Find your Discord account</h2>
        <p className="apl-muted">Type your Discord username or display name.</p>
        <label className="apl-search">
          <Search size={17} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. sashathesnep" autoComplete="off" spellCheck={false} maxLength={40} aria-label="Discord name" autoFocus />
          {loading ? <Loader2 size={16} className="apl-spin" aria-hidden="true" /> : null}
        </label>
        {error ? <p className="apl-alert">{error}</p> : null}
        {results ? (
          results.length ? (
            <ul className="apl-results">
              {results.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setPicked(a)}>
                    <Face src={a.avatar} name={a.name} />
                    <span className="apl-results-name">
                      <strong>{a.name}</strong>
                      <small>@{a.username}</small>
                    </span>
                    <span className="apl-pick">This is me</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="apl-muted apl-empty">
              No accounts match that name. Check the spelling, or skip the search and{" "}
              <a href="/api/appeals/discord">continue with Discord</a> directly.
            </p>
          )
        ) : null}
      </section>
    </>
  );
}

/** Step 3: the signed-in member's punishments, an appeal form, and their past appeals. */
function MyRecord({ me, punishments, appeals, reload }: { me: Me; punishments: Punishment[]; appeals: MyAppeal[]; reload: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ reference: string; email: boolean } | null>(null);
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    try {
      const pickedId = sessionStorage.getItem(PICKED_KEY);
      if (pickedId && pickedId !== me.discordId) setMismatch(true);
      sessionStorage.removeItem(PICKED_KEY);
    } catch {
      // ignore
    }
  }, [me.discordId]);

  async function signOut() {
    await fetch("/api/appeals/me", { method: "DELETE" }).catch(() => null);
    window.location.href = "/appeals";
  }

  async function submit(punishmentId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/appeals/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ punishmentId, message, email }) });
      const body = await res.json().catch(() => ({ ok: false, error: "That didn't send. Please try again." }));
      if (!res.ok || !body.ok) {
        setError(body.error ?? "That didn't send. Please try again.");
        return;
      }
      setSent({ reference: body.reference, email: Boolean(email.trim()) });
      setOpen(null);
      setMessage("");
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Steps step={3} />
      <section className="apl-card apl-me">
        <div className="apl-who">
          <Face src={me.avatar} name={me.name} />
          <span>
            <strong>{me.name}</strong>
            <small>
              <ShieldCheck size={12} aria-hidden="true" /> Verified with Discord as @{me.username}
            </small>
          </span>
        </div>
        <button type="button" className="apl-link" onClick={() => void signOut()}>
          <LogOut size={14} aria-hidden="true" /> Not you?
        </button>
      </section>
      {mismatch ? (
        <p className="apl-alert">
          <AlertTriangle size={15} aria-hidden="true" /> You signed in as @{me.username}, which isn&apos;t the account you picked. If that&apos;s wrong, use &quot;Not you?&quot; and sign in to the other Discord account.
        </p>
      ) : null}

      {sent ? (
        <section className="apl-card apl-sent" role="status">
          <CheckCircle2 size={28} aria-hidden="true" />
          <div>
            <h2>Appeal sent</h2>
            <p>
              Your reference is <b>{sent.reference}</b>. An admin will review it, usually within a few days.{" "}
              {sent.email ? "We've emailed you a copy and will email you the decision." : "Check back on this page for the decision."}
            </p>
          </div>
        </section>
      ) : null}

      <section className="apl-card">
        <h2>Your punishments</h2>
        {punishments.length ? (
          <ul className="apl-list">
            {punishments.map((p) => {
              const canAppeal = !p.appeal || (p.appeal.status === "denied" && p.appeal.canAppealAgainAt && new Date(p.appeal.canAppealAgainAt).getTime() < Date.now());
              return (
                <li key={p.id} className={open === p.id ? "is-open" : undefined}>
                  <div className="apl-row">
                    <span className={`apl-action apl-action--${p.action.replace("kick_unverified", "kick")}`}>
                      <Gavel size={13} aria-hidden="true" /> {ACTION[p.action] ?? p.action}
                    </span>
                    <div className="apl-row-text">
                      <strong>{p.reason}</strong>
                      <small>
                        {date(p.at)}
                        {p.active ? " · Active" : ""}
                        {p.expiresAt && p.active ? ` · ends ${date(p.expiresAt)}` : ""}
                      </small>
                    </div>
                    <div className="apl-row-end">
                      {p.appeal && !canAppeal ? <StatusChip status={p.appeal.status} /> : null}
                      {canAppeal && open !== p.id ? (
                        <button
                          type="button"
                          className="kb-btn apl-appeal-btn"
                          onClick={() => {
                            setOpen(p.id);
                            setError(null);
                            setSent(null);
                          }}
                        >
                          Appeal
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {p.appeal?.status === "denied" && !canAppeal && p.appeal.canAppealAgainAt ? (
                    <p className="apl-muted apl-note">You can appeal this again after {date(p.appeal.canAppealAgainAt)}.</p>
                  ) : null}
                  {open === p.id ? (
                    <form
                      className="apl-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void submit(p.id);
                      }}
                    >
                      <label>
                        <span>Why should we reconsider?</span>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={6}
                          maxLength={3000}
                          required
                          autoFocus
                          placeholder="Explain what happened from your side, what you'd do differently, and anything we might have missed. Be honest; it helps."
                        />
                        <small className={message.trim().length < 30 ? "apl-count is-low" : "apl-count"}>{message.trim().length < 30 ? `${30 - message.trim().length} more characters needed` : `${message.length} / 3000`}</small>
                      </label>
                      <label>
                        <span>
                          <Mail size={13} aria-hidden="true" /> Email for the decision <em>(optional)</em>
                        </span>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={254} autoComplete="email" />
                        <small className="apl-muted">Only used to tell you the outcome. Admins don&apos;t see the address.</small>
                      </label>
                      {error ? <p className="apl-alert">{error}</p> : null}
                      <div className="apl-form-actions">
                        <button type="submit" className="kb-btn kb-btn--primary" disabled={busy || message.trim().length < 30}>
                          {busy ? "Sending…" : "Send appeal"}
                        </button>
                        <button type="button" className="kb-btn" onClick={() => setOpen(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="apl-muted apl-empty">
            <UserRound size={16} aria-hidden="true" /> There are no punishments on this account. If you were punished on a different Discord account, use &quot;Not you?&quot; and sign in with that one.
          </p>
        )}
      </section>

      {appeals.length ? (
        <section className="apl-card">
          <h2>Your appeals</h2>
          <ul className="apl-list">
            {appeals.map((a) => (
              <li key={a.id}>
                <div className="apl-row">
                  <span className="apl-ref">{a.reference}</span>
                  <div className="apl-row-text">
                    <strong>{ACTION[a.action] ?? a.action} appeal</strong>
                    <small>
                      Sent {date(a.createdAt)}
                      {a.decidedAt ? ` · decided ${date(a.decidedAt)}` : ""}
                    </small>
                  </div>
                  <div className="apl-row-end">
                    <StatusChip status={a.status} />
                  </div>
                </div>
                {a.response ? (
                  <blockquote className="apl-response">
                    <b>From the admin team</b>
                    {a.response}
                  </blockquote>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

export function AppealsClient({ error }: { error: string | null }) {
  const [data, setData] = useState<{ me: Me | null; punishments?: Punishment[]; appeals?: MyAppeal[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/appeals/me", { cache: "no-store" }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    if (!body?.ok) {
      setLoadError(body?.error ?? "We couldn't load this page. Please refresh.");
      return;
    }
    setData(body);
  }

  useEffect(() => {
    void load();
    if (error) window.history.replaceState(null, "", "/appeals");
  }, [error]);

  return (
    <div className="apl-body">
      {error ? (
        <p className="apl-alert">
          <AlertTriangle size={15} aria-hidden="true" /> {error}
        </p>
      ) : null}
      {loadError ? <p className="apl-alert">{loadError}</p> : null}
      {!data && !loadError ? <div className="apl-card apl-skeleton" /> : null}
      {data && !data.me ? <FindAccount /> : null}
      {data?.me ? <MyRecord me={data.me} punishments={data.punishments ?? []} appeals={data.appeals ?? []} reload={() => void load()} /> : null}
      <p className="apl-fine">
        Appeals are reviewed by Kitty Kingdom admins only. Be respectful and honest; abusive or spam appeals are denied. If an appeal is denied, you can appeal the same
        punishment again after 30 days. See our <a href="/privacy">Privacy Policy</a> for how appeal information is stored.
      </p>
    </div>
  );
}
