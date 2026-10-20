"use client";

// Shared icons: the currency emote (changes with the season), and store item icons (Lucide).
import { useSeason } from "./season-context";
import { Award, Cake, Candy, Coffee, Cookie, CupSoda, Flower2, Gift, Heart, Mail, Package, PawPrint, Rocket, ShieldCheck, Sparkles, Star, Sun, Type } from "lucide-react";

/** The currency emote (a leaf in autumn, a snowflake in winter…), used everywhere the currency appears. */
export function LeafEmote({ size = 18, className }: { size?: number; className?: string }) {
  const season = useSeason();
  return <img className={className ? `leaf-emote ${className}` : "leaf-emote"} src={season.emote} alt={season.many.toLowerCase()} width={size} height={size} />;
}

/** The same emote under a clearer name. */
export const CurrencyEmote = LeafEmote;

/** The server's XP emoji, shown instead of the word "XP" after an amount ("500 <XpEmote />"). */
export function XpEmote({ size = 18, className }: { size?: number; className?: string }) {
  return <img className={className ? `leaf-emote xp-emote ${className}` : "leaf-emote xp-emote"} src="/xp-emote.png" alt="XP" title="XP" width={size} height={size} />;
}

/** "500 XP" with the XP emoji. */
export function XpAmount({ n, size = 16, bold }: { n: number | string; size?: number; bold?: boolean }) {
  const text = typeof n === "number" ? n.toLocaleString("en-US") : n;
  return (
    <span className="xp-amount">
      {bold ? <b>{text}</b> : text} <XpEmote size={size} />
    </span>
  );
}

// An amount followed by "XP" ("300 XP", "25–50 XP", "+20% XP"), for text that comes as a string
const XP_AMOUNT = /(\d[\d,]*(?:\.\d+)?%?(?:\s*[–-]\s*\d[\d,]*(?:\.\d+)?%?)?)\s?XP\b(?!\s*(?:[Ww]eekend|[Bb]ooster|[Bb]oost))/g;

/** Plain text with any "N XP" drawn as N and the XP emoji. */
export function XpText({ text, size = 15 }: { text: string; size?: number }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of Array.from(text.matchAll(XP_AMOUNT))) {
    // The number and its emoji stay on one line
    out.push(
      text.slice(last, m.index),
      <span key={m.index} className="xp-amount">
        {m[1]} <XpEmote size={size} />
      </span>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

const STORE_ICONS = {
  xp: Star,
  heart: Heart,
  rocket: Rocket,
  gift: Gift,
  coffee: Coffee,
  flower: Flower2,
  candy: Candy,
  paw: PawPrint,
  mail: Mail,
  cookie: Cookie,
  soda: CupSoda,
  cake: Cake,
  package: Package,
  spotlight: Sun,
  shield: ShieldCheck,
  superlike: Star,
  title: Type,
  badge: Award,
  sparkles: Sparkles,
} as const;

/** Icon for a store item (the server sends a key like "coffee"; "leaf" means the leaf emote). */
export function StoreItemIcon({ icon, size = 22 }: { icon: string | null | undefined; size?: number }) {
  if (icon === "leaf") return <LeafEmote size={size} />;
  const Icon = STORE_ICONS[(icon ?? "package") as keyof typeof STORE_ICONS] ?? Package;
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
}

/** The server logo (the season's uploaded logo when there is one). Takes normal <img> props. */
export function SiteLogo(props: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src">) {
  const season = useSeason();
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} src={season.logo} />;
}

/** Text written with 🍁 for the currency ("250 🍁 + 300 XP"): the 🍁 becomes the season's emote, and XP amounts get the XP emoji. */
export function CurrencyAmount({ text, size = 15 }: { text: string; size?: number }) {
  const parts = text.split("🍁");
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          <XpText text={p} size={size} />
          {i < parts.length - 1 ? <LeafEmote size={size} /> : null}
        </span>
      ))}
    </>
  );
}
