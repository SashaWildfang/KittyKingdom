"use client";

import { useEffect, useState } from "react";

type Status = "online" | "idle" | "dnd" | "offline";

const ONLINE_LABELS: Record<Exclude<Status, "offline">, string> = {
  online: "Online now",
  idle: "Away",
  dnd: "Do not disturb",
};

/** "Last online 2d 3h 14m 5s ago", ticking every second. */
function since(ms: number) {
  let s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const parts = [d ? `${d}d` : "", d || h ? `${h}h` : "", d || h || m ? `${m}m` : "", `${s}s`].filter(Boolean);
  return parts.join(" ");
}

export function LastOnline({ status, lastOnline }: { status: Status | null; lastOnline: string | null }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (status && status !== "offline") {
    return <p className={`staff-last-online staff-last-online--${status}`}>● {ONLINE_LABELS[status]}</p>;
  }
  if (!lastOnline) return <p className="staff-last-online">Offline</p>;
  const ms = (now ?? new Date(lastOnline).getTime()) - new Date(lastOnline).getTime();
  return (
    <p className="staff-last-online" title={new Date(lastOnline).toLocaleString()}>
      Last online <strong suppressHydrationWarning>{now === null ? "…" : since(ms)}</strong> ago
    </p>
  );
}
