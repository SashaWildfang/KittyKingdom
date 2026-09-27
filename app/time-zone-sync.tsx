"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Tells the server the viewer's time zone (kk_tz cookie) so server-rendered times, emails and
 * charts use their clock. If it changed, the page re-renders once with the right times.
 */
export function TimeZoneSync() {
  const router = useRouter();
  useEffect(() => {
    let zone = "";
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone) return;
    const current = /(?:^|;\s*)kk_tz=([^;]+)/.exec(document.cookie)?.[1];
    if (current && decodeURIComponent(current) === zone) return;
    document.cookie = `kk_tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    router.refresh();
  }, [router]);
  return null;
}
