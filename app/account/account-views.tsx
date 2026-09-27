"use client";

import { BarChart3 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { StatsView } from "./stats-view";

const isStats = () => typeof window !== "undefined" && window.location.hash === "#stats";

/**
 * My Account's main column. On #stats it swaps the sections (Discord, Overview, roles, daily…)
 * for the stats page; "Back to profile" or any section link swaps them back. The sections stay
 * mounted while hidden so nothing typed into them is lost.
 */
export function AccountViews({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = isStats();
      setStats(next);
      if (next) {
        // Phones stack the profile card above: bring the stats into view, else go to the top
        requestAnimationFrame(() => {
          const main = document.querySelector(".acct-main");
          const top = main ? main.getBoundingClientRect().top + window.scrollY - 90 : 0;
          window.scrollTo({ top: window.innerWidth < 900 ? top : 0, behavior: "smooth" });
        });
        return;
      }
      // A section link (e.g. #roles) while the stats page was showing: scroll once it's visible again
      const id = window.location.hash.slice(1);
      if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const back = () => {
    history.pushState(null, "", window.location.pathname + window.location.search);
    setStats(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="acct-main">
      <div className="acct-main-sections" hidden={stats}>
        {children}
      </div>
      {stats ? <StatsView onBack={back} /> : null}
    </div>
  );
}

/** Profile card button that opens the stats page. */
export function StatsButton() {
  return (
    <a className="acct-stats-button" href="#stats">
      <BarChart3 size={16} aria-hidden="true" /> View my stats
    </a>
  );
}
