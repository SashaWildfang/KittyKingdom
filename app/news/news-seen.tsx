"use client";

// Which news posts you've read. A post is read once you open it (or press "Mark all as read").
// Signed in, this is saved to your account so it follows you across devices; signed out, it's kept
// in this browser. Posts older than a month count as read so nobody starts with a wall of unread.
// The News tab bubble, the phone menu, the home notice and the News page all use this.

import { useEffect, useState } from "react";

export const NEWS_SEEN_KEY = "kk_news_seen"; // old "visited the News page" time, used once as a starting point
export const NEWS_READ_KEY = "kk_news_read";
export const NEWS_ALL_KEY = "kk_news_all_read";
export const NEWS_EVENT = "kk-news-read";
const BASELINE_MS = 30 * 86_400_000;

type State = { signedIn: boolean; ids: Set<string>; allBefore: string | null };
let state: State | null = null;
let loading: Promise<State> | null = null;

function local(): { ids: string[]; allBefore: string | null } {
  try {
    return {
      ids: JSON.parse(window.localStorage.getItem(NEWS_READ_KEY) ?? "[]"),
      allBefore: window.localStorage.getItem(NEWS_ALL_KEY) ?? window.localStorage.getItem(NEWS_SEEN_KEY),
    };
  } catch {
    return { ids: [], allBefore: null };
  }
}

function saveLocal(s: State) {
  try {
    window.localStorage.setItem(NEWS_READ_KEY, JSON.stringify(Array.from(s.ids).slice(-300)));
    if (s.allBefore) window.localStorage.setItem(NEWS_ALL_KEY, s.allBefore);
  } catch {
    // private mode: reads just last for this visit
  }
}

async function load(): Promise<State> {
  if (state) return state;
  loading ??= (async () => {
    const mine = local();
    const res = await fetch("/api/news/reads", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (res?.ok && res.signedIn) {
      // First time on this device while signed in: bring this browser's reads along
      const serverIds = new Set<string>(res.ids);
      const extra = mine.ids.filter((id) => !serverIds.has(id));
      if (extra.length) void post({ ids: extra });
      state = { signedIn: true, ids: new Set([...res.ids, ...extra]), allBefore: [res.allBefore, mine.allBefore].filter(Boolean).sort().pop() ?? null };
    } else {
      state = { signedIn: false, ids: new Set(mine.ids), allBefore: mine.allBefore };
    }
    return state;
  })();
  return loading;
}

function post(body: unknown) {
  return fetch("/api/news/reads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
}

function changed() {
  window.dispatchEvent(new Event(NEWS_EVENT));
}

export function isRead(s: State | null, id: string, at: string) {
  if (!s) return true; // until loaded, don't flash "unread"
  if (s.ids.has(id)) return true;
  if (s.allBefore && at <= s.allBefore) return true;
  return Date.now() - new Date(at).getTime() > BASELINE_MS;
}

export async function markNewsRead(id: string) {
  const s = await load();
  if (s.ids.has(id)) return;
  s.ids.add(id);
  saveLocal(s);
  if (s.signedIn) void post({ ids: [id] });
  changed();
}

export async function markAllNewsRead() {
  const s = await load();
  s.allBefore = new Date().toISOString();
  s.ids.clear();
  saveLocal(s);
  if (s.signedIn) void post({ all: true });
  changed();
}

/** The read state, updating whenever something is marked read (on any tab). */
export function useNewsReads() {
  const [s, setS] = useState<State | null>(state);
  useEffect(() => {
    let alive = true;
    const refresh = () => void load().then((x) => alive && setS({ ...x, ids: new Set(x.ids) }));
    refresh();
    window.addEventListener(NEWS_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(NEWS_EVENT, refresh);
    };
  }, []);
  return s;
}

/** Opening a post marks it read. (The News list itself no longer marks anything.) */
export function NewsSeen({ readId }: { latest?: string | null; readId?: string }) {
  useEffect(() => {
    if (readId) void markNewsRead(readId);
  }, [readId]);
  return null;
}
