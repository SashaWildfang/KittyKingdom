"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Hash, Paperclip, X } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { TOPICS } from "../../lib/topics";
import type { TopicMessagePage } from "../../lib/topic-messages";

type Load = { state: "loading" } | { state: "error"; error: string } | { state: "ok"; page: TopicMessagePage };

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The text with every matching word wrapped in <mark>. */
function marked(text: string, words: string[]): ReactNode {
  if (!words.length || !text) return text;
  const re = new RegExp(`(?<![a-z0-9'])(${words.map(escapeRe).join("|")})(?![a-z0-9'])`, "gi");
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of Array.from(text.matchAll(re))) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(<mark key={at}>{m[0]}</mark>);
    last = at + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric", hour: "numeric", minute: "2-digit" });
}

/** A window onto the member's own messages for a topic word (or a whole topic), one at a time with the chat around it. */
export function TopicMessages({ word, topic, color, onClose }: { word: string | null; topic: string; color: string; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => setIndex(0), [word, topic]);

  useEffect(() => {
    let alive = true;
    setLoad({ state: "loading" });
    const q = word ? `word=${encodeURIComponent(word)}` : `topic=${encodeURIComponent(topic)}`;
    fetch(`/api/account/stats/topic-messages?${q}&i=${index}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!alive) return;
        if (!r.ok || !data?.ok) setLoad({ state: "error", error: data?.error ?? "Couldn't load that message." });
        else setLoad({ state: "ok", page: data as TopicMessagePage });
      })
      .catch(() => alive && setLoad({ state: "error", error: "Couldn't load that message." }));
    return () => {
      alive = false;
    };
  }, [word, topic, index]);

  const page = load.state === "ok" ? load.page : null;
  const total = page?.total ?? 0;
  const highlight = word ? [word] : TOPICS[topic]?.words ?? [];
  const go = (step: number) => setIndex((i) => Math.min(Math.max(0, i + step), Math.max(0, total - 1)));

  return (
    <section
      className="st-ctx"
      style={{ "--hue": color } as CSSProperties}
      aria-label={word ? `Your messages with “${word}”` : "Your messages in this topic"}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
        if (e.key === "Escape") onClose();
      }}
    >
      <header>
        <b>{word ? <>“{word}” in your messages</> : <>Your messages about {TOPICS[topic]?.label ?? topic}</>}</b>
        <div className="st-ctx-nav">
          <button type="button" onClick={() => go(-1)} disabled={!page || page.index <= 0} aria-label="Newer message">
            <ChevronLeft size={16} />
          </button>
          <span>{total ? `${(page?.index ?? index) + 1} of ${total}` : load.state === "loading" ? "…" : "0"}</span>
          <button type="button" onClick={() => go(1)} disabled={!page || page.index >= total - 1} aria-label="Older message">
            <ChevronRight size={16} />
          </button>
          <button type="button" className="st-x" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
      </header>

      {load.state === "loading" ? (
        <div className="st-ctx-body is-loading" aria-busy="true">
          <i />
          <i />
          <i />
        </div>
      ) : load.state === "error" ? (
        <p className="st-ctx-note">{load.error}</p>
      ) : !total ? (
        <p className="st-ctx-note">
          No saved messages for this yet. New messages show up here as you chat{word ? ` (${word})` : ""}; older ones appear once the bot has looked back through the server.
        </p>
      ) : page!.deleted ? (
        <p className="st-ctx-note">This message was deleted (or edited so the word is gone). Use the arrows to see the others.</p>
      ) : (
        <>
          <div className="st-ctx-meta">
            {page!.channel ? (
              <span>
                <Hash size={13} /> {page!.channel}
              </span>
            ) : null}
            {page!.jumpUrl ? (
              <a href={page!.jumpUrl} target="_blank" rel="noreferrer">
                Open in Discord <ExternalLink size={12} />
              </a>
            ) : null}
          </div>
          <ol className="st-ctx-body">
            {page!.messages.map((m) => (
              <li key={m.id} className={`${m.hit ? "is-hit" : ""}${m.mine ? " is-mine" : ""}`}>
                {m.avatar ? <img src={m.avatar} alt="" width={30} height={30} /> : <span className="st-ctx-av">{m.author.slice(0, 1).toUpperCase()}</span>}
                <div>
                  <p className="st-ctx-who">
                    <b>{m.author}</b> <time dateTime={m.at}>{when(m.at)}</time>
                    {m.edited ? <small> (edited)</small> : null}
                  </p>
                  {m.content ? <p className="st-ctx-text">{m.hit ? marked(m.content, highlight) : m.content}</p> : null}
                  {m.attachments.length ? (
                    <p className="st-ctx-files">
                      <Paperclip size={12} /> {m.attachments.join(", ")}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <p className="st-ctx-foot">Newest first · private to your account · fetched live from Discord, never saved by the site</p>
        </>
      )}
    </section>
  );
}
