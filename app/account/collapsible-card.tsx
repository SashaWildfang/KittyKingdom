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
  defaultOpen = true,
}: {
  id: string;
  title: string;
  description?: string;
  /** Shown next to the title while folded, e.g. "12 roles picked" */
  summary?: string;
  children: ReactNode;
  /** From the kk_collapsed cookie, so the page is drawn folded or open from the start (no flash) */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  // Older choices were only saved in this browser: carry them over to the cookie once
  useEffect(() => {
    try {
      if (defaultOpen && window.localStorage.getItem(`kk-collapse:${id}`) === "closed") {
        setOpen(false);
        remember(id, false);
      }
    } catch {
      // storage blocked
    }
  }, [id, defaultOpen]);

  function toggle() {
    setOpen((v) => {
      remember(id, !v);
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

/** Folded sections are kept in a cookie the server can read. */
function remember(id: string, open: boolean) {
  const current = new Set(
    (document.cookie.match(/(?:^|;\s*)kk_collapsed=([^;]*)/)?.[1] ?? "")
      .split(",")
      .filter(Boolean)
      .map(decodeURIComponent),
  );
  if (open) current.delete(id);
  else current.add(id);
  document.cookie = `kk_collapsed=${Array.from(current).map(encodeURIComponent).join(",")}; path=/; max-age=31536000; samesite=lax`;
}
