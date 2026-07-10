"use client";

import { useEffect, useState } from "react";
import type { DisboardReview } from "../lib/disboard";

type ReviewCarouselProps = {
  rating: string | null;
  reviews: DisboardReview[];
};

export function ReviewCarousel({ rating, reviews }: ReviewCarouselProps) {
  const [index, setIndex] = useState(0);
  const hasReviews = reviews.length > 0;

  useEffect(() => {
    if (!hasReviews) return;

    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % reviews.length);
    }, 5500);

    return () => window.clearInterval(interval);
  }, [hasReviews, reviews.length]);

  const review = reviews[index];

  if (!review) {
    return (
      <article className="review-card review-card-empty clean-review-empty">
        <span className="review-stars" aria-label="Review stars">
          ★★★★★
        </span>
        <p>
          Reviews are available on DISBOARD, but DISBOARD blocks embedded and
          automated fetches.
        </p>
        <span className="review-source">
          Use “View all reviews” to open the live review page.
        </span>
      </article>
    );
  }

  return (
    <article
      className={`review-card${review.text.length > 180 ? " review-card-long" : ""}`}
    >
      <span className="review-stars" aria-label="Review stars">
        ★★★★★
      </span>
      <p>“{review.text}”</p>
      <span className="review-source">
        {review.author}
        {review.rating
          ? ` • ${review.rating}/5`
          : rating
            ? ` • ${rating}/5`
            : ""}
      </span>
    </article>
  );
}
