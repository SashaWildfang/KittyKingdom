import Link from "next/link";
import { LEAVE_REVIEW_URL, REVIEWS_URL, getReviews } from "../../lib/reviews";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const { reviews, average, count } = await getReviews();

  return (
    <main className="legal-page">
      <section className="legal-card reviews-page-card">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <img className="auth-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
        </Link>
        <p className="eyebrow">Reviews</p>
        <h1>What people are saying</h1>
        <p>
          Star rating: <strong>{average.toFixed(1)}/5</strong> from {count} reviews on DISBOARD
        </p>
        <div className="review-list">
          {reviews.map((review) => (
            <article className="review-card" key={`${review.author}-${review.text}`}>
              <div className="rating-row">
                <span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>
                  {"★".repeat(review.rating)}
                </span>
                <strong>{review.rating}/5</strong>
              </div>
              {review.title ? <h3>{review.title}</h3> : null}
              <p>“{review.text}”</p>
              <span className="review-source">{review.author}</span>
            </article>
          ))}
        </div>
        <div className="review-actions legal-actions">
          <a className="cta" href={REVIEWS_URL}>
            View all reviews
          </a>
          <a className="ghost" href={LEAVE_REVIEW_URL}>
            Leave a review
          </a>
        </div>
      </section>
    </main>
  );
}
