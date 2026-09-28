"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

export type Fix = { id: string; title: string; tags: string; steps: ReactNode[]; note?: ReactNode };

/** Searchable "common fixes" with step-by-step answers. */
export function SupportFixes({ fixes }: { fixes: Fix[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  // Topic cards link to #login, #store… : open that fix
  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.slice(1);
      if (fixes.some((f) => f.id === id)) {
        setQuery("");
        setOpen(id);
        window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "center", behavior: "smooth" }), 30);
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [fixes]);
  const shown = useMemo(() => (q ? fixes.filter((f) => `${f.title} ${f.tags}`.toLowerCase().includes(q)) : fixes), [fixes, q]);

  return (
    <div className="kb-fixes">
      <div className="kb-search">
        <Search size={20} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Describe the problem… “can't log in”, “role missing”, “muted”" aria-label="Search common problems" />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
            <X size={16} />
          </button>
        ) : null}
      </div>
      <div className="kb-faqs">
        {shown.map((f) => {
          const isOpen = open === f.id || (q !== "" && shown.length <= 2);
          return (
            <div key={f.id} id={f.id} className={`kb-faq${isOpen ? " is-open" : ""}`}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(open === f.id ? null : f.id)}>
                <span>{f.title}</span>
                <ChevronDown size={18} aria-hidden="true" />
              </button>
              {isOpen ? (
                <div className="kb-answer">
                  <ol className="kb-steps">
                    {f.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  {f.note ? <p className="kb-note">{f.note}</p> : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {!shown.length ? (
          <p className="kb-results">
            No quick fix for that yet. <a href="#contact">Open a ticket</a> and staff will sort it out.
          </p>
        ) : null}
      </div>
    </div>
  );
}
