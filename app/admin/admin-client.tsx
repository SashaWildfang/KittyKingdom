"use client";

import "./admin-nav.css";
import { TicketCanDelete, TicketDeletePermissions } from "./delete-ticket-button";
import { Eye, Inbox, Tags, ChevronDown, ChevronRight, Menu, Search, X, Lock, PartyPopper, Activity, Archive, AtSign, Database, CalendarDays, Gift, SunSnow, BarChart3, Bot, Coins, History, Megaphone, Server, Shield as ShieldIcon, BookOpen, Crown, Hammer, ClipboardCheck, ListChecks, TerminalSquare, Dices, Gavel, Globe, HeartHandshake, Mail, MessagesSquare, Newspaper, Scale, ScrollText, ShieldCheck, Ticket, Users, UsersRound, ImagePlus, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AccountsTab } from "./accounts-tab";
import { AppealsTab } from "./appeals-tab";
import { AutoModTab } from "./automod-tab";
import { DatingTab } from "./dating-tab";
import { MemberSearch, useLive, useStored } from "./admin-shared";
import { DrillPanel, type Drill } from "./drill-panel";
import { JoinAppsTab } from "./join-apps";
import { LiveTab } from "./live-tab";
import { LogsTab } from "./logs-tab";
import { MemberDrawer } from "./member-drawer";
import { MessagesTab, type Chat, type ChatFilter } from "./messages-tab";
import { GamesTab } from "./games-tab";
import { GuideTab } from "./guide-tab";
import { BanRequestsTab } from "./ban-requests-tab";
import { NewsTab } from "./news-tab";
import { PatreonTab } from "./patreon-tab";
import { DatabaseTab } from "./database-tab";
import { EmailsTab } from "./emails-tab";
import { AdsTab } from "./ads-tab";
import { TabBoundary } from "./tab-boundary";
import { RemovedTab } from "./removed-tab";
import { GiveawaysTab } from "./giveaways-tab";
import { ChatEventsTab } from "./chat-events-tab";
import { LockdownTab } from "./lockdown-tab";
import { SeasonsTab } from "./seasons-tab";
import { StatusTab } from "./status-tab";
import { EventsTab } from "./events-tab";
import { RulesTab } from "./rules-tab";
import { BotSettingsTab } from "./bots/bot-settings-tab";
import { BotsHistoryTab } from "./bots/change-log";
import { ConsoleTab } from "./bots/console-tab";
import { ServerSettingsTab } from "./bots/server-tab";
import { TrafficTab } from "./traffic-tab";
import { OverviewTab } from "./overview-tab";
import { DEFAULT_PUNISHMENT_FILTERS, PunishmentsTab, type PunishmentFilters } from "./punishments-tab";
import { TicketsTab } from "./tickets-tab";
import { MembersTab } from "./members/members-tab";
import { GraphicsTab } from "./graphics/graphics-tab";
import { TranscriptViewer } from "./transcript-viewer";
import { RolePickerTab } from "./role-picker-tab";
import { InboxTab } from "./inbox-tab";
import { WatchlistTab } from "./watchlist-tab";
import { CommandPalette, rememberTab } from "./command-palette";

type Tab = "graphics" | "discord-members" | "overview" | "punishments" | "automod" | "logs" | "tickets" | "accounts" | "news" | "traffic" | "live" | "join" | "dating" | "appeals" | "messages" | "games" | "guide" | "banrequests" | "patreon" | "emails" | "ads" | "bot-main" | "bot-economy" | "bot-moderation" | "bot-ticketing" | "server" | "bot-history" | "removed" | "giveaways" | "seasons" | "status" | "events" | "rules" | "bot-console" | "database" | "chat-events" | "lockdown" | "role-picker" | "inbox" | "watchlist";
type Level = "admin" | "staff";

// Tabs are grouped so the bar stays short: pick a group, then one of its tabs
type Group = "overview" | "moderation" | "members" | "community" | "website" | "bots";
const GROUPS: { key: Group; label: string; icon: LucideIcon; tabs: Tab[] }[] = [
  { key: "overview", label: "Overview", icon: BarChart3, tabs: ["inbox", "overview", "graphics", "seasons", "status", "guide"] },
  { key: "moderation", label: "Moderation", icon: Gavel, tabs: ["punishments", "banrequests", "appeals", "watchlist", "automod", "lockdown", "logs", "live", "removed", "rules"] },
  { key: "members", label: "Members", icon: Users, tabs: ["discord-members", "role-picker", "join", "tickets", "messages", "patreon"] },
  { key: "community", label: "Community", icon: PartyPopper, tabs: ["events", "chat-events", "giveaways", "games", "dating"] },
  { key: "website", label: "Website", icon: Globe, tabs: ["accounts", "emails", "news", "ads", "traffic", "database"] },
  { key: "bots", label: "Bots", icon: Bot, tabs: ["bot-console", "bot-main", "bot-economy", "bot-moderation", "bot-ticketing", "server", "bot-history"] },
];

// admin: admins only; giveaways: admins and Community Managers
const TABS: { key: Tab; label: string; icon: LucideIcon; admin?: boolean; giveaways?: boolean }[] = [
  { key: "inbox", label: "Needs attention", icon: Inbox },
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "discord-members", label: "Discord Members", icon: UsersRound, admin: true },
  { key: "role-picker", label: "Role Picker", icon: Tags, admin: true },
  { key: "graphics", label: "Graphics", icon: ImagePlus, admin: true },
  { key: "seasons", label: "Seasons", icon: SunSnow, admin: true },
  { key: "status", label: "Status", icon: Activity, admin: true },
  { key: "guide", label: "Staff Guide", icon: BookOpen },
  { key: "punishments", label: "Punishments", icon: Gavel },
  { key: "banrequests", label: "Ban Requests", icon: Hammer },
  { key: "appeals", label: "Appeals", icon: Scale, admin: true },
  { key: "watchlist", label: "Watchlist", icon: Eye },
  { key: "automod", label: "AutoMod", icon: ShieldCheck },
  { key: "lockdown", label: "Lockdown", icon: Lock },
  { key: "rules", label: "Rules", icon: ListChecks, admin: true },
  { key: "join", label: "Join Apps", icon: ClipboardCheck },
  { key: "logs", label: "Logs", icon: ScrollText },
  { key: "dating", label: "Social", icon: HeartHandshake },
  { key: "messages", label: "Messages", icon: Mail, admin: true },
  { key: "games", label: "Games", icon: Dices },
  { key: "events", label: "Events", icon: CalendarDays },
  { key: "giveaways", label: "Giveaways", icon: Gift, giveaways: true },
  { key: "chat-events", label: "Chat Events", icon: PartyPopper, giveaways: true },
  { key: "patreon", label: "Patreon", icon: Crown, admin: true },
  { key: "live", label: "Live Chat", icon: MessagesSquare },
  { key: "removed", label: "Removed messages", icon: Archive, admin: true },
  { key: "tickets", label: "Tickets", icon: Ticket },
  { key: "accounts", label: "Accounts", icon: Users, admin: true },
  { key: "emails", label: "Emails", icon: AtSign, admin: true },
  { key: "news", label: "News", icon: Newspaper, admin: true },
  { key: "ads", label: "Ads", icon: Megaphone, admin: true },
  { key: "bot-console", label: "Consoles", icon: TerminalSquare, admin: true },
  { key: "bot-main", label: "Main Bot", icon: Bot, admin: true },
  { key: "bot-economy", label: "Economy Bot", icon: Coins, admin: true },
  { key: "bot-moderation", label: "Moderation Bot", icon: ShieldIcon, admin: true },
  { key: "bot-ticketing", label: "Ticket Bot", icon: Ticket, admin: true },
  { key: "server", label: "Discord Server", icon: Server, admin: true },
  { key: "bot-history", label: "History", icon: History, admin: true },
  { key: "traffic", label: "Traffic", icon: Activity, admin: true },
  { key: "database", label: "Database", icon: Database, admin: true },
];

// Clicking a headline number opens the punishments list filtered to that kind
const ACTION_GROUPS: Record<string, string[]> = {
  ban: ["ban", "tempban"],
  mute: ["mute", "tempmute", "timeout", "muzzle"],
  kick: ["kick", "kick_unverified"],
  warn: ["warn"],
  unban: ["unban"],
};

export function AdminClient({ adminName, level, canDeleteNsfw = false, canGiveaways = false }: { adminName: string; level: Level; canDeleteNsfw?: boolean; canGiveaways?: boolean }) {
  const isAdmin = level === "admin";
  const tabs = TABS.filter((t) => isAdmin || (t.giveaways ? canGiveaways : !t.admin));
  const [tab, setTab] = useState<Tab>("overview");
  const [member, setMember] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<number | null>(null);
  // The ticket's database id when opened from a list, so the right one opens even if numbers have moved since
  const [transcriptKey, setTranscriptKey] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);
  // Admin → Messages: the open chat, and whose chats the list is narrowed to
  const [chat, setChat] = useState<Chat | null>(null);
  const [chatFilter, setChatFilter] = useState<ChatFilter>(null);
  const [punishmentFilters, setPunishmentFilters] = useStored<PunishmentFilters>("punishment-filters", DEFAULT_PUNISHMENT_FILTERS);
  const { data: meta } = useLive<{ actions: string[]; ticketTypes: string[] }>("/api/admin/meta", 60_000);
  const [urlRead, setUrlRead] = useState(false);
  // Waiting join applications, for the bubble on the Join Apps tab
  const joinCount = useLive<{ pending: number | null }>("/api/admin/join-apps/count", 15_000);
  const pendingApps = joinCount.data?.pending ?? 0;
  // Unread live messages, for the bubble on the Live Chat tab (the tab itself reports it live while open)
  const liveUnreadPoll = useLive<{ unread: number | null }>(tab === "live" ? null : "/api/admin/live/unread", 10_000);
  const [liveUnread, setLiveUnread] = useState<number | null>(null);
  useEffect(() => {
    if (typeof liveUnreadPoll.data?.unread === "number") setLiveUnread(liveUnreadPoll.data.unread);
  }, [liveUnreadPoll.data]);
  // New AutoMod catches since you last looked (the tab marks them seen while it's open)
  const automodPoll = useLive<{ unread: number | null }>(tab === "automod" ? null : "/api/admin/automod/unread", 10_000);
  const [automodUnread, setAutomodUnread] = useState<number | null>(null);
  useEffect(() => {
    if (typeof automodPoll.data?.unread === "number") setAutomodUnread(automodPoll.data.unread);
  }, [automodPoll.data]);
  useEffect(() => {
    if (tab === "automod") setAutomodUnread(0);
  }, [tab]);
  // Open tickets right now, for the bubble on the Tickets tab (staff don't count NSFW verification tickets)
  const openTicketsPoll = useLive<{ count: number }>("/api/admin/tickets/open?count=1", 15_000);
  const openTickets = openTicketsPoll.data?.count ?? 0;
  // News posts waiting for review (admins)
  const newsPoll = useLive<{ pending: number }>(isAdmin && tab !== "news" ? "/api/admin/news?status=pending" : null, 30_000);
  const pendingNews = newsPoll.data?.pending ?? 0;
  // Open dating reports
  const datingPoll = useLive<{ reports: unknown[] }>(tab !== "dating" ? "/api/admin/dating/reports?status=open" : null, 60_000);
  const datingReports = datingPoll.data?.reports.length ?? 0;
  // Appeals waiting for a decision (admins)
  const appealsPoll = useLive<{ counts: Record<string, number> }>(isAdmin && tab !== "appeals" ? "/api/admin/appeals?status=pending" : null, 30_000);
  const pendingAppeals = appealsPoll.data?.counts.pending ?? 0;
  // Jr Mod ban requests waiting for a Mod+
  const bansPoll = useLive<{ pending: number }>("/api/admin/ban-requests?count=1", 20_000);
  const pendingBans = bansPoll.data?.pending ?? 0;
  // Everything waiting on someone (Needs attention)
  const inboxPoll = useLive<{ total: number; urgent: number }>(tab !== "inbox" ? "/api/admin/inbox?count=1" : null, 30_000);
  const inboxTotal = inboxPoll.data?.total ?? 0;
  const inboxUrgent = inboxPoll.data?.urgent ?? 0;

  // Bubbles on tabs (and added up on their group)
  // 999 → "999", 1,420 → "1.42k", 15,300 → "15.3k"
  const shortCount = (n: number) => (n < 1000 ? String(n) : n < 10_000 ? `${(Math.floor(n / 10) / 100).toString()}k` : n < 1_000_000 ? `${(Math.floor(n / 100) / 10).toString()}k` : `${(Math.floor(n / 100_000) / 10).toString()}m`);
  const alert = (k: Tab): { count: number; hot?: boolean; live?: boolean; label: string } | null => {
    if (k === "inbox" && inboxTotal > 0 && tab !== "inbox") return { count: inboxTotal, hot: inboxUrgent > 0, label: `${inboxTotal} waiting${inboxUrgent ? `, ${inboxUrgent} urgent` : ""}` };
    if (k === "live" && liveUnread) return { count: liveUnread, live: true, label: `${liveUnread} unread` };
    if (k === "automod" && automodUnread) return { count: automodUnread, hot: true, label: `${automodUnread} new` };
    if (k === "news" && pendingNews > 0 && tab !== "news") return { count: pendingNews, label: `${pendingNews} waiting for review` };
    if (k === "dating" && datingReports > 0 && tab !== "dating") return { count: datingReports, hot: true, label: `${datingReports} open reports` };
    if (k === "appeals" && pendingAppeals > 0 && tab !== "appeals") return { count: pendingAppeals, hot: true, label: `${pendingAppeals} waiting` };
    if (k === "banrequests" && pendingBans > 0) return { count: pendingBans, hot: true, label: `${pendingBans} waiting for a Mod+` };
    if (k === "tickets" && openTickets > 0) return { count: openTickets, hot: true, label: `${openTickets} open` };
    if (k === "join" && pendingApps > 0) return { count: pendingApps, hot: true, label: `${pendingApps} pending` };
    return null;
  };
  const groups = GROUPS.map((g) => ({ ...g, tabs: g.tabs.filter((k) => tabs.some((t) => t.key === k)) })).filter((g) => g.tabs.length);
  const group = (groups.find((g) => g.tabs.includes(tab)) ?? groups[0]).key;
  const groupTabsOf = (g: Group) => (groups.find((x) => x.key === g)?.tabs ?? []).map((k) => tabs.find((t) => t.key === k)!).filter(Boolean);
  const currentTab = tabs.find((t) => t.key === tab);
  useEffect(() => {
    rememberTab(tab);
  }, [tab]);
  // Section menu: search, collapsed groups (remembered), and the slide-in menu on small screens
  const [navQ, setNavQ] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useStored<Group[]>("nav-collapsed", []);
  const navSearch = useRef<HTMLInputElement>(null);
  const navMatches = navQ.trim()
    ? groups.flatMap((g) => groupTabsOf(g.key).filter((t) => `${t.label} ${g.label}`.toLowerCase().includes(navQ.trim().toLowerCase())))
    : [];
  const pickTab = (k: Tab) => {
    setTab(k);
    setNavQ("");
    setNavOpen(false);
  };
  // Things waiting outside the open section (for the menu button on small screens)
  // (Needs attention is left out: everything in it is already counted on its own tab)
  const menuAlerts = tabs.reduce((n, t) => n + (t.key === "live" || t.key === "inbox" || t.key === tab ? 0 : alert(t.key)?.count ?? 0), 0);
  // While the slide-in menu is open: the page behind doesn't scroll, and Escape closes it
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    // The menu only exists on small screens: widening the window closes it (and lets the page scroll again)
    const wide = window.matchMedia("(min-width: 1001px)");
    const onWide = () => wide.matches && setNavOpen(false);
    window.addEventListener("keydown", esc);
    wide.addEventListener("change", onWide);
    onWide();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
      wide.removeEventListener("change", onWide);
    };
  }, [navOpen]);
  // "/" jumps to the section search (unless you're typing somewhere)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || el?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      if (window.matchMedia("(max-width: 1000px)").matches) setNavOpen(true);
      window.setTimeout(() => navSearch.current?.focus(), 30);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Keep the open tab / member / transcript in the address bar so links can be shared
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as Tab | null;
    if (t && tabs.some((x) => x.key === t)) setTab(t);
    if (params.get("member")) setMember(params.get("member"));
    if (params.get("ticket")) setTranscript(Number(params.get("ticket")));
    const c = /^(\d{15,21})-(\d{15,21})$/.exec(params.get("chat") ?? "");
    if (isAdmin && c) setChat({ a: c[1], b: c[2] });
    setUrlRead(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Wait until the address bar has been read, or it would be overwritten with the default tab
    if (!urlRead) return;
    const params = new URLSearchParams({ tab });
    if (member) params.set("member", member);
    if (transcript) params.set("ticket", String(transcript));
    if (tab === "messages" && chat) params.set("chat", `${chat.a}-${chat.b}`);
    // The Games tab keeps the table being watched in the link
    const watching = new URLSearchParams(window.location.search).get("watch");
    if (tab === "games" && watching) params.set("watch", watching);
    // The Staff Guide keeps its section in the link
    const section = new URLSearchParams(window.location.search).get("section");
    if (tab === "guide" && section) params.set("section", section);
    // A bell alert's link to one bot's console issues
    const bot = new URLSearchParams(window.location.search).get("bot");
    if (tab === "bot-console" && bot) params.set("bot", bot);
    window.history.replaceState(null, "", `/admin?${params}`);
  }, [tab, member, transcript, urlRead, chat]);

  const openMember = useCallback((id: string) => setMember(id), []);
  const openTranscript = useCallback((id: number, key?: string | null) => {
    setTranscriptKey(key ?? null);
    setTranscript(id);
  }, []);

  function submitLookup(text: string) {
    const value = text.trim().replace(/[<@!>]/g, "");
    if (/^\d{15,21}$/.test(value)) {
      setMember(value);
    } else if (/^#?\d{1,6}$/.test(value)) {
      setTranscript(Number(value.replace("#", "")));
    } else if (value) {
      setPunishmentFilters((f) => ({ ...f, search: value, member: null }));
      setTab("punishments");
    }
    setLookup("");
  }

  // The section menu: inline on wide screens, a slide-in drawer on small ones
  const sideNav = (drawer: boolean) => (
<aside className={`adm-side${drawer ? " is-drawer" : ""}`} aria-label="Admin sections">
      <div className="adm-side-top">
        <label className="adm-side-search">
          <Search size={14} aria-hidden="true" />
          <input ref={drawer === navOpen ? navSearch : undefined} value={navQ} onChange={(e) => setNavQ(e.target.value)} placeholder="Jump to…" aria-label="Find a section" onKeyDown={(e) => {
            if (e.key === "Enter" && navMatches.length) pickTab(navMatches[0].key);
            if (e.key === "Escape") setNavQ("");
          }} />
          {!navQ ? <kbd>/</kbd> : null}
        </label>
        <button type="button" className="adm-side-close" onClick={() => setNavOpen(false)} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>
      <nav className="adm-side-groups">
        {groups.map((g) => {
          const list = groupTabsOf(g.key).filter((t) => !navQ || navMatches.includes(t));
          if (!list.length) return null;
          // Live Chat is just unread chat, not something to act on, so it doesn't add to its group
          const count = g.tabs.reduce((n, k) => n + (k === "live" || k === "inbox" ? 0 : alert(k)?.count ?? 0), 0);
          const hot = g.tabs.some((k) => k !== "live" && k !== "inbox" && alert(k)?.hot);
          const closed = !navQ && collapsed.includes(g.key) && g.key !== group;
          return (
            <section key={g.key} className={`adm-side-group${g.key === group ? " is-current" : ""}`}>
              <button type="button" className="adm-side-head" aria-expanded={!closed} onClick={() => setCollapsed((c) => (c.includes(g.key) ? c.filter((x) => x !== g.key) : [...c, g.key]))}>
                <g.icon size={15} aria-hidden="true" />
                <span>{g.label}</span>
                {/* Collapsed: how many are waiting inside. Open: a dot (the tabs below show the numbers) */}
                {count > 0 ? (
                  closed ? (
                    <span className={`adm-tab-bubble${hot ? " is-hot" : ""}`}>{shortCount(count)}</span>
                  ) : (
                    <span className={`adm-side-dot${hot ? " is-hot" : ""}`} aria-label={`${count} waiting`} />
                  )
                ) : null}
                <ChevronDown size={14} className="adm-side-chev" aria-hidden="true" />
              </button>
              {!closed ? (
                <ul role="tablist" aria-label={g.label}>
                  {list.map((t) => {
                    const a = alert(t.key);
                    return (
                      <li key={t.key}>
                        <button type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "is-active" : undefined} onClick={() => pickTab(t.key)}>
                          <t.icon size={15} aria-hidden="true" />
                          <span>{t.label}</span>
                          {a ? (
                            <span className={`adm-tab-bubble${a.hot ? " is-hot" : ""}${a.live ? " is-live" : ""}`} aria-label={a.label}>
                              {shortCount(a.count)}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}
        {navQ && !navMatches.length ? <p className="adm-side-empty">No section called &ldquo;{navQ}&rdquo;.</p> : null}
      </nav>
    </aside>
  );

  return (
    <TicketDeletePermissions.Provider value={canDeleteNsfw}>
    <TicketCanDelete.Provider value={isAdmin}>
    <div className="adm">
      <header className="adm-head">
        <div className="adm-head-copy">
          <p className="eyebrow">{isAdmin ? "Bear Nation Admin" : "Bear Nation Staff"}</p>
          <h1>Moderation center</h1>
          <p className="adm-sub">
            Welcome back, {adminName}. Everything here updates live.
            <span className={`adm-level adm-level--${level}`}>{isAdmin ? "Admin access" : "Staff access"}</span>
          </p>
        </div>
        <MemberSearch
          className="adm-lookup"
          value={lookup}
          onChange={setLookup}
          onPick={(m) => {
            setLookup("");
            setMember(m.id);
          }}
          onSubmit={submitLookup}
          placeholder="Find a member, ID, @mention or ticket #"
        />
      </header>

      {/* A sidebar of every section, grouped (a menu button on small screens) */}
      <div className="adm-layout">
        {sideNav(false)}
        {/* On small screens the menu slides in over the page (on <body>, so nothing can clip it) */}
        {navOpen ? createPortal(<><div className="adm-side-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />{sideNav(true)}</>, document.body) : null}

        <div className="adm-main">
          <div className="adm-where">
            <button type="button" className="adm-menu-btn" onClick={() => setNavOpen(true)} aria-label="Open the section menu">
              <Menu size={18} aria-hidden="true" />
            </button>
            <span className="adm-where-group">{groups.find((g) => g.key === group)?.label}</span>
            <ChevronRight size={14} aria-hidden="true" />
            <b>{currentTab?.label}</b>
            {menuAlerts > 0 ? <span className="adm-tab-bubble is-hot adm-where-alerts">{shortCount(menuAlerts)}</span> : null}
            <button
              type="button"
              className="adm-goto"
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
              title="Jump to any tab, member or ticket (Ctrl+K)"
            >
              <Search size={13} aria-hidden="true" /> Go to… <kbd>Ctrl K</kbd>
            </button>
          </div>
          <CommandPalette
            tabs={tabs.map((t) => ({ key: t.key, label: t.label, icon: t.icon, group: groups.find((g) => g.tabs.includes(t.key))?.label ?? "" }))}
            onTab={(k) => pickTab(k as Tab)}
            onMember={openMember}
            onTicket={openTranscript}
          />
      <TabBoundary key={tab} name={tab}>
      {tab === "overview" ? (
        <OverviewTab
          level={level}
          onOpenMember={openMember}
          onDrill={setDrill}
          onFilterPunishments={(action) => {
            setPunishmentFilters({ ...DEFAULT_PUNISHMENT_FILTERS, actions: ACTION_GROUPS[action] ?? [action] });
            setTab("punishments");
          }}
        />
      ) : null}
      {tab === "punishments" ? (
        <PunishmentsTab filters={punishmentFilters} setFilters={setPunishmentFilters} actionsAvailable={meta?.actions ?? []} onOpenMember={openMember} />
      ) : null}
      {tab === "automod" ? <AutoModTab onOpenMember={openMember} /> : null}
      {tab === "join" ? <JoinAppsTab onOpenMember={openMember} /> : null}
      {tab === "live" ? <LiveTab onOpenMember={openMember} onUnread={setLiveUnread} /> : null}
      {tab === "logs" ? <LogsTab onOpenMember={openMember} /> : null}
      {tab === "dating" ? <DatingTab onOpenMember={openMember} /> : null}
      {tab === "games" ? <GamesTab /> : null}
      {tab === "guide" ? <GuideTab /> : null}
      {tab === "banrequests" ? <BanRequestsTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "appeals" ? <AppealsTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "messages" ? <MessagesTab chat={chat} onChat={setChat} filter={chatFilter} onFilter={setChatFilter} onOpenMember={openMember} /> : null}
      {isAdmin && tab === "discord-members" ? <MembersTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "graphics" ? <GraphicsTab /> : null}
      {tab === "tickets" ? <TicketsTab typesAvailable={meta?.ticketTypes ?? []} readOnly={!isAdmin} onOpenMember={openMember} onOpenTranscript={openTranscript} /> : null}
      {isAdmin && tab === "accounts" ? <AccountsTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "patreon" ? <PatreonTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "emails" ? <EmailsTab /> : null}
      {isAdmin && tab === "database" ? <DatabaseTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "news" ? <NewsTab /> : null}
      {isAdmin && tab === "ads" ? <AdsTab /> : null}
      {isAdmin && tab === "removed" ? <RemovedTab /> : null}
      {(isAdmin || canGiveaways) && tab === "giveaways" ? <GiveawaysTab /> : null}
      {(isAdmin || canGiveaways) && tab === "chat-events" ? <ChatEventsTab /> : null}
      {tab === "lockdown" ? <LockdownTab /> : null}
      {isAdmin && tab === "seasons" ? <SeasonsTab /> : null}
      {isAdmin && tab === "status" ? <StatusTab /> : null}
      {tab === "events" ? <EventsTab /> : null}
      {isAdmin && tab === "rules" ? <RulesTab /> : null}
      {isAdmin && tab === "bot-console" ? <ConsoleTab /> : null}
      {isAdmin && tab === "bot-main" ? <BotSettingsTab key="main" botKey="main" /> : null}
      {isAdmin && tab === "bot-economy" ? <BotSettingsTab key="economy" botKey="economy" /> : null}
      {isAdmin && tab === "bot-moderation" ? <BotSettingsTab key="moderation" botKey="moderation" /> : null}
      {isAdmin && tab === "bot-ticketing" ? <BotSettingsTab key="ticketing" botKey="ticketing" /> : null}
      {isAdmin && tab === "server" ? <ServerSettingsTab /> : null}
      {isAdmin && tab === "role-picker" ? <RolePickerTab /> : null}
      {tab === "inbox" ? <InboxTab onOpenMember={openMember} /> : null}
      {tab === "watchlist" ? <WatchlistTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "bot-history" ? <BotsHistoryTab /> : null}
      {isAdmin && tab === "traffic" ? <TrafficTab /> : null}
      </TabBoundary>
        </div>
      </div>

      {/* Overlays render at the page root so they sit above the site's top bar */}
      {member
        ? createPortal(
            <MemberDrawer
              userId={member}
              canEditRoles={isAdmin}
              onDrill={setDrill}
              onClose={() => setMember(null)}
              onOpenMember={openMember}
              onOpenTranscript={openTranscript}
              onOpenChat={(c) => {
                setChatFilter(null);
                setChat(c);
                setMember(null);
                setTab("messages");
              }}
              onOpenChats={(m) => {
                setChatFilter(m);
                setChat(null);
                setMember(null);
                setTab("messages");
              }}
            />,
            document.body,
          )
        : null}
      {drill ? createPortal(<DrillPanel
              drill={drill}
              onClose={() => setDrill(null)}
              onDrill={setDrill}
              onOpenTranscript={(id) => {
                setDrill(null);
                openTranscript(id);
              }}
              onOpenMember={(id) => {
                setDrill(null);
                openMember(id);
              }}
            />, document.body) : null}
      {transcript
        ? createPortal(<TranscriptViewer ticketId={transcript} ticketKey={transcriptKey} onClose={() => (setTranscript(null), setTranscriptKey(null))} onOpenMember={openMember} />, document.body)
        : null}
    </div>
    </TicketCanDelete.Provider>
    </TicketDeletePermissions.Provider>
  );
}
