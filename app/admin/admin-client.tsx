"use client";

import { TicketDeletePermissions } from "./delete-ticket-button";
import { Activity, Archive, AtSign, BarChart3, Bot, Coins, History, Megaphone, Server, Shield as ShieldIcon, BookOpen, Crown, Hammer, ClipboardCheck, Dices, Gavel, Globe, HeartHandshake, Mail, MessagesSquare, Newspaper, Scale, ScrollText, ShieldCheck, Ticket, Users, type LucideIcon } from "lucide-react";
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
import { EmailsTab } from "./emails-tab";
import { AdsTab } from "./ads-tab";
import { RemovedTab } from "./removed-tab";
import { BotSettingsTab } from "./bots/bot-settings-tab";
import { BotsHistoryTab } from "./bots/change-log";
import { ServerSettingsTab } from "./bots/server-tab";
import { TrafficTab } from "./traffic-tab";
import { OverviewTab } from "./overview-tab";
import { DEFAULT_PUNISHMENT_FILTERS, PunishmentsTab, type PunishmentFilters } from "./punishments-tab";
import { TicketsTab } from "./tickets-tab";
import { TranscriptViewer } from "./transcript-viewer";

type Tab = "overview" | "punishments" | "automod" | "logs" | "tickets" | "accounts" | "news" | "traffic" | "live" | "join" | "dating" | "appeals" | "messages" | "games" | "guide" | "banrequests" | "patreon" | "emails" | "ads" | "bot-main" | "bot-economy" | "bot-moderation" | "bot-ticketing" | "server" | "bot-history" | "removed";
type Level = "admin" | "staff";

// Tabs are grouped so the bar stays short: pick a group, then one of its tabs
type Group = "overview" | "moderation" | "members" | "website" | "bots";
const GROUPS: { key: Group; label: string; icon: LucideIcon; tabs: Tab[] }[] = [
  { key: "overview", label: "Overview", icon: BarChart3, tabs: ["overview", "guide"] },
  { key: "moderation", label: "Moderation", icon: Gavel, tabs: ["punishments", "banrequests", "appeals", "automod", "logs", "live", "removed"] },
  { key: "members", label: "Members", icon: Users, tabs: ["join", "tickets", "dating", "messages", "games", "patreon"] },
  { key: "website", label: "Website", icon: Globe, tabs: ["accounts", "emails", "news", "ads", "traffic"] },
  { key: "bots", label: "Bots", icon: Bot, tabs: ["bot-main", "bot-economy", "bot-moderation", "bot-ticketing", "server", "bot-history"] },
];

const TABS: { key: Tab; label: string; icon: LucideIcon; admin?: boolean }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "guide", label: "Staff Guide", icon: BookOpen },
  { key: "punishments", label: "Punishments", icon: Gavel },
  { key: "banrequests", label: "Ban Requests", icon: Hammer },
  { key: "appeals", label: "Appeals", icon: Scale, admin: true },
  { key: "automod", label: "AutoMod", icon: ShieldCheck },
  { key: "join", label: "Join Apps", icon: ClipboardCheck },
  { key: "logs", label: "Logs", icon: ScrollText },
  { key: "dating", label: "Social", icon: HeartHandshake },
  { key: "messages", label: "Messages", icon: Mail, admin: true },
  { key: "games", label: "Games", icon: Dices },
  { key: "patreon", label: "Patreon", icon: Crown, admin: true },
  { key: "live", label: "Live Chat", icon: MessagesSquare },
  { key: "removed", label: "Removed messages", icon: Archive, admin: true },
  { key: "tickets", label: "Tickets", icon: Ticket, admin: true },
  { key: "accounts", label: "Accounts", icon: Users, admin: true },
  { key: "emails", label: "Emails", icon: AtSign, admin: true },
  { key: "news", label: "News", icon: Newspaper, admin: true },
  { key: "ads", label: "Ads", icon: Megaphone, admin: true },
  { key: "bot-main", label: "Main Bot", icon: Bot, admin: true },
  { key: "bot-economy", label: "Economy Bot", icon: Coins, admin: true },
  { key: "bot-moderation", label: "Moderation Bot", icon: ShieldIcon, admin: true },
  { key: "bot-ticketing", label: "Ticket Bot", icon: Ticket, admin: true },
  { key: "server", label: "Discord Server", icon: Server, admin: true },
  { key: "bot-history", label: "History", icon: History, admin: true },
  { key: "traffic", label: "Traffic", icon: Activity, admin: true },
];

// Clicking a headline number opens the punishments list filtered to that kind
const ACTION_GROUPS: Record<string, string[]> = {
  ban: ["ban", "tempban"],
  mute: ["mute", "tempmute", "timeout", "muzzle"],
  kick: ["kick", "kick_unverified"],
  warn: ["warn"],
  unban: ["unban"],
};

export function AdminClient({ adminName, level, canDeleteNsfw = false }: { adminName: string; level: Level; canDeleteNsfw?: boolean }) {
  const isAdmin = level === "admin";
  const tabs = TABS.filter((t) => isAdmin || !t.admin);
  const [tab, setTab] = useState<Tab>("overview");
  const [member, setMember] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<number | null>(null);
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
  // Open tickets right now (admins), for the bubble on the Tickets tab
  const openTicketsPoll = useLive<{ count: number }>(isAdmin ? "/api/admin/tickets/open?count=1" : null, 15_000);
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
  const tabsRef = useRef<HTMLElement>(null);

  // Bubbles on tabs (and added up on their group)
  // 999 → "999", 1,420 → "1.42k", 15,300 → "15.3k"
  const shortCount = (n: number) => (n < 1000 ? String(n) : n < 10_000 ? `${(Math.floor(n / 10) / 100).toString()}k` : n < 1_000_000 ? `${(Math.floor(n / 100) / 10).toString()}k` : `${(Math.floor(n / 100_000) / 10).toString()}m`);
  const alert = (k: Tab): { count: number; hot?: boolean; live?: boolean; label: string } | null => {
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
  const groupTabs = tabs.filter((t) => groups.find((g) => g.key === group)?.tabs.includes(t.key));
  // Each group remembers the tab you last had open in it
  const lastInGroup = useRef<Partial<Record<Group, Tab>>>({});
  useEffect(() => {
    lastInGroup.current[group] = tab;
  }, [group, tab]);
  const openGroup = (g: Group) => {
    const found = groups.find((x) => x.key === g);
    if (!found) return;
    const last = lastInGroup.current[g];
    setTab(last && found.tabs.includes(last) ? last : found.tabs[0]);
  };

  // On narrow screens the tab strip scrolls sideways; keep the open tab in view
  useEffect(() => {
    const strip = tabsRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!strip || !active || strip.scrollWidth <= strip.clientWidth) return;
    const offset = active.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
    strip.scrollTo({ left: offset - (strip.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
  }, [tab]);

  // Keep the open tab / member / transcript in the address bar so links can be shared
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as Tab | null;
    if (t && tabs.some((x) => x.key === t)) setTab(t);
    if (params.get("member")) setMember(params.get("member"));
    if (isAdmin && params.get("ticket")) setTranscript(Number(params.get("ticket")));
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
    window.history.replaceState(null, "", `/admin?${params}`);
  }, [tab, member, transcript, urlRead, chat]);

  const openMember = useCallback((id: string) => setMember(id), []);
  const openTranscript = useCallback((id: number) => isAdmin && setTranscript(id), [isAdmin]);

  function submitLookup(text: string) {
    const value = text.trim().replace(/[<@!>]/g, "");
    if (/^\d{15,21}$/.test(value)) {
      setMember(value);
    } else if (isAdmin && /^#?\d{1,6}$/.test(value)) {
      setTranscript(Number(value.replace("#", "")));
    } else if (value) {
      setPunishmentFilters((f) => ({ ...f, search: value, member: null }));
      setTab("punishments");
    }
    setLookup("");
  }

  return (
    <TicketDeletePermissions.Provider value={canDeleteNsfw}>
    <div className="adm">
      <header className="adm-head">
        <div className="adm-head-copy">
          <p className="eyebrow">{isAdmin ? "Kitty Kingdom Admin" : "Kitty Kingdom Staff"}</p>
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
          placeholder={isAdmin ? "Find a member, ID, @mention or ticket #" : "Find a member, ID or @mention"}
        />
      </header>

      {/* Groups first, then the chosen group's tabs */}
      <nav className="adm-groups" aria-label="Admin sections">
        {groups.map((g) => {
          // Live Chat is just unread chat, not something to act on, so it doesn't add to its group
          const count = g.tabs.reduce((n, k) => n + (k === "live" ? 0 : alert(k)?.count ?? 0), 0);
          const hot = g.tabs.some((k) => k !== "live" && alert(k)?.hot);
          const on = g.key === group;
          return (
            <button key={g.key} type="button" className={on ? "is-active" : undefined} aria-pressed={on} onClick={() => openGroup(g.key)}>
              <g.icon size={16} aria-hidden="true" /> {g.label}
              {count > 0 && !on ? <span className={`adm-tab-bubble${hot ? " is-hot" : ""}`}>{shortCount(count)}</span> : null}
            </button>
          );
        })}
      </nav>
      {groupTabs.length > 1 ? (
        <nav className="adm-tabs" role="tablist" ref={tabsRef}>
          {groupTabs.map((t) => {
            const a = alert(t.key);
            return (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "is-active" : undefined} onClick={() => setTab(t.key)}>
                <t.icon size={16} aria-hidden="true" /> {t.label}
                {a ? (
                  <span className={`adm-tab-bubble${a.hot ? " is-hot" : ""}${a.live ? " is-live" : ""}`} aria-label={a.label}>
                    {shortCount(a.count)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      ) : null}

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
      {isAdmin && tab === "tickets" ? <TicketsTab typesAvailable={meta?.ticketTypes ?? []} onOpenMember={openMember} onOpenTranscript={openTranscript} /> : null}
      {isAdmin && tab === "accounts" ? <AccountsTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "patreon" ? <PatreonTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "emails" ? <EmailsTab /> : null}
      {isAdmin && tab === "news" ? <NewsTab /> : null}
      {isAdmin && tab === "ads" ? <AdsTab /> : null}
      {isAdmin && tab === "removed" ? <RemovedTab /> : null}
      {isAdmin && tab === "bot-main" ? <BotSettingsTab key="main" botKey="main" /> : null}
      {isAdmin && tab === "bot-economy" ? <BotSettingsTab key="economy" botKey="economy" /> : null}
      {isAdmin && tab === "bot-moderation" ? <BotSettingsTab key="moderation" botKey="moderation" /> : null}
      {isAdmin && tab === "bot-ticketing" ? <BotSettingsTab key="ticketing" botKey="ticketing" /> : null}
      {isAdmin && tab === "server" ? <ServerSettingsTab /> : null}
      {isAdmin && tab === "bot-history" ? <BotsHistoryTab /> : null}
      {isAdmin && tab === "traffic" ? <TrafficTab /> : null}

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
      {transcript && isAdmin
        ? createPortal(<TranscriptViewer ticketId={transcript} onClose={() => setTranscript(null)} onOpenMember={openMember} />, document.body)
        : null}
    </div>
    </TicketDeletePermissions.Provider>
  );
}
