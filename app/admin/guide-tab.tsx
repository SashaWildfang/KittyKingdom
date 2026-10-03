"use client";

import "./guide.css";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Copy,
  Files,
  Gavel,
  Globe,
  Hash,
  Heart,
  IdCard,
  Leaf,
  ListChecks,
  Lock,
  NotebookPen,
  Pencil,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Siren,
  Terminal,
  Ticket,
  Users,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  COMMAND_GROUPS,
  ID_VERIFICATION,
  PANEL_TABS,
  PROCEDURES,
  RANKS,
  ROLES,
  STAFF_RULES,
  rankIndex,
  type GuideCommand,
  type Procedure,
  type RankName,
} from "../../lib/staff-guide-data";

const ICONS: Record<string, LucideIcon> = {
  gavel: Gavel, users: Users, badge: BadgeCheck, ticket: Ticket, shield: ShieldCheck, settings: Settings, heart: Heart, lock: Lock, clock: Clock,
  id: IdCard, clipboard: ClipboardCheck, alert: AlertTriangle, siren: Siren, hash: Hash, scale: Scale, volume: Volume2, search: Search, files: Files,
  leaf: Leaf, bag: ShoppingBag,
};
const icon = (k: string) => ICONS[k] ?? BookOpen;

type Section = "start" | "roles" | "rules" | "id" | "procedures" | "commands" | "panel" | "notes";
const SECTIONS: { key: Section; label: string; icon: LucideIcon }[] = [
  { key: "start", label: "Start here", icon: BookOpen },
  { key: "roles", label: "Roles & duties", icon: Users },
  { key: "rules", label: "Staff rules", icon: Scale },
  { key: "id", label: "ID verification", icon: IdCard },
  { key: "procedures", label: "Procedures", icon: ListChecks },
  { key: "commands", label: "Commands", icon: Terminal },
  { key: "panel", label: "This panel", icon: Globe },
  { key: "notes", label: "Team notes", icon: NotebookPen },
];

type Notes = { text: string; updatedAt: string | null; updatedBy: string | null };

// ---------------------------------------------------------------- small pieces

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

function CopyCode({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="sg-code">
      <code>{text}</code>
      <button
        type="button"
        title="Copy"
        aria-label={`Copy ${text}`}
        onClick={() =>
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          })
        }
      >
        {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      </button>
    </span>
  );
}

function RankTag({ min, mine }: { min: RankName; mine: RankName }) {
  const ok = rankIndex(min) <= rankIndex(mine);
  return (
    <span className={`sg-rank-tag${ok ? " is-ok" : ""}`} title={ok ? "You can use this" : `Unlocks at ${min}`}>
      {ok ? <Check size={11} aria-hidden="true" /> : <Lock size={11} aria-hidden="true" />} {min}+
    </span>
  );
}

function SectionHead({ icon: Icon, title, intro }: { icon: LucideIcon; title: string; intro?: ReactNode }) {
  return (
    <header className="sg-head">
      <h2>
        <Icon size={22} aria-hidden="true" /> {title}
      </h2>
      {intro ? <p>{intro}</p> : null}
    </header>
  );
}

/** A procedure: numbered steps, then what to do in each case. */
function ProcedureBody({ p, mine }: { p: Procedure; mine: RankName }) {
  return (
    <div className="sg-proc">
      <ol className="sg-steps">
        {p.steps.map((s, i) => (
          <li key={s.title}>
            <span className="sg-step-n">{i + 1}</span>
            <div>
              <h4>
                {s.title} {s.min ? <RankTag min={s.min} mine={mine} /> : null}
              </h4>
              <p>{s.detail}</p>
              {s.example ? <CopyCode text={s.example} /> : null}
            </div>
          </li>
        ))}
      </ol>
      {p.outcomes?.length ? (
        <div className="sg-outcomes">
          {p.outcomes.map((o) => {
            const can = !o.min || rankIndex(o.min) <= rankIndex(mine);
            return (
              <div key={o.when} className={`sg-outcome is-${o.tone}`}>
                <h4>{o.when}</h4>
                <p>{o.do}</p>
                {o.example ? (
                  <div className="sg-outcome-cmd">
                    <CopyCode text={o.example} /> {o.min ? <RankTag min={o.min} mine={mine} /> : null}
                  </div>
                ) : null}
                {o.otherwise ? (
                  <p className={`sg-otherwise${can ? "" : " is-you"}`}>
                    {can ? null : <b>You: </b>}
                    {o.otherwise}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {p.notes?.length ? (
        <ul className="sg-callouts">
          {p.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CommandCard({ c, mine }: { c: GuideCommand; mine: RankName }) {
  const locked = rankIndex(c.min) > rankIndex(mine);
  return (
    <li className={`sg-cmd${locked ? " is-locked" : ""}`}>
      <div className="sg-cmd-head">
        <code className="sg-usage">{c.cmd}</code>
        <RankTag min={c.min} mine={mine} />
      </div>
      <p>{c.what}</p>
      <div className="sg-examples">
        <small>Example{c.examples.length > 1 ? "s" : ""}</small>
        {c.examples.map((e) => (
          <CopyCode key={e} text={e} />
        ))}
      </div>
      {c.notes ? <p className="sg-cmd-note">💡 {c.notes}</p> : null}
    </li>
  );
}

// ---------------------------------------------------------------- the tab

/** Admin panel → Staff Guide: the staff handbook, tailored to your rank. */
export function GuideTab() {
  const [data, setData] = useState<{ rank: RankName; level: "admin" | "staff"; notes: Notes } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("start");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [showLocked, setShowLocked] = useState(true);
  const [open, setOpen] = useState<string | null>(PROCEDURES[0].key);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/guide", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => (r?.ok ? setData(r) : setError(r?.error ?? "Couldn't load the guide.")))
      .catch(() => setError("Couldn't load the guide."));
    // Links straight to a section: /admin?tab=guide&section=id
    const s = new URL(window.location.href).searchParams.get("section") as Section | null;
    if (s && SECTIONS.some((x) => x.key === s)) setSection(s);
  }, []);

  const go = (s: Section) => {
    setSection(s);
    const url = new URL(window.location.href);
    url.searchParams.set("section", s);
    window.history.replaceState(null, "", url);
    document.querySelector(".sg-main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const rank = data?.rank ?? "Helper";
  const mine = rankIndex(rank);
  const allCommands = COMMAND_GROUPS.flatMap((g) => g.commands);
  const yours = allCommands.filter((c) => rankIndex(c.min) <= mine).length;
  const next = RANKS[mine + 1];
  const nextUnlocks = next ? allCommands.filter((c) => c.min === next.name) : [];
  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      COMMAND_GROUPS.filter((g) => group === "all" || g.key === group)
        .map((g) => ({
          ...g,
          commands: g.commands.filter(
            (c) => (showLocked || rankIndex(c.min) <= mine) && (!q || `${c.cmd} ${c.what} ${c.examples.join(" ")} ${c.notes ?? ""}`.toLowerCase().includes(q)),
          ),
        }))
        .filter((g) => g.commands.length),
    [group, showLocked, mine, q],
  );

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

  let ruleNo = 0;

  return (
    <section className="sg">
      <header className="sg-hero">
        <div>
          <p className="sg-eyebrow">
            <BookOpen size={14} aria-hidden="true" /> Staff Handbook
          </p>
          <h2>
            You&apos;re a <span className="sg-rank">{rank}</span>
          </h2>
          <p>
            {yours} of {allCommands.length} staff commands are yours to use.
            {next && nextUnlocks.length ? ` ${nextUnlocks.length} more unlock at ${next.name}.` : ""}
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

      <div className="sg-layout">
        <nav className="sg-nav" aria-label="Handbook sections">
          {SECTIONS.map((s) => (
            <button key={s.key} type="button" className={section === s.key ? "is-on" : ""} onClick={() => go(s.key)} aria-current={section === s.key ? "page" : undefined}>
              <s.icon size={16} aria-hidden="true" /> {s.label}
              {s.key === "notes" && data.notes.text ? <span className="sg-dot" aria-hidden="true" /> : null}
            </button>
          ))}
        </nav>

        <div className="sg-main">
          {/* ------------------------------------------------ Start here */}
          {section === "start" ? (
            <>
              <SectionHead icon={BookOpen} title="Start here" intro="Everything you need as Kitty Kingdom staff, in one place. Pick a section on the left, or jump in below." />
              <div className="sg-quick">
                {[
                  { s: "roles" as Section, t: "Your role & duties", d: `What a ${rank} is responsible for.` },
                  { s: "rules" as Section, t: "Staff rules", d: "How every staff member is expected to act." },
                  { s: "id" as Section, t: "ID verification", d: "Checking a member's age for 18+ access." },
                  { s: "procedures" as Section, t: "Procedures", d: "Applications, problems, tickets, raids and more." },
                  { s: "commands" as Section, t: "Command reference", d: "Every staff command, with examples." },
                  { s: "notes" as Section, t: "Team notes", d: data.notes.text ? "Notes from the admins." : "Notes from the admins (none yet)." },
                ].map((x) => {
                  const Icon = SECTIONS.find((y) => y.key === x.s)!.icon;
                  return (
                    <button key={x.s} type="button" className="sg-quick-card" onClick={() => go(x.s)}>
                      <Icon size={20} aria-hidden="true" />
                      <b>{x.t}</b>
                      <small>{x.d}</small>
                    </button>
                  );
                })}
              </div>
              <div className="sg-card">
                <h3>Golden rules</h3>
                <ul className="sg-callouts">
                  <li>Use the lightest action that fixes the problem, and always give a reason.</li>
                  <li>Everything goes through the bots so it&apos;s logged.</li>
                  <li>Never punish another staff member: report it to an Admin.</li>
                  <li>Not sure? Ask in #staff-general before acting.</li>
                </ul>
              </div>
              {next && nextUnlocks.length ? (
                <div className="sg-card">
                  <h3>Coming up at {next.name}</h3>
                  <div className="sg-chips">
                    {nextUnlocks.map((c) => (
                      <code key={c.cmd}>{c.cmd.split(/ (?=[a-z_[])/)[0]}</code>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {/* ------------------------------------------------ Roles */}
          {section === "roles" ? (
            <>
              <SectionHead icon={Users} title="Roles & duties" intro="Each rank does everything the ranks below it do, plus its own duties." />
              <ol className="sg-roles">
                {ROLES.map((r) => {
                  const i = rankIndex(r.rank);
                  return (
                    <li key={r.rank} className={`sg-role${i === mine ? " is-you" : ""}${i < mine ? " is-below" : ""}`}>
                      <div className="sg-role-head">
                        <span className="sg-role-n">{i + 1}</span>
                        <h3>{r.rank}</h3>
                        {i === mine ? <span className="sg-you">You</span> : null}
                      </div>
                      <p>{r.summary}</p>
                      <ul>
                        {r.duties.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}

          {/* ------------------------------------------------ Rules */}
          {section === "rules" ? (
            <>
              <SectionHead icon={Scale} title="Staff rules" intro="These apply to every rank. Breaking them can mean a warning, a demotion or removal from the team." />
              <div className="sg-rule-groups">
                {STAFF_RULES.map((g) => {
                  const Icon = icon(g.icon);
                  return (
                    <section key={g.title} className="sg-card">
                      <h3>
                        <Icon size={17} aria-hidden="true" /> {g.title}
                      </h3>
                      <ol className="sg-rules">
                        {g.rules.map((r) => {
                          ruleNo += 1;
                          return (
                            <li key={r}>
                              <span className="sg-rule-n">{ruleNo}</span>
                              <span>{r}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  );
                })}
              </div>
            </>
          ) : null}

          {/* ------------------------------------------------ ID verification */}
          {section === "id" ? (
            <>
              <SectionHead icon={IdCard} title={ID_VERIFICATION.title} intro={ID_VERIFICATION.summary} />
              <div className="sg-card">
                <ProcedureBody p={ID_VERIFICATION} mine={rank} />
              </div>
            </>
          ) : null}

          {/* ------------------------------------------------ Procedures */}
          {section === "procedures" ? (
            <>
              <SectionHead icon={ListChecks} title="Procedures" intro="Step by step, for the things that come up most. Steps above your rank are marked." />
              <div className="sg-accordion">
                {PROCEDURES.map((p) => {
                  const Icon = icon(p.icon);
                  const isOpen = open === p.key;
                  return (
                    <section key={p.key} className={`sg-acc${isOpen ? " is-open" : ""}`}>
                      <button type="button" className="sg-acc-head" onClick={() => setOpen(isOpen ? null : p.key)} aria-expanded={isOpen}>
                        <Icon size={18} aria-hidden="true" />
                        <span>
                          <b>{p.title}</b>
                          <small>{p.summary}</small>
                        </span>
                        <RankTag min={p.min} mine={rank} />
                        <ChevronDown size={18} className="sg-acc-chev" aria-hidden="true" />
                      </button>
                      {isOpen ? (
                        <div className="sg-acc-body">
                          <ProcedureBody p={p} mine={rank} />
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </>
          ) : null}

          {/* ------------------------------------------------ Commands */}
          {section === "commands" ? (
            <>
              <SectionHead icon={Terminal} title="Command reference" intro="Every staff command in Discord, with the lowest rank that can use it and examples you can copy." />
              <div className="sg-tools">
                <label className="sg-search">
                  <Search size={16} aria-hidden="true" />
                  <input type="search" placeholder="Search commands…" value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <label className="sg-toggle">
                  <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} /> Show higher ranks&apos; commands
                </label>
              </div>
              <div className="sg-groups" role="tablist" aria-label="Command groups">
                <button type="button" className={group === "all" ? "is-on" : ""} onClick={() => setGroup("all")}>
                  All
                </button>
                {COMMAND_GROUPS.map((g) => {
                  const Icon = icon(g.icon);
                  return (
                    <button key={g.key} type="button" className={group === g.key ? "is-on" : ""} onClick={() => setGroup(g.key)}>
                      <Icon size={14} aria-hidden="true" /> {g.title}
                    </button>
                  );
                })}
              </div>
              {groups.length ? (
                groups.map((g) => {
                  const Icon = icon(g.icon);
                  return (
                    <section key={g.key} className="sg-card sg-group">
                      <h3>
                        <Icon size={18} aria-hidden="true" /> {g.title}
                      </h3>
                      <p className="sg-muted">{g.about}</p>
                      <ul className="sg-cmds">
                        {g.commands.map((c) => (
                          <CommandCard key={c.cmd} c={c} mine={rank} />
                        ))}
                      </ul>
                    </section>
                  );
                })
              ) : (
                <p className="sg-muted">Nothing matches “{query}”.</p>
              )}
              <p className="sg-muted sg-fine">
                In Discord, type the command and pick each option as it pops up. <code>[brackets]</code> mean the option is optional.
              </p>
            </>
          ) : null}

          {/* ------------------------------------------------ Panel */}
          {section === "panel" ? (
            <>
              <SectionHead icon={Globe} title="This panel" intro="The website panel does most of what the bots do, with more detail." />
              <div className="sg-card">
                <h3>Tabs you can open</h3>
                <div className="sg-chips">
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
              </div>
              <div className="sg-card">
                <h3>Handy to know</h3>
                <ul className="sg-callouts">
                  <li>Search any member at the top of the panel to see their record, application and activity in one place.</li>
                  <li>Join Apps lets you accept, deny or ban applications straight from the website.</li>
                  <li>Punishments shows every action the team has taken, and you can filter by member, staff or type.</li>
                  <li>AutoMod shows what it caught and lets admins change rules and word lists.</li>
                </ul>
              </div>
            </>
          ) : null}

          {/* ------------------------------------------------ Notes */}
          {section === "notes" ? (
            <>
              <SectionHead icon={NotebookPen} title="Team notes" intro="Notes from the admins for the whole team." />
              <section className="sg-card sg-notes">
                {data.level === "admin" && !editing ? (
                  <div className="sg-card-head">
                    <span className="sg-muted">Only admins can edit these.</span>
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
                  </div>
                ) : null}
                {editing ? (
                  <div className="sg-edit">
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} placeholder={"Anything else the team should know.\n\n# A heading\n- A bullet point\n**Bold** words"} />
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
                      <small className="sg-muted">
                        Updated {new Date(data.notes.updatedAt).toLocaleDateString()} by {data.notes.updatedBy}
                      </small>
                    ) : null}
                  </>
                ) : (
                  <p className="sg-muted">No team notes yet.</p>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
