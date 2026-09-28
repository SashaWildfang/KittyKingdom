"use client";

import { ChevronDown, ListOrdered } from "lucide-react";
import { useEffect, useState } from "react";

type Part = { title: string; items: { id: string; n: number; title: string }[] };

/** Contents: sticky with the current section highlighted and a reading progress bar; a dropdown on phones. */
export function LegalToc({ parts }: { parts: Part[] }) {
  const [active, setActive] = useState<string | null>(parts[0]?.items[0]?.id ?? null);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ids = parts.flatMap((p) => p.items.map((i) => i.id));
    const onScroll = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 160) current = id;
      }
      setActive(current);
      const doc = document.querySelector(".legal-doc");
      if (doc) {
        const r = doc.getBoundingClientRect();
        const total = r.height - window.innerHeight * 0.6;
        setProgress(Math.max(0, Math.min(1, -r.top / Math.max(1, total))));
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [parts]);

  const current = parts.flatMap((p) => p.items).find((i) => i.id === active);

  return (
    <aside className={`legal-toc${open ? " is-open" : ""}`} aria-label="Contents">
      <button type="button" className="legal-toc-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ListOrdered size={16} aria-hidden="true" />
        <span>
          <small>Contents</small>
          {current ? `${current.n}. ${current.title}` : "Jump to a section"}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <p className="legal-toc-label">Contents</p>
      <div className="legal-progress" aria-hidden="true">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <nav className="legal-toc-list">
        {parts.map((p) => (
          <div key={p.title} className="legal-toc-part">
            <p>{p.title}</p>
            <ol>
              {p.items.map((i) => (
                <li key={i.id}>
                  <a href={`#${i.id}`} className={active === i.id ? "is-on" : undefined} aria-current={active === i.id ? "location" : undefined} onClick={() => setOpen(false)}>
                    <span>{i.n}</span> {i.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </nav>
    </aside>
  );
}
