import {
  AtSign,
  CalendarCheck,
  CalendarHeart,
  Camera,
  Clapperboard,
  Clover,
  Crown,
  Dices,
  Flame,
  Gem,
  Gift,
  HandHeart,
  Headphones,
  Heart,
  HeartHandshake,
  HelpCircle,
  Hourglass,
  Leaf,
  Lightbulb,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  MonitorUp,
  Moon,
  Music,
  Network,
  PartyPopper,
  PenLine,
  Reply,
  Rocket,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Smile,
  Snowflake,
  Sticker,
  Sunrise,
  Timer,
  TrendingUp,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { BadgeShape } from "../../lib/badges";

const ICONS: Record<string, LucideIcon> = {
  AtSign, CalendarCheck, CalendarHeart, Camera, Clapperboard, Clover, Crown, Dices, Flame, Gem, Gift, HandHeart, Headphones, Heart,
  HeartHandshake, HelpCircle, Hourglass, Leaf, Lightbulb, Megaphone, MessageCircle, MessagesSquare, MonitorUp, Moon, Music, Network,
  PartyPopper, PenLine, Reply, Rocket, ScrollText, ShieldCheck, ShoppingBag, Smile, Snowflake, Sticker, Sunrise, Timer, TrendingUp, Users, Video,
};

/**
 * A badge medal: its own shape (circle, hexagon, shield, diamond, squircle or star) and color,
 * with a metal rim for the tier (bronze, silver, gold, diamond). Tier 0 is shown locked.
 */
export function BadgeMedal({
  icon,
  shape,
  hue,
  tier,
  size = 56,
  title,
}: {
  icon: string;
  shape: BadgeShape;
  hue: string;
  tier: number;
  size?: number;
  title?: string;
}) {
  const Icon = ICONS[icon] ?? Crown;
  return (
    <span
      className={`bm bm--${shape} bm--t${tier}`}
      style={{ "--hue": hue, "--size": `${size}px` } as CSSProperties}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      <span className="bm-rim" />
      <span className="bm-face">
        <Icon size={Math.round(size * 0.42)} strokeWidth={2.2} />
      </span>
      {tier >= 3 ? <span className="bm-shine" /> : null}
    </span>
  );
}
