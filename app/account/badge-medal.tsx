import {
  ArrowBigUp,
  ArrowLeftRight,
  AtSign,
  AudioLines,
  BarChart3,
  Cake,
  CalendarCheck,
  CalendarHeart,
  Camera,
  Candy,
  Castle,
  Clapperboard,
  Clover,
  Compass,
  Crown,
  Diamond,
  Dices,
  Eraser,
  Flame,
  Flower2,
  Gauge,
  Gem,
  Ghost,
  Gift,
  Globe,
  Grid3x3,
  Hand,
  HandHeart,
  Headphones,
  Heart,
  HeartHandshake,
  HeartPulse,
  HelpCircle,
  Hourglass,
  Laugh,
  Leaf,
  Library,
  Lightbulb,
  Link,
  Link2,
  Lock,
  MailCheck,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Mic,
  MonitorUp,
  Moon,
  MoonStar,
  MousePointerClick,
  Music,
  Network,
  Package,
  PartyPopper,
  PenLine,
  Pin,
  Rabbit,
  Radio,
  Rainbow,
  Repeat,
  Reply,
  Rocket,
  ScrollText,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Skull,
  Smile,
  Snowflake,
  Sofa,
  Star,
  Sticker,
  Sun,
  Sunrise,
  Target,
  Terminal,
  Timer,
  TreePine,
  TrendingUp,
  Type,
  Users,
  Video,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { BadgeShape } from "../../lib/badges";

const ICONS: Record<string, LucideIcon> = {
  ArrowBigUp, ArrowLeftRight, AtSign, AudioLines, BarChart3, Cake, CalendarCheck, CalendarHeart, Camera, Candy, Castle, Clapperboard, Clover, Compass, Crown, Diamond, Dices, Eraser, Flame, Flower2, Gauge, Gem, Ghost, Gift, Globe, Grid3x3, Hand, HandHeart, Headphones, Heart, HeartHandshake, HeartPulse, HelpCircle, Hourglass, Laugh, Leaf, Library, Lightbulb, Link, Link2, Lock, MailCheck, Megaphone, MessageCircle, MessagesSquare, Mic, MonitorUp, Moon, MoonStar, MousePointerClick, Music, Network, Package, PartyPopper, PenLine, Pin, Rabbit, Radio, Rainbow, Repeat, Reply, Rocket, ScrollText, Share2, ShieldCheck, ShoppingBag, ShoppingCart, Skull, Smile, Snowflake, Sofa, Star, Sticker, Sun, Sunrise, Target, Terminal, Timer, TreePine, TrendingUp, Type, Users, Video, Wand2, Zap,
};

// How big the icon is (share of the medal) and how far to nudge it down (share of the medal),
// so it sits in the visual middle of each shape rather than the middle of its box
const ICON_FIT: Record<BadgeShape, { scale: number; dy: number }> = {
  circle: { scale: 0.42, dy: 0 },
  squircle: { scale: 0.42, dy: 0 },
  hex: { scale: 0.4, dy: 0 },
  octagon: { scale: 0.4, dy: 0 },
  burst: { scale: 0.34, dy: 0 },
  diamond: { scale: 0.3, dy: 0 },
  shield: { scale: 0.36, dy: -0.06 },
  star: { scale: 0.29, dy: 0.04 },
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
  const fit = ICON_FIT[shape] ?? ICON_FIT.circle;
  return (
    <span
      className={`bm bm--${shape} bm--t${tier}`}
      style={{ "--hue": hue, "--size": `${size}px` } as CSSProperties}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      <span className="bm-rim" />
      <span className="bm-face">
        <Icon
          size={Math.max(10, Math.round(size * fit.scale))}
          strokeWidth={size < 40 ? 2.4 : 2.2}
          style={fit.dy ? { transform: `translateY(${Math.round(size * fit.dy * 10) / 10}px)` } : undefined}
        />
      </span>
      {tier >= 3 ? <span className="bm-shine" /> : null}
    </span>
  );
}
