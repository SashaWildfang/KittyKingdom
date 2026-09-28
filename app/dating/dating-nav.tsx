"use client";

import { Compass, Heart, Home, LayoutGrid, MessageCircle, Settings, Sparkles, UserRound, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useApi } from "./ui";

type Counts = { likes: number; matches: number; unread: number; requests: number; friendRequests: number };

const TABS = [
  { href: "/dating", label: "Home", icon: Home, exact: true },
  { href: "/dating/discover", label: "Discover", icon: Compass },
  { href: "/dating/browse", label: "Browse", icon: LayoutGrid },
  { href: "/dating/likes", label: "Likes", icon: Heart, count: (c: Counts) => c.likes },
  { href: "/dating/matches", label: "Matches", icon: Sparkles, count: (c: Counts) => c.matches },
  { href: "/dating/messages", label: "Messages", icon: MessageCircle, count: (c: Counts) => c.unread + c.requests, hot: true },
  { href: "/dating/friends", label: "Friends", icon: Users, count: (c: Counts) => c.friendRequests, hot: true },
  { href: "/dating/profile", label: "My profile", icon: UserRound },
  { href: "/dating/settings", label: "Settings", icon: Settings },
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
    <nav className="dt-nav" aria-label="Dating">
      <a href="/dating" className="dt-nav-brand">
        <Heart size={18} fill="currentColor" aria-hidden="true" /> Dating
      </a>
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
