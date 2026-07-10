import Link from "next/link";

const reviewsUrl = "https://disboard.org/server/reviews/1358452494128250940";
const leaveReviewUrl = "https://disboard.org/review/create/1358452494128250940";

export default function ReviewsPage() {
  return (
    <main className="legal-page">
      <section className="legal-card reviews-page-card">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <img className="auth-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
        </Link>
        <p className="eyebrow">Reviews</p>
        <h1>What people are saying</h1>
        <p>
          Kitty Kingdom reviews are populated on DISBOARD. Use the buttons below to read the live review list or leave your own review.
        </p>
        <div className="review-actions legal-actions">
          <a className="cta" href={reviewsUrl}>View all reviews</a>
          <a className="ghost" href={leaveReviewUrl}>Leave a review</a>
        </div>
      </section>
    </main>
  );
}
