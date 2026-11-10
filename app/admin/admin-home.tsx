"use client";

// Admin → Home: the panel's landing page. What needs you right now, a search across every tool (by name, section
// and what it's for), your pinned tools and the ones you used lately, then every tool grouped by section.

import "./admin-home.css";
import { ArrowRight, Clock, Search, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { readRecent } from "./command-palette";

export type HomeTab = { key: string; label: string; icon: LucideIcon; group: string };
export type HomeAlert = { count: number; hot?: boolean; live?: boolean; label: string } | null;

/** One line per tool: what it's for (also searched, so people can find a tool by what they want to do). */
const ABOUT: Record<string, string> = {
  inbox: "Everything waiting on staff in one list: claim it, handle it, done.",
  overview: "Punishment numbers and trends at a glance.",
  insights: "Join funnel, why people leave, economy health, how events did.",
  graphics: "Make shareable stat images.",
  seasons: "Seasonal theme, currency name and server art.",
  status: "The public status page, incidents and maintenance mode.",
  guide: "How things work here, for staff.",
  punishments: "Every warn, mute, kick and ban; search and filter.",
  reports: "Messages members reported with right-click.",
  cases: "Files for ongoing issues: members, notes, linked reports.",
  banrequests: "Bans from Jr Mods waiting for a Mod or higher.",
  appeals: "Members asking for a punishment to be lifted.",
  watchlist: "Members staff are keeping an eye on.",
  automod: "AutoMod catches, rules, word lists and mistakes.",
  lockdown: "Lock channels or the whole server.",
  logs: "Bot logs: joins, leaves, edits, deletions, voice.",
  live: "Read the server's chat live.",
  removed: "Deleted and cleaned-up messages, archived.",
  rules: "Edit the server rules (Discord and website).",
  "discord-members": "Explore every member, filter, bulk role changes.",
  "role-picker": "The self-assign roles and their categories.",
  join: "Join applications: accept, deny, ban.",
  tickets: "Every ticket and transcript, live tickets, saved replies, response times.",
  messages: "Social chats (admins, logged).",
  patreon: "Patrons, tiers and perks.",
  tasks: "The team's shared to-do list.",
  "staff-activity": "What each staff member handled; promotion flags.",
  "staff-apps": "Staff applications by stage, with votes.",
  security: "Staff two-factor and signed-in devices.",
  announcements: "Write, preview and schedule announcements.",
  events: "Server events and polls.",
  "chat-events": "Seasonal chat events.",
  giveaways: "Run giveaways and pay out prizes.",
  "auto-replies": "Bot answers to common questions, and !commands.",
  games: "Casino games, Wordle and players.",
  dating: "Social profiles, photos and reports.",
  accounts: "Website accounts: email, 2FA, bans, view as.",
  emails: "Emails the site sent and email settings.",
  news: "News posts: write, approve, schedule.",
  ads: "Discord tip messages and their settings.",
  traffic: "Website visits and pages.",
  "admin-log": "Every change made in this panel, with Undo.",
  database: "Browse and clean the databases, backups.",
  "bot-console": "Live consoles, restarts, issues, up to date?, uptime.",
  "bot-main": "Main Bot settings.",
  "bot-economy": "Economy Bot settings.",
  "bot-moderation": "Moderation Bot settings and command permissions.",
  "bot-ticketing": "Ticket Bot settings.",
  server: "Channels, roles and the server layout.",
  "server-tools": "Who can do what where; quiet channels.",
  "bot-history": "Every bot settings change.",
};

const PIN_KEY = "kk-admin-pinned";
const readPins = (): string[] => {
  try {
    return JSON.parse(window.localStorage.getItem(PIN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

export function AdminHome({ tabs, alerts, onTab, name }: { tabs: HomeTab[]; alerts: Record<string, HomeAlert>; onTab: (key: string) => void; name: string }) {
  const [q, setQ] = useState("");
  const [pins, setPins] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setPins(readPins());
    setRecent(readRecent());
  }, []);
  const togglePin = (key: string) =>
    setPins((p) => {
      const next = p.includes(key) ? p.filter((k) => k !== key) : [...p, key];
      try {
        window.localStorage.setItem(PIN_KEY, JSON.stringify(next));
      } catch {
        // private mode: pins just last this visit
      }
      return next;
    });

  const usable = tabs.filter((t) => t.key !== "home");
  const byKey = new Map(usable.map((t) => [t.key, t]));
  const needs = usable
    .map((t) => ({ t, a: alerts[t.key] }))
    .filter((x): x is { t: HomeTab; a: NonNullable<HomeAlert> } => Boolean(x.a && x.a.count > 0))
    .sort((x, y) => Number(Boolean(y.a.hot)) - Number(Boolean(x.a.hot)) || y.a.count - x.a.count);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = useMemo(
    () => (words.length ? usable.filter((t) => words.every((w) => `${t.label} ${t.group} ${ABOUT[t.key] ?? ""}`.toLowerCase().includes(w))) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, tabs],
  );
  const sections = Array.from(new Set(usable.map((t) => t.group)));
  const pinned = pins.map((k) => byKey.get(k)).filter((t): t is HomeTab => Boolean(t));
  const recentTabs = recent.filter((k) => k !== "home" && !pins.includes(k)).map((k) => byKey.get(k)).filter((t): t is HomeTab => Boolean(t)).slice(0, 6);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const Card = ({ t, compact }: { t: HomeTab; compact?: boolean }) => {
    const a = alerts[t.key];
    const pinnedNow = pins.includes(t.key);
    return (
      <div className={`ah-card${compact ? " is-compact" : ""}${a?.hot ? " is-hot" : ""}`}>
        <button type="button" className="ah-card-main" onClick={() => onTab(t.key)}>
          <span className="ah-card-icon" aria-hidden="true">
            <t.icon size={compact ? 16 : 18} />
          </span>
          <span className="ah-card-text">
            <b>{t.label}</b>
            {!compact && ABOUT[t.key] ? <small>{ABOUT[t.key]}</small> : null}
          </span>
          {a && a.count > 0 ? (
            <span className={`ah-badge${a.hot ? " is-hot" : ""}`} title={a.label}>
              {a.count > 999 ? "999+" : a.count}
            </span>
          ) : null}
        </button>
        <button type="button" className={`ah-pin${pinnedNow ? " is-on" : ""}`} onClick={() => togglePin(t.key)} aria-label={pinnedNow ? `Unpin ${t.label}` : `Pin ${t.label} to Home`} aria-pressed={pinnedNow} title={pinnedNow ? "Unpin" : "Pin to Home"}>
          <Star size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="ah">
      <header className="ah-head">
        <div>
          <h2>
            {hello}, {name.split(" ")[0]}
          </h2>
          <p className="adm-muted">{needs.length ? `${needs.reduce((n, x) => n + x.a.count, 0)} things are waiting across ${needs.length} tool${needs.length === 1 ? "" : "s"}.` : "Nothing is waiting right now. 🎉"}</p>
        </div>
      </header>

      {needs.length ? (
        <section className="ah-needs" aria-label="Needs you">
          {needs.map(({ t, a }) => (
            <button key={t.key} type="button" className={`ah-need${a.hot ? " is-hot" : ""}`} onClick={() => onTab(t.key)}>
              <t.icon size={16} aria-hidden="true" />
              <span>
                <b>{t.label}</b>
                <small>{a.label}</small>
              </span>
              <ArrowRight size={14} aria-hidden="true" className="ah-need-go" />
            </button>
          ))}
        </section>
      ) : null}

      <label className="ah-search">
        <Search size={18} aria-hidden="true" />
        <input
          ref={search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) onTab(matches[0].key);
            if (e.key === "Escape") setQ("");
          }}
          placeholder="Find a tool… (try “mute”, “photos”, “dob”, “restart”)"
          aria-label="Find a tool"
        />
        <kbd>Ctrl K</kbd>
      </label>

      {words.length ? (
        <section className="ah-section">
          <h3>
            {matches.length} result{matches.length === 1 ? "" : "s"}
          </h3>
          {matches.length ? (
            <div className="ah-grid">
              {matches.map((t) => (
                <Card key={t.key} t={t} />
              ))}
            </div>
          ) : (
            <p className="adm-empty">No tool matches that. Try another word, or Ctrl+K to search members and tickets too.</p>
          )}
        </section>
      ) : (
        <>
          {pinned.length || recentTabs.length ? (
            <div className="ah-quick">
              {pinned.length ? (
                <section className="ah-section">
                  <h3>
                    <Star size={14} aria-hidden="true" /> Pinned
                  </h3>
                  <div className="ah-row">
                    {pinned.map((t) => (
                      <Card key={t.key} t={t} compact />
                    ))}
                  </div>
                </section>
              ) : null}
              {recentTabs.length ? (
                <section className="ah-section">
                  <h3>
                    <Clock size={14} aria-hidden="true" /> Recently used
                  </h3>
                  <div className="ah-row">
                    {recentTabs.map((t) => (
                      <Card key={t.key} t={t} compact />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <p className="adm-muted ah-tip">Tip: press the ☆ on any tool to pin it here.</p>
          )}
          {sections.map((sec) => (
            <section key={sec} className="ah-section">
              <h3>{sec}</h3>
              <div className="ah-grid">
                {usable
                  .filter((t) => t.group === sec)
                  .map((t) => (
                    <Card key={t.key} t={t} />
                  ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
