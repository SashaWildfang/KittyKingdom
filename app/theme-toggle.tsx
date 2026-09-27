"use client";

import { useEffect, useState } from "react";

/** Day / night switch: the sun slides across a sunset sky and turns into a moon among stars. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  // Only animate once the saved theme has been applied, so loading a page never plays the slide
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = (document.documentElement.dataset.theme ?? window.localStorage.getItem("kitty-theme")) as "dark" | "light" | null;
    const nextTheme = saved === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setReady(true)));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    // The page's real theme is the source of truth (the switch's look comes from it via CSS)
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const nextTheme = current === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem("kitty-theme", nextTheme);
    } catch {
      // private mode: the switch still works for this visit
    }
  }

  const dark = theme === "dark";
  return (
    <button
      className={`theme-switch${ready ? " is-ready" : ""}`}
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span className="theme-switch-sky" aria-hidden="true">
        <i className="ts-cloud ts-cloud--1" />
        <i className="ts-cloud ts-cloud--2" />
        <i className="ts-star ts-star--1" />
        <i className="ts-star ts-star--2" />
        <i className="ts-star ts-star--3" />
        <i className="ts-star ts-star--4" />
      </span>
      <span className="theme-switch-knob" aria-hidden="true">
        <i className="ts-crater ts-crater--1" />
        <i className="ts-crater ts-crater--2" />
      </span>
    </button>
  );
}
