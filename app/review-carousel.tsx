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

  return (
    <article className="review-card">
      <div className="rating-row">
        <span className="review-stars" aria-label="Reviews">★★★★★</span>
        <strong>{rating ? `${rating}/5` : "DISBOARD rating"}</strong>
      </div>
      {review ? (
        <>
          <p>“{review.text}”</p>
          <span className="review-source">{review.author}{review.rating ? ` • ${review.rating}/5` : ""}</span>
        </>
      ) : (
        <>
          <p>Live DISBOARD reviews will appear here when they are available to fetch.</p>
          <span className="review-source">Reviews are sourced from DISBOARD</span>
        </>
      )}
    </article>
  );
}
