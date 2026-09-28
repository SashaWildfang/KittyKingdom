"use client";

import { Gem, Heart, Lock } from "lucide-react";
import { useState } from "react";
import { Empty, ProfileTile, ago, post, useApi, type Card } from "../ui";

type Likes = { booster: boolean; received: (Card & { at: string | null })[]; hidden: number; sent: Card[] };

export default function Likes() {
  const { data, error, reload } = useApi<Likes>("/api/dating/lists?list=likes");
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [note, setNote] = useState<string | null>(null);
  if (error) return <p className="dt-error">{error}</p>;
  if (!data) return <div className="dt-loading" aria-busy="true" />;

  const likeBack = async (c: Card) => {
    const r = await post<{ mutual?: boolean }>("/api/dating/actions", { action: "like", target: c.id });
    setNote(r.ok ? (r.mutual ? `💞 It's a match with ${c.name}!` : `You liked ${c.name}.`) : r.error ?? "That didn't work.");
    if (r.ok) await reload();
  };
  const unlike = async (c: Card) => {
    const r = await post("/api/dating/actions", { action: "unlike", target: c.id });
    if (r.ok) await reload();
  };

  return (
    <div className="dt-list-page">
      <div className="dt-seg" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "received"} className={tab === "received" ? "is-on" : undefined} onClick={() => setTab("received")}>
          Likes you <span>{data.received.length + data.hidden}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "sent"} className={tab === "sent" ? "is-on" : undefined} onClick={() => setTab("sent")}>
          You liked <span>{data.sent.length}</span>
        </button>
      </div>
      {note ? <p className="dt-note">{note}</p> : null}

      {tab === "received" ? (
        data.received.length || data.hidden ? (
          <>
            <div className="dt-grid">
              {data.received.map((c) => (
                <ProfileTile
                  key={c.id}
                  card={c}
                  extra={
                    <div className="dt-tile-foot">
                      <small className="dt-muted">{c.at ? ago(c.at)?.replace("active ", "liked ") : null}</small>
                      {c.liked ? (
                        <span className="dt-badge dt-badge--match">💞 Match</span>
                      ) : (
                        <button type="button" className="dt-btn dt-btn--small dt-btn--like" onClick={() => void likeBack(c)}>
                          <Heart size={13} aria-hidden="true" /> Like back
                        </button>
                      )}
                    </div>
                  }
                />
              ))}
              {Array.from({ length: Math.min(data.hidden, 6) }).map((_, n) => (
                <div key={n} className="dt-tile dt-tile--locked" aria-hidden="true">
                  <Lock size={22} />
                </div>
              ))}
            </div>
            {data.hidden ? (
              <div className="dt-upsell">
                <Gem size={20} aria-hidden="true" />
                <div>
                  <b>
                    {data.hidden} more {data.hidden === 1 ? "person likes" : "people like"} you
                  </b>
                  <p className="dt-muted">Server boosters see everyone who liked them and get unlimited likes. Boost KittyKingdom on Discord to unlock.</p>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <Empty icon={<Heart size={28} />} title="No likes yet">
            <p>A great bio, a photo and a prompt or two make a big difference. Profiles with photos get far more likes.</p>
            <a className="dt-btn" href="/dating/profile">
              Improve my profile
            </a>
          </Empty>
        )
      ) : data.sent.length ? (
        <div className="dt-grid">
          {data.sent.map((c) => (
            <ProfileTile
              key={c.id}
              card={c}
              extra={
                <div className="dt-tile-foot">
                  <button type="button" className="dt-btn dt-btn--small dt-btn--ghost" onClick={() => void unlike(c)}>
                    Unlike
                  </button>
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <Empty icon={<Heart size={28} />} title="You haven't liked anyone yet">
          <a className="dt-btn" href="/dating/discover">
            Start discovering
          </a>
        </Empty>
      )}
    </div>
  );
}
