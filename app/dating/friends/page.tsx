"use client";

import { Ban, MessageCircle, UserCheck, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Empty, Photo, ProfileTile, post, useApi, type Card } from "../ui";

type Friend = Card & { friend: "friends" | "sent" | "received" | "none" };

export default function Friends() {
  const friends = useApi<{ cards: Friend[] }>("/api/dating/lists?list=friends");
  const blocked = useApi<{ cards: Card[]; ids: { id: string; at: string }[] }>("/api/dating/lists?list=blocked");
  const [tab, setTab] = useState<"friends" | "requests" | "blocked">("friends");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "requests" || t === "blocked") setTab(t);
  }, []);
  const act = async (action: string, target: string) => {
    const r = await post("/api/dating/actions", { action, target });
    if (r.ok) await Promise.all([friends.reload(), blocked.reload()]);
  };
  if (friends.error) return <p className="dt-error">{friends.error}</p>;
  if (!friends.data) return <div className="dt-loading" aria-busy="true" />;
  const all = friends.data.cards;
  const mine = all.filter((c) => c.friend === "friends");
  const incoming = all.filter((c) => c.friend === "received");
  const outgoing = all.filter((c) => c.friend === "sent");
  const blockedIds = blocked.data?.ids ?? [];

  return (
    <div className="dt-list-page">
      <div className="dt-seg" role="tablist">
        {(
          [
            ["friends", "Friends", mine.length],
            ["requests", "Requests", incoming.length],
            ["blocked", "Blocked", blockedIds.length],
          ] as const
        ).map(([k, l, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "is-on" : undefined} onClick={() => setTab(k)}>
            {l} <span className={k === "requests" && n ? "is-hot" : undefined}>{n}</span>
          </button>
        ))}
      </div>

      {tab === "friends" ? (
        mine.length ? (
          <div className="dt-grid">
            {mine.map((c) => (
              <ProfileTile
                key={c.id}
                card={c}
                extra={
                  <div className="dt-tile-foot">
                    <a className="dt-btn dt-btn--small" href={`/dating/messages/${c.id}`}>
                      <MessageCircle size={13} aria-hidden="true" /> Message
                    </a>
                    <button type="button" className="dt-btn dt-btn--small dt-btn--ghost" onClick={() => void act("unfriend", c.id)}>
                      Remove
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        ) : (
          <Empty icon={<Users size={28} />} title="No friends here yet">
            <p>Not everything has to be romance. Add friends from anyone&apos;s profile, and friends can message each other freely.</p>
            <a className="dt-btn" href="/dating/browse">
              Find people
            </a>
          </Empty>
        )
      ) : tab === "requests" ? (
        <div className="dt-stack">
          <h3 className="dt-subhead">Waiting for you</h3>
          {incoming.length ? (
            incoming.map((c) => (
              <div key={c.id} className="dt-rowcard">
                <a href={`/dating/u/${c.id}`}>
                  <Photo src={c.photo} name={c.name} accent={c.accent} className="dt-avatar" />
                  <span>
                    <b>{c.name}</b>
                    <small className="dt-muted">{[c.age, c.location].filter(Boolean).join(" · ")}</small>
                  </span>
                </a>
                <button type="button" className="dt-btn dt-btn--small" onClick={() => void act("accept", c.id)}>
                  <UserCheck size={13} aria-hidden="true" /> Accept
                </button>
                <button type="button" className="dt-btn dt-btn--small dt-btn--ghost" onClick={() => void act("decline", c.id)}>
                  <X size={13} aria-hidden="true" /> Decline
                </button>
              </div>
            ))
          ) : (
            <p className="dt-muted">No friend requests right now.</p>
          )}
          {outgoing.length ? (
            <>
              <h3 className="dt-subhead">You sent</h3>
              {outgoing.map((c) => (
                <div key={c.id} className="dt-rowcard">
                  <a href={`/dating/u/${c.id}`}>
                    <Photo src={c.photo} name={c.name} accent={c.accent} className="dt-avatar" />
                    <span>
                      <b>{c.name}</b>
                      <small className="dt-muted">Pending</small>
                    </span>
                  </a>
                  <button type="button" className="dt-btn dt-btn--small dt-btn--ghost" onClick={() => void act("unfriend", c.id)}>
                    Cancel
                  </button>
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : blockedIds.length ? (
        <div className="dt-stack">
          <p className="dt-muted">Blocked members can&apos;t see your profile or message you. They aren&apos;t told.</p>
          {blockedIds.map(({ id }) => {
            const c = blocked.data?.cards.find((x) => x.id === id);
            return (
              <div key={id} className="dt-rowcard">
                <span>
                  <Photo src={c?.photo ?? null} name={c?.name ?? "?"} accent={c?.accent ?? "#888"} className="dt-avatar" />
                  <span>
                    <b>{c?.name ?? "Former member"}</b>
                  </span>
                </span>
                <button type="button" className="dt-btn dt-btn--small dt-btn--ghost" onClick={() => void act("unblock", id)}>
                  <Ban size={13} aria-hidden="true" /> Unblock
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty icon={<Ban size={28} />} title="You haven't blocked anyone" />
      )}
    </div>
  );
}
