"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

function Rule({ valid, children }: { valid: boolean; children: ReactNode }) {
  return (
    <span className={`validation-rule ${valid ? "valid" : "invalid"}`}>
      <span aria-hidden="true">{valid ? "✓" : "×"}</span>
      {children}
    </span>
  );
}

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [visible, setVisible] = useState(false);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );
  const passwordLength = password.length >= 8;
  const passwordNumber = /\d/.test(password);
  const passwordSymbol = /[^A-Za-z0-9]/.test(password);
  const passwordValid = passwordLength && passwordNumber && passwordSymbol;

  return (
    <form className="auth-form" action="/api/account/register" method="post">
      <label>
        <span className="input-label">
          Email <span className="required-mark">*</span>
        </span>
        <span className="input-shell validation-shell">
          <span className="field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img">
              <path d="M4.75 5h14.5C20.22 5 21 5.78 21 6.75v10.5c0 .97-.78 1.75-1.75 1.75H4.75C3.78 19 3 18.22 3 17.25V6.75C3 5.78 3.78 5 4.75 5Zm.62 2 6.63 5.05L18.63 7H5.37Zm13.63 1.63-6.4 4.88a1 1 0 0 1-1.2 0L5 8.63V17h14V8.63Z" />
            </svg>
          </span>
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
          {email ? (
            <span className={`field-validity ${emailValid ? "valid" : "invalid"}`}>
              {emailValid ? "✓" : "×"}
            </span>
          ) : null}
        </span>
        {email ? (
          <span className={`field-help validation-help ${emailValid ? "valid" : "invalid"}`}>
            {emailValid ? "Email format looks valid." : "Enter a valid email address."}
          </span>
        ) : null}
      </label>

      <label>
        <span className="input-label">
          Password <span className="required-mark">*</span>
        </span>
        <span className="input-shell validation-shell">
          <span className="field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img">
              <path d="M17 9V7A5 5 0 0 0 7 7v2H5.75A1.75 1.75 0 0 0 4 10.75v7.5C4 19.22 4.78 20 5.75 20h12.5c.97 0 1.75-.78 1.75-1.75v-7.5C20 9.78 19.22 9 18.25 9H17Zm-8 0V7a3 3 0 0 1 6 0v2H9Zm4 4.25v2.5a1 1 0 1 1-2 0v-2.5a1 1 0 1 1 2 0Z" />
            </svg>
          </span>
          <input
            autoComplete="new-password"
            minLength={8}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            pattern="(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
            placeholder="Create a password"
            required
            type={visible ? "text" : "password"}
            value={password}
          />
          <button
            className="password-eye"
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5c5 0 8.4 4.2 9.6 6-.9 1.5-4.3 6-9.6 6s-8.7-4.5-9.6-6C3.6 9.2 7 5 12 5Zm0 2C8.9 7 6.4 9.1 4.9 11c1.4 1.9 3.9 4 7.1 4s5.7-2.1 7.1-4C17.6 9.1 15.1 7 12 7Zm0 1.5A2.5 2.5 0 1 1 12 13a2.5 2.5 0 0 1 0-5Z" />
            </svg>
          </button>
        </span>
        {password ? (
          <span className="validation-rules">
            <Rule valid={passwordLength}>8+ characters</Rule>
            <Rule valid={passwordNumber}>at least one number</Rule>
            <Rule valid={passwordSymbol}>at least one symbol</Rule>
          </span>
        ) : null}
      </label>

      <label className="policy-check">
        <input
          checked={accepted}
          name="acceptedPolicies"
          onChange={(event) => setAccepted(event.target.checked)}
          required
          type="checkbox"
          value="yes"
        />
        <span>
          I have read, understand, and accept the <Link href="/terms">Terms of Service</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </span>
      </label>
      <span className={`validation-rule ${accepted ? "valid" : "invalid"}`}>
        <span aria-hidden="true">{accepted ? "✓" : "×"}</span>
        Terms must be accepted.
      </span>

      <button type="submit" disabled={!emailValid || !passwordValid || !accepted}>
        Sign Up <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
