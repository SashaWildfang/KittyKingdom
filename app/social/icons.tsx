"use client";

// Icons for Social, matching the rest of the site (lucide line icons instead of emoji). Section ids
// come from the dating schema (lib/dating/schema-data.ts) plus the website's own editor sections.

import {
  AtSign,
  Baby,
  BookOpen,
  Camera,
  Cigarette,
  Clapperboard,
  Flag,
  Flame,
  Gamepad2,
  Handshake,
  Heart,
  HeartHandshake,
  Joystick,
  Lock,
  MapPin,
  MessageSquareQuote,
  Palette,
  PawPrint,
  PersonStanding,
  Plane,
  Sparkles,
  Star,
  Sun,
  ThumbsUp,
  Trash2,
  UserRound,
  Wine,
  type LucideIcon,
} from "lucide-react";

const SECTION: Record<string, LucideIcon> = {
  basics: UserRound,
  about: BookOpen,
  identity: Sparkles,
  physical: PersonStanding,
  logistics: MapPin,
  lifestyle: Sun,
  future: Baby,
  habits: Cigarette,
  targets: Heart,
  distance: Plane,
  vices: Wine,
  flags: Flag,
  interests: Gamepad2,
  media: Clapperboard,
  favorites: Star,
  socials: AtSign,
  gaming: Joystick,
  photos: Camera,
  looks: Palette,
  prompts: MessageSquareQuote,
  partners: HeartHandshake,
  fursonas: PawPrint,
  privacy: Lock,
  danger: Trash2,
};

export function SectionIcon({ id, size = 16 }: { id: string; size?: number }) {
  const Icon = SECTION[id] ?? Sparkles;
  return <Icon size={size} aria-hidden="true" className="dt-sicon" />;
}

/** The match-strength icon: a handshake when you'd get along but aren't a dating fit. */
export function TierIcon({ score, fit = true, size = 13 }: { score: number | null; fit?: boolean; size?: number }) {
  const Icon = !fit ? Handshake : (score ?? 0) >= 75 ? Flame : (score ?? 0) >= 60 ? Sparkles : ThumbsUp;
  return <Icon size={size} aria-hidden="true" />;
}

/** "81%" with its tier icon. */
export function Score({ score, fit = true, size = 13 }: { score: number | null; fit?: boolean; size?: number }) {
  if (score === null) return null;
  return (
    <>
      <TierIcon score={score} fit={fit} size={size} /> {score}%
    </>
  );
}
