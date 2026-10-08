"use client";

import { Folder, Hash, Search, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type Meta = {
  channels: { id: string; name: string; type: number; category: string | null }[];
  categories: { id: string; name: string }[];
  roles: { id: string; name: string; color: string | null; managed: boolean }[];
};

type Option = { id: string; label: string; sub?: string | null; color?: string | null; voice?: boolean; category?: boolean };

export function channelOptions(meta: Meta | null, kind: "text" | "voice" | "any" | "category" | "mixed" = "any"): Option[] {
  if (!meta) return [];
  const cats = meta.categories.map((c) => ({ id: c.id, label: c.name, sub: "Category", category: true }));
  if (kind === "category") return cats;
  if (kind === "mixed") return [...cats, ...channelOptions(meta, "any")];
  return meta.channels
    .filter((c) => (kind === "voice" ? c.type === 2 || c.type === 13 : kind === "text" ? c.type !== 2 && c.type !== 13 : true))
    .map((c) => ({ id: c.id, label: c.name, sub: c.category, voice: c.type === 2 || c.type === 13 }));
}

export function roleOptions(meta: Meta | null): Option[] {
  return (meta?.roles ?? []).filter((r) => !r.managed).map((r) => ({ id: r.id, label: r.name, color: r.color }));
}

function OptionLabel({ o, kind }: { o: Option; kind: "channel" | "role" }) {
  return (
    <span className="bs-opt">
      {kind === "role" ? (
        <i className="bs-dot" style={{ background: o.color ?? "var(--muted)" }} aria-hidden="true" />
      ) : o.category ? (
        <Folder size={13} aria-hidden="true" />
      ) : o.voice ? (
        <Volume2 size={13} aria-hidden="true" />
      ) : (
        <Hash size={13} aria-hidden="true" />
      )}
      <span>{o.label}</span>
      {o.sub ? <small>{o.sub}</small> : null}
    </span>
  );
}

/** A searchable dropdown for one channel or role (or several with `multiple`). */
export function Picker({
  value,
  onChange,
  options,
  kind,
  multiple,
  allowEmpty,
  placeholder,
}: {
  value: string | string[] | null;
  onChange: (v: string | string[] | null) => void;
  options: Option[];
  kind: "channel" | "role";
  multiple?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const selected = multiple ? ((value as string[]) ?? []) : value ? [value as string] : [];
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const list = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()) || (o.sub ?? "").toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  const pick = (id: string) => {
    if (multiple) onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else {
      onChange(id);
      setOpen(false);
    }
    setQ("");
  };

  return (
    <div className="bs-picker" ref={box}>
      <div className={`bs-picker-field${open ? " is-open" : ""}`} onClick={() => setOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}>
        {selected.length ? (
          selected.map((id) => {
            const o = byId.get(id);
            return (
              <span key={id} className="bs-chip">
                {o ? <OptionLabel o={o} kind={kind} /> : <span className="bs-opt">Unknown {kind} ({id})</span>}
                {multiple || allowEmpty ? (
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(multiple ? selected.filter((x) => x !== id) : null);
                    }}
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </span>
            );
          })
        ) : (
          <span className="bs-placeholder">{placeholder ?? `Pick a ${kind}`}</span>
        )}
      </div>
      {open ? (
        <div className="bs-picker-menu">
          <label className="bs-picker-search">
            <Search size={14} aria-hidden="true" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${kind}s`} />
          </label>
          <ul>
            {list.map((o) => (
              <li key={o.id}>
                <button type="button" className={selected.includes(o.id) ? "is-on" : undefined} onClick={() => pick(o.id)}>
                  <OptionLabel o={o} kind={kind} />
                </button>
              </li>
            ))}
            {!list.length ? <li className="bs-empty">No matches.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
