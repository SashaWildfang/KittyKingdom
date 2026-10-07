"use client";

import { BookOpenText, ChevronDown, FileText, GraduationCap, HeartHandshake, LogOut, Palette, Settings, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ThemeSwitch } from "./theme-switch";

/** "My Account" in the top bar: a small menu with account links, Appearance (theme) and Log out. */
export function AccountMenu({ social, owner = false }: { social: boolean; owner?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="acct-menu" ref={box}>
      <button type="button" className={`login-link logged-in-link acct-menu-button${open ? " is-open" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        My Account <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open ? (
        <div className="acct-menu-panel" role="menu">
          <a href="/account" role="menuitem">
            <UserRound size={16} aria-hidden="true" /> My Account
          </a>
          {social ? (
            <a href="/social/profile" role="menuitem">
              <HeartHandshake size={16} aria-hidden="true" /> My Social Profile
            </a>
          ) : null}
          <a href="/settings" role="menuitem">
            <Settings size={16} aria-hidden="true" /> Settings
          </a>
          {owner ? (
            <a href="/owner/project-guide" role="menuitem">
              <BookOpenText size={16} aria-hidden="true" /> Project Guide
            </a>
          ) : null}
          {owner ? (
            <a href="/owner/study" role="menuitem">
              <GraduationCap size={16} aria-hidden="true" /> Study Guide
            </a>
          ) : null}
          {owner ? (
            <a href="/owner/resume" role="menuitem">
              <FileText size={16} aria-hidden="true" /> My Resume
            </a>
          ) : null}
          <div className="acct-menu-section">
            <span>
              <Palette size={14} aria-hidden="true" /> Appearance
            </span>
            <ThemeSwitch />
          </div>
          <form action="/api/account/logout" method="post">
            <button type="submit" role="menuitem" className="acct-menu-logout">
              <LogOut size={16} aria-hidden="true" /> Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
