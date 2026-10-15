"use client";

import "./database/database.css";
import { Brush, Database, History, RefreshCw, Table2, UserSearch } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DbBackups } from "./database/db-backups";
import { DbBrowse } from "./database/db-browse";
import { DbCleanup } from "./database/db-cleanup";
import { DbMember } from "./database/db-member";
import { DbOverview, type Overview } from "./database/db-overview";
import { api, type DbName } from "./database/db-shared";

type View = "overview" | "browse" | "member" | "cleanup" | "backups";

/** Admin → Database: sizes and growth, browse/edit any record, per-member lookup, cleanups and backups */
export function DatabaseTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<{ db: DbName; name: string } | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [changes, setChanges] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<Overview>("/api/admin/db/overview");
    setLoading(false);
    if (!r.ok) return setError(r.error ?? "Couldn't load the database stats.");
    setError(null);
    setData(r);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const browse = (db: DbName, name: string, filter: string | null = null) => {
    setTarget({ db, name });
    setPreset(filter);
    setView("browse");
  };
  // Something changed: sizes and backups are out of date
  const changed = () => {
    setChanges((n) => n + 1);
    void load();
  };

  const owner = !!data?.isOwner;
  const views: { key: View; label: string; icon: typeof Database }[] = [
    { key: "overview", label: "Overview", icon: Database },
    ...(owner
      ? ([
          { key: "browse", label: "Browse & edit", icon: Table2 },
          { key: "member", label: "Member data", icon: UserSearch },
          { key: "cleanup", label: "Cleanup", icon: Brush },
          { key: "backups", label: "Backups", icon: History },
        ] as const)
      : []),
  ];

  return (
    <section className="adm-panel dbm">
      <div className="dbm-head">
        <div className="adm-seg dbm-views" role="tablist" aria-label="Database">
          {views.map((v) => (
            <button key={v.key} type="button" role="tab" aria-selected={view === v.key} className={view === v.key ? "is-active" : undefined} onClick={() => setView(v.key)}>
              <v.icon size={14} aria-hidden="true" /> {v.label}
            </button>
          ))}
        </div>
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => void load()} disabled={loading} aria-label="Refresh sizes">
          <RefreshCw size={14} aria-hidden="true" className={loading ? "set-spin" : undefined} /> Refresh
        </button>
      </div>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data && !error ? <div className="adm-skeleton" /> : null}
      {data && view === "overview" ? <DbOverview data={data} onBrowse={(db, name) => browse(db, name)} onCleanup={() => setView("cleanup")} /> : null}
      {data && owner && view === "browse" ? <DbBrowse collections={data.collections} target={target} onTarget={(t) => browse(t.db, t.name)} preset={preset} /> : null}
      {data && owner && view === "member" ? <DbMember onBrowse={browse} onOpenMember={onOpenMember} initial={null} /> : null}
      {data && owner && view === "cleanup" ? <DbCleanup onDone={changed} onBrowse={browse} /> : null}
      {data && owner && view === "backups" ? <DbBackups refresh={changes} onDone={changed} /> : null}
    </section>
  );
}
