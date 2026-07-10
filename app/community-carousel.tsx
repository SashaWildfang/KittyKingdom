"use client";

import { useEffect, useState } from "react";

export type CommunityCarouselItem = {
  label: string;
  detail: string;
  iconPath: string;
};

type CommunityCarouselProps = {
  eyebrow: string;
  title: string;
  items: CommunityCarouselItem[];
};

export function CommunityCarousel({
  eyebrow,
  title,
  items,
}: CommunityCarouselProps) {
  const [index, setIndex] = useState(0);
  const item = items[index];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, 5200);

    return () => window.clearInterval(interval);
  }, [items.length]);

  return (
    <section className="community-carousel-section" aria-label={title}>
      <div className="section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <article className="community-carousel-card">
        <span className="community-carousel-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d={item.iconPath} />
          </svg>
        </span>
        <div>
          <h3>{item.label}</h3>
          <p>{item.detail}</p>
        </div>
        <div
          className="carousel-controls"
          aria-label={`${title} carousel controls`}
        >
          {items.map((entry, itemIndex) => (
            <button
              aria-label={`Show ${entry.label}`}
              className={itemIndex === index ? "active" : ""}
              key={entry.label}
              onClick={() => setIndex(itemIndex)}
              type="button"
            />
          ))}
        </div>
      </article>
    </section>
  );
}
