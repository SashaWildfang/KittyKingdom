"use client";

import { FrameRing } from "../../cosmetic-flair";
import { Compass, Eye, Heart, HeartHandshake, RotateCcw, Sparkles, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Score } from "../icons";
import { Empty, Photo, ago, post, useApi, type Card } from "../ui";

type Queue = { mode?: "dating" | "friends"; cards: Card[]; total?: number; likesLeft: number | null; booster: boolean; needsProfile?: boolean; notLooking?: boolean };

type Mode = "dating" | "friends";

export default function Discover() {
  // "auto" uses the default from Settings; ?mode= or the switch picks one
  const [mode, setMode] = useState<Mode | "auto" | null>(null);
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    setMode(m === "friends" || m === "dating" ? m : "auto");
  }, []);
  const { data, error, reload } = useApi<Queue>(mode ? `/api/dating/discover${mode === "auto" ? "" : `?mode=${mode}`}` : null);
  const friends = (mode === "auto" ? data?.mode : mode) === "friends";
  const switchMode = (m: Mode) => {
    setMode(m);
    setLast(null);
    window.history.replaceState(null, "", `?mode=${m}`);
  };
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
      setBusy(true);
      // In Friends mode "like" sends a friend request and "pass" skips them
      const api = friends ? (action === "like" ? "friend" : "skip") : action;
      const r = await post<{ mutual?: boolean; left?: number | null; friend?: string }>("/api/dating/actions", { action: api, target: card.id });
      setBusy(false);
      if (!r.ok) {
        setToast({ text: r.error ?? "That didn't work.", kind: "error" });
        if (typeof r.left === "number") setLeft(r.left);
        return;
      }
      if (friends && action === "like") setToast({ text: r.friend === "friends" ? `You and ${card.name} are friends now!` : `Friend request sent to ${card.name}.` });
      else if (action === "like") {
        if (r.left !== undefined) setLeft(r.left ?? null);
        if (r.mutual) setToast({ text: `It's a match with ${card.name}! Say hi in Messages.`, kind: "match" });
      }
      setLeaving(action);
      window.setTimeout(() => {
        setLeaving(null);
        setLast({ card, action });
        setIndex((i) => i + 1);
      }, 220);
    },
    [card, busy, left, friends],
  );

  const undo = useCallback(async () => {
    if (!last || busy) return;
    setBusy(true);
    const undoAction = friends ? (last.action === "like" ? "unfriend" : "unskip") : last.action === "like" ? "unlike" : "unpass";
    const r = await post("/api/dating/actions", { action: undoAction, target: last.card.id });
    setBusy(false);
    if (!r.ok) return setToast({ text: r.error ?? "Couldn't undo that.", kind: "error" });
    setIndex((i) => Math.max(0, i - 1));
    setLast(null);
    if (last.action === "like" && left !== null && !friends) setLeft(left + 1);
  }, [last, busy, left, friends]);

  // Keyboard: ← pass, → like, Backspace undo, Enter open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") void act("like");
      else if (e.key === "ArrowLeft") void act("pass");
      else if (e.key === "Backspace") void undo();
      else if (e.key === "Enter" && card) window.location.href = `/social/u/${card.id}`;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, undo, card]);

  const toggle = (
    <div className="dt-seg dt-seg--mode" role="tablist" aria-label="Discover mode">
      <button type="button" role="tab" aria-selected={!friends} className={!friends ? "is-on" : undefined} onClick={() => switchMode("dating")}>
        <Heart size={14} aria-hidden="true" /> Dating
      </button>
      <button type="button" role="tab" aria-selected={friends} className={friends ? "is-on" : undefined} onClick={() => switchMode("friends")}>
        <Users size={14} aria-hidden="true" /> Friends
      </button>
    </div>
  );
  if (error) return <p className="dt-error">{error}</p>;
  if (!data) return <div className="dt-loading" aria-busy="true" />;
  if (data.needsProfile)
    return (
      <Empty icon={<UserPlus size={28} />} title="Make your profile first">
        <p>Discover shows your best matches, so it needs to know a little about you.</p>
        <a className="dt-btn" href="/social/setup">
          Create my profile
        </a>
      </Empty>
    );
  if (data.notLooking)
    return (
      <div className="dt-discover">
        {toggle}
        <Empty icon={<Users size={28} />} title="You're here for friends right now">
          <p>Dating matches are for people open to dating, but you can still find people to hang out with in Friends mode.</p>
          <div className="dt-row">
            <button type="button" className="dt-btn" onClick={() => switchMode("friends")}>
              <Users size={14} aria-hidden="true" /> Find friends
            </button>
            <a className="dt-btn dt-btn--ghost" href="/social/profile/edit#targets">
              I&apos;m open to dating
            </a>
          </div>
        </Empty>
      </div>
    );

  return (
    <div className="dt-discover">
      {toggle}
      <div className="dt-discover-top">
        <span className="dt-muted">
          {friends
            ? data.total
              ? `${Math.max(0, data.total - index)} people you'd get along with`
              : "People you'd get along with"
            : data.total
              ? `${Math.max(0, data.total - index)} great matches waiting`
              : "Your best matches, one at a time"}
        </span>
        {friends ? (
          <span className="dt-pill dt-pill--friends">
            <Users size={13} aria-hidden="true" /> Friend requests are unlimited
          </span>
        ) : (
          <span className={`dt-pill${left === 0 ? " is-empty" : ""}`}>
            <Heart size={13} aria-hidden="true" /> {left === null ? "Unlimited likes" : `${left} like${left === 1 ? "" : "s"} left today`}
          </span>
        )}
      </div>

      {card ? (
        <article className={`dt-deck${leaving ? ` is-leaving-${leaving}` : ""}`} style={{ "--acc": card.accent } as CSSProperties} key={card.id}>
          <a href={`/social/u/${card.id}`} className="dt-deck-photo" aria-label={`Open ${card.name}'s profile`}>
            <Photo src={card.photo} name={card.name} accent={card.accent} crop={card.photoCrop} />
            <FrameRing frame={card.flair?.frame} />
            {card.photoCount > 1 ? <span className="dt-deck-count">{card.photoCount} photos</span> : null}
            <span className="dt-deck-score">
              <Score score={card.score} fit={!friends} /> · {friends ? "Get-along score" : card.tier}
            </span>
            {!card.inServer ? <span className="dt-deck-left">Left the server</span> : null}
            {card.myPartner || card.partnered ? (
              <span className="dt-deck-partner">
                <HeartHandshake size={13} aria-hidden="true" /> {card.myPartner ? "Your partner" : "Partnered"}
              </span>
            ) : null}
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
            <button type="button" className="dt-round dt-round--pass" onClick={() => void act("pass")} disabled={busy} title={friends ? "Skip (←)" : "Pass (←)"} aria-label={friends ? `Skip ${card.name}` : `Pass on ${card.name}`}>
              <X size={26} />
            </button>
            <a className="dt-round dt-round--view" href={`/social/u/${card.id}`} title="Full profile (Enter)" aria-label="Full profile">
              <Eye size={20} />
            </a>
            {friends ? (
              <button type="button" className="dt-round dt-round--like dt-round--friend" onClick={() => void act("like")} disabled={busy} title="Add friend (→)" aria-label={`Add ${card.name} as a friend`}>
                <UserPlus size={26} />
              </button>
            ) : (
              <button type="button" className="dt-round dt-round--like" onClick={() => void act("like")} disabled={busy} title="Like (→)" aria-label={`Like ${card.name}`}>
                <Heart size={26} />
              </button>
            )}
          </div>
          <p className="dt-fine dt-center dt-desktop-only">Tip: use ← and → on your keyboard. Backspace undoes.</p>
        </article>
      ) : (
        <Empty icon={<Compass size={28} />} title={friends ? "You've met everyone for now" : "You've seen everyone for now"}>
          <p>New people join all the time. Meanwhile, try Browse with different filters or improve your profile to get better matches.</p>
          <div className="dt-row">
            <a className="dt-btn" href="/social/browse">
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
            <a href="/social/messages" className="dt-textlink">
              Open messages
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
