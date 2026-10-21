"use client";

// Which events and polls you've opened, like News: an event stays "new" until you open it on /events (or
// press "Mark all as read"). Signed in, this is saved to your account so it follows you across devices;
// signed out, it's kept in this browser. The Events tab bubble, the phone menu and /events all use this.

import { useEffect, useState } from "react";

const KEY = "kk_events_seen";
const EVENT = "kk-events-seen";

type State = { signedIn: boolean; ids: Set<string> };
let state: State | null = null;
let loading: Promise<State> | null = null;

function local(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveLocal(s: State) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Array.from(s.ids).slice(-400)));
  } catch {
    // private mode: reads just last for this visit
  }
}

function post(ids: string[]) {
  return fetch("/api/events/reads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }).catch(() => null);
}

async function load(): Promise<State> {
  if (state) return state;
  loading ??= (async () => {
    const mine = local();
    const res = await fetch("/api/events/reads", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (res?.ok && res.signedIn) {
      // First time on this device while signed in: bring this browser's reads along
      const server = new Set<string>(res.ids);
      const extra = mine.filter((id) => !server.has(id));
      if (extra.length) void post(extra);
      state = { signedIn: true, ids: new Set([...res.ids, ...extra]) };
    } else {
      state = { signedIn: false, ids: new Set(mine) };
    }
    return state;
  })();
  return loading;
}

/** Marks events / polls read ("e:<id>", "p:<id>"). */
export async function markEventsSeen(ids: string[]) {
  const s = await load();
  const fresh = ids.filter((id) => !s.ids.has(id));
  if (!fresh.length) return;
  fresh.forEach((id) => s.ids.add(id));
  saveLocal(s);
  if (s.signedIn) void post(fresh);
  window.dispatchEvent(new Event(EVENT));
}

/** The set of opened events / polls (null until loaded), updating whenever something is marked read. */
export function useEventReads() {
  const [ids, setIds] = useState<Set<string> | null>(state ? new Set(state.ids) : null);
  useEffect(() => {
    let alive = true;
    const refresh = () => void load().then((s) => alive && setIds(new Set(s.ids)));
    refresh();
    window.addEventListener(EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, refresh);
    };
  }, []);
  return ids;
}

export function useUnseenEvents(ids: string[]) {
  const read = useEventReads();
  if (!read) return 0;
  return ids.filter((id) => !read.has(id)).length;
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
