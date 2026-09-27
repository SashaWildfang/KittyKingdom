// Renders a news post: blank lines make paragraphs, plus **bold**, *italic* and [links](https://...)
import type { ReactNode } from "react";

const MD = /\*\*([^*]+)\*\*|\*([^*\n]+)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of Array.from(text.matchAll(MD))) {
    const index = m.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    if (m[1]) out.push(<strong key={key++}>{m[1]}</strong>);
    else if (m[2]) out.push(<em key={key++}>{m[2]}</em>);
    else if (m[3] && m[4])
      out.push(
        <a key={key++} href={m[4]} target="_blank" rel="noopener noreferrer nofollow">
          {m[3]}
        </a>,
      );
    last = index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function NewsBody({ body }: { body: string }) {
  return (
    <>
      {body
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>
            {p.split("\n").map((line, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {inline(line)}
              </span>
            ))}
          </p>
        ))}
    </>
  );
}
