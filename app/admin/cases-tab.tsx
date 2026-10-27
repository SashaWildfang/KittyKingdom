"use client";

// Admin → Moderation → Cases: a file for an ongoing issue. Collects the members involved, notes and links to
// reports, tickets and AutoMod catches, with an owner and open/closed status. Start one here, from a report,
// or from a member's profile.

import "./cases-tab.css";
import { ArrowLeft, Briefcase, CircleDot, FileText, Link2, Lock, MessageSquareWarning, Plus, ShieldAlert, Unlock, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { PersonLink, formatDate, timeAgo, useLive, type People } from "./admin-shared";

type Ref = { type: "report" | "ticket" | "automod" | "punishment"; id: string; label: string };
type Entry = { id: string; at: string; by: string; byName: string; kind: "note" | "link" | "status" | "owner" | "member"; text: string; ref: Ref | null; member?: string };
type CaseFile = { id: string; number: number; title: string; status: "open" | "closed"; members: string[]; owner: string | null; ownerName: string | null; createdByName: string; createdAt: string; updatedAt: string; entries: Entry[] };

const post = (body: unknown) =>
  fetch("/api/admin/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Couldn't reach the server." }));

/** Opens a case in the Cases tab (admin-client listens for this). */
export function openCase(id: string) {
  window.dispatchEvent(new CustomEvent("kk-open-case", { detail: id }));
}

/** "Start a case" from anywhere: creates it, then opens it. */
export function StartCaseButton({ title, members, refLink, note, className }: { title: string; members: string[]; refLink?: Ref; note?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className ?? "adm-btn adm-btn--ghost adm-btn--small"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await post({ op: "create", title, members, ref: refLink, note });
        setBusy(false);
        if (r?.ok) openCase(r.case.id);
      }}
    >
      <Briefcase size={13} aria-hidden="true" /> Start a case
    </button>
  );
}

export function CasesTab({ caseId, onCase, onOpenMember, onOpenTranscript }: { caseId: string | null; onCase: (id: string | null) => void; onOpenMember: (id: string) => void; onOpenTranscript: (id: number, key?: string | null) => void }) {
  if (caseId) return <CaseView id={caseId} onBack={() => onCase(null)} onOpenMember={onOpenMember} onOpenTranscript={onOpenTranscript} />;
  return <CaseList onCase={onCase} onOpenMember={onOpenMember} />;
}

function CaseList({ onCase, onOpenMember }: { onCase: (id: string) => void; onOpenMember: (id: string) => void }) {
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [mine, setMine] = useState(false);
  const { data, error, loading } = useLive<{ cases: CaseFile[]; people: People; me: string }>(`/api/admin/cases?status=${status}${mine ? "&mine=1" : ""}`, 30_000);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  async function create() {
    setProblem(null);
    const ids = members.split(/[\s,]+/).filter(Boolean);
    if (ids.some((x) => !/^\d{15,21}$/.test(x))) return setProblem("Members are Discord IDs (right-click someone → Copy User ID), separated by spaces.");
    const r = await post({ op: "create", title, members: ids });
    if (!r?.ok) return setProblem(r?.error ?? "Couldn't start the case.");
    onCase(r.case.id);
  }

  return (
    <div className="cs">
      <header className="cs-head">
        <div>
          <h2>
            <Briefcase size={20} aria-hidden="true" /> Cases
          </h2>
          <p className="adm-muted">A file for something ongoing: the members involved, notes and the reports, tickets and AutoMod catches that go with it. Start one here, from a report, or from someone&apos;s profile.</p>
        </div>
        <button type="button" className="adm-btn adm-btn--small" onClick={() => setCreating((c) => !c)}>
          <Plus size={14} aria-hidden="true" /> New case
        </button>
      </header>
      {creating ? (
        <form
          className="cs-new"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label>
            Title
            <input autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ongoing harassment between two members" />
          </label>
          <label>
            Members <small className="adm-muted">(Discord IDs, optional)</small>
            <input value={members} onChange={(e) => setMembers(e.target.value)} placeholder="123456789012345678 234567890123456789" />
          </label>
          <div className="cs-row">
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn--small" disabled={!title.trim()}>
              Start the case
            </button>
          </div>
          {problem ? <p className="adm-error">{problem}</p> : null}
        </form>
      ) : null}
      <div className="cs-filters">
        {(["open", "closed"] as const).map((s) => (
          <button key={s} type="button" className={status === s ? "is-on" : undefined} aria-pressed={status === s} onClick={() => setStatus(s)}>
            {s === "open" ? "Open" : "Closed"}
          </button>
        ))}
        <button type="button" className={mine ? "is-on" : undefined} aria-pressed={mine} onClick={() => setMine((m) => !m)}>
          Mine
        </button>
      </div>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data && loading ? <div className="adm-skeleton" style={{ height: 160 }} /> : null}
      {data && !data.cases.length ? <p className="adm-empty">{status === "open" ? "No open cases." : "No closed cases."}</p> : null}
      <ul className="cs-list">
        {data?.cases.map((c) => (
          <li key={c.id}>
            <button type="button" className="cs-card" onClick={() => onCase(c.id)}>
              <span className="cs-num">#{c.number}</span>
              <b>{c.title}</b>
              <small className="adm-muted">
                {c.ownerName ? `${c.ownerName} has it` : "Nobody has it"} · updated {timeAgo(c.updatedAt)}
              </small>
            </button>
            {c.members.length ? (
              <span className="cs-members">
                {c.members.slice(0, 4).map((m) => (
                  <PersonLink key={m} id={m} people={data.people} onOpen={onOpenMember} compact />
                ))}
                {c.members.length > 4 ? <small className="adm-muted">+{c.members.length - 4}</small> : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const REF_ICON = { report: MessageSquareWarning, ticket: FileText, automod: ShieldAlert, punishment: Lock };

function CaseView({ id, onBack, onOpenMember, onOpenTranscript }: { id: string; onBack: () => void; onOpenMember: (id: string) => void; onOpenTranscript: (id: number, key?: string | null) => void }) {
  const { data, error, reload } = useLive<{ case: CaseFile; people: People; me: string }>(`/api/admin/cases?id=${id}`, 20_000);
  const [note, setNote] = useState("");
  const [member, setMember] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const c = data?.case;

  async function run(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setProblem(null);
    const r = await post({ id, ...body });
    setBusy(false);
    if (!r?.ok) return setProblem(r?.error ?? "That didn't work.");
    after?.();
    reload();
  }
  function addLink() {
    const t = link.trim();
    const ticket = /^#?(\d{1,7})$/.exec(t);
    if (ticket) return void run({ op: "link", ref: { type: "ticket", id: ticket[1], label: `Ticket #${ticket[1]}` } }, () => setLink(""));
    setProblem("Type a ticket number like #123. Reports and AutoMod catches link themselves when you start a case from them.");
  }
  const openRef = (r: Ref) => {
    if (r.type === "ticket") onOpenTranscript(Number(r.id));
    else if (r.type === "report") window.open(`/admin?tab=reports`, "_self");
    else if (r.type === "automod") window.open(`/admin?tab=automod`, "_self");
  };

  return (
    <div className="cs">
      <button type="button" className="adm-link cs-back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden="true" /> All cases
      </button>
      {error && !data ? <p className="adm-error">{error}</p> : null}
      {!c ? (
        <div className="adm-skeleton" style={{ height: 260 }} />
      ) : (
        <>
          <header className="cs-view-head">
            <div>
              <small className="adm-muted">
                Case #{c.number} · opened by {c.createdByName} {timeAgo(c.createdAt)}
              </small>
              <h2>{c.title}</h2>
              <span className={`cs-status is-${c.status}`}>
                <CircleDot size={12} aria-hidden="true" /> {c.status === "open" ? "Open" : "Closed"}
              </span>
              <span className="adm-muted cs-owner">{c.ownerName ? `${c.owner === data.me ? "You have" : `${c.ownerName} has`} this case` : "Nobody has this case"}</span>
            </div>
            <div className="cs-view-actions">
              {c.owner !== data.me ? (
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy} onClick={() => void run({ op: "owner", owner: "me" })}>
                  Take it
                </button>
              ) : (
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy} onClick={() => void run({ op: "owner", owner: null })}>
                  Let go
                </button>
              )}
              {c.status === "open" ? (
                <button type="button" className="adm-btn adm-btn--small" disabled={busy} onClick={() => void run({ op: "status", status: "closed", text: note.trim() }, () => setNote(""))}>
                  <Lock size={13} aria-hidden="true" /> Close case
                </button>
              ) : (
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy} onClick={() => void run({ op: "status", status: "open" })}>
                  <Unlock size={13} aria-hidden="true" /> Reopen
                </button>
              )}
            </div>
          </header>

          <section className="cs-box">
            <h3>Members</h3>
            <ul className="cs-mem">
              {c.members.map((m) => (
                <li key={m}>
                  <PersonLink id={m} people={data.people} onOpen={onOpenMember} />
                  <button type="button" aria-label="Remove from case" title="Remove from case" disabled={busy} onClick={() => void run({ op: "member", member: m, remove: true })}>
                    <UserMinus size={13} />
                  </button>
                </li>
              ))}
              {!c.members.length ? <li className="adm-muted">Nobody added yet.</li> : null}
            </ul>
            <form
              className="cs-inline"
              onSubmit={(e) => {
                e.preventDefault();
                void run({ op: "member", member: member.trim() }, () => setMember(""));
              }}
            >
              <input value={member} onChange={(e) => setMember(e.target.value)} placeholder="Discord ID" aria-label="Add a member by Discord ID" />
              <button type="submit" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy || !member.trim()}>
                <UserPlus size={13} aria-hidden="true" /> Add
              </button>
            </form>
          </section>

          <section className="cs-box">
            <h3>Activity</h3>
            <ol className="cs-entries">
              {c.entries.map((e) => {
                const I = e.ref ? REF_ICON[e.ref.type] : null;
                return (
                  <li key={e.id} className={`is-${e.kind}`}>
                    <div className="cs-entry-head">
                      <b>{e.byName}</b>
                      <span className="adm-muted" title={formatDate(e.at)}>
                        {timeAgo(e.at)}
                      </span>
                    </div>
                    {e.kind === "note" ? <p>{e.text}</p> : null}
                    {e.kind === "link" && e.ref && I ? (
                      <button type="button" className="cs-ref" onClick={() => openRef(e.ref!)}>
                        <I size={13} aria-hidden="true" /> {e.ref.label || `${e.ref.type} ${e.ref.id}`}
                      </button>
                    ) : null}
                    {e.kind === "link" && e.text ? <p>{e.text}</p> : null}
                    {["status", "owner", "member"].includes(e.kind) ? (
                      <p className="adm-muted">
                        {e.text}
                        {e.member ? (
                          <>
                            {" "}
                            <PersonLink id={e.member} people={data.people} onOpen={onOpenMember} compact />
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            <form
              className="cs-note"
              onSubmit={(e) => {
                e.preventDefault();
                void run({ op: "note", text: note }, () => setNote(""));
              }}
            >
              <textarea value={note} maxLength={2000} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (what happened, what you did, what's next)…" aria-label="Add a note" />
              <button type="submit" className="adm-btn adm-btn--small" disabled={busy || !note.trim()}>
                Add note
              </button>
            </form>
            <form
              className="cs-inline"
              onSubmit={(e) => {
                e.preventDefault();
                addLink();
              }}
            >
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link a ticket: #123" aria-label="Link a ticket by number" />
              <button type="submit" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy || !link.trim()}>
                <Link2 size={13} aria-hidden="true" /> Link
              </button>
            </form>
          </section>
          {problem ? <p className="adm-error">{problem}</p> : null}
        </>
      )}
    </div>
  );
}
