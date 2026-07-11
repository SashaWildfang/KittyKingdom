"use client";

import { useEffect, useState } from "react";

const storageKey = "kitty-paw-cursor-enabled";

export function PawSetting() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(window.localStorage.getItem(storageKey) === "true");
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(storageKey, String(next));
    window.dispatchEvent(new Event("kitty-paw-cursor-change"));
  }

  return (
    <button
      className="form-button secondary-button"
      type="button"
      onClick={toggle}
    >
      {enabled ? "Disable paw cursor" : "Enable paw cursor"}
    </button>
  );
}
