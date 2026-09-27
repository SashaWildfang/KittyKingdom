"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

/** An account card that folds away; remembers whether you left it open. */
export function CollapsibleCard({
  id,
  title,
  description,
  summary,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  /** Shown next to the title while folded, e.g. "12 roles picked" */
  summary?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(`kk-collapse:${id}`) === "closed") setOpen(false);
    } catch {
      // storage blocked: stay open
    }
  }, [id]);

  function toggle() {
    setOpen((v) => {
      try {
        window.localStorage.setItem(`kk-collapse:${id}`, v ? "closed" : "open");
      } catch {
        // ignore
      }
      return !v;
    });
  }

  return (
    <section className={`acct-card acct-collapsible${open ? " is-open" : ""}`} id={id}>
      <button type="button" className="acct-collapse-head" onClick={toggle} aria-expanded={open} aria-controls={bodyId}>
        <span>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </span>
        {!open && summary ? <span className="acct-collapse-summary">{summary}</span> : null}
        <span className="acct-collapse-toggle" aria-hidden="true">
          <span className="acct-collapse-label">{open ? "Hide" : "Show"}</span>
          <span className="acct-collapse-chevron">
            <ChevronDown size={20} strokeWidth={2.5} />
          </span>
        </span>
      </button>
      <div className="acct-collapse-body" id={bodyId}>
        <div>{children}</div>
      </div>
    </section>
  );
}
