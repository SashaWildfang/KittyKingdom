"use client";

import { ExternalLink, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { MemberSearch } from "../admin-shared";
import { WipeMember } from "../wipe-member";
import { agoText, api, dateText, dbLabel, type DbName } from "./db-shared";

type Report = {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  inServer: boolean | null;
  joinedAt: string | null;
  leftAt: string | null;
  leftKnown: boolean;
  lastSeen: string | null;
  lastSeenFrom: string | null;
  account: { username: string | null; createdAt: string | null; lastLoginAt: string | null } | null;
  rows: { db: DbName; coll: string; label: string; kind: string; safety: boolean; collLabel: string; count: number; filter: string }[];
};

const KIND_LABELS: Record<string, string> = {
  economy: "Economy",
  history: "History",
  activity: "Activity",
  social: "Social",
  website: "Website",
  directory: "Member list",
  account: "Website account",
};

/** Everything stored about one member, with a jump into each collection */
export function DbMember({ onBrowse, onOpenMember, initial }: { onBrowse: (db: DbName, name: string, filter: string) => void; onOpenMember: (id: string) => void; initial: string | null }) {
  const [q, setQ] = useState("");
  const [id, setId] = useState<string | null>(initial);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    setLoading(true);
    setError(null);
    void api<Report>(`/api/admin/db/member/${id}`).then((r) => {
      if (stop) return;
      setLoading(false);
      if (!r.ok) return setError(r.error ?? "Couldn't look them up.");
      setReport(r);
    });
    return () => {
      stop = true;
    };
  }, [id, tick]);

  const stored = report?.rows.filter((r) => !r.safety) ?? [];
  const kept = report?.rows.filter((r) => r.safety) ?? [];
  const storedTotal = stored.reduce((n, r) => n + r.count, 0);

  return (
    <div className="dbm-member">
      <MemberSearch
        value={q}
        onChange={setQ}
        onPick={(m) => (setId(m.id), setQ(m.name))}
        onSubmit={(text) => /^\d{15,21}$/.test(text.trim()) && setId(text.trim())}
        placeholder="Search a member by name, or paste a Discord id (left members too)…"
      />
      {error ? <p className="adm-error">{error}</p> : null}
      {loading && !report ? <div className="adm-skeleton" /> : null}
      {!id && !loading ? <p className="adm-empty">Look up anyone to see every record stored about them, in every collection.</p> : null}
      {report ? (
        <>
          <div className="dbm-member-head">
            {report.avatar ? <img src={report.avatar} alt="" width={56} height={56} /> : <UserRound size={40} aria-hidden="true" />}
            <div>
              <h3>{report.name ?? report.id}</h3>
              <p className="adm-muted">
                {report.username ? `@${report.username} · ` : ""}
                <code>{report.id}</code>
              </p>
              <div className="dbm-member-facts">
                <span className={`dbm-badge ${report.inServer ? "dbm-badge--safe" : report.inServer === false ? "dbm-badge--left" : ""}`}>
                  {report.inServer ? "In the server" : report.inServer === false ? "Left the server" : "Never seen in the member list"}
                </span>
                {report.joinedAt ? <span>Joined {dateText(report.joinedAt)}</span> : null}
                {report.inServer === false ? <span>Left {report.leftKnown ? dateText(report.leftAt) : "before leave dates were tracked"}</span> : null}
                <span>
                  Last seen {agoText(report.lastSeen)}
                  {report.lastSeenFrom ? ` (${report.lastSeenFrom})` : ""}
                </span>
                {report.account ? <span>Website account · last sign-in {agoText(report.account.lastLoginAt)}</span> : <span>No website account</span>}
              </div>
            </div>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={() => onOpenMember(report.id)}>
              <ExternalLink size={14} aria-hidden="true" /> Full profile
            </button>
            {loading ? <Loader2 size={16} className="set-spin" aria-hidden="true" /> : null}
          </div>

          <div className="adm-grid dbm-member-grid">
            <div className="adm-card adm-card--span2">
              <h3>
                Stored about them <span className="adm-tag">{storedTotal.toLocaleString()} records</span>
              </h3>
              <MemberRows rows={stored} onBrowse={onBrowse} />
            </div>
            <div className="adm-card">
              <h3>
                <ShieldCheck size={15} aria-hidden="true" /> Kept for safety
              </h3>
              <p className="adm-muted dbm-note">Never removed by cleanups or wipes, so bans, appeals and reports keep working.</p>
              <MemberRows rows={kept} onBrowse={onBrowse} />
            </div>
          </div>
          <WipeMember key={report.id} userId={report.id} onDone={() => setTick((t) => t + 1)} />
        </>
      ) : null}
    </div>
  );
}

function MemberRows({ rows, onBrowse }: { rows: Report["rows"]; onBrowse: (db: DbName, name: string, filter: string) => void }) {
  const shown = rows.filter((r) => r.count > 0);
  const empty = rows.length - shown.length;
  if (!shown.length) return <p className="adm-empty">Nothing.</p>;
  return (
    <>
      <ul className="dbm-mrows">
        {shown.map((r) => (
          <li key={`${r.db}.${r.coll}.${r.label}`}>
            <button type="button" onClick={() => onBrowse(r.db, r.coll, r.filter)} title="Open these records">
              <span>
                <b>{r.label}</b>
                <small>
                  {KIND_LABELS[r.kind] ? `${KIND_LABELS[r.kind]} · ` : ""}
                  {dbLabel(r.db)} · {r.collLabel}
                </small>
              </span>
              <strong>{r.count.toLocaleString()}</strong>
              <span aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
      {empty ? <p className="adm-muted dbm-note">{empty} other place{empty === 1 ? "" : "s"} checked with nothing stored.</p> : null}
    </>
  );
}
