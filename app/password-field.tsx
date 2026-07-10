"use client";

import { useState } from "react";

type PasswordFieldProps = {
  label: string;
  name: string;
  placeholder: string;
  autoComplete?: string;
  minLength?: number;
};

export function PasswordField({ label, name, placeholder, autoComplete, minLength }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      <span className="label-row">
        {label}
        <button
          className="password-eye"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
      <input
        autoComplete={autoComplete}
        minLength={minLength}
        name={name}
        placeholder={placeholder}
        required
        type={visible ? "text" : "password"}
      />
    </label>
  );
}
