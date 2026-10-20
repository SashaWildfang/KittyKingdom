"use client";

import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bookmark,
  Download,
  Filter as FilterIcon,
  Grid3x3,
  Loader2,
  MessageCircleQuestion,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Table2,
  List as ListIcon,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { MMMember, MMRole, MMSnapshot } from "../../../lib/members-manager";
import { askConfirm, showNotice } from "../../confirm-dialog";
import { downloadText, timeAgo, toCsv, useStored } from "../admin-shared";
import {
  EMPTY,
  applyFilter,
  breakdown,
  categoryOf,
  combine,
  crosstab,
  describe,
  filterIsEmpty,
  makeCtx,
  noneBuckets,
  parseQuestion,
  type Ctx,
  type Dim,
  type Filter,
  type Parsed,
} from "./members-query";
import "./members.css";

const EXAMPLES = [
  "of the 18+ verified members how many are male",
  "gender breakdown of 18+ verified members",
  "ratio of men to women among 18+ verified",
  "relationship status of females",
  "how many 18+ verified members have no gender role",
  "how many members joined in the last 30 days",
  "how many boosters have a website account",
  "pronouns breakdown of nonbinary members",
];

type View = "breakdown" | "crosstab" | "roles" | "members";
type SortKey = "name" | "joined" | "created" | "level" | "messages" | "balance" | "roles";
type Saved = { name: string; filter: Filter };

const pct = (n: number, of: number) => (of ? `${((n / of) * 100).toFixed(n / of < 0.1 && n ? 1 : 0)}%` : "0%");
const fmtDate = (t: number | null) => (t ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const ratioText = (a: number, b: number) => (!b ? (a ? "all of one side" : "—") : `${(a / b).toFixed(a / b >= 10 ? 1 : 2)} : 1`);

function RoleChip({ role, mode, onClick, count }: { role: MMRole; mode?: "all" | "any" | "none"; onClick?: () => void; count?: number }) {
  return (
    <button type="button" className={`mm-chip${mode ? ` is-${mode}` : ""}`} style={{ "--rc": role.color ?? "#8b8d98" } as CSSProperties} onClick={onClick} title={mode === "none" ? "Excluded" : mode === "any" ? "Any of these" : mode ? "Must have" : role.name}>
      <i aria-hidden="true" />
      {mode === "none" ? "not " : ""}
      {role.name}
      {typeof count === "number" ? <small>{count}</small> : null}
      {onClick && mode ? <X size={12} aria-hidden="true" /> : null}
    </button>
  );
}

/** Horizontal bars with counts and shares; role bars can be clicked to filter by that role. */
function Bars({ rows, total, onPick, extra = [] }: { rows: { key: string; label: string; count: number; color?: string | null; roleId?: string }[]; total: number; onPick?: (roleId: string) => void; extra?: { key: string; label: string; count: number; color?: string | null }[] }) {
  // The "no role" bars always show (even at 0) so it's clear everyone is counted
  const all: { key: string; label: string; count: number; color?: string | null; roleId?: string }[] = [...rows, ...extra];
  const max = Math.max(1, ...all.map((r) => r.count));
  return (
    <div className="mm-bars">
      {all.map((r) => (
        <button
          key={r.key}
          type="button"
          className="mm-bar"
          disabled={!(r.roleId && onPick)}
          onClick={() => r.roleId && onPick?.(r.roleId)}
          title={r.roleId && onPick ? `Filter to ${r.label}` : undefined}
        >
          <span className="mm-bar-label">
            <i style={{ background: r.color ?? "var(--mm-accent)" }} aria-hidden="true" />
            {r.label}
          </span>
          <span className="mm-bar-track">
            <span className="mm-bar-fill" style={{ width: `${(r.count / max) * 100}%`, background: r.color ?? "var(--mm-accent)" }} />
          </span>
          <span className="mm-bar-val">
            <b>{r.count.toLocaleString()}</b> {pct(r.count, total)}
          </span>
        </button>
      ))}
    </div>
  );
}

/** The answer to a typed question. */
function Answer({ ctx, parsed, onShow }: { ctx: Ctx; parsed: Parsed; onShow: (f: Filter) => void }) {
  const base = applyFilter(ctx, parsed.base);
  let headline: ReactNode = null;
  let detail: ReactNode = null;
  let showFilter = parsed.base;
  let split: { members: MMMember[]; dim: Dim; title: string } | null = null;

  if (parsed.ratio) {
    const a = applyFilter(ctx, combine(parsed.base, parsed.ratio[0])).length;
    const b = applyFilter(ctx, combine(parsed.base, parsed.ratio[1])).length;
    headline = (
      <>
        <strong>{ratioText(a, b)}</strong>
        <span>
          {a.toLocaleString()} {describe(ctx, parsed.ratio[0])} to {b.toLocaleString()} {describe(ctx, parsed.ratio[1])}
        </span>
      </>
    );
    detail = <p>Among {base.length.toLocaleString()} members ({describe(ctx, parsed.base)}).</p>;
    const role = parsed.ratio[0].all[0] ?? parsed.ratio[1].all[0];
    const cat = role ? categoryOf(ctx, role) : null;
    if (cat) split = { members: base, dim: { kind: "category", key: cat }, title: `${ctx.snap.categories.find((c) => c.key === cat)?.title} among them` };
  } else if (parsed.target) {
    const both = combine(parsed.base, parsed.target);
    const hit = applyFilter(ctx, both);
    showFilter = both;
    const allBase = filterIsEmpty(parsed.base);
    headline = (
      <>
        <strong>{hit.length.toLocaleString()}</strong>
        <span>
          {allBase ? "members" : `of ${base.length.toLocaleString()}`} · <b>{pct(hit.length, base.length)}</b>
          {allBase ? " of everyone" : ""}
        </span>
      </>
    );
    detail = (
      <p>
        {allBase ? (
          <>
            {hit.length.toLocaleString()} members match: {describe(ctx, parsed.target)}.
          </>
        ) : (
          <>
            Of the {base.length.toLocaleString()} members with {describe(ctx, parsed.base)}, {hit.length.toLocaleString()} ({pct(hit.length, base.length)}) have {describe(ctx, parsed.target)}.
          </>
        )}
      </p>
    );
    const role = parsed.target.all[0] ?? parsed.target.any[0];
    const cat = parsed.dim?.kind === "category" ? parsed.dim.key : role ? categoryOf(ctx, role) : null;
    if (parsed.dim) split = { members: base, dim: parsed.dim, title: "Breakdown" };
    else if (cat) split = { members: base, dim: { kind: "category", key: cat }, title: `All ${ctx.snap.categories.find((c) => c.key === cat)?.title.toLowerCase()} roles among them` };
  } else {
    headline = (
      <>
        <strong>{base.length.toLocaleString()}</strong>
        <span>members · {describe(ctx, parsed.base)}</span>
      </>
    );
    if (parsed.dim) split = { members: base, dim: parsed.dim, title: "Breakdown" };
  }

  const b = split ? breakdown(ctx, split.members, split.dim) : null;
  return (
    <div className="mm-answer">
      <div className="mm-answer-head">{headline}</div>
      {detail}
      <div className="mm-reading">
        <span>Read as:</span>
        {parsed.reading.map((r) => (
          <em key={r}>{r}</em>
        ))}
      </div>
      {parsed.unknown.length ? <p className="mm-unknown">Didn&apos;t understand: {Array.from(new Set(parsed.unknown)).slice(0, 8).join(", ")}. Role names need to match the server&apos;s roles.</p> : null}
      {b && split ? (
        <div className="mm-answer-split">
          <h4>{split.title}</h4>
          <Bars rows={b.buckets} total={split.members.length} extra={split.dim.kind === "category" ? noneBuckets(b) : []} />
          {b.multi ? <p className="mm-fine">{b.multi} picked more than one, so the bars can add up to more than the total.</p> : null}
        </div>
      ) : null}
      <button type="button" className="adm-btn adm-btn--ghost" onClick={() => onShow(showFilter)}>
        <Users size={14} aria-hidden="true" /> Show these members
      </button>
    </div>
  );
}

/** Pick roles to add to the filter: searchable, grouped by role selector category, with member counts. */
function RolePicker({ ctx, counts, onPick, onMissing, onClose }: { ctx: Ctx; counts: Map<string, number>; onPick: (id: string, mode: "all" | "any" | "none") => void; onMissing: (key: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"all" | "any" | "none">("all");
  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => {
    const inCat = new Set(ctx.snap.categories.flatMap((c) => c.roleIds));
    const list = ctx.snap.categories.map((c) => ({ key: c.key, title: c.title, roles: c.roleIds.map((id) => ctx.snap.roles[ctx.index.get(id)!]).filter(Boolean), category: true }));
    list.unshift({ key: "__server", title: "Server roles", roles: ctx.snap.roles.filter((r) => !inCat.has(r.id) && !r.managed), category: false });
    return list.map((g) => ({ ...g, roles: g.roles.filter((r) => !needle || r.name.toLowerCase().includes(needle)) })).filter((g) => g.roles.length);
  }, [ctx, needle]);
  return (
    <div className="mm-picker" role="dialog" aria-label="Add a role filter">
      <div className="mm-picker-head">
        <label className="adm-search">
          <Search size={15} aria-hidden="true" />
          <input autoFocus placeholder="Find a role…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="mm-seg" role="radiogroup" aria-label="How to use the role">
          {(
            [
              ["all", "Must have"],
              ["any", "Any of"],
              ["none", "Exclude"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? "is-on" : undefined} onClick={() => setMode(k)}>
              {l}
            </button>
          ))}
        </div>
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <div className="mm-picker-body">
        {groups.map((g) => (
          <section key={g.key}>
            <h5>
              {g.title}
              {g.category ? (
                <button type="button" onClick={() => onMissing(g.key)} title={`Members who picked no ${g.title.toLowerCase()} role`}>
                  + has none
                </button>
              ) : null}
            </h5>
            <div className="mm-picker-roles">
              {g.roles.map((r) => (
                <RoleChip key={r.id} role={r} count={counts.get(r.id) ?? 0} onClick={() => onPick(r.id, mode)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function MembersTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [snap, setSnap] = useState<MMSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useStored<Filter>("mm-filter", EMPTY);
  const [view, setView] = useStored<View>("mm-view", "breakdown");
  const [dimKey, setDimKey] = useStored<string>("mm-dim", "cat:Gender");
  const [rowCat, setRowCat] = useStored<string>("mm-row", "Gender");
  const [colCat, setColCat] = useStored<string>("mm-col", "Relationship_Status");
  const [rowPct, setRowPct] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "joined", dir: -1 });
  const [page, setPage] = useState(1);
  const [picker, setPicker] = useState(false);
  const [question, setQuestion] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [saved, setSaved] = useStored<Saved[]>("mm-saved", []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignable, setAssignable] = useState<{ id: string; name: string }[] | null>(null);
  const [bulkRole, setBulkRole] = useState("");
  const [bulk, setBulk] = useState<{ done: number; failed: number; total: number } | null>(null);
  const [roleSearch, setRoleSearch] = useState("");

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/members/all${fresh ? "?fresh=1" : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null);
    setLoading(false);
    if (res?.ok) setSnap(res as MMSnapshot);
    else setError(res?.error ?? "Couldn't load the member list.");
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const ctx = useMemo(() => (snap ? makeCtx(snap) : null), [snap]);
  const f = useMemo(() => ({ ...EMPTY, ...filter }), [filter]);
  const members = useMemo(() => (ctx ? applyFilter(ctx, f) : []), [ctx, f]);
  const humans = useMemo(() => snap?.members.filter((m) => !m.bot) ?? [], [snap]);
  const roleCounts = useMemo(() => {
    const c = new Map<string, number>();
    if (!snap) return c;
    for (const m of members) for (const i of m.r) c.set(snap.roles[i].id, (c.get(snap.roles[i].id) ?? 0) + 1);
    return c;
  }, [members, snap]);

  const serverCounts = useMemo(() => {
    const c = new Map<string, number>();
    if (!snap) return c;
    for (const m of snap.members) if (!m.bot) for (const i of m.r) c.set(snap.roles[i].id, (c.get(snap.roles[i].id) ?? 0) + 1);
    return c;
  }, [snap]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [filter]);

  if (error && !snap) {
    return (
      <div className="adm-panel">
        <p className="adm-error">{error}</p>
        <button type="button" className="adm-btn" onClick={() => void load(true)}>
          Try again
        </button>
      </div>
    );
  }
  if (!snap || !ctx) {
    return (
      <div className="adm-panel mm-loading">
        <Loader2 size={20} className="mm-spin" aria-hidden="true" /> Loading every member from Discord…
      </div>
    );
  }

  const role = (id: string) => snap.roles[ctx.index.get(id) ?? -1];
  const setF = (patch: Partial<Filter>) => setFilter({ ...f, ...patch });
  const addRole = (id: string, mode: "all" | "any" | "none") => {
    const strip = (list: string[]) => list.filter((x) => x !== id);
    setF({ all: strip(f.all), any: strip(f.any), none: strip(f.none), [mode]: [...strip(f[mode]), id] });
  };
  const removeRole = (id: string) => setF({ all: f.all.filter((x) => x !== id), any: f.any.filter((x) => x !== id), none: f.none.filter((x) => x !== id) });

  const ask = (text: string) => {
    setQuestion(text);
    if (!text.trim()) return setParsed(null);
    setParsed(parseQuestion(ctx, text));
  };

  // Stats across the whole server (not the filter)
  const week = Date.now() - 7 * 86_400_000;
  const stats = [
    { label: "Members", value: humans.length },
    { label: "Bots", value: snap.members.length - humans.length },
    { label: "Joined this week", value: humans.filter((m) => (m.joinedAt ?? 0) > week).length },
    { label: "Boosting", value: humans.filter((m) => m.boosting).length },
    { label: "Website accounts", value: humans.filter((m) => m.account).length },
    { label: "Social profiles", value: humans.filter((m) => m.social).length },
  ];

  // Breakdown
  const dim: Dim = dimKey.startsWith("cat:") ? { kind: "category", key: dimKey.slice(4) } : ({ kind: dimKey } as Dim);
  const b = view === "breakdown" ? breakdown(ctx, members, dim) : null;
  const ct = view === "crosstab" ? crosstab(ctx, members, rowCat, colCat) : null;

  // Members table
  const sorted =
    view === "members"
      ? members.slice().sort((a, z) => {
          const v = (m: MMMember) =>
            sort.key === "name" ? m.name.toLowerCase() : sort.key === "joined" ? m.joinedAt ?? 0 : sort.key === "created" ? m.createdAt : sort.key === "level" ? m.level ?? -1 : sort.key === "messages" ? m.messages ?? -1 : sort.key === "balance" ? m.balance ?? -1 : m.r.length;
          const x = v(a);
          const y = v(z);
          return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
        })
      : [];
  const PAGE = 50;
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const shown = sorted.slice((page - 1) * PAGE, page * PAGE);
  const th = (key: SortKey, label: string) => (
    <th>
      <button type="button" className="mm-sort" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))}>
        {label} {sort.key === key ? sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null}
      </button>
    </th>
  );

  const exportCsv = () => {
    const rows = [["Discord ID", "Display name", "Username", "Joined", "Account created", "Level", "Messages", "Leaves", "Website account", "Social profile", "Boosting", "Roles"]];
    for (const m of members)
      rows.push([m.id, m.name, m.username, m.joinedAt ? new Date(m.joinedAt).toISOString().slice(0, 10) : "", new Date(m.createdAt).toISOString().slice(0, 10), String(m.level ?? ""), String(m.messages ?? ""), String(m.balance ?? ""), m.account ?? "no", m.social ? "yes" : "no", m.boosting ? "yes" : "no", m.r.map((i) => snap.roles[i].name).join("; ")]);
    // A cell starting with = + - @ would run as a formula in Excel / Sheets
    const safe = rows.map((r) => r.map((v) => (/^[=+\-@]/.test(v) ? `'${v}` : v)));
    downloadText(`discord-members-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(safe));
  };

  const targets = selected.size ? members.filter((m) => selected.has(m.id)) : members;
  const runBulk = async (add: boolean) => {
    const r = assignable?.find((x) => x.id === bulkRole);
    if (!r) return;
    const ids = targets.filter((m) => !m.bot && (add ? !m.r.includes(ctx.index.get(r.id)!) : m.r.includes(ctx.index.get(r.id)!))).map((m) => m.id);
    if (!ids.length) return void showNotice(add ? "Everyone picked already has that role." : "Nobody picked has that role.");
    if (ids.length > 1000) return void showNotice("That's more than 1,000 members. Narrow the filter first.");
    if (!(await askConfirm(`${add ? "Add" : "Remove"} the ${r.name} role ${add ? "to" : "from"} ${ids.length.toLocaleString()} member${ids.length === 1 ? "" : "s"}?`, { title: "Bulk role change", confirmLabel: add ? "Add role" : "Remove role", danger: !add }))) return;
    let done = 0;
    let failed = 0;
    setBulk({ done, failed, total: ids.length });
    for (let i = 0; i < ids.length; i += 25) {
      const res = await fetch("/api/admin/members/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId: r.id, add, ids: ids.slice(i, i + 25) }) })
        .then((x) => x.json())
        .catch(() => null);
      if (!res?.ok) {
        setBulk(null);
        return void showNotice(res?.error ?? "That stopped part way. Some members may have been changed.");
      }
      done += res.done;
      failed += res.failed.length;
      setBulk({ done, failed, total: ids.length });
    }
    await fetch("/api/admin/members/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId: r.id, add, finish: true, done, failed }) }).catch(() => undefined);
    setBulk(null);
    await showNotice(`${add ? "Added" : "Removed"} ${r.name} ${add ? "to" : "from"} ${done.toLocaleString()} member${done === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}.`);
    void load(true);
  };

  return (
    <div className="adm-panel mm">
      <header className="mm-head">
        <div>
          <h2>
            <Users size={20} aria-hidden="true" /> Discord Members
          </h2>
          <p>
            Every member of the server, live from Discord with their roles, levels and website accounts. Updated {timeAgo(new Date(snap.at).toISOString())}.
          </p>
        </div>
        <div className="mm-head-actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => void load(true)} disabled={loading}>
            <RefreshCw size={14} className={loading ? "mm-spin" : undefined} aria-hidden="true" /> Refresh
          </button>
          <button type="button" className="adm-btn adm-btn--ghost" onClick={exportCsv}>
            <Download size={14} aria-hidden="true" /> Export {members.length.toLocaleString()} as CSV
          </button>
        </div>
      </header>

      <div className="mm-stats">
        {stats.map((s) => (
          <div key={s.label}>
            <small>{s.label}</small>
            <b>{s.value.toLocaleString()}</b>
          </div>
        ))}
      </div>

      {/* Ask a question */}
      <section className="mm-ask">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <MessageCircleQuestion size={18} aria-hidden="true" />
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question, like “of the 18+ verified members how many are male”" aria-label="Ask a question about members" />
          {question ? (
            <button type="button" className="mm-ask-clear" onClick={() => ask("")} aria-label="Clear">
              <X size={15} />
            </button>
          ) : null}
          <button type="submit" className="adm-btn">
            <Sparkles size={14} aria-hidden="true" /> Ask
          </button>
        </form>
        {!parsed ? (
          <div className="mm-examples">
            {EXAMPLES.map((x) => (
              <button key={x} type="button" onClick={() => ask(x)}>
                {x}
              </button>
            ))}
          </div>
        ) : (
          <Answer
            ctx={ctx}
            parsed={parsed}
            onShow={(nf) => {
              setFilter(nf);
              setView("members");
            }}
          />
        )}
      </section>

      {/* Filters */}
      <section className="mm-filters">
        <div className="mm-filter-roles">
          <span className="mm-label">
            <FilterIcon size={14} aria-hidden="true" /> Roles
          </span>
          {f.all.map((id) => role(id) && <RoleChip key={id} role={role(id)} mode="all" onClick={() => removeRole(id)} />)}
          {f.any.length ? <span className="mm-or">any of</span> : null}
          {f.any.map((id) => role(id) && <RoleChip key={id} role={role(id)} mode="any" onClick={() => removeRole(id)} />)}
          {f.none.map((id) => role(id) && <RoleChip key={id} role={role(id)} mode="none" onClick={() => removeRole(id)} />)}
          {f.missing.map((k) => (
            <button key={k} type="button" className="mm-chip is-none" onClick={() => setF({ missing: f.missing.filter((x) => x !== k) })}>
              no {snap.categories.find((c) => c.key === k)?.title.toLowerCase()} role <X size={12} aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="mm-add" onClick={() => setPicker((p) => !p)}>
            <Plus size={14} aria-hidden="true" /> Add role
          </button>
        </div>
        {picker ? (
          <RolePicker
            ctx={ctx}
            counts={roleCounts}
            onPick={(id, mode) => addRole(id, mode)}
            onMissing={(k) => setF({ missing: Array.from(new Set([...f.missing, k])) })}
            onClose={() => setPicker(false)}
          />
        ) : null}
        <div className="mm-filter-grid">
          <label className="adm-search">
            <Search size={15} aria-hidden="true" />
            <input value={f.search} onChange={(e) => setF({ search: e.target.value })} placeholder="Name, username or ID" />
          </label>
          <select className="adm-select" value={f.joined} onChange={(e) => setF({ joined: e.target.value as Filter["joined"] })} aria-label="Joined">
            <option value="any">Joined: any time</option>
            <option value="1">Joined today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
            <option value="older">Over a year ago</option>
          </select>
          <span className="mm-range">
            Level
            <input type="number" min={0} placeholder="min" value={f.levelMin ?? ""} onChange={(e) => setF({ levelMin: e.target.value === "" ? null : Number(e.target.value) })} />
            <input type="number" min={0} placeholder="max" value={f.levelMax ?? ""} onChange={(e) => setF({ levelMax: e.target.value === "" ? null : Number(e.target.value) })} />
          </span>
          <span className="mm-range">
            Messages
            <input type="number" min={0} placeholder="min" value={f.messagesMin ?? ""} onChange={(e) => setF({ messagesMin: e.target.value === "" ? null : Number(e.target.value) })} />
          </span>
          <select className="adm-select" value={f.account} onChange={(e) => setF({ account: e.target.value as Filter["account"] })} aria-label="Website account">
            <option value="any">Website account: any</option>
            <option value="yes">Has an account</option>
            <option value="verified">Account, email confirmed</option>
            <option value="no">No account</option>
          </select>
          <select className="adm-select" value={f.social} onChange={(e) => setF({ social: e.target.value as Filter["social"] })} aria-label="Social profile">
            <option value="any">Social profile: any</option>
            <option value="yes">Has a Social profile</option>
            <option value="no">No Social profile</option>
          </select>
          <select className="adm-select" value={f.boosting} onChange={(e) => setF({ boosting: e.target.value as Filter["boosting"] })} aria-label="Boosting">
            <option value="any">Boosting: any</option>
            <option value="yes">Boosting</option>
            <option value="no">Not boosting</option>
          </select>
          <select className="adm-select" value={f.timedOut} onChange={(e) => setF({ timedOut: e.target.value as Filter["timedOut"] })} aria-label="Timed out">
            <option value="any">Timeout: any</option>
            <option value="yes">Timed out now</option>
            <option value="no">Not timed out</option>
          </select>
          <select className="adm-select" value={f.bots} onChange={(e) => setF({ bots: e.target.value as Filter["bots"] })} aria-label="Bots">
            <option value="humans">People only</option>
            <option value="all">People and bots</option>
            <option value="bots">Bots only</option>
          </select>
        </div>
        <div className="mm-filter-foot">
          <p className="mm-count">
            <b>{members.length.toLocaleString()}</b> of {humans.length.toLocaleString()} members ({pct(members.length, humans.length)}) · {describe(ctx, f)}
          </p>
          <div className="mm-saved">
            {saved.map((s) => (
              <span key={s.name} className="mm-saved-item">
                <button type="button" onClick={() => setFilter({ ...EMPTY, ...s.filter })}>
                  <Bookmark size={12} aria-hidden="true" /> {s.name}
                </button>
                <button type="button" aria-label={`Delete ${s.name}`} onClick={() => setSaved(saved.filter((x) => x.name !== s.name))}>
                  <X size={11} />
                </button>
              </span>
            ))}
            {!filterIsEmpty(f) ? (
              <>
                <button
                  type="button"
                  className="adm-btn adm-btn--ghost adm-btn--tiny"
                  onClick={() => {
                    const name = describe(ctx, f).slice(0, 40);
                    setSaved([...saved.filter((x) => x.name !== name), { name, filter: f }].slice(-12));
                  }}
                >
                  <Bookmark size={12} aria-hidden="true" /> Save view
                </button>
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => setFilter(EMPTY)}>
                  <X size={12} aria-hidden="true" /> Clear
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* Results */}
      <nav className="mm-views" role="tablist">
        {(
          [
            ["breakdown", "Breakdown", BarChart3],
            ["crosstab", "Compare two groups", Grid3x3],
            ["roles", "Every role", ListIcon],
            ["members", `Members (${members.length.toLocaleString()})`, Table2],
          ] as const
        ).map(([k, l, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? "is-on" : undefined} onClick={() => setView(k)}>
            <Icon size={15} aria-hidden="true" /> {l}
          </button>
        ))}
      </nav>

      {view === "breakdown" && b ? (
        <section className="mm-card">
          <div className="mm-card-head">
            <h3>Breakdown of these {members.length.toLocaleString()} members</h3>
            <select className="adm-select" value={dimKey} onChange={(e) => setDimKey(e.target.value)} aria-label="Break down by">
              <optgroup label="Role groups">
                {snap.categories.map((c) => (
                  <option key={c.key} value={`cat:${c.key}`}>
                    {c.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Other">
                <option value="roles">Every role (top 40)</option>
                <option value="level">Level</option>
                <option value="messages">Messages sent</option>
                <option value="joinMonth">Month they joined</option>
                <option value="accountAge">Discord account age</option>
                <option value="account">Website account</option>
              </optgroup>
            </select>
          </div>
          <Bars rows={b.buckets} total={members.length} extra={dim.kind === "category" ? noneBuckets(b) : []} onPick={(id) => addRole(id, "all")} />
          {b.multi ? <p className="mm-fine">{b.multi} members picked more than one role in this group, so the bars can add up to more than {members.length}.</p> : null}
          {dim.kind === "category" || dim.kind === "roles" ? <p className="mm-fine">Click a role to narrow the members to it.</p> : null}
        </section>
      ) : null}

      {view === "crosstab" && ct ? (
        <section className="mm-card">
          <div className="mm-card-head">
            <h3>Compare two role groups</h3>
            <div className="mm-ct-pick">
              <select className="adm-select" value={rowCat} onChange={(e) => setRowCat(e.target.value)} aria-label="Rows">
                {snap.categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.title}
                  </option>
                ))}
              </select>
              <span>by</span>
              <select className="adm-select" value={colCat} onChange={(e) => setColCat(e.target.value)} aria-label="Columns">
                {snap.categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.title}
                  </option>
                ))}
              </select>
              <label className="mm-check">
                <input type="checkbox" checked={rowPct} onChange={(e) => setRowPct(e.target.checked)} /> Show % of each row
              </label>
            </div>
          </div>
          <div className="mm-ct-wrap">
            <table className="mm-ct">
              <thead>
                <tr>
                  <th />
                  {ct.cols.map((c) => (
                    <th key={c.id}>{c.name}</th>
                  ))}
                  <th>None</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {ct.rows.map((r, ri) => {
                  const total = roleCounts.get(r.id) ?? 0;
                  const max = Math.max(1, ...ct.cells.flat());
                  return (
                    <tr key={r.id}>
                      <th>
                        <i style={{ background: r.color ?? "#8b8d98" }} aria-hidden="true" /> {r.name}
                      </th>
                      {ct.cells[ri].map((n, ci) => (
                        <td key={ct.cols[ci].id} style={{ "--heat": n / max } as CSSProperties}>
                          <button type="button" onClick={() => setFilter({ ...f, all: Array.from(new Set([...f.all, r.id, ct.cols[ci].id])) })} title="Filter to these members" disabled={!n}>
                            {rowPct ? pct(n, total) : n || "·"}
                          </button>
                        </td>
                      ))}
                      <td className="is-none">{rowPct ? pct(ct.colNone[ri], total) : ct.colNone[ri]}</td>
                      <td className="is-total">{total}</td>
                    </tr>
                  );
                })}
                <tr className="is-none-row">
                  <th>
                    <i style={{ background: "#5c5b56" }} aria-hidden="true" /> No {snap.categories.find((c) => c.key === rowCat)?.title.toLowerCase()} role
                  </th>
                  {ct.rowNone.map((n, ci) => (
                    <td key={ct.cols[ci].id} className="is-none">
                      {rowPct ? pct(n, ct.rowNoneTotal) : n}
                    </td>
                  ))}
                  <td className="is-none">{rowPct ? pct(ct.neither, ct.rowNoneTotal) : ct.neither}</td>
                  <td className="is-total">{ct.rowNoneTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mm-fine">
            Counts within the {members.length.toLocaleString()} filtered members. Click a cell to see those members. People can pick more than one role in a group.
            {ctx.adult.has(rowCat) || ctx.adult.has(colCat) ? " 18+ groups can only be picked by members with 18+ Verified, so most “None” counts there are members without it." : ""}
          </p>
        </section>
      ) : null}

      {view === "roles" ? (
        <section className="mm-card">
          <div className="mm-card-head">
            <h3>Every role, by how many of these {members.length.toLocaleString()} members have it</h3>
            <label className="adm-search mm-role-search">
              <Search size={15} aria-hidden="true" />
              <input value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} placeholder="Find a role" />
            </label>
          </div>
          <div className="mm-table-wrap">
            <table className="mm-table mm-roles-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Group</th>
                  <th>Members</th>
                  <th>Share</th>
                  <th>In the whole server</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {snap.roles
                  .filter((r) => !roleSearch.trim() || r.name.toLowerCase().includes(roleSearch.trim().toLowerCase()))
                  .map((r) => ({ r, n: roleCounts.get(r.id) ?? 0, total: serverCounts.get(r.id) ?? 0 }))
                  .sort((a, z) => z.n - a.n || z.total - a.total)
                  .map(({ r, n, total }) => (
                    <tr key={r.id} className="is-static">
                      <td>
                        <span className="mm-role" style={{ "--rc": r.color ?? "#8b8d98" } as CSSProperties}>
                          {r.name}
                        </span>
                        {r.managed ? <em className="mm-tag">bot role</em> : null}
                      </td>
                      <td>{snap.categories.find((c) => c.key === r.category)?.title ?? "Server"}</td>
                      <td>
                        <b>{n.toLocaleString()}</b>
                      </td>
                      <td>
                        <span className="mm-mini">
                          <i style={{ width: pct(n, members.length), background: r.color ?? "var(--mm-accent)" }} />
                        </span>{" "}
                        {pct(n, members.length)}
                      </td>
                      <td>{total.toLocaleString()}</td>
                      <td>
                        <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => addRole(r.id, "all")}>
                          Must have
                        </button>{" "}
                        <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => addRole(r.id, "none")}>
                          Exclude
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === "members" ? (
        <section className="mm-card">
          <div className="mm-bulk">
            <span>
              {selected.size ? (
                <>
                  <b>{selected.size}</b> selected ·{" "}
                  <button type="button" className="mm-link" onClick={() => setSelected(new Set())}>
                    clear
                  </button>
                </>
              ) : (
                <>Bulk actions apply to all {members.length.toLocaleString()} filtered members, or tick some first.</>
              )}
            </span>
            {assignable ? (
              <>
                <select className="adm-select" value={bulkRole} onChange={(e) => setBulkRole(e.target.value)} aria-label="Role to add or remove">
                  <option value="">Pick a role…</option>
                  {assignable.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="adm-btn adm-btn--tiny" disabled={!bulkRole || !!bulk} onClick={() => void runBulk(true)}>
                  <Plus size={13} aria-hidden="true" /> Add to {targets.length.toLocaleString()}
                </button>
                <button type="button" className="adm-btn adm-btn--tiny adm-btn--danger" disabled={!bulkRole || !!bulk} onClick={() => void runBulk(false)}>
                  <Trash2 size={13} aria-hidden="true" /> Remove from {targets.length.toLocaleString()}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="adm-btn adm-btn--ghost adm-btn--tiny"
                onClick={() =>
                  fetch("/api/admin/roles", { cache: "no-store" })
                    .then((r) => r.json())
                    .then((r) => setAssignable(r?.ok ? r.roles : []))
                    .catch(() => setAssignable([]))
                }
              >
                Add or remove a role…
              </button>
            )}
            {bulk ? (
              <span className="mm-progress">
                <Loader2 size={13} className="mm-spin" aria-hidden="true" /> {bulk.done + bulk.failed} / {bulk.total}
              </span>
            ) : null}
          </div>
          <div className="mm-table-wrap">
            <table className="mm-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select this page"
                      checked={shown.length > 0 && shown.every((m) => selected.has(m.id))}
                      onChange={(e) => {
                        const next = new Set(selected);
                        shown.forEach((m) => (e.target.checked ? next.add(m.id) : next.delete(m.id)));
                        setSelected(next);
                      }}
                    />
                  </th>
                  {th("name", "Member")}
                  {th("joined", "Joined")}
                  {th("created", "Account")}
                  {th("level", "Level")}
                  {th("messages", "Messages")}
                  {th("balance", "Leaves")}
                  <th>Website</th>
                  {th("roles", "Roles")}
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => {
                  const rs = m.r.map((i) => snap.roles[i]).sort((a, z) => z.position - a.position);
                  return (
                    <tr key={m.id} onClick={() => onOpenMember(m.id)}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${m.name}`}
                          checked={selected.has(m.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(m.id);
                            else next.delete(m.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td>
                        <span className="mm-who">
                          {m.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.avatar} alt="" width={28} height={28} loading="lazy" />
                          ) : (
                            <span className="mm-who-blank" />
                          )}
                          <span>
                            <b>
                              {m.name}
                              {m.bot ? <em className="mm-tag">bot</em> : null}
                              {m.boosting ? <em className="mm-tag is-boost">booster</em> : null}
                              {m.timedOut ? <em className="mm-tag is-out">timed out</em> : null}
                            </b>
                            <small>@{m.username}</small>
                          </span>
                        </span>
                      </td>
                      <td>{fmtDate(m.joinedAt)}</td>
                      <td>{fmtDate(m.createdAt)}</td>
                      <td>{m.level ?? "—"}</td>
                      <td>{m.messages?.toLocaleString() ?? "—"}</td>
                      <td>{m.balance?.toLocaleString() ?? "—"}</td>
                      <td>{m.account ? (m.account === "verified" ? "✓" : "unconfirmed") : "—"}{m.social ? " · Social" : ""}</td>
                      <td>
                        <span className="mm-roles">
                          {rs.slice(0, 5).map((r) => (
                            <span key={r.id} className="mm-role" style={{ "--rc": r.color ?? "#8b8d98" } as CSSProperties}>
                              {r.name}
                            </span>
                          ))}
                          {rs.length > 5 ? <span className="mm-role is-more" title={rs.slice(5).map((r) => r.name).join(", ")}>+{rs.length - 5}</span> : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mm-pager">
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
