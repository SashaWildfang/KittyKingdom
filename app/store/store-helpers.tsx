"use client";

// Small pieces shared by the Store's views (Shop, Inventory, the buy and gift windows).

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Crown, Gift, Heart, LayoutGrid, Paintbrush, Rocket, Star, Wand2 } from "lucide-react";
import type { StoreItem } from "../../lib/store";
import { CosmeticPreview } from "../cosmetic-flair";
import { LeafEmote, StoreItemIcon } from "../ui-icons";

export const MAX_BUY = 50;
export const CATEGORY_ORDER = ["Cosmetics", "Social", "Perks", "Roles", "Boosters", "Gifts"];
export const CATEGORY_ICONS: Record<string, ReactNode> = {
  All: <LayoutGrid size={15} />,
  Drops: <Crown size={15} />,
  Cosmetics: <Wand2 size={15} />,
  Social: <Heart size={15} />,
  Perks: <Star size={15} />,
  Roles: <Paintbrush size={15} />,
  Boosters: <Rocket size={15} />,
  Gifts: <Gift size={15} />,
};

/** The most of an item you could put in the cart right now. */
export function maxFor(item: StoreItem) {
  if (!item.stackable) return item.owned > 0 ? 0 : 1;
  const dailyLeft = item.dailyLimit ? Math.max(item.dailyLimit - item.boughtToday, 0) : MAX_BUY;
  return Math.max(0, Math.min(MAX_BUY, item.stock ?? MAX_BUY, dailyLeft));
}

/** What a line really costs: Patreon supporters' discount, rounded down per line (the same as lib/store.ts). */
export function priceFor(price: number, amount: number, discount: number) {
  return Math.floor(price * amount * (1 - (discount || 0)));
}

export function Leaf({ size = 18 }: { size?: number }) {
  return <LeafEmote size={size} className="store-leaf" />;
}

export function formatCountdown(ms: number) {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

export function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  if (seconds % 86400 === 0) return `${seconds / 86400} day${seconds === 86400 ? "" : "s"}`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
  return `${Math.round(seconds / 60)} min`;
}

export function swatchStyle(colors: string[]): CSSProperties {
  const stops = colors.length === 0 ? ["#f59b2a", "#c85f18"] : colors.length === 1 ? [colors[0], colors[0]] : colors;
  return { "--swatch": `linear-gradient(135deg, ${stops.join(", ")})` } as CSSProperties;
}

/** A small preview of a cosmetic (cart, inventory, buy window). */
function CosmeticThumb({ cosmetic, large = false }: { cosmetic: NonNullable<StoreItem["cosmetic"]>; large?: boolean }) {
  return (
    <span className={`store-cos-thumb${large ? " is-large" : ""}`} aria-hidden="true">
      <CosmeticPreview slot={cosmetic.slot} cosKey={cosmetic.key} compact />
    </span>
  );
}

export function ItemVisual({ icon, roleColors, isRole, large = false, cosmetic }: { icon: string | null; roleColors: string[]; isRole: boolean; large?: boolean; cosmetic?: StoreItem["cosmetic"]; name?: string }) {
  if (cosmetic) return <CosmeticThumb cosmetic={cosmetic} large={large} />;
  if (isRole) {
    return <span className={`store-swatch${large ? " store-swatch--large" : ""}`} style={swatchStyle(roleColors)} aria-hidden="true" />;
  }
  return (
    <span className={`store-icon${large ? " store-icon--large" : ""}`} aria-hidden="true">
      <StoreItemIcon icon={icon} size={large ? 30 : 22} />
    </span>
  );
}

/** The current time, ticking every second. 0 until the page is in the browser, so the server and browser
 * render the same text (countdowns appear once it's running instead of breaking hydration). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
