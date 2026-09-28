"use client";

import { Eye, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { Empty, ProfileTile, ago, post, useApi, type Card } from "../ui";

type Likes = { booster: boolean; received: (Card & { at: string | null })[]; hidden: number; sent: Card[] };

export default function Likes() {
  const { data, error, reload } = useApi<Likes>("/api/dating/lists?list=likes");
  const [tab, setTab] = useState<"received" | "sent" | "views">("received");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "sent" || t === "views") setTab(t);
  }, []);
  const views = useApi<{ weekCount: number; cards: (Card & { at: string | null })[] }>(tab === "views" ? "/api/dating/lists?list=views" : null);
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
        <button type="button" role="tab" aria-selected={tab === "views"} className={tab === "views" ? "is-on" : undefined} onClick={() => setTab("views")}>
          <Eye size={14} aria-hidden="true" /> Viewed you
        </button>
      </div>
      {note ? <p className="dt-note">{note}</p> : null}

      {tab === "views" ? (
        !views.data ? (
          <div className="dt-loading" aria-busy="true" />
        ) : views.data.cards.length ? (
          <>
            <p className="dt-muted dt-count">
              {views.data.weekCount} profile view{views.data.weekCount === 1 ? "" : "s"} this week · people browsing anonymously aren&apos;t listed ·{" "}
              <a className="dt-textlink" href="/dating/settings#privacy">
                Browse anonymously yourself
              </a>
            </p>
            <div className="dt-grid">
              {views.data.cards.map((c) => (
                <ProfileTile
                  key={c.id}
                  card={c}
                  extra={
                    <div className="dt-tile-foot">
                      <small className="dt-muted">{c.at ? ago(c.at)?.replace("active ", "viewed ") : null}</small>
                    </div>
                  }
                />
              ))}
            </div>
          </>
        ) : (
          <Empty icon={<Eye size={28} />} title="No profile views yet">
            <p>When someone looks at your profile, they&apos;ll show up here (unless they browse anonymously).</p>
          </Empty>
        )
      ) : tab === "received" ? (
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
            </div>
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
