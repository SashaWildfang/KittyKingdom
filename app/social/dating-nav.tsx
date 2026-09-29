"use client";

import { Compass, Heart, Home, LayoutGrid, Sparkles, UserRound, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useApi } from "./ui";

type Counts = { likes: number; matches: number; unread: number; requests: number; friendRequests: number };

const TABS = [
  { href: "/social", label: "Home", icon: Home, exact: true },
  { href: "/social/discover", label: "Discover", icon: Compass },
  { href: "/social/browse", label: "Browse", icon: LayoutGrid },
  { href: "/social/likes", label: "Likes", icon: Heart, count: (c: Counts) => c.likes },
  { href: "/social/matches", label: "Matches", icon: Sparkles, count: (c: Counts) => c.matches },
  { href: "/social/friends", label: "Friends", icon: Users, count: (c: Counts) => c.friendRequests, hot: true },
  { href: "/social/profile", label: "My profile", icon: UserRound },
];

/** The Dating tabs, with live counts (unread messages and friend requests flash). */
export function DatingNav() {
  const path = usePathname();
  const { data } = useApi<Counts>("/api/dating/counts", 20_000);
  const strip = useRef<HTMLDivElement>(null);
  // On phones the tabs scroll sideways; keep the open one in view
  useEffect(() => {
    const el = strip.current;
    const on = el?.querySelector<HTMLElement>(".is-on");
    if (el && on && el.scrollWidth > el.clientWidth) el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2;
  }, [path]);
  return (
    <nav className="dt-nav" aria-label="Social">
      {/* No "Social" title link here: the top bar already has Social */}
      <div className="dt-nav-tabs" ref={strip}>
        {TABS.map((t) => {
          const on = t.exact ? path === t.href : path.startsWith(t.href);
          const n = data && t.count ? t.count(data) : 0;
          return (
            <a key={t.href} href={t.href} className={on ? "is-on" : undefined} aria-current={on ? "page" : undefined}>
              <t.icon size={16} aria-hidden="true" /> <span>{t.label}</span>
              {n ? <b className={t.hot ? "is-hot" : undefined}>{n > 99 ? "99+" : n}</b> : null}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
