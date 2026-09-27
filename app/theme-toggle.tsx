"use client";

import { useEffect, useState } from "react";

/** Day / night switch: the sun slides across a sunset sky and turns into a moon among stars. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("kitty-theme") as "dark" | "light" | null;
    const nextTheme = saved ?? "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
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
      className={`theme-switch${dark ? " is-dark" : ""}`}
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
