"use client";

import { Activity, BarChart3, ClipboardCheck, MessagesSquare, Gavel, Newspaper, ScrollText, Ticket, Users, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AccountsTab } from "./accounts-tab";
import { MemberSearch, useLive, useStored } from "./admin-shared";
import { DrillPanel, type Drill } from "./drill-panel";
import { JoinAppsTab } from "./join-apps";
import { LiveTab } from "./live-tab";
import { LogsTab } from "./logs-tab";
import { MemberDrawer } from "./member-drawer";
import { NewsTab } from "./news-tab";
import { TrafficTab } from "./traffic-tab";
import { OverviewTab } from "./overview-tab";
import { DEFAULT_PUNISHMENT_FILTERS, PunishmentsTab, type PunishmentFilters } from "./punishments-tab";
import { TicketsTab } from "./tickets-tab";
import { TranscriptViewer } from "./transcript-viewer";

type Tab = "overview" | "punishments" | "logs" | "tickets" | "accounts" | "news" | "traffic" | "live" | "join";
type Level = "admin" | "staff";

const TABS: { key: Tab; label: string; icon: LucideIcon; admin?: boolean }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "punishments", label: "Punishments", icon: Gavel },
  { key: "join", label: "Join Apps", icon: ClipboardCheck },
  { key: "logs", label: "Logs", icon: ScrollText },
  { key: "live", label: "Live Chat", icon: MessagesSquare },
  { key: "tickets", label: "Tickets", icon: Ticket, admin: true },
  { key: "accounts", label: "Website", icon: Users, admin: true },
  { key: "news", label: "News", icon: Newspaper, admin: true },
  { key: "traffic", label: "Traffic", icon: Activity, admin: true },
];

// Clicking a headline number opens the punishments list filtered to that kind
const ACTION_GROUPS: Record<string, string[]> = {
  ban: ["ban", "tempban"],
  mute: ["mute", "tempmute", "timeout"],
  kick: ["kick", "kick_unverified"],
  warn: ["warn"],
  unban: ["unban"],
};

export function AdminClient({ adminName, level }: { adminName: string; level: Level }) {
  const isAdmin = level === "admin";
  const tabs = TABS.filter((t) => isAdmin || !t.admin);
  const [tab, setTab] = useState<Tab>("overview");
  const [member, setMember] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<number | null>(null);
  const [lookup, setLookup] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);
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
  const tabsRef = useRef<HTMLElement>(null);

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
    setUrlRead(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Wait until the address bar has been read, or it would be overwritten with the default tab
    if (!urlRead) return;
    const params = new URLSearchParams({ tab });
    if (member) params.set("member", member);
    if (transcript) params.set("ticket", String(transcript));
    window.history.replaceState(null, "", `/admin?${params}`);
  }, [tab, member, transcript, urlRead]);

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

      <nav className="adm-tabs" role="tablist" ref={tabsRef}>
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "is-active" : undefined} onClick={() => setTab(t.key)}>
            <t.icon size={16} aria-hidden="true" /> {t.label}
            {t.key === "live" && liveUnread ? (
              <span className="adm-tab-bubble is-live" aria-label={`${liveUnread} unread`}>
                {liveUnread > 999 ? "999+" : liveUnread}
              </span>
            ) : null}
            {t.key === "join" && joinCount.data ? (
              <span className={`adm-tab-bubble${pendingApps > 0 ? " is-hot" : ""}`} aria-label={`${pendingApps} pending`}>
                {pendingApps}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

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
      {tab === "join" ? <JoinAppsTab onOpenMember={openMember} /> : null}
      {tab === "live" ? <LiveTab onOpenMember={openMember} onUnread={setLiveUnread} /> : null}
      {tab === "logs" ? <LogsTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "tickets" ? <TicketsTab typesAvailable={meta?.ticketTypes ?? []} onOpenMember={openMember} onOpenTranscript={openTranscript} /> : null}
      {isAdmin && tab === "accounts" ? <AccountsTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "news" ? <NewsTab /> : null}
      {isAdmin && tab === "traffic" ? <TrafficTab /> : null}

      {/* Overlays render at the page root so they sit above the site's top bar */}
      {member
        ? createPortal(
            <MemberDrawer userId={member} canEditRoles={isAdmin} onDrill={setDrill} onClose={() => setMember(null)} onOpenMember={openMember} onOpenTranscript={openTranscript} />,
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
  );
}
