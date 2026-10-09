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

/** Text written with 🍁 for the currency ("250 🍁 + 300 XP"): the 🍁 becomes the season's emote. */
export function CurrencyAmount({ text, size = 15 }: { text: string; size?: number }) {
  const parts = text.split("🍁");
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 ? <LeafEmote size={size} /> : null}
        </span>
      ))}
    </>
  );
}
