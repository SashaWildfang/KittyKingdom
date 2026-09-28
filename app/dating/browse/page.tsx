"use client";

import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FIELD_LIST } from "../../../lib/dating/schema-data";
import { Chips, Empty, ProfileTile, post, useApi, type Card } from "../ui";

type Result = { total: number; page: number; pages: number; cards: Card[] };
type Filters = { q: string; genders: string[]; ageMin: string; ageMax: string; dating: boolean; photos: boolean; active: string; isNew: boolean; looking: string[]; sort: string; open: string; inServer: boolean };

const GENDERS = FIELD_LIST.find((f) => f.key === "gender")!.options;
const REL_TYPES = FIELD_LIST.find((f) => f.key === "looking_for_relationship_type")!.options.filter((o) => o.value !== "Any");
const SORTS = [
  ["best", "Best match"],
  ["active", "Recently active"],
  ["new", "Newest"],
  ["age-asc", "Youngest"],
  ["age-desc", "Oldest"],
  ["name", "Name A–Z"],
];
const EMPTY: Filters = { q: "", genders: [], ageMin: "", ageMax: "", dating: false, photos: false, active: "", isNew: false, looking: [], sort: "best", open: "", inServer: false };
const KEY = "kk_dating_browse";

export default function Browse() {
  const [f, setF] = useState<Filters>(EMPTY);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);

  // Remember filters for this viewer
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      // A link like /dating/browse?q=hiking (from Home's popular interests) wins over saved filters
      const linked = new URLSearchParams(window.location.search).get("q");
      const next = { ...EMPTY, ...(saved ?? {}), ...(linked !== null ? { q: linked.slice(0, 60) } : {}) };
      setF(next);
      setQ(next.q ?? "");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(f));
    } catch {}
  }, [f]);
  // Debounce search typing
  useEffect(() => {
    const t = window.setTimeout(() => setF((x) => (x.q === q ? x : { ...x, q })), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setPage(0);
  }, [f]);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (f.q) p.set("q", f.q);
    if (f.genders.length) p.set("genders", f.genders.join(","));
    if (/^\d+$/.test(f.ageMin)) p.set("ageMin", f.ageMin);
    if (/^\d+$/.test(f.ageMax)) p.set("ageMax", f.ageMax);
    if (f.dating) p.set("dating", "1");
    if (f.photos) p.set("photos", "1");
    if (f.active) p.set("active", f.active);
    if (f.isNew) p.set("new", "1");
    if (f.looking.length) p.set("looking", f.looking.join(","));
    if (f.open) p.set("open", f.open);
    if (f.inServer) p.set("inServer", "1");
    p.set("sort", f.sort);
    p.set("page", String(page));
    return `/api/dating/browse?${p}`;
  }, [f, page]);
  const { data, error } = useApi<Result>(url);
  const activeCount = [f.genders.length, f.ageMin, f.ageMax, f.dating, f.photos, f.active, f.isNew, f.looking.length, f.open, f.inServer].filter(Boolean).length;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));

  const like = async (c: Card) => {
    const r = await post<{ mutual?: boolean }>("/api/dating/actions", { action: "like", target: c.id });
    if (!r.ok) return setNote(r.error ?? "That didn't work.");
    setLiked((s) => new Set(s).add(c.id));
    setNote(r.mutual ? `💞 It's a match with ${c.name}!` : `You liked ${c.name}.`);
  };
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 3500);
    return () => window.clearTimeout(t);
  }, [note]);

  return (
    <div className="dt-browse">
      <div className="dt-browse-bar">
        <label className="dt-search">
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, interests, games, places…" maxLength={60} aria-label="Search profiles" />
        </label>
        <select className="dt-select" value={f.sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sort by">
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button type="button" className={`dt-btn dt-btn--ghost${open ? " is-on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <SlidersHorizontal size={15} aria-hidden="true" /> Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
      </div>

      {open ? (
        <div className="dt-filters">
          <div>
            <b>Here for</b>
            <div className="dt-chips" role="radiogroup">
              {[
                ["", "Anyone"],
                ["dating", "💘 Open to dating"],
                ["friends", "🫂 Friends only"],
              ].map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={f.open === v} className={f.open === v ? "is-on" : undefined} onClick={() => set("open", v)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <b>Gender</b>
            <Chips options={GENDERS} value={f.genders} multi onChange={(v) => set("genders", (v as string[]) ?? [])} />
          </div>
          <div>
            <b>Looking for</b>
            <Chips options={REL_TYPES} value={f.looking} multi onChange={(v) => set("looking", (v as string[]) ?? [])} />
          </div>
          <div className="dt-filters-row">
            <label>
              <b>Age</b>
              <span className="dt-range">
                <input className="dt-input" inputMode="numeric" placeholder="18" value={f.ageMin} onChange={(e) => set("ageMin", e.target.value.replace(/\D/g, "").slice(0, 2))} aria-label="Youngest age" />
                <span>to</span>
                <input className="dt-input" inputMode="numeric" placeholder="99" value={f.ageMax} onChange={(e) => set("ageMax", e.target.value.replace(/\D/g, "").slice(0, 2))} aria-label="Oldest age" />
              </span>
            </label>
            <label>
              <b>Active</b>
              <select className="dt-select" value={f.active} onChange={(e) => set("active", e.target.value)}>
                <option value="">Any time</option>
                <option value="1">Today</option>
                <option value="7">This week</option>
                <option value="30">This month</option>
              </select>
            </label>
          </div>
          <div className="dt-toggles">
            <label>
              <input type="checkbox" checked={f.dating} onChange={(e) => set("dating", e.target.checked)} /> Dating matches only
            </label>
            <label>
              <input type="checkbox" checked={f.photos} onChange={(e) => set("photos", e.target.checked)} /> Has photos
            </label>
            <label>
              <input type="checkbox" checked={f.isNew} onChange={(e) => set("isNew", e.target.checked)} /> New this fortnight
            </label>
            <label>
              <input type="checkbox" checked={f.inServer} onChange={(e) => set("inServer", e.target.checked)} /> Still in the server
            </label>
          </div>
          {activeCount ? (
            <button type="button" className="dt-textlink" onClick={() => setF({ ...EMPTY, q: f.q, sort: f.sort })}>
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="dt-error">{error}</p> : null}
      {!data ? (
        <div className="dt-loading" aria-busy="true" />
      ) : data.cards.length ? (
        <>
          <p className="dt-muted dt-count">
            {data.total} {data.total === 1 ? "person" : "people"}
            {f.sort === "best" ? " · 🤝 means you'd get along but aren't a dating fit on preferences" : ""}
          </p>
          <div className="dt-grid">
            {data.cards.map((c) => (
              <ProfileTile key={c.id} card={{ ...c, liked: c.liked || liked.has(c.id) }} onLike={like} />
            ))}
          </div>
          {data.pages > 1 ? (
            <nav className="dt-pager" aria-label="Pages">
              <button type="button" className="dt-btn dt-btn--ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={15} aria-hidden="true" /> Previous
              </button>
              <span>
                Page {page + 1} of {data.pages}
              </span>
              <button type="button" className="dt-btn dt-btn--ghost" disabled={page + 1 >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight size={15} aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </>
      ) : (
        <Empty icon={<Users size={28} />} title="No one matches those filters">
          <p>Try widening the age range or clearing a filter.</p>
        </Empty>
      )}
      {note ? (
        <div className="dt-toast" role="status">
          {note}
        </div>
      ) : null}
    </div>
  );
}
