"use client";

import { BookOpen, Check, GraduationCap, Wrench } from "lucide-react";
import { useState } from "react";
import { Md } from "./md";

export type Requirement = { item: string; level: string; explain: string; done: string; code?: string };

/** The job's requirements: pick one on the left, see what it is and what I've done on the right. */
export function RequirementExplorer({ items }: { items: Requirement[] }) {
  const [active, setActive] = useState(0);
  const r = items[active];
  const learn = r.level === "learn";
  return (
    <div className="rx">
      <div className="rx-list" role="tablist" aria-label="Job requirements">
        {items.map((it, i) => (
          <button
            key={it.item}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={`rx-tab${i === active ? " is-active" : ""}${it.level === "learn" ? " is-learn" : ""}`}
            onClick={() => setActive(i)}
          >
            {it.level === "learn" ? <GraduationCap size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            <span>{it.item}</span>
          </button>
        ))}
      </div>
      <div className={`rx-panel${learn ? " is-learn" : ""}`} role="tabpanel">
        <header>
          <h3>{r.item}</h3>
          <span className="rx-badge">
            {learn ? <GraduationCap size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
            {learn ? "Ready to learn this skill" : "Built into Kitty Kingdom"}
          </span>
        </header>
        <div className="rx-part">
          <h4>
            <BookOpen size={15} aria-hidden="true" /> What it is
          </h4>
          <p>
            <Md text={r.explain} />
          </p>
        </div>
        <div className="rx-part is-mine">
          <h4>
            <Wrench size={15} aria-hidden="true" /> {learn ? "Related experience" : "What I've done"}
          </h4>
          <p>
            <Md text={r.done} />
          </p>
          {r.code ? (
            <pre>
              <code>{r.code}</code>
            </pre>
          ) : null}
        </div>
        <footer>
          <button type="button" onClick={() => setActive((active - 1 + items.length) % items.length)}>
            ← Previous
          </button>
          <span>
            {active + 1} of {items.length}
          </span>
          <button type="button" onClick={() => setActive((active + 1) % items.length)}>
            Next →
          </button>
        </footer>
      </div>
    </div>
  );
}
