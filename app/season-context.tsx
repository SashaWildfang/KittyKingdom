"use client";

// The live season for the browser: currency words, the currency emote and the season's art.
// Admins can preview another season (Admin → Overview → Seasons); that's kept in this browser only.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { seasonalText, type SeasonKey, type SeasonView } from "../lib/seasons";

export const PREVIEW_KEY = "kk-season-preview";

const SeasonContext = createContext<SeasonView | null>(null);

const FALLBACK: SeasonView = {
  key: "fall",
  name: "Autumn",
  one: "Leaf",
  many: "Leaves",
  emote: "/leaf-emote.png",
  logo: "/logo.png",
  banner: "/banner.jpg",
  particles: "full",
  scenery: true,
  bursts: true,
  version: 0,
};

export function readPreview(): SeasonKey | null {
  try {
    const v = localStorage.getItem(PREVIEW_KEY);
    return v === "spring" || v === "summer" || v === "fall" || v === "winter" ? v : null;
  } catch {
    return null;
  }
}

export function SeasonProvider({ live, all, children }: { live: SeasonView; all: Record<SeasonKey, SeasonView>; children: ReactNode }) {
  const [preview, setPreview] = useState<SeasonKey | null>(null);
  useEffect(() => {
    setPreview(readPreview());
    const sync = () => setPreview(readPreview());
    window.addEventListener("storage", sync);
    window.addEventListener("kk-season-preview", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("kk-season-preview", sync);
    };
  }, []);
  const previewing = preview && preview !== live.key ? all[preview] : null;
  const value = previewing ?? live;
  useEffect(() => {
    document.documentElement.dataset.season = value.key;
  }, [value.key]);
  return (
    <SeasonContext.Provider value={value}>
      {children}
      {previewing ? (
        <div className="season-preview-bar" role="status">
          <span>
            Previewing <b>{previewing.name}</b> <small>(only you see this)</small>
          </span>
          <button type="button" onClick={() => setSeasonPreview(null)}>
            Stop preview
          </button>
        </div>
      ) : null}
    </SeasonContext.Provider>
  );
}

/** The season being shown (the live one, or the one an admin is previewing). */
export function useSeason(): SeasonView {
  return useContext(SeasonContext) ?? FALLBACK;
}

/** Currency words: cur.many ("Leaves"), cur.one ("Leaf"), cur.text("50 Leaves") → "50 Snowflakes". */
export function useCurrency() {
  const s = useSeason();
  return { one: s.one, many: s.many, lower: s.many.toLowerCase(), lowerOne: s.one.toLowerCase(), text: (t: string) => seasonalText(t, s), amount: (n: number) => `${n.toLocaleString()} ${n === 1 ? s.one : s.many}` };
}

/** The currency's name as text, e.g. <CurrencyName /> → "Leaves". */
export function CurrencyName({ one, lower }: { one?: boolean; lower?: boolean }) {
  const s = useSeason();
  const word = one ? s.one : s.many;
  return <>{lower ? word.toLowerCase() : word}</>;
}

/** Runs fall-worded text through the season's words. */
export function Seasonal({ children }: { children: string }) {
  const s = useSeason();
  return <>{seasonalText(children, s)}</>;
}

/** Turns an admin's preview on or off (also tells other tabs). */
export function setSeasonPreview(key: SeasonKey | null) {
  try {
    if (key) localStorage.setItem(PREVIEW_KEY, key);
    else localStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event("kk-season-preview"));
}

/** Shows children as if a given season were live (for admin previews of one piece, like a glyph). */
export function SeasonOverride({ season, children }: { season: SeasonKey; children: ReactNode }) {
  const current = useSeason();
  return <SeasonContext.Provider value={{ ...current, key: season }}>{children}</SeasonContext.Provider>;
}
