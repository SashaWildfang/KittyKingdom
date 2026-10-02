import { Fragment } from "react";

const CUSTOM = /<(a?):(\w+):(\d+)>/g;

/** Game log text (e.g. a slots spin "<:paw_red:…> | <:paw_red:…> | …") with Discord's custom emoji drawn as images. */
export function EmojiText({ text, size = 18 }: { text: string; size?: number }) {
  const parts: (string | { name: string; id: string; animated: boolean })[] = [];
  let last = 0;
  const clean = text.replace(/ \| /g, " ");
  for (const m of Array.from(clean.matchAll(CUSTOM))) {
    if (m.index! > last) parts.push(clean.slice(last, m.index));
    parts.push({ animated: m[1] === "a", name: m[2], id: m[3] });
    last = m.index! + m[0].length;
  }
  if (last < clean.length) parts.push(clean.slice(last));
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <Fragment key={i}>{p.trim() === "" && i > 0 ? null : p}</Fragment>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} className="gm-emoji" src={`https://cdn.discordapp.com/emojis/${p.id}.${p.animated ? "gif" : "webp"}?size=48&quality=lossless`} alt={`:${p.name}:`} width={size} height={size} />
        ),
      )}
    </>
  );
}
