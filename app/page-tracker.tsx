"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const SESSION_IDLE_MS = 30 * 60_000;

// The same random, anonymous browser id the "on the website" counter uses
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

/** A visit: a new one starts after 30 minutes without any page views. */
function sessionId() {
  try {
    const raw = window.sessionStorage.getItem("kk_session_visit");
    const [id, last] = raw ? raw.split("|") : [];
    const fresh = !id || !last || Date.now() - Number(last) > SESSION_IDLE_MS;
    const sid = fresh ? crypto.randomUUID() : id;
    window.sessionStorage.setItem("kk_session_visit", `${sid}|${Date.now()}`);
    return sid;
  } catch {
    return null;
  }
}

function firstVisit() {
  try {
    if (window.localStorage.getItem("kk_seen")) return false;
    window.localStorage.setItem("kk_seen", "1");
    return true;
  } catch {
    return false;
  }
}

function optedOut() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/** Counts page views for the admin traffic stats (first-party only, no third-party scripts). */
export function PageTracker() {
  const pathname = usePathname();
  const current = useRef<{ id: string | null; vid: string; visibleSince: number; spent: number } | null>(null);
  const lastSent = useRef<{ path: string; at: number } | null>(null);

  // Sends the time spent on the page when the visitor leaves or hides the tab
  useEffect(() => {
    const flush = () => {
      const c = current.current;
      if (!c?.id) return;
      const spent = c.spent + (document.visibilityState === "visible" ? Date.now() - c.visibleSince : 0);
      navigator.sendBeacon?.("/api/track", JSON.stringify({ type: "leave", id: c.id, vid: c.vid, ms: spent }));
    };
    const onVisibility = () => {
      const c = current.current;
      if (!c) return;
      if (document.visibilityState === "hidden") {
        c.spent += Date.now() - c.visibleSince;
        const id = c.id;
        if (id) navigator.sendBeacon?.("/api/track", JSON.stringify({ type: "leave", id, vid: c.vid, ms: c.spent }));
      } else {
        c.visibleSince = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || optedOut()) return;
    // The same page reported twice in a row within a second is one view
    if (lastSent.current && lastSent.current.path === pathname && Date.now() - lastSent.current.at < 1000) return;
    lastSent.current = { path: pathname, at: Date.now() };
    const vid = visitorId();
    const sid = sessionId();
    if (!vid || !sid) return;

    // Finish the previous page before starting this one
    const prev = current.current;
    if (prev?.id) {
      const spent = prev.spent + (document.visibilityState === "visible" ? Date.now() - prev.visibleSince : 0);
      navigator.sendBeacon?.("/api/track", JSON.stringify({ type: "leave", id: prev.id, vid: prev.vid, ms: spent }));
    }
    const entry = { id: null as string | null, vid, visibleSince: Date.now(), spent: 0 };
    current.current = entry;

    const params = new URLSearchParams(window.location.search);
    const isFirstPage = !prev;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        type: "view",
        path: pathname,
        // Where they came from only matters for the first page of a visit
        ref: isFirstPage ? document.referrer : "",
        utm: params.get("utm_source") ?? params.get("ref") ?? "",
        vid,
        sid,
        w: window.innerWidth,
        newVisitor: isFirstPage && firstVisit(),
      }),
    })
      .then((r) => (r.status === 200 ? r.json() : null))
      .then((body: { id?: string | null } | null) => {
        if (body?.id && current.current === entry) entry.id = body.id;
      })
      .catch(() => undefined);
  }, [pathname]);

  return null;
}
