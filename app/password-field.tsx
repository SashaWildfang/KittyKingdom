"use client";

import { useState } from "react";

type PasswordFieldProps = {
  label: string;
  name: string;
  placeholder: string;
  autoComplete?: string;
  helpText?: string;
  minLength?: number;
  pattern?: string;
};

export function PasswordField({
  label,
  name,
  placeholder,
  autoComplete,
  helpText,
  minLength,
  pattern,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      <span className="input-label">
        {label} <span className="required-mark">*</span>
      </span>
      <span className="input-shell">
        <span className="field-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="M17 9V7A5 5 0 0 0 7 7v2H5.75A1.75 1.75 0 0 0 4 10.75v7.5C4 19.22 4.78 20 5.75 20h12.5c.97 0 1.75-.78 1.75-1.75v-7.5C20 9.78 19.22 9 18.25 9H17Zm-8 0V7a3 3 0 0 1 6 0v2H9Zm4 4.25v2.5a1 1 0 1 1-2 0v-2.5a1 1 0 1 1 2 0Z" />
          </svg>
        </span>
        <input
          autoComplete={autoComplete}
          minLength={minLength}
          name={name}
          pattern={pattern}
          placeholder={placeholder}
          required
          type={visible ? "text" : "password"}
        />
        <button
          className="password-eye"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5c5 0 8.4 4.2 9.6 6-.9 1.5-4.3 6-9.6 6s-8.7-4.5-9.6-6C3.6 9.2 7 5 12 5Zm0 2C8.9 7 6.4 9.1 4.9 11c1.4 1.9 3.9 4 7.1 4s5.7-2.1 7.1-4C17.6 9.1 15.1 7 12 7Zm0 1.5A2.5 2.5 0 1 1 12 13a2.5 2.5 0 0 1 0-5Z" />
          </svg>
        </button>
      </span>
      {helpText ? <span className="field-help">{helpText}</span> : null}
    </label>
  );
}
