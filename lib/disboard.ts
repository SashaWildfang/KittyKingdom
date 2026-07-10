export type DisboardReview = {
  author: string;
  text: string;
  rating?: string;
};

export type DisboardSummary = {
  rating: string | null;
  reviews: DisboardReview[];
};

const reviewsUrl = "https://disboard.org/server/reviews/1358452494128250940";
const serverUrl = "https://disboard.org/server/1358452494128250940";

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRating(html: string) {
  const jsonLdRating = html.match(/"ratingValue"\s*:\s*"?([0-5](?:\.\d+)?)"?/i)?.[1];
  if (jsonLdRating) return jsonLdRating;

  const visibleRating = html.match(/([0-5](?:\.\d+)?)\s*\/\s*5/i)?.[1];
  return visibleRating ?? null;
}

function extractReviews(html: string): DisboardReview[] {
  const reviews: DisboardReview[] = [];
  const reviewBodyMatches = Array.from(html.matchAll(/"reviewBody"\s*:\s*"([\s\S]*?)"/gi));
  const authorMatches = Array.from(html.matchAll(/"author"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([\s\S]*?)"/gi));
  const ratingMatches = Array.from(html.matchAll(/"reviewRating"\s*:\s*\{[\s\S]*?"ratingValue"\s*:\s*"?([0-5](?:\.\d+)?)"?/gi));

  for (let index = 0; index < reviewBodyMatches.length; index += 1) {
    const text = decodeHtml(reviewBodyMatches[index][1] ?? "");
    if (!text || reviews.some((review) => review.text === text)) continue;

    reviews.push({
      author: decodeHtml(authorMatches[index]?.[1] ?? "DISBOARD member"),
      rating: ratingMatches[index]?.[1],
      text,
    });
  }

  return reviews.slice(0, 8);
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 KittyKingdomBot/1.0" },
    next: { revalidate: 60 * 30 },
  });

  if (!response.ok) return "";
  return response.text();
}

export async function getDisboardSummary(): Promise<DisboardSummary> {
  try {
    const [reviewsHtml, serverHtml] = await Promise.all([fetchHtml(reviewsUrl), fetchHtml(serverUrl)]);
    return {
      rating: extractRating(serverHtml || reviewsHtml),
      reviews: extractReviews(reviewsHtml),
    };
  } catch {
    return { rating: null, reviews: [] };
  }
}
