"use client";

// "Views" menu for a tab's filters: save the filters you're looking at with a name, and get back to them in one
// click (saved on your admin account, so they follow you to other devices).

import "./saved-views.css";
import { Bookmark, Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type View = { id: string; name: string; value: Record<string, unknown> };

export function SavedViews<T extends Record<string, unknown>>({ scope, current, onApply }: { scope: string; current: T; onApply: (value: T) => void }) {
  const [views, setViews] = useState<View[]>([]);
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const load = () =>
    fetch("/api/admin/prefs", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => setViews((r?.savedViews?.[scope] as View[]) ?? []))
      .catch(() => undefined);
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && (setOpen(false), setNaming(false));
    window.addEventListener("mousedown", away);
    return () => window.removeEventListener("mousedown", away);
  }, [open]);

  const same = (v: View) => JSON.stringify(v.value) === JSON.stringify(current);
  const save = async () => {
    if (!name.trim()) return;
    await fetch("/api/admin/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "save-view", scope, name, value: current }) }).catch(() => null);
    setName("");
    setNaming(false);
    await load();
  };
  const remove = async (id: string) => {
    await fetch("/api/admin/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "delete-view", scope, id }) }).catch(() => null);
    await load();
  };

  return (
    <div className="svv" ref={box}>
      <button type="button" className={`svv-btn${open ? " is-open" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Bookmark size={14} aria-hidden="true" /> Views{views.length ? ` (${views.length})` : ""}
      </button>
      {open ? (
        <div className="svv-menu" role="menu">
          {views.length ? null : <p className="svv-empty">No saved views yet. Set up the filters you use a lot, then save them here.</p>}
          {views.map((v) => (
            <div key={v.id} className="svv-row">
              <button type="button" role="menuitem" onClick={() => (onApply(v.value as T), setOpen(false))}>
                {same(v) ? <Check size={13} aria-hidden="true" /> : <span className="svv-dot" aria-hidden="true" />}
                {v.name}
              </button>
              <button type="button" className="svv-del" onClick={() => void remove(v.id)} aria-label={`Delete ${v.name}`}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {naming ? (
            <form
              className="svv-save"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this view" maxLength={40} aria-label="View name" />
              <button type="submit" disabled={!name.trim()}>
                Save
              </button>
            </form>
          ) : (
            <button type="button" className="svv-new" onClick={() => setNaming(true)}>
              <Plus size={13} aria-hidden="true" /> Save the current filters
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
