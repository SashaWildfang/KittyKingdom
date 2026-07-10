"use client";

import { useEffect, useState } from "react";

type OnlineStatusProps = {
  initialOnline: number | null;
};

export function OnlineStatus({ initialOnline }: OnlineStatusProps) {
  const [online, setOnline] = useState(initialOnline);
  const [staffOnline, setStaffOnline] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const [onlineResponse, staffResponse] = await Promise.all([
          fetch("/api/discord/online", { cache: "no-store" }),
          fetch("/api/discord/staff-online", { cache: "no-store" }),
        ]);

        if (onlineResponse.ok) {
          const data = (await onlineResponse.json()) as {
            online: number | null;
          };
          if (!cancelled) setOnline(data.online);
        }

        if (staffResponse.ok) {
          const data = (await staffResponse.json()) as {
            online: number | null;
          };
          if (!cancelled) setStaffOnline(data.online);
        }
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
    <span className="status-stack">
      <small className="online-status">
        <span aria-hidden="true" />
        {online === null ? "Live now" : `${online.toLocaleString()} online`}
      </small>
      <small className="online-status staff-online-status">
        <span aria-hidden="true" />
        {staffOnline === null
          ? "staff status live soon"
          : `${staffOnline.toLocaleString()} staff online`}
      </small>
    </span>
  );
}
