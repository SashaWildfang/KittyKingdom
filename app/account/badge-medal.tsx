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
