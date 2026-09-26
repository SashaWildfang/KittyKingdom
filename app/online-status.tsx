"use client";

import { useEffect, useState } from "react";

type OnlineStatusProps = {
  initialOnline: number | null;
};

const HEARTBEAT_MS = 30000;
const DISCORD_REFRESH_MS = 60000;

// A random, anonymous id per browser so each visitor is counted once across tabs and pages
function visitorId() {
  try {
    let id = window.localStorage.getItem("kk_visitor");
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("kk_visitor", id);
    }
    return id;
  } catch {
    return null;
  }
}

export function OnlineStatus({ initialOnline }: OnlineStatusProps) {
  const [online, setOnline] = useState(initialOnline);
  const [siteVisitors, setSiteVisitors] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = visitorId();

    async function refreshDiscord() {
      try {
        const response = await fetch("/api/discord/online", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as { online: number | null };
          if (!cancelled) setOnline(data.online);
        }
      } catch {
        // Keep the last known value.
      }
    }

    async function heartbeat() {
      // Only tabs someone is actually looking at count as "on the website"
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
          cache: "no-store",
        });
        if (response.ok) {
          const data = (await response.json()) as { online: number | null };
          if (!cancelled && typeof data.online === "number") setSiteVisitors(data.online);
        }
      } catch {
        // Keep the last known value.
      }
    }

    const discordInterval = window.setInterval(refreshDiscord, DISCORD_REFRESH_MS);
    const heartbeatInterval = window.setInterval(heartbeat, HEARTBEAT_MS);
    const onVisible = () => void heartbeat();
    document.addEventListener("visibilitychange", onVisible);
    void refreshDiscord();
    void heartbeat();

    return () => {
      cancelled = true;
      window.clearInterval(discordInterval);
      window.clearInterval(heartbeatInterval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <span className="status-stack">
      <small className="online-status">
        <span aria-hidden="true" />
        {online === null ? "Live now" : `${online.toLocaleString()} online`}
      </small>
      {siteVisitors && siteVisitors > 0 ? (
        <small className="online-status staff-online-status" title="People browsing the website right now">
          <span aria-hidden="true" />
          {`${siteVisitors.toLocaleString()} on the website`}
        </small>
      ) : null}
    </span>
  );
}
