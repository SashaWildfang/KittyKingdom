"use client";

import { useEffect, useState } from "react";

type Overall = "up" | "degraded" | "down" | "unknown";
const LABEL: Record<Overall, string> = { up: "All systems operational", degraded: "Some systems having problems", down: "Major outage", unknown: "System status" };

/** The footer's live status pill, linking to status.kittykingdom.net. */
export function FooterStatus() {
  const [overall, setOverall] = useState<Overall>("unknown");
  useEffect(() => {
    let alive = true;
    // Loaded after the page settles so it never slows anything down
    const t = window.setTimeout(() => {
      fetch("/api/status")
        .then((r) => r.json())
        .then((r) => alive && r?.ok && setOverall(r.overall))
        .catch(() => undefined);
    }, 1500);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);
  return (
    <a className={`ft-status is-${overall}`} href="https://status.kittykingdom.net" target="_blank" rel="noopener noreferrer">
      <i aria-hidden="true" /> {LABEL[overall]}
    </a>
  );
}
