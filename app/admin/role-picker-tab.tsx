"use client";

// Admin → Role Picker: the categories and roles members pick in Discord ("Edit my roles") and on the website
// (My Account → Roles). One list for both; saving it updates the Main Bot's panels within a few seconds.

import "./role-picker.css";
import { ArrowDown, ArrowUp, ChevronDown, EyeOff, Plus, RotateCcw, Save, ShieldAlert, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Role = { id: string; name: string; emoji: string; description: string; hidden?: boolean; roleName?: string; hint?: string };
type Category = { key: string; title: string; description: string; color: string; adult: boolean; mode: "single" | "multi"; hidden?: boolean; roles: Role[] };
type GuildRole = { id: string; name: string; color: string | null; position: number };
type Loaded = { categories: Category[]; version: number; updatedAt: string | null; updatedBy: string | null; custom: boolean; guildRoles: GuildRole[] };

const move = <T,>(list: T[], i: number, by: number) => {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export function RolePickerTab() {
  const [data, setData] = useState<Loaded | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const r = await fetch("/api/admin/role-catalog", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (!r?.ok) return setError(r?.error ?? "Couldn't load the roles.");
    setData(r);
    setCats(r.categories);
  };
  useEffect(() => {
    void load();
  }, []);

  const dirty = useMemo(() => Boolean(data) && JSON.stringify(cats) !== JSON.stringify(data!.categories), [cats, data]);
  const roleById = useMemo(() => new Map((data?.guildRoles ?? []).map((r) => [r.id, r])), [data]);
  const usedIn = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cats) for (const r of c.roles) m.set(r.id, c.title);
    return m;
  }, [cats]);

  // Leaving with unsaved changes asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setCat = (i: number, patch: Partial<Category>) => setCats((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const setRole = (ci: number, ri: number, patch: Partial<Role>) => setCats((cs) => cs.map((c, k) => (k === ci ? { ...c, roles: c.roles.map((r, j) => (j === ri ? { ...r, ...patch } : r)) } : c)));

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await fetch("/api/admin/role-catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: cats, version: data?.version ?? 0 }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return setError(r?.error ?? "Couldn't save.");
    setNotice("Saved. Discord's role panels update within a few seconds, and My Account straight away.");
    await load();
  }

  async function reset() {
    if (!window.confirm("Go back to the built-in role list? Your changes to categories and labels are replaced (members keep their roles).")) return;
    setBusy(true);
    const r = await fetch("/api/admin/role-catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset", version: data?.version ?? 0 }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return setError(r?.error ?? "Couldn't reset.");
    setNotice("Back to the built-in list.");
    await load();
  }

  async function createRole(ci: number, name: string, color: string) {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/role-catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create-role", name, color }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return setError(r?.error ?? "Couldn't create the role.");
    setData((d) => (d ? { ...d, guildRoles: [{ id: r.role.id, name: r.role.name, color: r.role.color, position: 0 }, ...d.guildRoles] } : d));
    setCats((cs) => cs.map((c, k) => (k === ci ? { ...c, roles: [...c.roles, { id: r.role.id, name, emoji: "", description: "" }] } : c)));
    setNotice(`Created the "${name}" role in Discord and added it. Save to put it in the picker.`);
  }

  if (!data) return <div className="adm-panel rp">{error ? <p className="adm-error">{error}</p> : <p className="adm-muted">Loading the role picker…</p>}</div>;

  return (
    <div className="rp">
      <header className="rp-head">
        <div>
          <h2>Role Picker</h2>
          <p className="adm-muted">
            What members pick with <b>Edit my roles</b> in Discord and in My Account → Roles. <b>Pick one</b> categories replace the member&apos;s choice instead of adding to it; <b>18+</b> categories only work with the 18+ Verified role, and are taken off (then given back) when that role is removed and returned.
          </p>
        </div>
        <div className="rp-head-actions">
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => void reset()} disabled={busy} title="Replace this list with the built-in one">
            <RotateCcw size={14} aria-hidden="true" /> Built-in list
          </button>
        </div>
      </header>

      {error ? <p className="adm-error">{error}</p> : null}
      {notice ? <p className="adm-notice">{notice}</p> : null}

      <div className="rp-list">
        {cats.map((c, ci) => {
          const isOpen = open === c.key;
          return (
            <section key={`${c.key}-${ci}`} className={`rp-cat${c.hidden ? " is-hidden" : ""}`} style={{ "--cat": c.color } as React.CSSProperties}>
              <div className="rp-cat-bar">
                <button type="button" className="rp-cat-toggle" onClick={() => setOpen(isOpen ? null : c.key)} aria-expanded={isOpen}>
                  <i aria-hidden="true" />
                  <b>{c.title || "Untitled"}</b>
                  <span className="rp-tags">
                    <span className={`rp-tag${c.mode === "single" ? " is-one" : ""}`}>{c.mode === "single" ? "Pick one" : "Pick many"}</span>
                    {c.adult ? (
                      <span className="rp-tag is-adult">
                        <ShieldAlert size={11} aria-hidden="true" /> 18+
                      </span>
                    ) : null}
                    {c.hidden ? (
                      <span className="rp-tag">
                        <EyeOff size={11} aria-hidden="true" /> Hidden
                      </span>
                    ) : null}
                    <span className="rp-count">{c.roles.length} roles</span>
                  </span>
                  <ChevronDown size={15} className="rp-chev" aria-hidden="true" />
                </button>
                <div className="rp-cat-move">
                  <button type="button" onClick={() => setCats((cs) => move(cs, ci, -1))} disabled={ci === 0} aria-label="Move up">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" onClick={() => setCats((cs) => move(cs, ci, 1))} disabled={ci === cats.length - 1} aria-label="Move down">
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>

              {isOpen ? (
                <div className="rp-cat-body">
                  <div className="rp-fields">
                    <label>
                      <span>Name</span>
                      <input value={c.title} onChange={(e) => setCat(ci, { title: e.target.value })} maxLength={60} />
                    </label>
                    <label className="rp-wide">
                      <span>Description</span>
                      <input value={c.description} onChange={(e) => setCat(ci, { description: e.target.value })} maxLength={200} />
                    </label>
                    <label className="rp-color">
                      <span>Color</span>
                      <input type="color" value={c.color} onChange={(e) => setCat(ci, { color: e.target.value })} />
                    </label>
                  </div>
                  <div className="rp-switches">
                    <div className="rp-seg" role="group" aria-label="How many can be picked">
                      <button type="button" className={c.mode === "single" ? "is-on" : undefined} onClick={() => setCat(ci, { mode: "single" })}>
                        Pick one
                      </button>
                      <button type="button" className={c.mode === "multi" ? "is-on" : undefined} onClick={() => setCat(ci, { mode: "multi" })}>
                        Pick as many as they like
                      </button>
                    </div>
                    <label className="rp-check">
                      <input type="checkbox" checked={c.adult} onChange={(e) => setCat(ci, { adult: e.target.checked })} /> 18+ only
                    </label>
                    <label className="rp-check">
                      <input type="checkbox" checked={Boolean(c.hidden)} onChange={(e) => setCat(ci, { hidden: e.target.checked || undefined })} /> Hide this category
                    </label>
                    <button
                      type="button"
                      className="rp-danger"
                      onClick={() => window.confirm(`Remove the "${c.title}" category from the picker? Members keep the roles; they just can't pick them any more.`) && setCats((cs) => cs.filter((_, k) => k !== ci))}
                    >
                      <Trash2 size={13} aria-hidden="true" /> Remove category
                    </button>
                  </div>

                  <div className="rp-roles">
                    <div className="rp-role rp-role-head" aria-hidden="true">
                      <span>Emoji</span>
                      <span>Label</span>
                      <span>Short description</span>
                      <span>Discord role</span>
                      <span />
                    </div>
                    {c.roles.map((r, ri) => {
                      const g = roleById.get(r.id);
                      return (
                        <div key={`${r.id}-${ri}`} className={`rp-role${r.hidden ? " is-hidden" : ""}`}>
                          <input className="rp-emoji" value={r.emoji} onChange={(e) => setRole(ci, ri, { emoji: e.target.value })} maxLength={16} aria-label="Emoji" placeholder="🙂" />
                          <input value={r.name} onChange={(e) => setRole(ci, ri, { name: e.target.value })} maxLength={80} aria-label="Label" />
                          <input value={r.description} onChange={(e) => setRole(ci, ri, { description: e.target.value })} maxLength={100} aria-label="Short description" />
                          <select value={r.id} onChange={(e) => setRole(ci, ri, { id: e.target.value })} aria-label="Discord role" className={g ? undefined : "is-missing"}>
                            {!g ? <option value={r.id}>⚠️ Missing role</option> : null}
                            {data.guildRoles.map((gr) => (
                              <option key={gr.id} value={gr.id} disabled={gr.id !== r.id && usedIn.has(gr.id)}>
                                {gr.name}
                                {gr.id !== r.id && usedIn.has(gr.id) ? ` (in ${usedIn.get(gr.id)})` : ""}
                              </option>
                            ))}
                          </select>
                          <div className="rp-role-actions">
                            <button type="button" title={r.hidden ? "Show in the picker" : "Hide from the picker (members keep it)"} className={r.hidden ? "is-on" : undefined} onClick={() => setRole(ci, ri, { hidden: r.hidden ? undefined : true })}>
                              <EyeOff size={13} />
                            </button>
                            <button type="button" onClick={() => setCat(ci, { roles: move(c.roles, ri, -1) })} disabled={ri === 0} aria-label="Move up">
                              <ArrowUp size={13} />
                            </button>
                            <button type="button" onClick={() => setCat(ci, { roles: move(c.roles, ri, 1) })} disabled={ri === c.roles.length - 1} aria-label="Move down">
                              <ArrowDown size={13} />
                            </button>
                            <button type="button" className="rp-danger" onClick={() => setCat(ci, { roles: c.roles.filter((_, j) => j !== ri) })} aria-label="Remove from the picker">
                              <Trash2 size={13} />
                            </button>
                          </div>
                          {g && r.roleName && r.roleName !== g.name ? <small className="rp-rename">The Discord role will be renamed to “{r.roleName}”.</small> : null}
                        </div>
                      );
                    })}
                    <AddRole
                      taken={usedIn}
                      guildRoles={data.guildRoles}
                      disabled={busy || c.roles.length >= 25}
                      onAdd={(id) => {
                        const g = roleById.get(id);
                        setCat(ci, { roles: [...c.roles, { id, name: g?.name ?? "New role", emoji: "", description: "" }] });
                      }}
                      onCreate={(name, color) => void createRole(ci, name, color)}
                    />
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <button
        type="button"
        className="adm-btn adm-btn--ghost rp-add-cat"
        onClick={() => {
          const key = `Category_${Date.now().toString(36)}`;
          setCats((cs) => [...cs, { key, title: "New category", description: "", color: "#d56300", adult: false, mode: "multi", roles: [] }]);
          setOpen(key);
        }}
      >
        <Plus size={15} aria-hidden="true" /> Add a category
      </button>

      <div className={`rp-savebar${dirty ? " is-dirty" : ""}`}>
        <span>{dirty ? "You have unsaved changes." : data.updatedAt ? `Last saved ${new Date(data.updatedAt).toLocaleString()}${data.updatedBy ? ` by ${data.updatedBy}` : ""}.` : "Using the built-in list."}</span>
        <div>
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={!dirty || busy} onClick={() => setCats(data.categories)}>
            Discard
          </button>
          <button type="button" className="adm-btn adm-btn--small" disabled={!dirty || busy} onClick={() => void save()}>
            <Save size={14} aria-hidden="true" /> {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddRole({ taken, guildRoles, disabled, onAdd, onCreate }: { taken: Map<string, string>; guildRoles: GuildRole[]; disabled: boolean; onAdd: (id: string) => void; onCreate: (name: string, color: string) => void }) {
  const [mode, setMode] = useState<"pick" | "create" | null>(null);
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#99aab5");
  const free = guildRoles.filter((g) => !taken.has(g.id));
  if (!mode) {
    return (
      <div className="rp-add">
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={disabled} onClick={() => setMode("pick")}>
          <Plus size={13} aria-hidden="true" /> Add an existing role
        </button>
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={disabled} onClick={() => setMode("create")}>
          <Wand2 size={13} aria-hidden="true" /> Create a new role
        </button>
      </div>
    );
  }
  return (
    <div className="rp-add is-open">
      {mode === "pick" ? (
        <>
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Discord role to add">
            <option value="">Choose a Discord role…</option>
            {free.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button type="button" className="adm-btn adm-btn--small" disabled={!pick} onClick={() => (onAdd(pick), setPick(""), setMode(null))}>
            Add
          </button>
        </>
      ) : (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New role name" maxLength={100} aria-label="New role name" />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Role color" />
          <button type="button" className="adm-btn adm-btn--small" disabled={!name.trim()} onClick={() => (onCreate(name.trim(), color), setName(""), setMode(null))}>
            Create in Discord
          </button>
        </>
      )}
      <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setMode(null)}>
        Cancel
      </button>
    </div>
  );
}
