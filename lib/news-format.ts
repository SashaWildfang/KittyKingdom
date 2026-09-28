// News posts use Discord-style formatting:
//   **bold**  *italic*  __underline__  ~~strike~~  ||spoiler||  `code`  [text](https://link)  :leaf:
//   # Heading  ## Smaller heading  - bullet  1. numbered  > quote  --- divider  ``` code block ```
// This file only turns posts into plain text (for previews); app/news-body.tsx renders them.

/** A post as plain text, for short previews on the home page and in the admin list. */
export function newsPlainText(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*!\[[^\]]*\]\([^)]*\)\s*$/gm, " ")
    .replace(/^\s*https?:\/\/\S+\s*$/gm, " ")
    .replace(/^\s{0,3}(#{1,3}|>|[-*]|\d+[.)])\s+/gm, "")
    .replace(/^\s*-{3,}\s*$/gm, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/(\*\*\*|\*\*|__|~~|\|\||\*|`)(.+?)\1/g, "$2")
    .replace(/:leaf:/g, "🍂")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cuts plain text at a word boundary. `cut` is true when something was left out. */
export function newsExcerpt(body: string, max: number) {
  const text = newsPlainText(body);
  if (text.length <= max) return { text, cut: false };
  const slice = text.slice(0, max);
  const space = slice.lastIndexOf(" ");
  return { text: `${(space > max * 0.6 ? slice.slice(0, space) : slice).replace(/[\s,.;:!?-]+$/, "")}…`, cut: true };
}

/** The first picture in a post, for card covers (a YouTube video uses its thumbnail). */
export function newsCover(body: string): string | null {
  for (const line of body.split("\n")) {
    const t = line.trim();
    const media = t.match(/^!\[[^\]]*\]\(([^)\s]+)\)$/);
    const url = media ? media[1] : /^https:\/\/\S+$/.test(t) ? t : null;
    if (!url) continue;
    const yt = url.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (yt) return `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`;
    if (media && !/\.(mp4|webm|mov)(\?|$)/i.test(url) && (/^https:\/\//.test(url) || /^\/api\/news-media\//.test(url))) return url;
  }
  return null;
}

/** Minutes to read a post. */
export function newsReadMinutes(body: string) {
  return Math.max(1, Math.round(newsPlainText(body).split(/\s+/).filter(Boolean).length / 220));
}
