"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLive, useStored } from "./admin-shared";
import { MemberDrawer } from "./member-drawer";
import { OverviewTab } from "./overview-tab";
import { DEFAULT_PUNISHMENT_FILTERS, PunishmentsTab, type PunishmentFilters } from "./punishments-tab";
import { TicketsTab } from "./tickets-tab";
import { TranscriptViewer } from "./transcript-viewer";

type Tab = "overview" | "punishments" | "tickets";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "punishments", label: "Punishments", icon: "🔨" },
  { key: "tickets", label: "Tickets & Transcripts", icon: "🎫" },
];

// Clicking a headline number opens the punishments list filtered to that kind
const ACTION_GROUPS: Record<string, string[]> = {
  ban: ["ban", "tempban"],
  mute: ["mute", "tempmute", "timeout"],
  kick: ["kick", "kick_unverified"],
  warn: ["warn"],
};

export function AdminClient({ adminName }: { adminName: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [member, setMember] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<number | null>(null);
  const [lookup, setLookup] = useState("");
  const [punishmentFilters, setPunishmentFilters] = useStored<PunishmentFilters>("punishment-filters", DEFAULT_PUNISHMENT_FILTERS);
  const { data: meta } = useLive<{ actions: string[]; ticketTypes: string[] }>("/api/admin/meta", 60_000);

  // Keep the open tab / member / transcript in the address bar so links can be shared between admins
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as Tab | null;
    if (t && TABS.some((x) => x.key === t)) setTab(t);
    if (params.get("member")) setMember(params.get("member"));
    if (params.get("ticket")) setTranscript(Number(params.get("ticket")));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ tab });
    if (member) params.set("member", member);
    if (transcript) params.set("ticket", String(transcript));
    window.history.replaceState(null, "", `/admin?${params}`);
  }, [tab, member, transcript]);

  const openMember = useCallback((id: string) => setMember(id), []);
  const openTranscript = useCallback((id: number) => setTranscript(id), []);

  function submitLookup(e: React.FormEvent) {
    e.preventDefault();
    const value = lookup.trim().replace(/[<@!>]/g, "");
    if (/^\d{15,21}$/.test(value)) {
      setMember(value);
    } else if (/^#?\d{1,6}$/.test(value)) {
      setTranscript(Number(value.replace("#", "")));
    } else if (value) {
      setPunishmentFilters((f) => ({ ...f, search: value }));
      setTab("punishments");
    }
    setLookup("");
  }

  return (
    <div className="adm">
      <header className="adm-head">
        <div>
          <p className="eyebrow">Kitty Kingdom Admin</p>
          <h1>Moderation center</h1>
          <p className="adm-sub">Welcome back, {adminName}. Everything here updates live.</p>
        </div>
        <form className="adm-lookup" onSubmit={submitLookup}>
          <input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="Jump to: Discord ID, @mention, ticket #, or name"
            aria-label="Quick lookup"
          />
          <button type="submit" className="adm-btn">
            Go
          </button>
        </form>
      </header>

      <nav className="adm-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "is-active" : undefined} onClick={() => setTab(t.key)}>
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <OverviewTab
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
      {tab === "tickets" ? <TicketsTab typesAvailable={meta?.ticketTypes ?? []} onOpenMember={openMember} onOpenTranscript={openTranscript} /> : null}

      {/* Overlays render at the page root so they sit above the site's top bar */}
      {member
        ? createPortal(
            <MemberDrawer userId={member} onClose={() => setMember(null)} onOpenMember={openMember} onOpenTranscript={openTranscript} />,
            document.body,
          )
        : null}
      {transcript
        ? createPortal(<TranscriptViewer ticketId={transcript} onClose={() => setTranscript(null)} onOpenMember={openMember} />, document.body)
        : null}
    </div>
  );
}
