"use client";

import { useEffect } from "react";

/** Highlights the section-bar link for the part of My Account you're looking at (and keeps it in view). */
export function NavSpy() {
  useEffect(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".acct-nav--bar a[href^='#']"));
    const targets = links.map((a) => document.getElementById(a.hash.slice(1))).filter((el): el is HTMLElement => Boolean(el));
    if (!targets.length || !("IntersectionObserver" in window)) return;
    const visible = new Map<string, number>();
    const mark = () => {
      const top = targets.find((t) => (visible.get(t.id) ?? 0) > 0);
      for (const a of links) {
        const on = Boolean(top) && a.hash === `#${top!.id}`;
        a.classList.toggle("is-here", on);
        if (on) a.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        mark();
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: [0, 0.01, 0.5] },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
  return null;
}
