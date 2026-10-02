"use client";

import { Dices, Heart, HeartHandshake, Home, LogIn, LogOut, Menu, MessageCircle, MessagesSquare, Newspaper, Settings, ShoppingBag, Trophy, UserPlus, UserRound, UserStar, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeSwitch } from "./theme-switch";
import { ThemeToggle } from "./theme-toggle";
import { MessagesButton } from "./messages-nav-badge";
import { useUnreadNews } from "./news-nav-badge";
import { NotificationBell } from "./notification-bell";

type NavLink = { href: string; label: string; icon: "home" | "news" | "discord" | "patreon" | "staff" | "store" | "games" | "leaderboards" | "admin" | "dating" | "settings" | "messages"; external?: boolean };

const ICONS = { home: Home, news: Newspaper, discord: MessageCircle, patreon: Heart, staff: Users, store: ShoppingBag, games: Dices, leaderboards: Trophy, admin: UserStar, dating: HeartHandshake, settings: Settings, messages: MessagesSquare };

/** Phone navigation: a slim bar with the theme switch and a menu that opens a sheet of big, tappable links. */
export function MobileMenu({ links, signedIn, newsStamps = [], bell = false, messages = false }: { links: NavLink[]; signedIn: boolean; newsStamps?: { id: string; at: string }[]; bell?: boolean; messages?: boolean }) {
  const unreadNews = useUnreadNews(newsStamps);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close when you navigate, press Escape, or rotate to a wide screen
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth > 1100 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.body.classList.add("menu-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.classList.remove("menu-open");
    };
  }, [open]);

  const isActive = (href: string) => href !== "/" && (pathname === href || (href === "/home" && pathname === "/") || pathname.startsWith(`${href}/`));

  return (
    <div className="mobile-nav">
      {messages ? <MessagesButton /> : null}
      {bell ? <NotificationBell /> : null}
      <ThemeToggle />
      <button type="button" className={`mobile-nav-button${open ? " is-open" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-sheet" aria-label={open ? "Close menu" : "Open menu"}>
        {open ? <X size={22} /> : <Menu size={22} />}
        {!open && unreadNews ? <span className="nav-news-badge nav-news-badge--dot" aria-label={`${unreadNews} unread news`}>{unreadNews > 9 ? "9+" : unreadNews}</span> : null}
      </button>

      {open ? <div className="mobile-sheet-backdrop" onClick={() => setOpen(false)} aria-hidden="true" /> : null}
      <div id="mobile-sheet" className={`mobile-sheet${open ? " is-open" : ""}`} aria-hidden={!open}>
        <nav className="mobile-sheet-links" aria-label="Pages">
          {links.map((link) => {
            const Icon = ICONS[link.icon];
            return (
              <a key={link.href} href={link.href} className={isActive(link.href) ? "is-active" : undefined} tabIndex={open ? 0 : -1} {...(link.external ? { rel: "noopener noreferrer", target: link.icon === "patreon" ? "_blank" : undefined } : {})}>
                <span className="mobile-sheet-icon">
                  <Icon size={19} aria-hidden="true" />
                </span>
                {link.label}
                {link.icon === "news" && unreadNews ? <span className="nav-news-badge">{unreadNews > 9 ? "9+" : unreadNews}</span> : null}
              </a>
            );
          })}
        </nav>
        <div className="mobile-sheet-theme">
          <span>Theme</span>
          <ThemeSwitch />
        </div>
        <div className="mobile-sheet-account">
          {signedIn ? (
            <>
              <a className="mobile-sheet-cta" href="/account" tabIndex={open ? 0 : -1}>
                <UserRound size={18} aria-hidden="true" /> My Account
              </a>
              <form action="/api/account/logout" method="post">
                <button className="mobile-sheet-ghost" type="submit" tabIndex={open ? 0 : -1}>
                  <LogOut size={18} aria-hidden="true" /> Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <a className="mobile-sheet-cta" href="/register" tabIndex={open ? 0 : -1}>
                <UserPlus size={18} aria-hidden="true" /> Create account
              </a>
              <a className="mobile-sheet-ghost" href="/login" tabIndex={open ? 0 : -1}>
                <LogIn size={18} aria-hidden="true" /> Log in
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
