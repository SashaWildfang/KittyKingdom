"use client";

import { useEffect, useState } from "react";

// Settings → Appearance options that only apply to this browser (saved in localStorage):
//   text size  → <html data-text="small|large|xl">
//   motion     → <html data-motion="reduce">  (default: follow the device's reduced-motion setting)
//   effects    → <html data-fx="off">          (the season's drifting leaves/snow and click bursts)
// layout.tsx applies them before the page paints; device-prefs.css does the rest.

export type TextSize = "small" | "default" | "large" | "xl";
export type Motion = "system" | "reduce" | "full";
export type DevicePrefs = { text: TextSize; motion: Motion; effects: boolean };

const KEYS = { text: "kk-text", motion: "kk-motion", effects: "kk-fx" } as const;
const EVENT = "kk-device-prefs";
export const DEVICE_DEFAULTS: DevicePrefs = { text: "default", motion: "system", effects: true };

function read(): DevicePrefs {
  try {
    const t = localStorage.getItem(KEYS.text);
    const m = localStorage.getItem(KEYS.motion);
    return {
      text: t === "small" || t === "large" || t === "xl" ? t : "default",
      motion: m === "reduce" || m === "full" ? m : "system",
      effects: localStorage.getItem(KEYS.effects) !== "off",
    };
  } catch {
    return DEVICE_DEFAULTS;
  }
}

function apply(p: DevicePrefs) {
  const root = document.documentElement;
  if (p.text === "default") delete root.dataset.text;
  else root.dataset.text = p.text;
  if (p.motion === "system") delete root.dataset.motion;
  else root.dataset.motion = p.motion;
  if (p.effects) delete root.dataset.fx;
  else root.dataset.fx = "off";
}

/** Whether animations should be skipped: the member's choice here, else the device setting. */
export function prefersLessMotion() {
  const m = document.documentElement.dataset.motion;
  if (m === "reduce") return true;
  if (m === "full") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function effectsOff() {
  return document.documentElement.dataset.fx === "off";
}

export function useDevicePrefs(): [DevicePrefs, (patch: Partial<DevicePrefs>) => void] {
  const [prefs, setPrefs] = useState<DevicePrefs>(DEVICE_DEFAULTS);
  useEffect(() => {
    const sync = () => setPrefs(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = (patch: Partial<DevicePrefs>) => {
    const next = { ...read(), ...patch };
    try {
      if (next.text === "default") localStorage.removeItem(KEYS.text);
      else localStorage.setItem(KEYS.text, next.text);
      if (next.motion === "system") localStorage.removeItem(KEYS.motion);
      else localStorage.setItem(KEYS.motion, next.motion);
      if (next.effects) localStorage.removeItem(KEYS.effects);
      else localStorage.setItem(KEYS.effects, "off");
    } catch {
      // private mode: still applies for this visit
    }
    apply(next);
    setPrefs(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return [prefs, update];
}

/** Listens for changes made in Settings (so the season backdrop can stop or start). */
export function onDevicePrefsChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
