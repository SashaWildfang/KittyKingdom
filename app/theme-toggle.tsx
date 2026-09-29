"use client";

import { useEffect, useState } from "react";
import { setChoice, useThemeChoice } from "./theme-switch";

/** Day / night switch (the phone bar): the sun slides across a sunset sky and turns into a moon among
 *  stars. Flipping it picks Light or Dark; "System" lives in the menu's theme switch. */
export function ThemeToggle() {
  const [choice] = useThemeChoice();
  const [dark, setDark] = useState(false);
  // Only animate once the saved theme has been applied, so loading a page never plays the slide
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setReady(true)));
    return () => window.cancelAnimationFrame(frame);
  }, [choice]);

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setChoice(next);
    setDark(next === "dark");
  }

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
