"use client";

import { Sparkles } from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { BadgeEarned } from "../../lib/badge-history";
import { TIER_NAMES, badgeAbout, badgeById, type BadgeShape, type BadgeShowcase } from "../../lib/badges";
import type { CustomBadge, CustomTitle } from "../../lib/cosmetics";
import { BadgeMedal } from "./badge-medal";
import { useCurrency } from "../season-context";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function tierLabel(tiers: number[], tier: number) {
  if (!tier) return "Locked";
  return tiers.length === 1 ? "Special" : TIER_NAMES[Math.min(tier, 4) - 1];
}

/** "today", "yesterday" or "on Sep 29, 2026" (in the viewer's own calendar). */
function onDay(iso: string) {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(new Date(iso))) / 86_400_000);
  return diff === 0 ? "today" : diff === 1 ? "yesterday" : `on ${dateFmt.format(new Date(iso))}`;
}

/** "Earned today", "Reached Gold yesterday", "Earned on Sep 29, 2026". */
export function earnedText(earned: BadgeEarned | null | undefined, tiers: number[]) {
  if (!earned) return null;
  const when = onDay(earned.at);
  return tiers.length > 1 && earned.tier > 1 ? `Reached ${TIER_NAMES[Math.min(earned.tier, 4) - 1]} ${when}` : `Earned ${when}`;
}

/**
 * The hover/focus card for a badge or title. It's drawn at the page root and kept inside the window (above the
 * badge, or below it when there's no room), so it never runs off the screen or under the top bar.
 * With href, the badge is also a link (e.g. to your badge collection).
 */
function Tip({ label, hue, href, className, children, tip }: { label: string; hue: string | number; href?: string; className?: string; children: ReactNode; tip: ReactNode }) {
  const anchor = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current || !card.current) return setPos(null);
    const place = () => {
      if (!anchor.current || !card.current) return;
      const a = anchor.current.getBoundingClientRect();
      const c = card.current.getBoundingClientRect();
      const gap = 8;
      const margin = 10;
      const topBar = 76; // the site's sticky top bar
      const left = Math.min(Math.max(margin, a.left + a.width / 2 - c.width / 2), window.innerWidth - c.width - margin);
      const below = a.top - gap - c.height < topBar;
      setPos({ left, top: below ? a.bottom + gap : a.top - gap - c.height, below });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  const props = {
    className: `badge-tip-wrap${href ? " is-link" : ""} ${className ?? ""}`,
    "aria-label": label,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  };
  const floating =
    open && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={card}
            className={`badge-tip is-floating${pos?.below ? " is-below" : ""}`}
            role="tooltip"
            style={{ "--hue": hue, left: pos?.left ?? -9999, top: pos?.top ?? -9999, opacity: pos ? 1 : 0 } as CSSProperties}
          >
            {tip}
            {href ? <span className="badge-tip-go">Click to see your badges</span> : null}
          </span>,
          document.body,
        )
      : null;
  return href ? (
    <a href={href} ref={(el) => void (anchor.current = el)} {...props}>
      {children}
      {floating}
    </a>
  ) : (
    <span tabIndex={0} ref={(el) => void (anchor.current = el)} {...props}>
      {children}
      {floating}
    </span>
  );
}

/** Hover (or focus) a badge to see what it is, its tier and when it was earned. */
export function BadgeTip({ id, tier, earned, children, className, href }: { id: string; tier: number; earned?: BadgeEarned | null; children: ReactNode; className?: string; href?: string }) {
  const cur = useCurrency();
  const def = badgeById(id);
  if (!def) return <>{children}</>;
  const when = earnedText(earned, def.tiers);
  const about = cur.text(badgeAbout(id));
  const name = cur.text(def.name);
  return (
    <Tip
      label={`${name}, ${tierLabel(def.tiers, tier)}. ${about}${when ? ` ${when}.` : ""}`}
      hue={def.hue}
      href={href}
      className={className}
      tip={
        <>
          <b>{name}</b>
          <span className={`badge-tip-tier badge-tip-tier--${def.tiers.length === 1 ? "special" : tier}`}>{tierLabel(def.tiers, tier)}</span>
          <span className="badge-tip-desc">{about}</span>
          {when ? <span className="badge-tip-when">{when}</span> : null}
        </>
      }
    >
      {children}
    </Tip>
  );
}

/** A badge a member designed themselves (store perk), with its tooltip. */
export function CustomBadgeMedal({ badge, size = 40, href }: { badge: CustomBadge; size?: number; href?: string }) {
  return (
    <Tip
      label={`${badge.name}, custom badge.${badge.desc ? ` ${badge.desc}` : ""}`}
      hue={badge.hue}
      href={href}
      tip={
        <>
          <b>{badge.name}</b>
          <span className="badge-tip-tier badge-tip-tier--special">Custom</span>
          {badge.desc ? <span className="badge-tip-desc">{badge.desc}</span> : null}
          <span className="badge-tip-when">One of a kind, designed by its owner</span>
        </>
      }
    >
      <BadgeMedal icon={badge.icon} shape={badge.shape as BadgeShape} hue={badge.hue} tier={4} size={size} />
    </Tip>
  );
}

/** A member's badge title and pinned badges (profile card, Social profiles), each with its tooltip. */
export function ShowcaseBadges({
  showcase,
  earned,
  size = 40,
  className,
  customTitle,
  customBadges,
  href,
}: {
  showcase: BadgeShowcase | null;
  earned?: Record<string, BadgeEarned>;
  size?: number;
  className?: string;
  /** From the store: a title they wrote (shown instead of a badge title) and badges they designed */
  customTitle?: CustomTitle | null;
  customBadges?: CustomBadge[];
  /** Makes each badge a link (My Account: your badge collection) */
  href?: string;
}) {
  const title = showcase?.title ? badgeById(showcase.title.id) : null;
  const pinned = (showcase?.pinned ?? []).map((p) => ({ def: badgeById(p.id), tier: p.tier })).filter((p) => p.def);
  const custom = customBadges ?? [];
  if (!title && !pinned.length && !customTitle && !custom.length) return null;
  return (
    <div className={`acct-badges-showcase ${className ?? ""}`}>
      {customTitle ? (
        <Tip
          label={`${customTitle.text}, custom title`}
          hue={customTitle.hue}
          href={href}
          tip={
            <>
              <b>{customTitle.text}</b>
              <span className="badge-tip-tier badge-tip-tier--special">Custom title</span>
              <span className="badge-tip-desc">Written by its owner with a Custom Title from the store.</span>
            </>
          }
        >
          <span className="st-title-pill acct-badge-title cos-title" style={{ "--hue": customTitle.hue } as CSSProperties}>
            <Sparkles size={12} aria-hidden="true" /> {customTitle.text}
          </span>
        </Tip>
      ) : title && showcase?.title ? (
        <BadgeTip id={title.id} tier={showcase.title.tier} earned={earned?.[title.id]} href={href}>
          <span className="st-title-pill acct-badge-title" style={{ "--hue": title.hue } as CSSProperties}>
            <Sparkles size={12} aria-hidden="true" /> {title.name}
          </span>
        </BadgeTip>
      ) : null}
      {pinned.length || custom.length ? (
        <div className="acct-pinned-badges">
          {pinned.map(({ def, tier }) => (
            <BadgeTip key={def!.id} id={def!.id} tier={tier} earned={earned?.[def!.id]} href={href}>
              <BadgeMedal icon={def!.icon} shape={def!.shape} hue={def!.hue} tier={tier} size={size} />
            </BadgeTip>
          ))}
          {custom.map((b) => (
            <CustomBadgeMedal key={b.id} badge={b} size={size} href={href} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
