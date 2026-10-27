"use client";

// Admin → Moderation → Watchlist: members staff are keeping an eye on, with what each has done lately.
// Add someone from their profile (Watch, next to Staff notes) or with /watch in Discord.

import "./member-insights.css";
import { Eye, Gavel, LogIn, NotebookPen, ShieldAlert, Ticket } from "lucide-react";
import { PersonLink, formatDate, timeAgo, useLive, type People } from "./admin-shared";

type Entry = { discordId: string; reason: string; by: string; byName: string; at: string };
type Activity = { discordId: string; kind: "punishment" | "automod" | "ticket" | "joined"; label: string; at: string; ref: string };

const ICON = { punishment: Gavel, automod: ShieldAlert, ticket: Ticket, joined: LogIn };

export function WatchlistTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const { data, error, loading } = useLive<{ list: Entry[]; activity: Activity[]; notes: Record<string, number>; people: People }>("/api/admin/watchlist", 30_000);
  const list = data?.list ?? [];
  const byMember = new Map<string, Activity[]>();
  for (const a of data?.activity ?? []) byMember.set(a.discordId, [...(byMember.get(a.discordId) ?? []), a]);
  // Most recently active first, then newest on the list
  const sorted = [...list].sort((a, b) => (byMember.get(b.discordId)?.[0]?.at ?? "").localeCompare(byMember.get(a.discordId)?.[0]?.at ?? "") || b.at.localeCompare(a.at));

  return (
    <div className="mi-watchlist">
      <header className="mi-wl-top">
        <div>
          <h2>
            <Eye size={20} aria-hidden="true" /> Watchlist {data ? <small className="adm-muted">{list.length}</small> : null}
          </h2>
          <p className="adm-muted">Members staff are keeping an eye on. Anything they do shows up in Needs attention. Add someone with Watch on their profile, or /watch in Discord.</p>
        </div>
      </header>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data && loading ? <div className="adm-skeleton" style={{ height: 200 }} /> : null}
      {data && !list.length ? <p className="adm-empty">Nobody is on the watchlist.</p> : null}
      <ul className="mi-wl">
        {sorted.map((w) => {
          const recent = byMember.get(w.discordId) ?? [];
          const person = data?.people[w.discordId];
          const notes = data?.notes[w.discordId] ?? 0;
          return (
            <li key={w.discordId}>
              <div className="mi-wl-head">
                <PersonLink id={w.discordId} people={data?.people ?? {}} onOpen={onOpenMember} />
                {person?.inServer ? <span className="adm-status adm-status--active">● In server</span> : null}
                {notes ? (
                  <span className="adm-tag">
                    <NotebookPen size={12} aria-hidden="true" /> {notes} {notes === 1 ? "note" : "notes"}
                  </span>
                ) : null}
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => onOpenMember(w.discordId)}>
                  Open profile
                </button>
              </div>
              <p className="mi-wl-reason">{w.reason}</p>
              <small className="adm-muted">
                Added by {w.byName} · <span title={formatDate(w.at)}>{timeAgo(w.at)}</span>
              </small>
              {recent.length ? (
                <ul className="mi-wl-activity">
                  {recent.slice(0, 5).map((a) => {
                    const I = ICON[a.kind];
                    return (
                      <li key={`${a.kind}:${a.ref}`}>
                        <I size={12} aria-hidden="true" /> {a.label} <span className="adm-muted">· {timeAgo(a.at)}</span>
                      </li>
                    );
                  })}
                  {recent.length > 5 ? <li className="adm-muted">…and {recent.length - 5} more in the last 2 weeks</li> : null}
                </ul>
              ) : (
                <p className="adm-muted mi-wl-quiet">Quiet for the last 2 weeks.</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
