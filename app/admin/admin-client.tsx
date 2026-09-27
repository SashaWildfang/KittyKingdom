"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AccountsTab } from "./accounts-tab";
import { MemberSearch, useLive, useStored } from "./admin-shared";
import { LogsTab } from "./logs-tab";
import { MemberDrawer } from "./member-drawer";
import { OverviewTab } from "./overview-tab";
import { DEFAULT_PUNISHMENT_FILTERS, PunishmentsTab, type PunishmentFilters } from "./punishments-tab";
import { TicketsTab } from "./tickets-tab";
import { TranscriptViewer } from "./transcript-viewer";

type Tab = "overview" | "punishments" | "logs" | "tickets" | "accounts";
type Level = "admin" | "staff";

const TABS: { key: Tab; label: string; icon: string; admin?: boolean }[] = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "punishments", label: "Punishments", icon: "🔨" },
  { key: "logs", label: "Bot Logs", icon: "📜" },
  { key: "tickets", label: "Tickets & Transcripts", icon: "🎫", admin: true },
  { key: "accounts", label: "Website Accounts", icon: "👥", admin: true },
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
  const [punishmentFilters, setPunishmentFilters] = useStored<PunishmentFilters>("punishment-filters", DEFAULT_PUNISHMENT_FILTERS);
  const { data: meta } = useLive<{ actions: string[]; ticketTypes: string[] }>("/api/admin/meta", 60_000);

  // Keep the open tab / member / transcript in the address bar so links can be shared
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as Tab | null;
    if (t && tabs.some((x) => x.key === t)) setTab(t);
    if (params.get("member")) setMember(params.get("member"));
    if (isAdmin && params.get("ticket")) setTranscript(Number(params.get("ticket")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ tab });
    if (member) params.set("member", member);
    if (transcript) params.set("ticket", String(transcript));
    window.history.replaceState(null, "", `/admin?${params}`);
  }, [tab, member, transcript]);

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

      <nav className="adm-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "is-active" : undefined} onClick={() => setTab(t.key)}>
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <OverviewTab
          level={level}
          onOpenMember={openMember}
          onFilterPunishments={(action) => {
            setPunishmentFilters({ ...DEFAULT_PUNISHMENT_FILTERS, actions: ACTION_GROUPS[action] ?? [action] });
            setTab("punishments");
          }}
        />
      ) : null}
      {tab === "punishments" ? (
        <PunishmentsTab filters={punishmentFilters} setFilters={setPunishmentFilters} actionsAvailable={meta?.actions ?? []} onOpenMember={openMember} />
      ) : null}
      {tab === "logs" ? <LogsTab onOpenMember={openMember} /> : null}
      {isAdmin && tab === "tickets" ? <TicketsTab typesAvailable={meta?.ticketTypes ?? []} onOpenMember={openMember} onOpenTranscript={openTranscript} /> : null}
      {isAdmin && tab === "accounts" ? <AccountsTab onOpenMember={openMember} /> : null}

      {/* Overlays render at the page root so they sit above the site's top bar */}
      {member
        ? createPortal(
            <MemberDrawer userId={member} canEditRoles={isAdmin} onClose={() => setMember(null)} onOpenMember={openMember} onOpenTranscript={openTranscript} />,
            document.body,
          )
        : null}
      {transcript && isAdmin
        ? createPortal(<TranscriptViewer ticketId={transcript} onClose={() => setTranscript(null)} onOpenMember={openMember} />, document.body)
        : null}
    </div>
  );
}
