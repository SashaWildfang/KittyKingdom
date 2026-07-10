"use client";

import { useEffect, useState } from "react";

const reviewPrompts = [
  "See what members are saying about Kitty Kingdom on DISBOARD.",
  "Browse community feedback before joining the kingdom.",
  "Already part of the server? Share your experience with a public review.",
];

export function ReviewCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % reviewPrompts.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <article className="review-card">
      <span className="review-stars" aria-label="Reviews">★★★★★</span>
      <p>{reviewPrompts[index]}</p>
      <span className="review-source">Reviews are sourced from DISBOARD</span>
    </article>
  );
}
