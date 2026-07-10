import Link from "next/link";

const news = [
  [
    "Fall Update",
    "We permanently moved Kitty Kingdom over to a cozy fall theme.",
  ],
  [
    "Discord Website",
    "We started work on the Discord website and account portal.",
  ],
  ["Leaves Currency", "We changed the server currency to leaves."],
];

export default function NewsPage() {
  return (
    <main className="legal-page">
      <section className="legal-card wide-card">
        <Link
          className="auth-logo"
          href="/home"
          aria-label="Kitty Kingdom home"
        >
          <img
            className="auth-logo-img"
            src="/logo.png"
            alt="Kitty Kingdom logo"
          />
        </Link>
        <p className="eyebrow">News</p>
        <h1>Kitty Kingdom Updates</h1>
        <div className="review-list">
          {news.map(([title, text], index) => (
            <article className="review-card" key={title}>
              <span className="card-kicker">Update {index + 1}</span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
