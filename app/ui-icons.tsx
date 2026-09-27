// Shared icons: our custom leaf emote for the currency, and store item icons (Lucide).
import { Cake, Candy, Coffee, Cookie, CupSoda, Flower2, Gift, Heart, Mail, Package, PawPrint, Rocket, Star } from "lucide-react";

/** The server's custom leaf emote, used everywhere leafs (the currency) appear. */
export function LeafEmote({ size = 18, className }: { size?: number; className?: string }) {
  return <img className={className ? `leaf-emote ${className}` : "leaf-emote"} src="/leaf-emote.png" alt="leafs" width={size} height={size} />;
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
} as const;

/** Icon for a store item (the server sends a key like "coffee"; "leaf" means the leaf emote). */
export function StoreItemIcon({ icon, size = 22 }: { icon: string | null | undefined; size?: number }) {
  if (icon === "leaf") return <LeafEmote size={size} />;
  const Icon = STORE_ICONS[(icon ?? "package") as keyof typeof STORE_ICONS] ?? Package;
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
}
