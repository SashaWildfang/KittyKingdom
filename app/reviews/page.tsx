import Link from "next/link";
import { getDisboardSummary } from "../../lib/disboard";

const reviewsUrl = "https://disboard.org/server/reviews/1358452494128250940";
const leaveReviewUrl = "https://disboard.org/review/create/1358452494128250940";

export default async function ReviewsPage() {
  const disboard = await getDisboardSummary();

  return (
    <main className="legal-page">
      <section className="legal-card reviews-page-card">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <img className="auth-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
        </Link>
        <p className="eyebrow">Reviews</p>
        <h1>What people are saying</h1>
        <p>
          Star rating: <strong>{disboard.rating ? `${disboard.rating}/5` : "Loaded from DISBOARD when available"}</strong>
        </p>
        <div className="review-list">
          {disboard.reviews.length > 0 ? (
            disboard.reviews.map((review) => (
              <article className="review-card" key={`${review.author}-${review.text}`}>
                <div className="rating-row">
                  <span className="review-stars" aria-label="Review rating">★★★★★</span>
                  {review.rating ? <strong>{review.rating}/5</strong> : null}
                </div>
                <p>“{review.text}”</p>
                <span className="review-source">{review.author}</span>
              </article>
            ))
          ) : (
            <p>Live DISBOARD reviews could not be fetched during this request. Use the button below to view the live review page.</p>
          )}
        </div>
        <div className="review-actions legal-actions">
          <a className="cta" href={reviewsUrl}>View all reviews</a>
          <a className="ghost" href={leaveReviewUrl}>Leave a review</a>
        </div>
      </section>
    </main>
  );
}
