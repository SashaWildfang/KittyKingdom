"use client";

import { useEffect, useState } from "react";

type OnlineStatusProps = {
  initialOnline: number | null;
};

export function OnlineStatus({ initialOnline }: OnlineStatusProps) {
  const [online, setOnline] = useState(initialOnline);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/discord/online", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { online: number | null };
        if (!cancelled) setOnline(data.online);
      } catch {
        // Keep the last known value.
      }
    }

    const interval = window.setInterval(refresh, 60000);
    void refresh();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <small className="online-status">
      <span aria-hidden="true" />
      {online === null ? "Live now" : `${online.toLocaleString()} online`}
    </small>
  );
}
