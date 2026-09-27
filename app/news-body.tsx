// Renders a news post with Discord-style formatting (see lib/news-format.ts for the syntax).
// Everything becomes React elements, so posts can never inject HTML or scripts.
import type { ReactNode } from "react";
import { LeafEmote } from "./ui-icons";

const INLINE = new RegExp(
  [
    String.raw`\*\*\*(?<bi>.+?)\*\*\*`,
    String.raw`\*\*(?<b>.+?)\*\*`,
    String.raw`__(?<u>.+?)__`,
    String.raw`~~(?<s>.+?)~~`,
    String.raw`\|\|(?<sp>.+?)\|\|`,
    String.raw`\*(?<i>[^*\s](?:[^*]*[^*\s])?)\*`,
    "`(?<code>[^`]+)`",
    String.raw`\[(?<lt>[^\]]+)\]\((?<lu>https?:\/\/[^\s)]+)\)`,
    String.raw`(?<url>https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])`,
    "(?<leaf>:leaf:)",
  ].join("|"),
  "g",
);

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  );
}

function inline(text: string, keyBase = "k"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of Array.from(text.matchAll(INLINE))) {
    const g = m.groups ?? {};
    const index = m.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const key = `${keyBase}-${n++}`;
    if (g.bi) out.push(<strong key={key}><em>{inline(g.bi, key)}</em></strong>);
    else if (g.b) out.push(<strong key={key}>{inline(g.b, key)}</strong>);
    else if (g.u) out.push(<u key={key}>{inline(g.u, key)}</u>);
    else if (g.s) out.push(<s key={key}>{inline(g.s, key)}</s>);
    else if (g.sp)
      out.push(
        <span key={key} className="news-spoiler" tabIndex={0} title="Spoiler: tap to reveal">
          {inline(g.sp, key)}
        </span>,
      );
    else if (g.i) out.push(<em key={key}>{inline(g.i, key)}</em>);
    else if (g.code) out.push(<code key={key}>{g.code}</code>);
    else if (g.lt && g.lu) out.push(<Link key={key} href={g.lu}>{inline(g.lt, key)}</Link>);
    else if (g.url) out.push(<Link key={key} href={g.url}>{g.url}</Link>);
    else if (g.leaf) out.push(<LeafEmote key={key} size={18} className="news-emote" />);
    last = index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "code"; text: string }
  | { kind: "hr" };

function parse(body: string): Block[] {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  const lastBlock = () => blocks[blocks.length - 1];
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] }); // paragraph break marker
      i++;
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s{0,3}[-*•]\s+(.+)$/);
    const numbered = line.match(/^\s{0,3}\d+[.)]\s+(.+)$/);
    const quote = line.match(/^\s{0,3}>\s?(.*)$/);
    const prev = lastBlock();
    if (heading) blocks.push({ kind: "h", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
    else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) blocks.push({ kind: "hr" });
    else if (bullet) prev?.kind === "ul" ? prev.items.push(bullet[1]) : blocks.push({ kind: "ul", items: [bullet[1]] });
    else if (numbered) prev?.kind === "ol" ? prev.items.push(numbered[1]) : blocks.push({ kind: "ol", items: [numbered[1]] });
    else if (quote) prev?.kind === "quote" ? prev.lines.push(quote[1]) : blocks.push({ kind: "quote", lines: [quote[1]] });
    else if (prev?.kind === "p" && prev.lines.length) prev.lines.push(line);
    else blocks.push({ kind: "p", lines: [line] });
    i++;
  }
  return blocks.filter((b) => b.kind !== "p" || b.lines.length);
}

const lineBreaks = (lines: string[], key: string) =>
  lines.map((line, j) => (
    <span key={`${key}-${j}`}>
      {j > 0 ? <br /> : null}
      {inline(line, `${key}-${j}`)}
    </span>
  ));

export function NewsBody({ body }: { body: string }) {
  return (
    <>
      {parse(body).map((b, i) => {
        const key = `b${i}`;
        switch (b.kind) {
          case "h":
            return b.level === 1 ? <h3 key={key}>{inline(b.text, key)}</h3> : b.level === 2 ? <h4 key={key}>{inline(b.text, key)}</h4> : <h5 key={key}>{inline(b.text, key)}</h5>;
          case "ul":
            return <ul key={key}>{b.items.map((it, j) => <li key={j}>{inline(it, `${key}-${j}`)}</li>)}</ul>;
          case "ol":
            return <ol key={key}>{b.items.map((it, j) => <li key={j}>{inline(it, `${key}-${j}`)}</li>)}</ol>;
          case "quote":
            return <blockquote key={key}>{lineBreaks(b.lines, key)}</blockquote>;
          case "code":
            return <pre key={key}><code>{b.text}</code></pre>;
          case "hr":
            return <hr key={key} />;
          default:
            return <p key={key}>{lineBreaks(b.lines, key)}</p>;
        }
      })}
    </>
  );
}
