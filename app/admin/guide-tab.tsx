"use client";

import "./guide.css";
import { BadgeCheck, BookOpen, Check, Copy, Gavel, Globe, Lock, NotebookPen, Pencil, Search, Settings, ShieldCheck, Ticket, Users, type LucideIcon } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { COMMANDS, PANEL_TABS, RANKS, SECTIONS, rankIndex, type GuideCommand, type RankName } from "../../lib/staff-guide-data";

const ICONS: Record<string, LucideIcon> = { gavel: Gavel, users: Users, badge: BadgeCheck, ticket: Ticket, shield: ShieldCheck, settings: Settings };
type Notes = { text: string; updatedAt: string | null; updatedBy: string | null };

/** **bold** inside a line of team notes */
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>));
}

/** Team notes, line by line: "# " is a heading, "- " or "* " a bullet, blank lines end a paragraph. */
function NotesView({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (bullets.length) {
      const items = bullets;
      out.push(
        <ul key={out.length}>
          {items.map((l, j) => (
            <li key={j}>{inline(l)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
    if (para.length) {
      const lines = para;
      out.push(<p key={out.length}>{lines.map((l, j) => (j ? [<br key={`b${j}`} />, inline(l)] : inline(l)))}</p>);
      para = [];
    }
  };
  for (const raw of text.trim().split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) flush();
    else if (/^#{1,3} /.test(line)) {
      flush();
      out.push(<h4 key={out.length}>{inline(line.replace(/^#{1,3} /, ""))}</h4>);
    } else if (/^\s*[-*] /.test(line)) {
      if (para.length) flush();
      bullets.push(line.replace(/^\s*[-*] /, ""));
    } else {
      if (bullets.length) flush();
      para.push(line);
    }
  }
  flush();
  return <div className="sg-notes-body">{out}</div>;
}

function CommandRow({ c, mine }: { c: GuideCommand; mine: RankName }) {
  const locked = rankIndex(c.min) > rankIndex(mine);
  const [copied, setCopied] = useState(false);
  const base = c.cmd.split(/ [<[·]/)[0].trim();
  return (
    <li className={`sg-cmd${locked ? " is-locked" : ""}`}>
      <div className="sg-cmd-head">
        <code>{c.cmd}</code>
        {locked ? (
          <span className="sg-unlock">
            <Lock size={12} aria-hidden="true" /> {c.min}+
          </span>
        ) : (
          <button
            type="button"
            className="sg-copy"
            title={`Copy ${base}`}
            onClick={() => {
              void navigator.clipboard?.writeText(base).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              });
            }}
          >
            {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          </button>
        )}
      </div>
      <p>{c.what}</p>
      {c.tip ? <small>💡 {c.tip}</small> : null}
    </li>
  );
}

/** Admin panel → Staff Guide: your rank, the Discord commands you can use, how-tos and the team's notes. */
export function GuideTab() {
  const [data, setData] = useState<{ rank: RankName; level: "admin" | "staff"; notes: Notes } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showLocked, setShowLocked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/guide", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => (r?.ok ? setData(r) : setError(r?.error ?? "Couldn't load the guide.")))
      .catch(() => setError("Couldn't load the guide."));
  }, []);

  const rank = data?.rank ?? "Helper";
  const mine = rankIndex(rank);
  const q = query.trim().toLowerCase();
  const categories = useMemo(
    () =>
      COMMANDS.map((cat) => ({
        ...cat,
        commands: cat.commands.filter((c) => (showLocked || rankIndex(c.min) <= mine) && (!q || `${c.cmd} ${c.what} ${c.tip ?? ""}`.toLowerCase().includes(q))),
      })).filter((cat) => cat.commands.length),
    [showLocked, mine, q],
  );
  const allowed = COMMANDS.flatMap((c) => c.commands).filter((c) => rankIndex(c.min) <= mine).length;
  const next = RANKS[mine + 1];
  const nextUnlocks = next ? COMMANDS.flatMap((c) => c.commands).filter((c) => c.min === next.name) : [];
  const sections = SECTIONS.filter((s) => showLocked || rankIndex(s.min) <= mine);

  if (error) return <p className="adm-error">{error}</p>;
  if (!data) return <div className="sg-loading" aria-busy="true" />;

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/guide", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: draft }) })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (res?.ok) {
      setData((d) => (d ? { ...d, notes: res.notes } : d));
      setEditing(false);
    }
  };

  return (
    <section className="sg">
      <header className="sg-hero">
        <div>
          <p className="sg-eyebrow">
            <BookOpen size={14} aria-hidden="true" /> Staff Guide
          </p>
          <h2>
            You&apos;re a <span className="sg-rank">{rank}</span>
          </h2>
          <p>
            {allowed} Discord commands are yours to use. {next && nextUnlocks.length ? `${nextUnlocks.length} more unlock at ${next.name}.` : "You have every command."}
          </p>
        </div>
        <ol className="sg-ladder" aria-label="Staff ranks">
          {RANKS.map((r, i) => (
            <li key={r.id} className={i === mine ? "is-you" : i < mine ? "is-below" : ""}>
              {r.name}
            </li>
          ))}
        </ol>
      </header>

      <div className="sg-tools">
        <label className="sg-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Search commands and how-tos…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="sg-toggle">
          <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} /> Show what higher ranks can do
        </label>
      </div>

      {data.notes.text || data.level === "admin" ? (
        <section className="sg-card sg-notes">
          <div className="sg-card-head">
            <h3>
              <NotebookPen size={17} aria-hidden="true" /> Team notes
            </h3>
            {data.level === "admin" && !editing ? (
              <button
                type="button"
                className="sg-btn"
                onClick={() => {
                  setDraft(data.notes.text);
                  setEditing(true);
                }}
              >
                <Pencil size={14} aria-hidden="true" /> {data.notes.text ? "Edit" : "Write notes"}
              </button>
            ) : null}
          </div>
          {editing ? (
            <div className="sg-edit">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={12} placeholder={"House rules, who to ask about what, anything from the old staff-guide channel.\n\n# A heading\n- A bullet point\n**Bold** words"} />
              <div className="sg-edit-actions">
                <button type="button" className="sg-btn is-primary" disabled={saving} onClick={save}>
                  {saving ? "Saving…" : "Save notes"}
                </button>
                <button type="button" className="sg-btn" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : data.notes.text ? (
            <>
              <NotesView text={data.notes.text} />
              {data.notes.updatedAt ? (
                <small className="sg-meta">
                  Updated {new Date(data.notes.updatedAt).toLocaleDateString()} by {data.notes.updatedBy}
                </small>
              ) : null}
            </>
          ) : (
            <p className="sg-muted">No team notes yet. Add the house rules and anything else the team should know; everyone on staff sees them here.</p>
          )}
        </section>
      ) : null}

      {next && nextUnlocks.length && !q ? (
        <section className="sg-card sg-next">
          <h3>Coming up at {next.name}</h3>
          <p>{nextUnlocks.map((c) => c.cmd.split(/ [<[]/)[0]).join(" · ")}</p>
        </section>
      ) : null}

      <h3 className="sg-title">Discord commands</h3>
      {categories.length ? (
        <div className="sg-cats">
          {categories.map((cat) => {
            const Icon = ICONS[cat.icon] ?? BookOpen;
            return (
              <section key={cat.key} className="sg-card">
                <h3>
                  <Icon size={17} aria-hidden="true" /> {cat.title}
                </h3>
                <p className="sg-muted">{cat.about}</p>
                <ul className="sg-cmds">
                  {cat.commands.map((c) => (
                    <CommandRow key={c.cmd} c={c} mine={rank} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="sg-muted">Nothing matches “{query}”.</p>
      )}

      <h3 className="sg-title">How-tos</h3>
      <div className="sg-cats">
        {sections
          .filter((s) => !q || `${s.title} ${s.points.join(" ")}`.toLowerCase().includes(q))
          .map((s) => {
            const locked = rankIndex(s.min) > mine;
            return (
              <section key={s.key} className={`sg-card${locked ? " is-locked" : ""}`}>
                <h3>
                  {s.title}
                  {locked ? (
                    <span className="sg-unlock">
                      <Lock size={12} aria-hidden="true" /> {s.min}+
                    </span>
                  ) : null}
                </h3>
                <ul className="sg-points">
                  {s.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </section>
            );
          })}
      </div>

      <h3 className="sg-title">This panel</h3>
      <section className="sg-card">
        <h3>
          <Globe size={17} aria-hidden="true" /> What you can open here
        </h3>
        <div className="sg-tabs">
          {PANEL_TABS.staff.map((t) => (
            <span key={t} className="sg-pill">
              {t}
            </span>
          ))}
          {PANEL_TABS.admin.map((t) => (
            <span key={t} className={`sg-pill${data.level === "admin" ? "" : " is-locked"}`} title={data.level === "admin" ? undefined : "Admins only"}>
              {data.level === "admin" ? null : <Lock size={11} aria-hidden="true" />} {t}
            </span>
          ))}
        </div>
        <p className="sg-muted">Search any member at the top of the panel to see their record, applications and activity in one place.</p>
      </section>
    </section>
  );
}
