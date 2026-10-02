"use client";

import "../games/games.css";
import { BarChart3, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import type { SiteGames } from "../../lib/games/stats";
import { LiveGames } from "../games/live";
import { SiteGamesStats } from "../games/stats-ui";

const staffTable = (id: string) => `/api/admin/games?table=${encodeURIComponent(id)}`;

/** Admin → Games: live tables (staff can watch anyone, even private players) and server-wide gambling stats. */
export function GamesTab() {
  const [stats, setStats] = useState<SiteGames | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"live" | "stats">("live");
  const [live, setLive] = useState<number | null>(null);
  const watch = typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("watch") : null;

  useEffect(() => {
    fetch("/api/admin/games", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => (r?.ok ? setStats(r.stats) : setError(r?.error ?? "Couldn't load game stats.")))
      .catch(() => setError("Couldn't load game stats."));
  }, []);

  return (
    <section className="adm-games">
      <div className="gm-tabs adm-games-tabs" role="tablist" aria-label="Games views">
        <button type="button" role="tab" aria-selected={view === "live"} className={view === "live" ? "is-on" : ""} onClick={() => setView("live")}>
          <Radio size={16} aria-hidden="true" /> Live tables
          {live ? <span className="gm-tab-badge">{live}</span> : null}
        </button>
        <button type="button" role="tab" aria-selected={view === "stats"} className={view === "stats" ? "is-on" : ""} onClick={() => setView("stats")}>
          <BarChart3 size={16} aria-hidden="true" /> Gambling stats
        </button>
        <span className="gm-tab-ink" style={{ transform: `translateX(${view === "live" ? 0 : 100}%)`, width: "calc(50% - 4px)" }} aria-hidden="true" />
      </div>
      {view === "live" ? (
        <>
          <p className="adm-muted">Staff can watch every table, including members who keep their games private. Watching counts toward the viewer number.</p>
          <LiveGames listUrl="/api/admin/games?live=1" tableUrl={staffTable} minBet={25} rouletteUrl="/api/admin/games?roulette=1" initialWatch={watch && (/^(bj|sc|sl):\d{5,25}$/.test(watch) || watch === "rl:table") ? watch : null} onCount={setLive} />
        </>
      ) : error ? (
        <p className="adm-error">{error}</p>
      ) : stats ? (
        <SiteGamesStats stats={stats} />
      ) : (
        <div className="adm-skeleton" style={{ height: 320 }} />
      )}
    </section>
  );
}
