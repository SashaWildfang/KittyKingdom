"use client";

import { ArrowBigUpDash, Check, Circle, CircleCheck, MailCheck, MessageCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChangeEmailForm } from "./change-email-form";
import { ResendVerificationLink } from "./resend-verification-link";

type Mode = "login" | "register";
export type AuthStatus = { text: string; tone: "error" | "success" | "info"; unverified?: boolean } | null;

const MAIL_ICON =
  "M4.75 5h14.5C20.22 5 21 5.78 21 6.75v10.5c0 .97-.78 1.75-1.75 1.75H4.75C3.78 19 3 18.22 3 17.25V6.75C3 5.78 3.78 5 4.75 5Zm.62 2 6.63 5.05L18.63 7H5.37Zm13.63 1.63-6.4 4.88a1 1 0 0 1-1.2 0L5 8.63V17h14V8.63Z";
const LOCK_ICON =
  "M17 9V7A5 5 0 0 0 7 7v2H5.75A1.75 1.75 0 0 0 4 10.75v7.5C4 19.22 4.78 20 5.75 20h12.5c.97 0 1.75-.78 1.75-1.75v-7.5C20 9.78 19.22 9 18.25 9H17Zm-8 0V7a3 3 0 0 1 6 0v2H9Zm4 4.25v2.5a1 1 0 1 1-2 0v-2.5a1 1 0 1 1 2 0Z";
const EYE_ICON =
  "M12 5c5 0 8.4 4.2 9.6 6-.9 1.5-4.3 6-9.6 6s-8.7-4.5-9.6-6C3.6 9.2 7 5 12 5Zm0 2C8.9 7 6.4 9.1 4.9 11c1.4 1.9 3.9 4 7.1 4s5.7-2.1 7.1-4C17.6 9.1 15.1 7 12 7Zm0 1.5A2.5 2.5 0 1 1 12 13a2.5 2.5 0 0 1 0-5Z";
const EYE_OFF_ICON =
  "M3.3 2.3 21.7 20.7l-1.4 1.4-3.3-3.3A10.6 10.6 0 0 1 12 20c-5.3 0-8.7-4.5-9.6-6 .6-1 2-2.9 4-4.4L1.9 3.7l1.4-1.4ZM7.9 11a4 4 0 0 0 5.1 5.1l-1.6-1.6A2 2 0 0 1 9.5 12.6L7.9 11ZM12 6c5.3 0 8.7 4.5 9.6 6-.5.9-1.6 2.4-3.1 3.7l-1.4-1.4c1-.8 1.8-1.7 2.2-2.3C17.8 10 15.3 8 12 8c-.5 0-1 .1-1.5.1L8.8 6.4C9.8 6.2 10.9 6 12 6Z";

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/** A password box with a clear Show/Hide toggle and a Caps Lock heads-up. */
export function PasswordInput({
  name,
  label,
  placeholder,
  autoComplete,
  value,
  onChange,
}: {
  name: string;
  label: string;
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="kk-field">
      <label className="kk-label" htmlFor={id}>
        {label} <span className="kk-required">*</span>
      </label>
      <div className="kk-input">
        <span className="kk-input-icon">
          <Icon path={LOCK_ICON} />
        </span>
        <input
          ref={input}
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
          onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
          onBlur={() => setCapsLock(false)}
          spellCheck={false}
          autoCapitalize="none"
        />
        <button
          type="button"
          className={`kk-reveal${visible ? " is-on" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setVisible((v) => !v);
            input.current?.focus();
          }}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          <Icon path={visible ? EYE_OFF_ICON : EYE_ICON} />
          <span>{visible ? "Hide" : "Show"}</span>
        </button>
      </div>
      {capsLock ? <p className="kk-hint kk-hint--warn"><ArrowBigUpDash size={14} aria-hidden="true" /> Caps Lock is on</p> : null}
    </div>
  );
}

export function passwordChecks(password: string) {
  return [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "A number", ok: /\d/.test(password) },
    { label: "A symbol", ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function passwordStrength(password: string) {
  if (!password) return 0;
  let score = passwordChecks(password).filter((c) => c.ok).length;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  return Math.min(5, score);
}

export const STRENGTH_LABELS = ["", "Weak", "Okay", "Good", "Strong", "Very strong"];

function StatusBox({ status, identifier }: { status: AuthStatus; identifier: string }) {
  if (!status) return null;
  return (
    <div className={`kk-alert kk-alert--${status.tone}`} role={status.tone === "error" ? "alert" : "status"}>
      <span aria-hidden="true">{status.tone === "error" ? <TriangleAlert size={18} /> : status.tone === "success" ? <CircleCheck size={18} /> : <MailCheck size={18} />}</span>
      <p>
        {status.text}
        {status.unverified ? (
          <>
            {" "}
            <ResendVerificationLink identifier={identifier} />.
          </>
        ) : null}
      </p>
      {status.unverified ? <ChangeEmailForm identifier={identifier} className="kk-change-email" /> : null}
    </div>
  );
}

function SubmitButton({ busy, disabled, children }: { busy: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button className={`kk-submit${busy ? " is-busy" : ""}`} type="submit" disabled={busy || disabled}>
      {busy ? <span className="kk-spinner" aria-hidden="true" /> : null}
      <span>{busy ? "One moment…" : children}</span>
      {!busy ? <span aria-hidden="true">→</span> : null}
    </button>
  );
}

function LoginForm({ identifier: initialIdentifier, active, next }: { identifier: string; active: boolean; next?: string }) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    if (active) first.current?.focus({ preventScroll: true });
  }, [active]);

  return (
    <form className="kk-form" action="/api/account/login" method="post" onSubmit={() => setBusy(true)}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="kk-field">
        <label className="kk-label" htmlFor={id}>
          Email or username <span className="kk-required">*</span>
        </label>
        <div className="kk-input">
          <span className="kk-input-icon">
            <Icon path={MAIL_ICON} />
          </span>
          <input
            ref={first}
            id={id}
            name="identifier"
            type="text"
            autoComplete="username"
            placeholder="you@example.com or YourUsername"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoCapitalize="none"
            spellCheck={false}
            tabIndex={active ? 0 : -1}
          />
        </div>
      </div>
      <PasswordInput name="password" label="Password" placeholder="Enter your password" autoComplete="current-password" value={password} onChange={setPassword} />
      <div className="kk-row">
        <span />
        <Link href="/forgot-password" tabIndex={active ? 0 : -1}>
          Forgot password?
        </Link>
      </div>
      <SubmitButton busy={busy}>Log in</SubmitButton>
    </form>
  );
}

function RegisterForm({ active }: { active: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    if (active) first.current?.focus({ preventScroll: true });
  }, [active]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const checks = passwordChecks(password);
  const passwordOk = checks.every((c) => c.ok);
  const score = passwordStrength(password);
  const ready = emailOk && passwordOk && accepted;

  return (
    <form className="kk-form" action="/api/account/register" method="post" onSubmit={() => setBusy(true)}>
      <div className="kk-field">
        <label className="kk-label" htmlFor={id}>
          Email <span className="kk-required">*</span>
        </label>
        <div className={`kk-input${touched && email && !emailOk ? " is-bad" : ""}${emailOk ? " is-good" : ""}`}>
          <span className="kk-input-icon">
            <Icon path={MAIL_ICON} />
          </span>
          <input
            ref={first}
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            autoCapitalize="none"
            spellCheck={false}
            tabIndex={active ? 0 : -1}
          />
          {emailOk ? (
            <span className="kk-input-ok" aria-hidden="true">
              <Check size={16} strokeWidth={3} />
            </span>
          ) : null}
        </div>
        {touched && email && !emailOk ? <p className="kk-hint kk-hint--bad">That email doesn&apos;t look quite right.</p> : null}
      </div>

      <PasswordInput name="password" label="Password" placeholder="Create a password" autoComplete="new-password" value={password} onChange={setPassword} />
      <div className="kk-strength" aria-live="polite">
        <div className="kk-strength-bar" data-score={score}>
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} className={n <= score ? "is-on" : undefined} />
          ))}
        </div>
        <span>{STRENGTH_LABELS[score]}</span>
      </div>
      <ul className="kk-checks">
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? "is-ok" : undefined}>
            <span aria-hidden="true">{c.ok ? <Check size={12} strokeWidth={3} /> : <Circle size={10} />}</span> {c.label}
          </li>
        ))}
      </ul>

      <label className="kk-terms">
        <input name="acceptedPolicies" type="checkbox" value="yes" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} tabIndex={active ? 0 : -1} />
        <span className="kk-checkbox" aria-hidden="true">
          <Check size={14} strokeWidth={3} />
        </span>
        <span>
          I&apos;ve read and accept the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.
        </span>
      </label>

      <div className="kk-discord-note" role="note">
        <span className="kk-discord-note-icon" aria-hidden="true">
          <MessageCircle size={16} />
        </span>
        <p>
          <strong>Members only.</strong> Accounts are for verified members of the Kitty Kingdom Discord. Next, you&apos;ll confirm your email, then get a code to use with{" "}
          <code>/link</code> in the server.
        </p>
      </div>
      <SubmitButton busy={busy} disabled={!ready}>
        Continue
      </SubmitButton>
      {!ready && (email || password) ? (
        <p className="kk-hint kk-hint--center">
          {!emailOk ? "Add a valid email" : !passwordOk ? "Finish the password checklist" : "Accept the terms"} to continue.
        </p>
      ) : null}
    </form>
  );
}

/** Login and Sign up in one card: switching tabs slides between the forms without a page load. */
export function AuthCard({
  initialMode,
  loginStatus,
  registerStatus,
  identifier,
  next,
}: {
  initialMode: Mode;
  loginStatus: AuthStatus;
  registerStatus: AuthStatus;
  identifier: string;
  /** Page to return to after logging in */
  next?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [height, setHeight] = useState<number | null>(null);
  const panels = useRef<Record<Mode, HTMLDivElement | null>>({ login: null, register: null });

  const switchTo = useCallback((next: Mode, push = true) => {
    setMode(next);
    if (push) window.history.pushState({ mode: next }, "", next === "login" ? "/login" : "/register");
  }, []);

  useEffect(() => {
    const onPop = () => setMode(window.location.pathname.startsWith("/register") ? "register" : "login");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The hidden form can't be tabbed into or clicked
  useEffect(() => {
    (Object.keys(panels.current) as Mode[]).forEach((m) => panels.current[m]?.toggleAttribute("inert", m !== mode));
  }, [mode]);

  // The card smoothly grows or shrinks to fit whichever form is showing
  useLayoutEffect(() => {
    const el = panels.current[mode];
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]);

  return (
    <section className="auth-card minehut-card kk-card" aria-label={mode === "login" ? "Login" : "Sign up"}>
      <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
        <img className="auth-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
      </Link>
      <h1>Kitty Kingdom</h1>

      <div className="kk-tabs" role="tablist" aria-label="Log in or sign up">
        <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-active" : undefined} onClick={() => switchTo("login")}>
          Log in
        </button>
        <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "is-active" : undefined} onClick={() => switchTo("register")}>
          Sign up
        </button>
        <span className="kk-tabs-indicator" style={{ transform: `translateX(${mode === "login" ? "0" : "100%"})` }} aria-hidden="true" />
      </div>

      <div className="kk-viewport" style={height ? { height } : undefined}>
        <div className="kk-track" style={{ transform: `translateX(${mode === "login" ? "0" : "-50%"})` }}>
          <div className="kk-panel" ref={(el) => void (panels.current.login = el)} aria-hidden={mode !== "login"}>
            <p className="kk-intro">Welcome back! Log in to your Kitty Kingdom account.</p>
            <StatusBox status={loginStatus} identifier={identifier} />
            <LoginForm identifier={identifier} active={mode === "login"} next={next} />
            <p className="kk-switch">
              New here?{" "}
              <button type="button" onClick={() => switchTo("register")}>
                Create an account
              </button>
            </p>
          </div>
          <div className="kk-panel" ref={(el) => void (panels.current.register = el)} aria-hidden={mode !== "register"}>
            <p className="kk-intro">Create your account in three quick steps: your details, confirm your email, then link your Discord.</p>
            <StatusBox status={registerStatus} identifier={identifier} />
            <RegisterForm active={mode === "register"} />
            <p className="kk-switch">
              Already have an account?{" "}
              <button type="button" onClick={() => switchTo("login")}>
                Log in
              </button>
            </p>
          </div>
        </div>
      </div>

      <Link className="auth-help" href="/support">
        Need help? Contact support
      </Link>
    </section>
  );
}
