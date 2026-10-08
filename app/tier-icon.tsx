import { Crown, Gem, Shield, Zap, type LucideProps } from "lucide-react";
import type { TierKey } from "../lib/perks";

/** The icon for a Patreon tier (or "nitro"), used instead of emoji across the site. */
const ICONS = { knight: Shield, noble: Gem, monarch: Crown, nitro: Zap } as const;

export function TierIcon({ tier, ...props }: { tier: TierKey | "nitro" } & LucideProps) {
  const Icon = ICONS[tier];
  return <Icon aria-hidden="true" {...props} />;
}
