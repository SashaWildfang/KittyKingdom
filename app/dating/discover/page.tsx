"use client";

import { Compass, Eye, Heart, RotateCcw, Sparkles, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Empty, Photo, ago, post, useApi, type Card } from "../ui";

type Queue = { cards: Card[]; total?: number; likesLeft: number | null; booster: boolean; needsProfile?: boolean; notLooking?: boolean };

export default function Discover() {
  const { data, error, reload } = useApi<Queue>("/api/dating/discover");
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [last, setLast] = useState<{ card: Card; action: "like" | "pass" } | null>(null);
  const [toast, setToast] = useState<{ text: string; kind?: "match" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState<"like" | "pass" | null>(null);

  useEffect(() => {
    if (data) {
      setIndex(0);
      setLeft(data.likesLeft);
    }
  }, [data]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.kind === "match" ? 6000 : 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const card = data?.cards[index] ?? null;

  const act = useCallback(
    async (action: "like" | "pass") => {
      if (!card || busy) return;
      if (action === "like" && left === 0) {
        setToast({ text: "You've used your 3 likes for today. Boost the server for unlimited likes!", kind: "error" });
        return;
      }
      setBusy(true);
      const r = await post<{ mutual?: boolean; left?: number | null }>("/api/dating/actions", { action, target: card.id });
      setBusy(false);
      if (!r.ok) {
        setToast({ text: r.error ?? "That didn't work.", kind: "error" });
        if (typeof r.left === "number") setLeft(r.left);
        return;
      }
      if (action === "like") {
        if (r.left !== undefined) setLeft(r.left ?? null);
        if (r.mutual) setToast({ text: `💞 It's a match with ${card.name}! Say hi in Messages.`, kind: "match" });
      }
      setLeaving(action);
      window.setTimeout(() => {
        setLeaving(null);
        setLast({ card, action });
        setIndex((i) => i + 1);
      }, 220);
    },
    [card, busy, left],
  );

  const undo = useCallback(async () => {
    if (!last || busy) return;
    setBusy(true);
    const r = await post("/api/dating/actions", { action: last.action === "like" ? "unlike" : "unpass", target: last.card.id });
    setBusy(false);
    if (!r.ok) return setToast({ text: r.error ?? "Couldn't undo that.", kind: "error" });
    setIndex((i) => Math.max(0, i - 1));
    setLast(null);
    if (last.action === "like" && left !== null) setLeft(left + 1);
  }, [last, busy, left]);

  // Keyboard: ← pass, → like, Backspace undo, Enter open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") void act("like");
      else if (e.key === "ArrowLeft") void act("pass");
      else if (e.key === "Backspace") void undo();
      else if (e.key === "Enter" && card) window.location.href = `/dating/u/${card.id}`;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, undo, card]);

  if (error) return <p className="dt-error">{error}</p>;
  if (!data) return <div className="dt-loading" aria-busy="true" />;
  if (data.needsProfile)
    return (
      <Empty icon={<UserPlus size={28} />} title="Make your profile first">
        <p>Discover shows your best matches, so it needs to know a little about you.</p>
        <a className="dt-btn" href="/dating/setup">
          Create my profile
        </a>
      </Empty>
    );
  if (data.notLooking)
    return (
      <Empty icon={<Heart size={28} />} title="You're set to not looking">
        <p>Discover is for people open to dating. You can still Browse and make friends, or switch it on in your profile.</p>
        <div className="dt-row">
          <a className="dt-btn" href="/dating/profile#targets">
            I&apos;m open to dating
          </a>
          <a className="dt-btn dt-btn--ghost" href="/dating/browse">
            Browse everyone
          </a>
        </div>
      </Empty>
    );

  return (
    <div className="dt-discover">
      <div className="dt-discover-top">
        <span className="dt-muted">
          {data.total ? `${Math.max(0, data.total - index)} great matches waiting` : "Your best matches, one at a time"}
        </span>
        <span className={`dt-pill${left === 0 ? " is-empty" : ""}`}>
          <Heart size={13} aria-hidden="true" /> {left === null ? "Unlimited likes" : `${left} like${left === 1 ? "" : "s"} left today`}
        </span>
      </div>

      {card ? (
        <article className={`dt-deck${leaving ? ` is-leaving-${leaving}` : ""}`} style={{ "--acc": card.accent } as CSSProperties} key={card.id}>
          <a href={`/dating/u/${card.id}`} className="dt-deck-photo" aria-label={`Open ${card.name}'s profile`}>
            <Photo src={card.photo} name={card.name} accent={card.accent} />
            {card.photoCount > 1 ? <span className="dt-deck-count">{card.photoCount} photos</span> : null}
            <span className="dt-deck-score">
              {card.emoji} {card.score}% · {card.tier}
            </span>
          </a>
          <div className="dt-deck-body">
            <h2>
              {card.name}
              {card.age ? <span>, {card.age}</span> : null}
              {card.isNew ? <span className="dt-new">New</span> : null}
            </h2>
            {card.headline ? <p className="dt-headline">{card.headline}</p> : null}
            <p className="dt-muted">
              {[card.gender, card.pronouns, card.location].filter(Boolean).join(" · ")}
              {card.lastActive ? <span className={ago(card.lastActive) === "online now" ? "is-online" : ""}> · {ago(card.lastActive)}</span> : null}
            </p>
            {card.bio ? <p className="dt-deck-bio">{card.bio}</p> : null}
            {card.shared.length ? (
              <div className="dt-deck-shared">
                <small>
                  <Sparkles size={12} aria-hidden="true" /> You both like
                </small>
                <div className="dt-tags">
                  {card.shared.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {card.lookingFor ? <p className="dt-muted">Looking for: {card.lookingFor}</p> : null}
          </div>
          <div className="dt-deck-actions">
            <button type="button" className="dt-round dt-round--undo" onClick={() => void undo()} disabled={!last || busy} title="Undo (Backspace)" aria-label="Undo">
              <RotateCcw size={18} />
            </button>
            <button type="button" className="dt-round dt-round--pass" onClick={() => void act("pass")} disabled={busy} title="Pass (←)" aria-label={`Pass on ${card.name}`}>
              <X size={26} />
            </button>
            <a className="dt-round dt-round--view" href={`/dating/u/${card.id}`} title="Full profile (Enter)" aria-label="Full profile">
              <Eye size={20} />
            </a>
            <button type="button" className="dt-round dt-round--like" onClick={() => void act("like")} disabled={busy} title="Like (→)" aria-label={`Like ${card.name}`}>
              <Heart size={26} />
            </button>
          </div>
          <p className="dt-fine dt-center dt-desktop-only">Tip: use ← and → on your keyboard. Backspace undoes.</p>
        </article>
      ) : (
        <Empty icon={<Compass size={28} />} title="You've seen everyone for now">
          <p>New people join all the time. Meanwhile, try Browse with different filters or improve your profile to get better matches.</p>
          <div className="dt-row">
            <a className="dt-btn" href="/dating/browse">
              Browse everyone
            </a>
            <button type="button" className="dt-btn dt-btn--ghost" onClick={() => void reload()}>
              Refresh
            </button>
            {last ? (
              <button type="button" className="dt-btn dt-btn--ghost" onClick={() => void undo()}>
                <RotateCcw size={14} aria-hidden="true" /> Undo last
              </button>
            ) : null}
          </div>
        </Empty>
      )}

      {toast ? (
        <div className={`dt-toast${toast.kind ? ` is-${toast.kind}` : ""}`} role="status">
          {toast.text}
          {toast.kind === "match" ? (
            <a href="/dating/messages" className="dt-textlink">
              Open messages
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
