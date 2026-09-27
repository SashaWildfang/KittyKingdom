"use client";

// Discord message formatting for Live Chat: mentions, custom emojis (including pasted emoji links),
// <t:…> timestamps, spoilers, markdown, links, quotes, headings, lists and code blocks.
import { useState, type ReactNode } from "react";
import type { Mentions, People } from "./admin-shared";

type Ctx = { mentions?: Mentions; people?: People; onOpenMember?: (id: string) => void; staff?: Record<string, { rank: string; color: string | null }> };

const EMOJI_URL = /^https?:\/\/(?:cdn|media)\.discordapp\.(?:com|net)\/emojis\/(\d{15,21})\.(png|gif|webp|jpe?g)(?:\?\S*)?$/i;

const INLINE = new RegExp(
  [
    String.raw`<(?<ea>a?):(?<en>\w{2,32}):(?<ei>\d{15,21})>`,
    String.raw`<#(?<ch>\d{15,21})>`,
    String.raw`<@&(?<ro>\d{15,21})>`,
    String.raw`<@!?(?<us>\d{15,21})>`,
    String.raw`</(?<cmd>[\w -]{1,64}):\d{15,21}>`,
    String.raw`<t:(?<ts>-?\d{1,13})(?::(?<tf>[tTdDfFR]))?>`,
    String.raw`(?<ev>@everyone|@here)`,
    String.raw`\|\|(?<sp>[\s\S]+?)\|\|`,
    "```(?<cb>[\\s\\S]+?)```",
    "`(?<ic>[^`]+)`",
    String.raw`\*\*\*(?<bi>[\s\S]+?)\*\*\*`,
    String.raw`\*\*(?<b>[\s\S]+?)\*\*`,
    String.raw`__(?<u>[\s\S]+?)__`,
    String.raw`~~(?<s>[\s\S]+?)~~`,
    String.raw`\*(?<i>[^*\s](?:[^*]*?[^*\s])?)\*`,
    String.raw`(?<![\w])_(?<i2>[^_\s](?:[^_]*?[^_\s])?)_(?![\w])`,
    String.raw`\[(?<lt>[^\]]+)\]\(<?(?<lu>https?:\/\/[^\s)>]+)>?\)`,
    String.raw`<?(?<url>https?:\/\/[^\s<>]+[^\s<>.,;:!?)\]'"])>?`,
  ].join("|"),
  "g",
);

function formatTimestamp(unix: number, style: string | undefined) {
  const d = new Date(unix * 1000);
  if (Number.isNaN(d.getTime())) return "invalid date";
  switch (style) {
    case "t":
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    case "T":
      return d.toLocaleTimeString();
    case "d":
      return d.toLocaleDateString();
    case "D":
      return d.toLocaleDateString([], { dateStyle: "long" });
    case "F":
      return d.toLocaleString([], { dateStyle: "full", timeStyle: "short" });
    case "R": {
      const s = Math.round((d.getTime() - Date.now()) / 1000);
      const abs = Math.abs(s);
      const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
      if (abs < 60) return rtf.format(s, "second");
      if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
      if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
      if (abs < 2592000) return rtf.format(Math.round(s / 86400), "day");
      if (abs < 31536000) return rtf.format(Math.round(s / 2592000), "month");
      return rtf.format(Math.round(s / 31536000), "year");
    }
    default:
      return d.toLocaleString([], { dateStyle: "long", timeStyle: "short" });
  }
}

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      className={`dt-spoiler${shown ? " is-shown" : ""}`}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setShown(true);
      }}
      onKeyDown={(e) => e.key === "Enter" && setShown(true)}
    >
      {children}
    </span>
  );
}

function emojiImg(id: string, name: string, animated: boolean, key: string, jumbo: boolean) {
  return (
    <img
      key={key}
      className={`dt-emoji${jumbo ? " is-jumbo" : ""}`}
      src={`https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=${jumbo ? 96 : 48}&quality=lossless`}
      alt={`:${name}:`}
      title={`:${name}:`}
      loading="lazy"
    />
  );
}

function inline(text: string, ctx: Ctx, keyBase: string, jumbo: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of Array.from(text.matchAll(INLINE))) {
    const g = m.groups ?? {};
    const index = m.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const key = `${keyBase}.${n++}`;
    const nest = (t: string) => inline(t, ctx, key, false);
    if (g.ei) out.push(emojiImg(g.ei, g.en, g.ea === "a", key, jumbo));
    else if (g.ch) out.push(<span key={key} className="dt-mention">#{ctx.mentions?.channels[g.ch] ?? "unknown-channel"}</span>);
    else if (g.ro) {
      const role = ctx.mentions?.roles[g.ro];
      out.push(
        <span key={key} className="dt-mention" style={role?.color ? ({ "--m": role.color } as React.CSSProperties) : undefined}>
          @{role?.name ?? "unknown-role"}
        </span>,
      );
    } else if (g.us) {
      const person = ctx.people?.[g.us];
      out.push(
        <button
          key={key}
          type="button"
          className="dt-mention"
          onClick={(e) => {
            e.stopPropagation();
            ctx.onOpenMember?.(g.us);
          }}
        >
          @{person?.name ?? "unknown-user"}
        </button>,
      );
    } else if (g.cmd) out.push(<span key={key} className="dt-mention">/{g.cmd}</span>);
    else if (g.ts) out.push(<time key={key} className="dt-time" title={new Date(Number(g.ts) * 1000).toLocaleString()}>{formatTimestamp(Number(g.ts), g.tf)}</time>);
    else if (g.ev) out.push(<span key={key} className="dt-mention">{g.ev}</span>);
    else if (g.sp) out.push(<Spoiler key={key}>{nest(g.sp)}</Spoiler>);
    else if (g.cb) out.push(<code key={key} className="dt-code">{g.cb.replace(/^\w*\n/, "")}</code>);
    else if (g.ic) out.push(<code key={key} className="dt-code">{g.ic}</code>);
    else if (g.bi) out.push(<strong key={key}><em>{nest(g.bi)}</em></strong>);
    else if (g.b) out.push(<strong key={key}>{nest(g.b)}</strong>);
    else if (g.u) out.push(<u key={key}>{nest(g.u)}</u>);
    else if (g.s) out.push(<s key={key}>{nest(g.s)}</s>);
    else if (g.i || g.i2) out.push(<em key={key}>{nest(g.i ?? g.i2)}</em>);
    else if (g.lt && g.lu)
      out.push(
        <a key={key} className="dt-link" href={g.lu} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()}>
          {nest(g.lt)}
        </a>,
      );
    else if (g.url) {
      const emoji = g.url.match(EMOJI_URL);
      if (emoji) {
        // A pasted emoji link shows as the emoji, like in Discord
        const name = new URL(g.url).searchParams.get("name") ?? "emoji";
        out.push(emojiImg(emoji[1], name, emoji[2].toLowerCase() === "gif" || new URL(g.url).searchParams.get("animated") === "true", key, jumbo));
      } else {
        out.push(
          <a key={key} className="dt-link" href={g.url} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()}>
            {g.url.length > 70 ? `${g.url.slice(0, 67)}…` : g.url}
          </a>,
        );
      }
    }
    last = index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const PICTOGRAPHS = new RegExp("\\p{Extended_Pictographic}|\\u200d|\\ufe0f|\\s", "gu");

/** True when a message is only emojis (Discord shows those bigger). */
function onlyEmojis(text: string) {
  const stripped = text
    .replace(/<a?:\w{2,32}:\d{15,21}>/g, "")
    .replace(/https?:\/\/(?:cdn|media)\.discordapp\.(?:com|net)\/emojis\/\S+/gi, "")
    .replace(PICTOGRAPHS, "")
    .trim();
  return !stripped && text.trim().length > 0;
}

/** Discord text, block by block: code blocks, quotes, headings, subtext and lists. */
export function DiscordText({ text, compact, ...ctx }: Ctx & { text: string; compact?: boolean }) {
  if (!text) return null;
  const jumbo = !compact && onlyEmojis(text);
  const blocks: ReactNode[] = [];
  const parts = text.split(/(```[\s\S]*?```)/g);
  let k = 0;
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("```") && part.endsWith("```") && part.length > 6) {
      const body = part.slice(3, -3).replace(/^\w*\n/, "");
      blocks.push(compact ? <code key={k++} className="dt-code">{body}</code> : <pre key={k++} className="dt-pre"><code>{body}</code></pre>);
      continue;
    }
    const lines = part.split("\n");
    let quote: string[] = [];
    const flushQuote = () => {
      if (quote.length) {
        const q = quote;
        quote = [];
        blocks.push(
          <blockquote key={k++} className="dt-quote">
            {q.map((l, i) => (
              <span key={i}>
                {i ? <br /> : null}
                {inline(l, ctx, `q${k}.${i}`, false)}
              </span>
            ))}
          </blockquote>,
        );
      }
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^>>> /.test(line) && !compact) {
        quote.push(line.slice(4), ...lines.slice(i + 1));
        break;
      }
      const q = line.match(/^> ?(.*)$/);
      if (q && !compact) {
        quote.push(q[1]);
        continue;
      }
      flushQuote();
      const h = compact ? null : line.match(/^(#{1,3}) (.+)$/);
      const sub = compact ? null : line.match(/^-# (.+)$/);
      const li = compact ? null : line.match(/^\s*[-*] (.+)$/);
      const key = `l${k}`;
      if (h) blocks.push(<span key={k++} className={`dt-h dt-h${h[1].length}`}>{inline(h[2], ctx, key, false)}</span>);
      else if (sub) blocks.push(<span key={k++} className="dt-sub">{inline(sub[1], ctx, key, false)}</span>);
      else if (li) blocks.push(<span key={k++} className="dt-li">{inline(li[1], ctx, key, false)}</span>);
      else
        blocks.push(
          <span key={k++} className="dt-line">
            {inline(line, ctx, key, jumbo)}
            {i < lines.length - 1 ? <br /> : null}
          </span>,
        );
    }
    flushQuote();
  }
  return <>{blocks}</>;
}

/** Link previews of a pasted emoji duplicate the emoji itself; skip those. */
export function isEmojiLink(url: string | null) {
  return Boolean(url && EMOJI_URL.test(url));
}
