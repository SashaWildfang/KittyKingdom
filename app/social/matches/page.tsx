"use client";

import { MessageCircle, Sparkles } from "lucide-react";
import { Empty, ProfileTile, ago, useApi, type Card } from "../ui";

export default function Matches() {
  const { data, error } = useApi<{ cards: (Card & { at: string | null })[] }>("/api/dating/lists?list=matches");
  if (error) return <p className="dt-error">{error}</p>;
  if (!data) return <div className="dt-loading" aria-busy="true" />;
  if (!data.cards.length)
    return (
      <Empty icon={<Sparkles size={28} />} title="No matches yet">
        <p>When you and someone both like each other, you&apos;ll match and can chat freely.</p>
        <a className="dt-btn" href="/social/discover">
          Discover people
        </a>
      </Empty>
    );
  return (
    <div className="dt-list-page">
      <p className="dt-muted dt-count">
        {data.cards.length} {data.cards.length === 1 ? "match" : "matches"} · you can message matches without a request
      </p>
      <div className="dt-grid">
        {data.cards.map((c) => (
          <ProfileTile
            key={c.id}
            card={c}
            extra={
              <div className="dt-tile-foot">
                <small className="dt-muted">{c.at ? ago(c.at)?.replace("active ", "matched ") : null}</small>
                <a className="dt-btn dt-btn--small" href={`/social/messages/${c.id}`}>
                  <MessageCircle size={13} aria-hidden="true" /> Message
                </a>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}
