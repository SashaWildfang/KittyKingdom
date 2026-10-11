"use client";

// The bubble on the Events tab: how many upcoming events and open polls you haven't seen on /events yet,
// or a green dot while an event is happening. Seen ones are kept in this browser; opening /events clears it.

import { useEffect, useState } from "react";

const KEY = "kk_events_seen";
const EVENT = "kk-events-seen";

function seen(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

/** /events calls this with everything on the page. */
export function markEventsSeen(ids: string[]) {
  try {
    const all = Array.from(new Set([...Array.from(seen()), ...ids])).slice(-200);
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // private mode: the bubble just comes back next visit
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useUnseenEvents(ids: string[]) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => {
      const s = seen();
      setCount(ids.filter((id) => !s.has(id)).length);
    };
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [ids]);
  return count;
}

export function EventsNavBadge({ ids, live, dot = false }: { ids: string[]; live: boolean; dot?: boolean }) {
  const count = useUnseenEvents(ids);
  if (count)
    return (
      <span className={`nav-news-badge${dot ? " nav-news-badge--dot" : ""}`} aria-label={`${count} new event${count === 1 ? "" : "s"} or poll${count === 1 ? "" : "s"}`}>
        {count > 9 ? "9+" : count}
      </span>
    );
  if (live && !dot) return <span className="nav-live-dot" title="An event is happening now" aria-label="An event is happening now" />;
  return null;
}
