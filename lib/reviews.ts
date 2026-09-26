import { getMongoClient } from "./mongodb";
import { manualReviews, type Review } from "./manual-reviews";

export type { Review };

export const REVIEWS_URL = "https://disboard.org/server/reviews/1358452494128250940";
export const LEAVE_REVIEW_URL = "https://disboard.org/review/create/1358452494128250940";

export type ReviewSummary = {
  reviews: Review[];
  average: number;
  count: number;
};

type ReviewDoc = {
  title?: string;
  author?: string;
  text?: string;
  rating?: number;
  postedAt?: Date | string;
  hidden?: boolean;
};

const key = (author: string) => author.trim().toLowerCase();

/**
 * The built-in DISBOARD reviews merged with the ones staff add or hide from Discord
 * (/sitereviews, stored in website.reviews and keyed by the reviewer's name). Newest first.
 */
export async function getReviews(): Promise<ReviewSummary> {
  const byAuthor = new Map<string, Review | null>();
  for (const review of manualReviews) byAuthor.set(key(review.author), review);

  try {
    const client = await getMongoClient();
    const docs = (await client
      .db(process.env.MONGODB_DB ?? "website")
      .collection("reviews")
      .find({})
      .limit(200)
      .toArray()) as ReviewDoc[];
    for (const d of docs) {
      if (!d.author) continue;
      if (d.hidden) {
        byAuthor.set(key(d.author), null);
      } else if (d.text) {
        byAuthor.set(key(d.author), {
          title: d.title || undefined,
          author: String(d.author),
          text: String(d.text),
          rating: Math.min(5, Math.max(1, Number(d.rating) || 5)),
          postedAt: new Date(d.postedAt ?? Date.now()).toISOString(),
        });
      }
    }
  } catch (error) {
    console.error("Reviews lookup failed", error);
  }

  const reviews = Array.from(byAuthor.values())
    .filter((r): r is Review => r !== null)
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 5;
  return { reviews, average: Math.round(average * 10) / 10, count: reviews.length };
}
