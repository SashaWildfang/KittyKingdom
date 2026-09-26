"use client";

import { useState } from "react";

export type ShowcaseItem = { label: string; detail: string; iconPath: string };
export type ShowcaseTab = { key: string; label: string; title: string; items: ShowcaseItem[] };

export function HomeShowcase({ tabs }: { tabs: ShowcaseTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="home-showcase">
      <div className="home-showcase-head">
        <h2 key={tab.key} className="home-showcase-title">
          {tab.title}
        </h2>
        <div className="home-segment" role="tablist" aria-label="Why join and features">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === tab.key}
              className={t.key === tab.key ? "is-active" : undefined}
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="home-feature-grid" role="tabpanel" key={tab.key}>
        {tab.items.map((item, index) => (
          <article className="home-feature" data-spotlight key={item.label} style={{ animationDelay: `${index * 55}ms` }}>
            <span className="home-feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d={item.iconPath} />
              </svg>
            </span>
            <h3>{item.label}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
