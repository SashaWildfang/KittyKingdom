"use client";

// Maintenance mode (Admin → Status): members see a "back soon" screen; staff and admins get a banner instead.
// Sign-in, the status page and the admin panel always work, so staff can get in and turn it off.

import "./maintenance-gate.css";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type State = { on: boolean; message: string; until: string | null; exempt: boolean };
const OPEN_PATHS = /^\/(login|register|admin|status|api|forgot-password|reset-password|verify)/;

export function MaintenanceGate() {
  const path = usePathname() ?? "/";
  const [m, setM] = useState<State | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/maintenance", { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => alive && r?.ok && setM(r))
        .catch(() => undefined);
    void load();
    const t = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);
  if (!m?.on) return null;
  const until = m.until ? new Date(m.until).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : null;
  if (m.exempt) {
    return (
      <div className="mg-banner" role="status">
        Maintenance mode is on: members see a &quot;back soon&quot; screen{until ? ` until ${until}` : ""}. <a href="/admin?tab=status">Turn it off</a>
      </div>
    );
  }
  if (OPEN_PATHS.test(path)) return null;
  return (
    <div className="mg-screen" role="dialog" aria-modal="true" aria-labelledby="mg-title">
      <div className="mg-box">
        <span className="mg-emoji" aria-hidden="true">
          🛠️
        </span>
        <h1 id="mg-title">Back soon!</h1>
        <p>{m.message || "We're doing some quick maintenance on the website. Discord works as normal in the meantime."}</p>
        {until ? <p className="mg-until">Expected back around {until}.</p> : null}
        <div className="mg-links">
          <a href="https://status.bear-nation.net">Status page</a>
          <a href="/login">Staff sign in</a>
        </div>
      </div>
    </div>
  );
}
