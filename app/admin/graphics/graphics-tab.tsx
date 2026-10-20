"use client";

import { ChevronLeft, ChevronRight, Copy, Dices, Download, Gavel, Globe, HeartHandshake, ImageIcon, Leaf, LayoutGrid, Loader2, MessageCircle, Mic, PartyPopper, ScrollText, Search, ShieldCheck, ShoppingBag, Users, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, RANGES, ZONES, type ParamKind, type Params, type Spec, type StatMeta } from "../../../lib/graphics/spec";
import { useStored } from "../admin-shared";
import { SIZES, svgToPng, type Size, type Theme, type Trend } from "./charts";
import { SpecGraphic } from "./spec-graphic";
import "./graphics.css";

type Options = {
  ranges: { group: string; items: [string, string][] }[];
  channels: { id: string; name: string; messages: number }[];
  groups: { key: string; title: string; adult: boolean }[];
  roles: { id: string; name: string }[];
  games: { key: string; name: string }[];
};
type Look = { theme: Theme; size: Size; footnote: boolean; trend?: Trend };
type Tip = { x: number; y: number; lines: string[]; flip: boolean };

// The category icons named in lib/graphics/spec.ts
const ICONS: Record<string, LucideIcon> = { ShieldCheck, Users, MessageCircle, Mic, Leaf, Dices, ShoppingBag, PartyPopper, HeartHandshake, Gavel, Globe, ScrollText };
function CategoryIcon({ category, size = 15 }: { category: string; size?: number }) {
  const Icon = ICONS[CATEGORIES.find((c) => c.key === category)?.icon ?? ""] ?? LayoutGrid;
  return <Icon size={size} aria-hidden="true" />;
}

const browserZone = () => {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return ZONES.some((x) => x[0] === z) ? z : "America/New_York";
  } catch {
    return "America/New_York";
  }
};

/** A date as YYYY-MM-DD in the viewer's own calendar (not UTC, which can be a day off). */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmtDay = (v: string) => (v ? new Date(`${v}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "…");

/** One-click custom ranges (both days included). */
function quickRanges(): [string, string, string][] {
  const now = new Date();
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return [
    ["This week", ymd(monday), ymd(addDays(monday, 6))],
    ["Last week", ymd(addDays(monday, -7)), ymd(addDays(monday, -1))],
    ["This month", ymd(monthStart), ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))],
    ["Last month", ymd(lastMonthStart), ymd(new Date(now.getFullYear(), now.getMonth(), 0))],
    ["Last 3 months", ymd(new Date(now.getFullYear(), now.getMonth() - 2, 1)), ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))],
  ];
}

/** The time range: recent periods, whole years, single months, or custom dates. */
function RangeControl({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Options }) {
  const custom = value.startsWith("c:");
  const [, from = "", to = ""] = custom ? value.split(":") : [];
  const today = ymd(new Date());
  const monthAgo = ymd(addDays(new Date(), -30));
  // Either date can be picked in any order (and in the future: the graphic just stops at today); if they
  // end up the wrong way round they're swapped
  const set = (f: string, t: string) => onChange(f && t && f > t ? `c:${t}:${f}` : `c:${f || monthAgo}:${t || today}`);
  return (
    <div className="gx-range">
      <label className="gx-field">
        <span>Time range</span>
        <select className="adm-select" value={custom ? "custom" : value} onChange={(e) => onChange(e.target.value === "custom" ? `c:${monthAgo}:${today}` : e.target.value)}>
          {(options.ranges?.length ? options.ranges : [{ group: "Recent", items: RANGES }]).map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </optgroup>
          ))}
          <optgroup label="Custom">
            <option value="custom">Pick dates…</option>
          </optgroup>
        </select>
      </label>
      {custom ? (
        <div className="gx-custom">
          <div className="gx-custom-dates">
            <label className="gx-field gx-date">
              <span>Start date</span>
              <input type="date" className="gx-input" value={from} onChange={(e) => e.target.value && set(e.target.value, to)} />
            </label>
            <label className="gx-field gx-date">
              <span>End date (included)</span>
              <input type="date" className="gx-input" value={to} onChange={(e) => e.target.value && set(from, e.target.value)} />
            </label>
          </div>
          <div className="gx-quick" role="group" aria-label="Quick dates">
            {quickRanges().map(([label, f, t]) => (
              <button key={label} type="button" className={from === f && to === t ? "is-on" : undefined} onClick={() => onChange(`c:${f}:${t}`)}>
                {label}
              </button>
            ))}
          </div>
          <p className="gx-custom-note">
            Showing {fmtDay(from)} to {fmtDay(to)}, both days included.
            {from > today ? " These dates are all in the future, so there's nothing to show yet." : to > today ? " Days after today have no data yet." : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** One dropdown per option the chosen graphic needs. */
function ParamControl({ kind, value, onChange, options }: { kind: ParamKind; value: string; onChange: (v: string) => void; options: Options }) {
  const select = (label: string, items: [string, string][], allowEmpty?: string) => (
    <label className="gx-field">
      <span>{label}</span>
      <select className="adm-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty !== undefined ? <option value="">{allowEmpty}</option> : null}
        {items.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
  if (kind === "range") return <RangeControl value={value} onChange={onChange} options={options} />;
  if (kind === "tz") return select("Time zone", ZONES);
  if (kind === "top") return select("How many", ["5", "10", "15", "20", "25"].map((x) => [x, `Top ${x}`]));
  if (kind === "group") return select("Role group", options.groups.map((g) => [g.key, `${g.title}${g.adult ? " (18+)" : ""}`]));
  if (kind === "rowGroup") return select("Down the side", options.groups.map((g) => [g.key, g.title]));
  if (kind === "colGroup") return select("Across the top", options.groups.map((g) => [g.key, g.title]));
  if (kind === "among") return select("Only members with", options.roles.map((r) => [r.id, r.name]), "Everyone (no role filter)");
  if (kind === "channel") return select("Channel", options.channels.map((c) => [c.id, `${c.name} (${c.messages.toLocaleString()} msgs/yr)`]), "All channels");
  if (kind === "game") return select("Game", options.games.map((g) => [g.key, g.name]), "All games");
  if (kind === "months") return select("Months", ["6", "12", "18", "24"].map((x) => [x, `Last ${x} months`]));
  // rolesA / rolesB: several roles, stored as "id,id"
  const picked = value.split(",").filter(Boolean);
  return (
    <div className="gx-field">
      <span>{kind === "rolesA" ? "First side (any of)" : "Second side (any of)"}</span>
      <div className="gx-multi">
        {picked.map((id) => (
          <button key={id} type="button" className="gx-pill" onClick={() => onChange(picked.filter((x) => x !== id).join(","))}>
            {options.roles.find((r) => r.id === id)?.name ?? id} ×
          </button>
        ))}
        <select className="adm-select" value="" onChange={(e) => e.target.value && onChange([...picked, e.target.value].join(","))}>
          <option value="">{picked.length ? "Add another role…" : "Pick a role…"}</option>
          {options.roles
            .filter((r) => !picked.includes(r.id))
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}

export function GraphicsTab() {
  const [stats, setStats] = useState<StatMeta[] | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [selected, setSelected] = useStored<string>("gx-selected", "members-overview");
  const [params, setParams] = useStored<Params>("gx-params", {});
  const [look, setLook] = useStored<Look>("gx-look", { theme: "dark", size: "landscape", footnote: true });
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [spec, setSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(false);
  const [specError, setSpecError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"png" | "copy" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    fetch("/api/admin/graphics/catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => {
        if (!r?.ok) return setError(r?.error ?? "Couldn't load the graphics list.");
        setStats(r.stats);
        setOptions(r.options);
      })
      .catch(() => setError("Couldn't load the graphics list."));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const stat = stats?.find((s) => s.id === selected) ?? stats?.[0] ?? null;

  // Sensible starting choices (filled in once the role list is known)
  const defaults = useMemo<Params>(() => {
    const find = (re: RegExp) => options?.roles.find((r) => re.test(r.name.replace(/[^\w\s()+/-]/g, "").trim()))?.id ?? "";
    return { range: "30", tz: browserZone(), top: "10", group: "Gender", rowGroup: "Gender", colGroup: "Relationship_Status", rolesA: find(/^male$/i), rolesB: find(/^female$/i), months: "12" };
  }, [options]);
  const value = (k: ParamKind) => params[k] ?? defaults[k] ?? "";

  // Work out the graphic whenever it or its options change
  const req = stat ? `id=${stat.id}&${stat.params.map((k) => `${k}=${encodeURIComponent(value(k))}`).join("&")}` : "";
  useEffect(() => {
    if (!req || !options) return;
    let stop = false;
    setLoading(true);
    setSpecError(null);
    const t = setTimeout(() => {
      fetch(`/api/admin/graphics/run?${req}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => {
          if (stop) return;
          if (r?.ok) setSpec(r.spec);
          else setSpecError(r?.error ?? "Couldn't work that graphic out.");
        })
        .catch(() => !stop && setSpecError("Couldn't work that graphic out."))
        .finally(() => !stop && setLoading(false));
    }, 150);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [req, options]);

  const pick = (id: string) => {
    setSelected(id);
    setTitle("");
    setSubtitle("");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (stats ?? []).filter((s) => (cat === "all" || s.category === cat) && (!q || `${s.title} ${s.blurb} ${(s.tags ?? []).join(" ")} ${CATEGORIES.find((c) => c.key === s.category)?.label}`.toLowerCase().includes(q)));
  }, [stats, query, cat]);
  const index = filtered.findIndex((s) => s.id === stat?.id);
  const step = (d: number) => filtered.length && pick(filtered[(index + d + filtered.length) % filtered.length].id);

  const fileName = () => `${(title || spec?.title || "graphic").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}.png`;
  const download = async () => {
    if (!svgRef.current) return;
    setBusy("png");
    try {
      const blob = await svgToPng(svgRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setToast("Saved");
    } catch {
      setToast("Couldn't make the image");
    }
    setBusy(null);
  };
  const copy = async () => {
    if (!svgRef.current) return;
    setBusy("copy");
    try {
      const blob = await svgToPng(svgRef.current);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setToast("Copied. Paste it into Discord");
    } catch {
      setToast("Your browser blocked copying. Use Download");
    }
    setBusy(null);
  };

  if (error)
    return (
      <div className="adm-panel">
        <p className="adm-error">{error}</p>
      </div>
    );
  if (!stats || !options || !stat) {
    return (
      <div className="adm-panel gx-loading">
        <Loader2 size={20} className="gx-spin" aria-hidden="true" /> Loading graphics…
      </div>
    );
  }
  const { w, h } = SIZES[look.size];
  const counts = new Map(CATEGORIES.map((c) => [c.key, stats.filter((s) => s.category === c.key).length]));

  return (
    <div className="adm-panel gx">
      <header className="gx-head">
        <div>
          <h2>
            <ImageIcon size={20} aria-hidden="true" /> Graphics
          </h2>
          <p>
            {stats.length} graphics from the server&apos;s chat, voice, economy, casino, moderation, Social and website data, each with its own options. Pick one, adjust it, then download a PNG or copy it
            straight into Discord.
          </p>
        </div>
      </header>

      <div className="gx-layout">
        <aside className="gx-browse">
          <label className="adm-search gx-search">
            <Search size={15} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: emojis, voice, tickets, gender…" />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear">
                <X size={13} />
              </button>
            ) : null}
          </label>
          <div className="gx-cats">
            <button type="button" className={cat === "all" ? "is-on" : undefined} onClick={() => setCat("all")}>
              <LayoutGrid size={13} aria-hidden="true" /> All <small>{stats.length}</small>
            </button>
            {CATEGORIES.map((c) => (
              <button key={c.key} type="button" className={cat === c.key ? "is-on" : undefined} onClick={() => setCat(c.key)}>
                <CategoryIcon category={c.key} size={13} /> {c.label} <small>{counts.get(c.key)}</small>
              </button>
            ))}
          </div>
          <div className="gx-list">
            {filtered.map((s) => (
              <button key={s.id} type="button" className={s.id === stat.id ? "is-on" : undefined} onClick={() => pick(s.id)}>
                <span className="gx-list-icon">
                  <CategoryIcon category={s.category} />
                </span>
                <span>
                  <b>{s.title}</b>
                  <small>{s.blurb}</small>
                </span>
              </button>
            ))}
            {!filtered.length ? <p className="gx-none">Nothing matches “{query}”.</p> : null}
          </div>
        </aside>

        <section className="gx-work">
          <div className="gx-toolbar">
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => step(-1)} aria-label="Previous graphic">
              <ChevronLeft size={14} />
            </button>
            <b className="gx-current">{stat.title}</b>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => step(1)} aria-label="Next graphic">
              <ChevronRight size={14} />
            </button>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => pick(stats[Math.floor(Math.random() * stats.length)].id)}>
              <Dices size={14} aria-hidden="true" /> Surprise me
            </button>
            <span className="gx-spacer" />
            <button type="button" className="adm-btn" onClick={() => void download()} disabled={!!busy || !spec}>
              {busy === "png" ? <Loader2 size={14} className="gx-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />} Download PNG
            </button>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={() => void copy()} disabled={!!busy || !spec}>
              {busy === "copy" ? <Loader2 size={14} className="gx-spin" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} Copy image
            </button>
            {toast ? <span className="gx-done">{toast}</span> : null}
          </div>

          <div className="gx-controls-row">
            {stat.params.map((k) => (
              <ParamControl key={k} kind={k} value={value(k)} onChange={(v) => setParams({ ...params, [k]: v })} options={options} />
            ))}
            <label className="gx-field">
              <span>Trend</span>
              <select className="adm-select" value={look.trend ?? "line"} onChange={(e) => setLook({ ...look, trend: e.target.value as Trend })}>
                <option value="line">Trend line</option>
                <option value="avg">Moving average</option>
                <option value="both">Both</option>
                <option value="none">None</option>
              </select>
            </label>
            <label className="gx-field">
              <span>Look</span>
              <select className="adm-select" value={look.theme} onChange={(e) => setLook({ ...look, theme: e.target.value as Theme })}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="gx-field">
              <span>Size</span>
              <select className="adm-select" value={look.size} onChange={(e) => setLook({ ...look, size: e.target.value as Size })}>
                {(Object.keys(SIZES) as Size[]).map((s) => (
                  <option key={s} value={s}>
                    {SIZES[s].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <details className="gx-more">
            <summary>Change the title, subtitle or footnote</summary>
            <div className="gx-controls-row">
              <label className="gx-field gx-wide">
                <span>Title</span>
                <input className="gx-input" value={title} placeholder={spec?.title} onChange={(e) => setTitle(e.target.value)} maxLength={90} />
              </label>
              <label className="gx-field gx-wide">
                <span>Subtitle</span>
                <input className="gx-input" value={subtitle} placeholder={spec?.subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={180} />
              </label>
              <label className="gx-check">
                <input type="checkbox" checked={look.footnote} onChange={(e) => setLook({ ...look, footnote: e.target.checked })} /> Footnote (how it was counted)
              </label>
            </div>
          </details>

          <div
            className={`gx-canvas${loading ? " is-loading" : ""}`}
            style={{ aspectRatio: `${w} / ${h}` }}
            onPointerMove={(e) => {
              // Hover points: anything drawn with a data-tip shows it in a tooltip
              const el = (e.target as Element).closest?.("[data-tip]");
              if (!el) return setTip(null);
              const box = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - box.left;
              setTip({ x, y: e.clientY - box.top, lines: (el.getAttribute("data-tip") ?? "").split("\n").filter(Boolean), flip: x > box.width - 240 });
            }}
            onPointerLeave={() => setTip(null)}
          >
            {spec ? <SpecGraphic spec={spec} theme={look.theme} size={look.size} title={title} subtitle={subtitle} footnote={look.footnote} svgRef={svgRef} trend={look.trend ?? "line"} /> : null}
            {tip && tip.lines.length ? (
              <div className={`gx-tip${tip.flip ? " is-flip" : ""}`} style={{ left: tip.x, top: tip.y }} role="tooltip">
                <b>{tip.lines[0]}</b>
                {tip.lines.slice(1).map((l, i) => (
                  <span key={i} className={i === 0 ? "is-main" : undefined}>
                    {l}
                  </span>
                ))}
              </div>
            ) : null}
            {loading ? (
              <span className="gx-overlay">
                <Loader2 size={15} className="gx-spin" aria-hidden="true" /> Updating…
              </span>
            ) : null}
            {specError ? <span className="gx-overlay is-error">{specError}</span> : null}
          </div>
          <p className="gx-dims">
            {w * 2}×{h * 2} PNG · numbers are cached for five minutes
          </p>
        </section>
      </div>
    </div>
  );
}
