"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

// The theme choice: "system" (follow the device, the default), "light" or "dark". Saved in this
// browser as "kitty-theme"; the page itself always gets data-theme="light" | "dark" (set first by
// the script in layout.tsx so there's no flash, then kept up to date here).
export type ThemeChoice = "system" | "light" | "dark";
const KEY = "kitty-theme";
const EVENT = "kk-theme-change";

function systemTheme(): "light" | "dark" {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readChoice(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyChoice(choice: ThemeChoice) {
  document.documentElement.dataset.theme = choice === "system" ? systemTheme() : choice;
}

export function setChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, choice);
  } catch {
    // private mode: it still changes for this visit
  }
  applyChoice(choice);
  window.dispatchEvent(new Event(EVENT));
}

/** The current choice, updating when it changes anywhere on the page (or the device switches theme). */
export function useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setState] = useState<ThemeChoice>("system");
  useEffect(() => {
    const sync = () => setState(readChoice());
    sync();
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystem = () => readChoice() === "system" && applyChoice("system");
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    media?.addEventListener?.("change", onSystem);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      media?.removeEventListener?.("change", onSystem);
    };
  }, []);
  return [choice, setChoice];
}

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** Light / Dark / System segmented switch (footer, account menu, phone menu). */
export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const [choice, set] = useThemeChoice();
  return (
    <div className={`theme-seg${compact ? " is-compact" : ""}`} role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button key={value} type="button" role="radio" aria-checked={choice === value} className={choice === value ? "is-on" : undefined} onClick={() => set(value)} title={`${label} theme`}>
          <Icon size={14} aria-hidden="true" />
          {compact ? <span className="theme-seg-sr">{label}</span> : <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
