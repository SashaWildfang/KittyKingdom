"use client";

import { Check, Copy, Download, ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MMMember, MMSnapshot } from "../../../lib/members-manager";
import { useStored } from "../admin-shared";
import { applyFilter, breakdown, crosstab, EMPTY, makeCtx, noneBuckets, type Ctx, type Filter } from "../members/members-query";
import { BarsBlock, ColumnsBlock, Graphic, HeatBlock, HeroBlock, pctText, seriesColor, SIZES, SplitBlock, StripBlock, svgToPng, TilesBlock, TOKENS, type BarRow, type Frame, type Size, type Theme } from "./charts";
import "./graphics.css";

type Kind = "group" | "ratio" | "compare" | "overview" | "joins" | "levels";
const KINDS: { key: Kind; label: string; blurb: string }[] = [
  { key: "group", label: "Role group breakdown", blurb: "Every role in a group (Gender, Pronouns, Positions…) with counts, shares and a strip." },
  { key: "ratio", label: "Ratio", blurb: "One set of roles against another, like men to women." },
  { key: "compare", label: "Two groups compared", blurb: "A heat table, like Gender × Relationship Status." },
  { key: "overview", label: "Server overview", blurb: "Headline numbers, joins over the last year and the biggest roles." },
  { key: "joins", label: "Joins over time", blurb: "New members each month." },
  { key: "levels", label: "Level spread", blurb: "How many members are at each level band." },
];

type Opts = {
  kind: Kind;
  theme: Theme;
  size: Size;
  among: string; // role id, or "" for everyone
  group: string;
  rowGroup: string;
  colGroup: string;
  aRoles: string[];
  bRoles: string[];
  months: number;
  title: string;
  subtitle: string;
  footnote: boolean;
};
const DEFAULT: Opts = { kind: "group", theme: "dark", size: "landscape", among: "", group: "Gender", rowGroup: "Gender", colGroup: "Relationship_Status", aRoles: [], bRoles: [], months: 12, title: "", subtitle: "", footnote: true };

const today = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const ratio = (a: number, b: number) => (!b ? "—" : (a / b).toFixed(a / b >= 10 ? 1 : 2).replace(/\.?0+$/, "") || "0");

/** Works out everything a graphic needs, then draws it. */
function useGraphic(ctx: Ctx | null, o: Opts) {
  return useMemo(() => {
    if (!ctx) return null;
    const snap = ctx.snap;
    const roleName = (id: string) => snap.roles[ctx.index.get(id) ?? -1]?.name ?? "Unknown role";
    const groupTitle = (k: string) => snap.categories.find((c) => c.key === k)?.title ?? k;
    const base: Filter = o.among ? { ...EMPTY, all: [o.among] } : EMPTY;
    const members = applyFilter(ctx, base);
    const humans = snap.members.filter((m) => !m.bot);
    const amongText = o.among ? `members with ${roleName(o.among)}` : "members";
    const stamp = `Snapshot · ${today()}\nSource: live Discord roles`;
    let title = "";
    let subtitle = "";
    let footnote = "";
    let body: (b: { x: number; y: number; w: number; h: number; t: (typeof TOKENS)["dark"]; theme: Theme }) => ReactNode = () => null;
    const square = o.size === "square";

    if (o.kind === "group") {
      const b = breakdown(ctx, members, { kind: "category", key: o.group });
      const many = b.buckets.length > 8;
      const rows: BarRow[] = b.buckets.map((x, i) => ({ label: x.label, count: x.count, color: many ? undefined : seriesColor(o.theme, i) }));
      const none = noneBuckets(b);
      const top = b.buckets[0];
      const second = b.buckets[1];
      title = `${groupTitle(o.group)} breakdown${o.among ? ` of ${roleName(o.among)} members` : ""}`;
      subtitle = `${members.length.toLocaleString()} ${amongText}, counted from the ${groupTitle(o.group).toLowerCase()} roles they picked.`;
      footnote = [b.multi ? `${b.multi} members picked more than one ${groupTitle(o.group).toLowerCase()} role, so a few are counted twice.` : "", none.length > 1 ? "18+ role groups can only be picked by members with 18+ Verified." : "", "Bots are not counted."].filter(Boolean).join(" ");
      body = ({ x, y, w, h, t, theme }) => {
        const accent = seriesColor(theme, 0);
        const barRows = [...rows.map((r) => ({ ...r, color: r.color ?? accent })), ...none.map((n, i) => ({ label: n.label, count: n.count, color: i ? t.gray2 : t.gray }))];
        const stripRows: BarRow[] = [...b.buckets.slice(0, 7).map((x, i) => ({ label: x.label, count: x.count, color: seriesColor(theme, i) })), ...(b.buckets.length > 7 ? [{ label: "Other roles", count: b.buckets.slice(7).reduce((a, z) => a + z.count, 0), color: t.text2 }] : []), ...none.map((n, i) => ({ label: n.label, count: n.count, color: i ? t.gray2 : t.gray }))];
        const stripH = 170;
        const gap = 26;
        const heroW = square ? w : w * 0.36;
        const heroH = square ? 260 : h - stripH - gap;
        const bars = square ? { x, y: y + heroH + gap, w, h: h - heroH - stripH - gap * 2 } : { x: x + heroW + gap, y, w: w - heroW - gap, h: h - stripH - gap };
        return (
          <g>
            <HeroBlock
              x={x}
              y={y}
              w={heroW}
              h={heroH}
              t={t}
              label={second && top ? `${top.label} : ${second.label}` : "Most picked"}
              big={second && top ? ratio(top.count, second.count) : top ? pctText(top.count, members.length) : "0"}
              small={second && top ? ": 1" : undefined}
              caption={top ? `${top.count.toLocaleString()} ${top.label} to ${second ? `${second.count.toLocaleString()} ${second.label}` : "no others"}. ${top.label} is ${pctText(top.count, members.length)} of ${amongText}.` : "Nobody has picked one of these roles yet."}
              chips={[top, second].filter(Boolean).map((z, i) => ({ color: seriesColor(theme, i), text: `${z!.label} ${z!.count.toLocaleString()}` }))}
            />
            <BarsBlock {...bars} t={t} rows={barRows} total={members.length} title={`Members by ${groupTitle(o.group).toLowerCase()} role`} />
            <StripBlock x={x} y={y + h - stripH} w={w} h={stripH} t={t} rows={stripRows} title="Everyone, side by side" />
          </g>
        );
      };
    } else if (o.kind === "ratio") {
      const fa = { ...base, any: o.aRoles };
      const fb = { ...base, any: o.bRoles };
      const ma = o.aRoles.length ? applyFilter(ctx, fa).length : 0;
      const mb = o.bRoles.length ? applyFilter(ctx, fb).length : 0;
      const la = o.aRoles.map(roleName).join(" + ") || "Pick roles";
      const lb = o.bRoles.map(roleName).join(" + ") || "Pick roles";
      title = `${la} to ${lb}${o.among ? ` among ${roleName(o.among)}` : ""}`;
      subtitle = `Out of ${members.length.toLocaleString()} ${amongText}.`;
      footnote = "Members with roles on both sides are counted on both. Bots are not counted.";
      body = ({ x, y, w, h, t, theme }) => {
        const tileH = 170;
        const gap = 26;
        return (
          <g>
            <HeroBlock x={x} y={y} w={square ? w : w * 0.42} h={h - tileH - gap} t={t} label="Ratio" big={ratio(ma, mb)} small=": 1" caption={`${ma.toLocaleString()} ${la} for every ${mb.toLocaleString()} ${lb}.`} chips={[{ color: seriesColor(theme, 0), text: `${la} ${ma}` }, { color: seriesColor(theme, 1), text: `${lb} ${mb}` }]} />
            {!square ? (
              <SplitBlock x={x + w * 0.42 + gap} y={y} w={w - w * 0.42 - gap} h={h - tileH - gap} t={t} a={{ label: la, count: ma, color: seriesColor(theme, 0) }} b={{ label: lb, count: mb, color: seriesColor(theme, 1) }} title="Side by side" />
            ) : null}
            <TilesBlock
              x={x}
              y={y + h - tileH}
              w={w}
              h={tileH}
              t={t}
              tiles={[
                { label: la, value: ma.toLocaleString(), note: `${pctText(ma, members.length)} of ${amongText}` },
                { label: lb, value: mb.toLocaleString(), note: `${pctText(mb, members.length)} of ${amongText}` },
                { label: o.among ? `All with ${roleName(o.among)}` : "All members", value: members.length.toLocaleString() },
              ]}
            />
          </g>
        );
      };
    } else if (o.kind === "compare") {
      const ct = crosstab(ctx, members, o.rowGroup, o.colGroup);
      title = `${groupTitle(o.rowGroup)} × ${groupTitle(o.colGroup)}${o.among ? ` · ${roleName(o.among)}` : ""}`;
      subtitle = `${members.length.toLocaleString()} ${amongText}. Each cell counts members with both roles.`;
      footnote = `“None” is members with no ${groupTitle(o.colGroup).toLowerCase()} role${ctx.adult.has(o.colGroup) ? " (18+ groups need the 18+ Verified role)" : ""}. Members can pick more than one role in a group. Bots are not counted.`;
      const rowLabels = [...ct.rows.map((r) => r.name), `No ${groupTitle(o.rowGroup).toLowerCase()} role`];
      const colLabels = [...ct.cols.map((c) => c.name), "None"];
      const cells = [...ct.cells.map((r, i) => [...r, ct.colNone[i]]), [...ct.rowNone, ct.neither]];
      const totals = cells.map((r) => r.reduce((a, z) => a + z, 0));
      body = ({ x, y, w, h, t, theme }) => <HeatBlock x={x} y={y} w={w} h={h} t={t} rows={rowLabels} cols={colLabels} cells={cells} totals={totals} title="Members in each pair" accent={seriesColor(theme, 0)} />;
    } else if (o.kind === "overview") {
      const now = Date.now();
      const month = 30 * 86_400_000;
      const verified = ctx.verified !== null ? humans.filter((m) => m.r.includes(ctx.verified!)).length : 0;
      const joins = monthly(humans, 12);
      const top = Array.from(
        humans.reduce((acc, m) => {
          m.r.forEach((i) => acc.set(i, (acc.get(i) ?? 0) + 1));
          return acc;
        }, new Map<number, number>()),
      )
        .filter(([i]) => !snap.roles[i].managed)
        .sort((a, z) => z[1] - a[1])
        .slice(0, 8);
      title = "Bear Nation at a glance";
      subtitle = `${humans.length.toLocaleString()} members in the Discord server today.`;
      footnote = "Bots are not counted. Joins only count members who are still in the server.";
      body = ({ x, y, w, h, t, theme }) => {
        const tileH = 150;
        const gap = 26;
        const rest = h - tileH - gap;
        return (
          <g>
            <TilesBlock
              x={x}
              y={y}
              w={w}
              h={tileH}
              t={t}
              tiles={[
                { label: "Members", value: humans.length.toLocaleString() },
                { label: "Joined in 30 days", value: humans.filter((m) => (m.joinedAt ?? 0) > now - month).length.toLocaleString() },
                { label: "18+ Verified", value: verified.toLocaleString(), note: pctText(verified, humans.length) },
                { label: "Boosting", value: humans.filter((m) => m.boosting).length.toLocaleString() },
                ...(square ? [] : [{ label: "Website accounts", value: humans.filter((m) => m.account).length.toLocaleString(), note: pctText(humans.filter((m) => m.account).length, humans.length) }]),
              ]}
            />
            <ColumnsBlock x={x} y={y + tileH + gap} w={square ? w : w * 0.55} h={square ? rest * 0.5 - gap / 2 : rest} t={t} cols={joins} title="New members each month" color={seriesColor(theme, 0)} />
            <BarsBlock
              x={square ? x : x + w * 0.55 + gap}
              y={square ? y + tileH + gap + rest * 0.5 + gap / 2 : y + tileH + gap}
              w={square ? w : w - w * 0.55 - gap}
              h={square ? rest * 0.5 - gap / 2 : rest}
              t={t}
              rows={top.map(([i, n]) => ({ label: snap.roles[i].name, count: n, color: seriesColor(theme, 0) }))}
              total={humans.length}
              title="Biggest roles"
            />
          </g>
        );
      };
    } else if (o.kind === "joins") {
      const cols = monthly(members, o.months);
      const total = cols.reduce((a, c) => a + c.count, 0);
      const best = cols.reduce((a, c) => (c.count > a.count ? c : a), cols[0] ?? { label: "", count: 0 });
      title = `New ${o.among ? `${roleName(o.among)} ` : ""}members each month`;
      subtitle = `The last ${o.months} months: ${total.toLocaleString()} joined and are still here. Busiest month: ${best.label} (${best.count.toLocaleString()}).`;
      footnote = "Counts members by the date they joined. Members who joined and left again aren't included. Bots are not counted.";
      body = ({ x, y, w, h, t, theme }) => <ColumnsBlock x={x} y={y} w={w} h={h} t={t} cols={cols} title="Joins per month" color={seriesColor(theme, 0)} />;
    } else {
      const b = breakdown(ctx, members, { kind: "level" });
      const withLevel = members.filter((m) => (m.level ?? 0) > 0);
      const avg = withLevel.length ? withLevel.reduce((a, m) => a + (m.level ?? 0), 0) / withLevel.length : 0;
      const maxLevel = Math.max(0, ...members.map((m) => m.level ?? 0));
      title = `Level spread${o.among ? ` of ${roleName(o.among)} members` : ""}`;
      subtitle = `${members.length.toLocaleString()} ${amongText}, grouped by their chat level.`;
      footnote = "Levels come from chat and voice XP. Bots are not counted.";
      body = ({ x, y, w, h, t, theme }) => {
        const tileH = 150;
        const gap = 26;
        return (
          <g>
            <TilesBlock
              x={x}
              y={y}
              w={w}
              h={tileH}
              t={t}
              tiles={[
                { label: "Average level", value: avg.toFixed(1), note: "of members with a level" },
                { label: "Highest level", value: String(maxLevel) },
                { label: "Level 10+", value: members.filter((m) => (m.level ?? 0) >= 10).length.toLocaleString(), note: pctText(members.filter((m) => (m.level ?? 0) >= 10).length, members.length) },
              ]}
            />
            <ColumnsBlock x={x} y={y + tileH + gap} w={w} h={h - tileH - gap} t={t} cols={b.buckets.map((z) => ({ label: z.label, count: z.count }))} title="Members per level band" color={seriesColor(theme, 2)} />
          </g>
        );
      };
    }

    const frame: Frame = {
      theme: o.theme,
      size: o.size,
      eyebrow: o.among ? `Bear Nation · ${roleName(o.among)}` : "Bear Nation",
      title: o.title.trim() || title,
      subtitle: o.subtitle.trim() || subtitle,
      stamp,
      footnote: o.footnote ? footnote : "",
    };
    return { frame, body, defaults: { title, subtitle } };
  }, [ctx, o]);
}

/** Members per join month, oldest to newest. */
function monthly(members: MMMember[], months: number) {
  const now = new Date();
  const keys = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return { y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleDateString("en-US", { month: "short", ...(months > 12 || d.getMonth() === 0 ? { year: "2-digit" } : {}) }) };
  });
  return keys.map((k) => ({ label: k.label, count: members.filter((m) => m.joinedAt && new Date(m.joinedAt).getFullYear() === k.y && new Date(m.joinedAt).getMonth() === k.m).length }));
}

function RoleMulti({ ctx, value, onChange, placeholder }: { ctx: Ctx; value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="gx-multi">
      {value.map((id) => (
        <button key={id} type="button" className="gx-pill" onClick={() => onChange(value.filter((x) => x !== id))}>
          {ctx.snap.roles[ctx.index.get(id) ?? -1]?.name ?? id} ×
        </button>
      ))}
      <select className="adm-select" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])} aria-label={placeholder}>
        <option value="">{value.length ? "Add another role…" : placeholder}</option>
        {ctx.snap.roles
          .filter((r) => !r.managed && !value.includes(r.id))
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
      </select>
    </div>
  );
}

export function GraphicsTab() {
  const [snap, setSnap] = useState<MMSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [o, setO] = useStored<Opts>("gx-opts", DEFAULT);
  const opts = useMemo(() => ({ ...DEFAULT, ...o }), [o]);
  const [busy, setBusy] = useState<"png" | "copy" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 2000);
    return () => clearTimeout(t);
  }, [done]);

  const ctx = useMemo(() => (snap ? makeCtx(snap) : null), [snap]);
  // A sensible starting ratio (Male vs Female) the first time
  useEffect(() => {
    if (!ctx || opts.aRoles.length || opts.bRoles.length) return;
    const find = (re: RegExp) => ctx.snap.roles.find((r) => re.test(r.name.replace(/[^\w\s()+/-]/g, "").trim()))?.id;
    const male = find(/^male$/i);
    const female = find(/^female$/i);
    if (male && female) setO({ ...opts, aRoles: [male], bRoles: [female] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);
  const g = useGraphic(ctx, opts);
  const set = (patch: Partial<Opts>) => setO({ ...opts, ...patch });

  const filename = () => `${(g?.frame.title ?? "graphic").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}.png`;
  const download = async () => {
    if (!svgRef.current) return;
    setBusy("png");
    try {
      const blob = await svgToPng(svgRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDone("Saved");
    } catch {
      setDone("Couldn't make the image");
    }
    setBusy(null);
  };
  const copy = async () => {
    if (!svgRef.current) return;
    setBusy("copy");
    try {
      const blob = await svgToPng(svgRef.current);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setDone("Copied. Paste it into Discord");
    } catch {
      setDone("Your browser blocked copying. Use Download instead");
    }
    setBusy(null);
  };

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
  if (!ctx || !g) {
    return (
      <div className="adm-panel gx-loading">
        <Loader2 size={20} className="gx-spin" aria-hidden="true" /> Loading member data…
      </div>
    );
  }
  const { w, h } = SIZES[opts.size];
  const groups = ctx.snap.categories;

  return (
    <div className="adm-panel gx">
      <header className="gx-head">
        <div>
          <h2>
            <ImageIcon size={20} aria-hidden="true" /> Graphics
          </h2>
          <p>Make a stat graphic from live member data and save it as a PNG to post. Nothing is shared until you post it.</p>
        </div>
        <button type="button" className="adm-btn adm-btn--ghost" onClick={() => void load(true)} disabled={loading}>
          <RefreshCw size={14} className={loading ? "gx-spin" : undefined} aria-hidden="true" /> Refresh data
        </button>
      </header>

      <div className="gx-layout">
        <aside className="gx-controls">
          <section>
            <h3>Graphic</h3>
            <div className="gx-kinds">
              {KINDS.map((k) => (
                <button key={k.key} type="button" className={opts.kind === k.key ? "is-on" : undefined} onClick={() => set({ kind: k.key, title: "", subtitle: "" })}>
                  <b>{k.label}</b>
                  <small>{k.blurb}</small>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Data</h3>
            {opts.kind !== "overview" ? (
              <label className="gx-field">
                <span>Among</span>
                <select className="adm-select" value={opts.among} onChange={(e) => set({ among: e.target.value, title: "", subtitle: "" })}>
                  <option value="">Everyone in the server</option>
                  {ctx.snap.roles
                    .filter((r) => !r.managed)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Members with {r.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            {opts.kind === "group" ? (
              <label className="gx-field">
                <span>Role group</span>
                <select
                  className="adm-select"
                  value={opts.group}
                  onChange={(e) => {
                    // 18+ groups only make sense among 18+ Verified members, so start there (it can still be changed)
                    const adult = ctx.adult.has(e.target.value);
                    const v18 = ctx.verified !== null ? ctx.snap.roles[ctx.verified].id : "";
                    set({ group: e.target.value, title: "", subtitle: "", ...(adult && !opts.among && v18 ? { among: v18 } : {}) });
                  }}
                >
                  {groups.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.title}
                      {c.adult ? " (18+)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {opts.kind === "compare" ? (
              <>
                <label className="gx-field">
                  <span>Down the side</span>
                  <select className="adm-select" value={opts.rowGroup} onChange={(e) => set({ rowGroup: e.target.value, title: "", subtitle: "" })}>
                    {groups.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="gx-field">
                  <span>Across the top</span>
                  <select className="adm-select" value={opts.colGroup} onChange={(e) => set({ colGroup: e.target.value, title: "", subtitle: "" })}>
                    {groups.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            {opts.kind === "ratio" ? (
              <>
                <div className="gx-field">
                  <span>First side (any of these roles)</span>
                  <RoleMulti ctx={ctx} value={opts.aRoles} onChange={(v) => set({ aRoles: v, title: "", subtitle: "" })} placeholder="Pick a role…" />
                </div>
                <div className="gx-field">
                  <span>Second side (any of these roles)</span>
                  <RoleMulti ctx={ctx} value={opts.bRoles} onChange={(v) => set({ bRoles: v, title: "", subtitle: "" })} placeholder="Pick a role…" />
                </div>
              </>
            ) : null}
            {opts.kind === "joins" ? (
              <label className="gx-field">
                <span>Months</span>
                <select className="adm-select" value={opts.months} onChange={(e) => set({ months: Number(e.target.value), subtitle: "" })}>
                  {[6, 12, 18, 24].map((n) => (
                    <option key={n} value={n}>
                      Last {n} months
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </section>

          <section>
            <h3>Look</h3>
            <div className="gx-seg" role="radiogroup" aria-label="Theme">
              {(["dark", "light"] as Theme[]).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={opts.theme === t} className={opts.theme === t ? "is-on" : undefined} onClick={() => set({ theme: t })}>
                  {t === "dark" ? "Dark" : "Light"}
                </button>
              ))}
            </div>
            <label className="gx-field">
              <span>Size</span>
              <select className="adm-select" value={opts.size} onChange={(e) => set({ size: e.target.value as Size })}>
                {(Object.keys(SIZES) as Size[]).map((s) => (
                  <option key={s} value={s}>
                    {SIZES[s].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="gx-field">
              <span>Title</span>
              <input className="gx-input" value={opts.title} placeholder={g.defaults.title} onChange={(e) => set({ title: e.target.value })} maxLength={90} />
            </label>
            <label className="gx-field">
              <span>Subtitle</span>
              <input className="gx-input" value={opts.subtitle} placeholder={g.defaults.subtitle} onChange={(e) => set({ subtitle: e.target.value })} maxLength={180} />
            </label>
            <label className="gx-check">
              <input type="checkbox" checked={opts.footnote} onChange={(e) => set({ footnote: e.target.checked })} /> Show the footnote (how it was counted)
            </label>
          </section>
        </aside>

        <div className="gx-preview">
          <div className="gx-actions">
            <button type="button" className="adm-btn" onClick={() => void download()} disabled={!!busy}>
              {busy === "png" ? <Loader2 size={14} className="gx-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />} Download PNG
            </button>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={() => void copy()} disabled={!!busy}>
              {busy === "copy" ? <Loader2 size={14} className="gx-spin" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} Copy image
            </button>
            {done ? (
              <span className="gx-done" role="status">
                <Check size={14} aria-hidden="true" /> {done}
              </span>
            ) : null}
            <span className="gx-dims">
              {w * 2}×{h * 2} PNG
            </span>
          </div>
          <div className="gx-canvas" style={{ aspectRatio: `${w} / ${h}` }}>
            <Graphic frame={g.frame} body={g.body} svgRef={svgRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
