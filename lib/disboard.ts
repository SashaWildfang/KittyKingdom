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
    .replace(/\\u003C/g, "<")
    .replace(/\\u003E/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\n/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripScripts(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
}

function addReview(reviews: DisboardReview[], review: DisboardReview) {
  const text = decodeHtml(review.text);
  if (text.length < 12) return;
  if (/cookie|privacy|terms|javascript|cloudflare/i.test(text)) return;
  if (reviews.some((existing) => existing.text === text)) return;
  reviews.push({ author: decodeHtml(review.author || "DISBOARD member"), rating: review.rating, text });
}

function extractRating(html: string) {
  const patterns = [
    /"aggregateRating"[\s\S]*?"ratingValue"\s*:\s*"?([0-5](?:\.\d+)?)"?/i,
    /"ratingValue"\s*:\s*"?([0-5](?:\.\d+)?)"?/i,
    /([0-5](?:\.\d+)?)\s*\/\s*5/i,
    /([0-5](?:\.\d+)?)\s*out\s*of\s*5/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1];
    if (match) return match;
  }

  return null;
}

function extractJsonLdReviews(html: string, reviews: DisboardReview[]) {
  const scripts = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(decodeHtml(script[1] ?? ""));
      const blocks = Array.isArray(parsed) ? parsed : [parsed];

      for (const block of blocks) {
        const reviewList = Array.isArray(block.review) ? block.review : block.review ? [block.review] : [];
        for (const review of reviewList) {
          addReview(reviews, {
            author: review.author?.name ?? "DISBOARD member",
            rating: review.reviewRating?.ratingValue ? String(review.reviewRating.ratingValue) : undefined,
            text: review.reviewBody ?? review.description ?? "",
          });
        }
      }
    } catch {
      // Ignore malformed embedded JSON.
    }
  }
}

function extractRegexReviews(html: string, reviews: DisboardReview[]) {
  const reviewBodyMatches = Array.from(html.matchAll(/"reviewBody"\s*:\s*"([\s\S]*?)"/gi));
  const authorMatches = Array.from(html.matchAll(/"author"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([\s\S]*?)"/gi));
  const ratingMatches = Array.from(html.matchAll(/"reviewRating"\s*:\s*\{[\s\S]*?"ratingValue"\s*:\s*"?([0-5](?:\.\d+)?)"?/gi));

  for (let index = 0; index < reviewBodyMatches.length; index += 1) {
    addReview(reviews, {
      author: authorMatches[index]?.[1] ?? "DISBOARD member",
      rating: ratingMatches[index]?.[1],
      text: reviewBodyMatches[index][1] ?? "",
    });
  }
}

function extractVisibleReviews(html: string, reviews: DisboardReview[]) {
  const visible = stripScripts(html);
  const reviewBlocks = Array.from(visible.matchAll(/<article[\s\S]*?<\/article>|<div[^>]+class=["'][^"']*(?:review|comment)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi));

  for (const block of reviewBlocks) {
    const raw = block[0];
    const rating = raw.match(/([0-5](?:\.\d+)?)\s*(?:\/\s*5|stars?)/i)?.[1];
    const author = raw.match(/(?:class=["'][^"']*(?:user|author|name)[^"']*["'][^>]*>)([\s\S]*?)<\//i)?.[1] ?? "DISBOARD member";
    const text = decodeHtml(raw);
    addReview(reviews, { author, rating, text });
  }
}

function extractReviews(html: string): DisboardReview[] {
  const reviews: DisboardReview[] = [];
  extractJsonLdReviews(html, reviews);
  extractRegexReviews(html, reviews);
  extractVisibleReviews(html, reviews);
  return reviews.slice(0, 8);
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; KittyKingdomBot/1.0; +https://kittykingdom.net)",
    },
    cache: "no-store",
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
