"use client";

import { BarChart3, Check, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicPoll } from "../../lib/event-polls";
import type { PublicEvent } from "../../lib/events-shared";

const left = (ms: number) => {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${Math.max(1, m)} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} hour${h === 1 ? "" : "s"}` : `${Math.round(h / 24)} days`;
};

/** Event polls on /events: results for everyone, voting for members with Discord linked. */
export function EventPollsBoard({ initial, events, signedIn, linked, now }: { initial: PublicPoll[]; events: PublicEvent[]; signedIn: boolean; linked: boolean; now: number }) {
  const [polls, setPolls] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; text: string } | null>(null);

  // New votes from Discord come in through the bot, so refresh now and then
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/events/polls", { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => r?.ok && setPolls(r.polls))
        .catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (!polls.length) return null;

  const vote = async (p: PublicPoll, index: number) => {
    const picked = p.multiple ? (p.mine.includes(index) ? p.mine.filter((i) => i !== index) : [...p.mine, index]) : p.mine.includes(index) ? [] : [index];
    setBusy(p.id);
    setErr(null);
    const r = await fetch(`/api/events/polls/${p.id}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: picked }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(null);
    if (!r?.ok) return setErr({ id: p.id, text: r?.error ?? "Couldn't save your vote." });
    setPolls((list) => list.map((x) => (x.id === p.id ? { ...x, answers: r.answers, totalVotes: r.totalVotes, mine: r.mine } : x)));
  };

  return (
    <section className="evp-polls" aria-labelledby="evp-polls-h">
      <h2 id="evp-polls-h">
        <BarChart3 size={18} aria-hidden="true" /> Polls
      </h2>
      <div className="evp-poll-grid">
        {polls.map((p) => {
          const event = p.eventId ? events.find((e) => e.id === p.eventId) : undefined;
          const open = p.open && (!p.expiresAt || new Date(p.expiresAt).getTime() > now);
          const canVote = open && linked && !p.votedInDiscord;
          const top = Math.max(0, ...p.answers.map((a) => a.votes));
          return (
            <article key={p.id} className={`evp-poll${open ? "" : " is-ended"}`}>
              <header>
                <h3>{p.question}</h3>
                <p>
                  <span className={open ? "evp-poll-live" : undefined}>{open ? (p.expiresAt ? `${left(new Date(p.expiresAt).getTime() - now)} left` : "Open") : "Ended"}</span>
                  <span>
                    {p.totalVotes} {p.totalVotes === 1 ? "vote" : "votes"}
                  </span>
                  {p.multiple ? <span>Pick as many as you like</span> : null}
                  {event ? (
                    <a href={`#event-${event.id}`} className="evp-poll-event">
                      For {event.title}
                    </a>
                  ) : null}
                </p>
              </header>
              <ul>
                {p.answers.map((a, i) => {
                  const pct = p.totalVotes ? Math.round((a.votes / p.totalVotes) * 100) : 0;
                  const picked = p.mine.includes(i);
                  const win = !open && a.votes > 0 && a.votes === top;
                  const body = (
                    <>
                      <span className="evp-poll-fill" style={{ width: `${pct}%` }} aria-hidden="true" />
                      <span className="evp-poll-pick" aria-hidden="true">
                        {picked ? <Check size={13} strokeWidth={3} /> : null}
                      </span>
                      <span className="evp-poll-answer">
                        {a.emoji ? <span aria-hidden="true">{a.emoji}</span> : null} {a.text}
                      </span>
                      <span className="evp-poll-pct">{pct}%</span>
                    </>
                  );
                  return (
                    <li key={i}>
                      {canVote ? (
                        <button
                          type="button"
                          className={`evp-poll-opt${picked ? " is-picked" : ""}`}
                          disabled={busy === p.id}
                          aria-pressed={picked}
                          aria-label={`${a.text}, ${a.votes} votes`}
                          onClick={() => vote(p, i)}
                        >
                          {body}
                        </button>
                      ) : (
                        <div className={`evp-poll-opt${picked ? " is-picked" : ""}${win ? " is-win" : ""}`}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <footer>
                {err?.id === p.id ? (
                  <span className="evp-error">{err.text}</span>
                ) : !open ? (
                  <span>{p.mine.length ? "You voted in this one." : "Voting has closed."}</span>
                ) : p.votedInDiscord ? (
                  <span>You voted in Discord. Change your vote there.</span>
                ) : !signedIn ? (
                  <a href="/login?next=/events">Log in to vote</a>
                ) : !linked ? (
                  <a href="/account#discord">Link your Discord to vote</a>
                ) : (
                  <span>{p.mine.length ? (p.multiple ? "Tap to change your picks." : "Tap your pick again to take it back.") : "Tap an answer to vote."}</span>
                )}
                {p.messageUrl ? (
                  <a href={p.messageUrl} target="_blank" rel="noopener noreferrer" className="evp-poll-discord">
                    <ExternalLink size={13} aria-hidden="true" /> In Discord
                  </a>
                ) : null}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
