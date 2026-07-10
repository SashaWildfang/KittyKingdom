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
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const item = items[index];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDirection("next");
      setIndex((current) => (current + 1) % items.length);
    }, 5200);

    return () => window.clearInterval(interval);
  }, [items.length]);

  function previous() {
    setDirection("prev");
    setIndex((current) => (current - 1 + items.length) % items.length);
  }

  function next() {
    setDirection("next");
    setIndex((current) => (current + 1) % items.length);
  }

  return (
    <section className="community-carousel-section" aria-label={title}>
      <div className="section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <article className="community-carousel-card">
        <div
          className={`community-carousel-slide swoosh-${direction}`}
          key={`${item.label}-${index}`}
        >
          <span className="community-carousel-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d={item.iconPath} />
            </svg>
          </span>
          <div>
            <h3>{item.label}</h3>
            <p>{item.detail}</p>
          </div>
        </div>
        <div
          className="carousel-controls"
          aria-label={`${title} carousel controls`}
        >
          <button
            className="carousel-arrow"
            type="button"
            onClick={previous}
            aria-label={`Previous ${title} item`}
          >
            ‹
          </button>
          {items.map((entry, itemIndex) => (
            <button
              aria-label={`Show ${entry.label}`}
              className={itemIndex === index ? "active" : ""}
              key={entry.label}
              onClick={() => {
                setDirection(itemIndex > index ? "next" : "prev");
                setIndex(itemIndex);
              }}
              type="button"
            />
          ))}
          <button
            className="carousel-arrow"
            type="button"
            onClick={next}
            aria-label={`Next ${title} item`}
          >
            ›
          </button>
        </div>
      </article>
    </section>
  );
}
