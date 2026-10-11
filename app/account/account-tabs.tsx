"use client";

import { useEffect } from "react";

// My Account shows one tab at a time, picked by the link in the sidebar (#roles, #security…). Old links to a
// card on the dashboard (#daily, #discord, #overview…) open the dashboard and scroll to that card.
const HOME_PARTS = new Set(["", "home", "daily", "supporter", "discord", "discord-account", "overview"]);

function tabFor(hash: string) {
  const id = hash.replace(/^#/, "");
  if (id === "stats") return "stats";
  if (HOME_PARTS.has(id)) return "home";
  return document.querySelector(`[data-tab-panel="${CSS.escape(id)}"]`) ? id : "home";
}

/** Keeps the visible tab and the highlighted sidebar link in step with the address bar. */
export function AccountTabs() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".acct4");
    if (!root) return;
    let first = true;
    const sync = () => {
      const hash = window.location.hash;
      const tab = tabFor(hash);
      root.dataset.tab = tab;
      root.querySelectorAll<HTMLElement>("[data-tab-panel]").forEach((p) => p.classList.toggle("is-active", p.dataset.tabPanel === tab));
      root.querySelectorAll<HTMLAnchorElement>(".acct4-nav a[data-tab]").forEach((a) => a.classList.toggle("is-here", a.dataset.tab === tab));
      if (first) {
        first = false;
        if (!hash) return;
      }
      if (tab === "stats") return;
      const id = hash.replace(/^#/, "");
      const card = tab === "home" && id && id !== "home" ? document.getElementById(id === "discord" ? "discord-account" : id) : null;
      requestAnimationFrame(() => {
        if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
        else {
          const top = root.getBoundingClientRect().top + window.scrollY - 96;
          if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
        }
      });
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    // "Back to profile" on the stats page changes the address without a hashchange
    window.addEventListener("kk-account-view", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("kk-account-view", sync);
    };
  }, []);
  return null;
}
