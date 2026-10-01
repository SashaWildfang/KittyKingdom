"use client";

import {
  Activity,
  Ban,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Gamepad2,
  Globe2,
  Heart,
  Link2,
  Quote,
  HeartHandshake,
  HeartOff,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  MoreHorizontal,
  PenLine,
  Settings2,
  Sparkles,
  ThumbsDown,
  Timer,
  TriangleAlert,
  Undo2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  Wind,
  Wine,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { BadgeEarned } from "../../lib/badge-history";
import type { BadgeShowcase } from "../../lib/badges";
import { ShowcaseBadges } from "../account/badge-tip";
import { BrandIcon } from "./brand-icons";
import { SectionIcon, TierIcon } from "./icons";
import { Empty, Photo, ReportButton, ago, cropStyle, post, useApi, type Crop } from "./ui";

type View = {
  id: string;
  name: string;
  discordName: string | null;
  avatar: string | null;
  inServer: boolean;
  partners: { id: string; name: string; avatar: string | null; hasProfile: boolean }[];
  age: number | null;
  headline: string | null;
  accent: string;
  banner: string | null;
  bannerY: number;
  photos: { url: string; caption: string | null; crop: Crop | null }[];
  facts: { label: string; value: string; key: string }[];
  sections: { id: string; label: string; items: { key: string; label: string; value: string; legacy: boolean; long: boolean; href: string | null }[] }[];
  prompts: { q: string; a: string }[];
  fursonas: { name: string; description: string; art_links: string[] }[];
  lookingFor: { open: boolean; genders: string[]; relTypes: string[]; ages: string | null };
  lastActive: string | null;
  strength: number;
  paused: boolean;
  isNew: boolean;
  badges: { showcase: BadgeShowcase; earned: Record<string, BadgeEarned> } | null;
};
type Compat = { partnered?: boolean; score: number; tier: string; parts: Record<string, number | null>; pairs: { a: string; b: string }[]; agreements: string[]; conflicts: string[]; blocked: string | null; starter: string; ai: boolean };
type Views = { total: number; week: number; theyViewedMe: string | null; iViewedBefore: boolean } | null;
type Relation = { iLiked: boolean; likesMe: boolean; match: boolean; friend: "none" | "friends" | "sent" | "received"; blockedByMe: boolean; passed: boolean };
type Data = { own: boolean; profile: View; compat: Compat | null; views: Views; relation: Relation };

const PART_LABELS: Record<string, [string, LucideIcon]> = {
  interests: ["Interests", Gamepad2],
  lifestyle: ["Lifestyle", Moon],
  logistics: ["Distance & time", Globe2],
  vices: ["Habits", Wine],
  independence: ["Independence", Wind],
  completeness: ["Their profile", FileText],
  recency: ["Recently active", Timer],
};
const FACT_ICONS: Record<string, LucideIcon> = { gender: UserRound, pronouns: UserRound, sexuality: Sparkles, location: MapPin, timezone: Clock, relationship_status: HeartHandshake };
// The matcher prefixes agreements with an emoji; the list already has its own icon
/** Dark or light text, whichever reads better on the member's color. */
const inkFor = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? "#1d0f08" : "#ffffff";
};
const noEmoji = (t: string) => t.replace(/^[^A-Za-z0-9(]+/, "");
const photoId = (url: string) => url.match(/\/media\/([a-f0-9]{24})\./)?.[1];
const isImage = (l: string) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(l) || l.startsWith("/api/dating/media/");

function Gallery({ photos, name, owner }: { photos: View["photos"]; name: string; owner: string }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      if (e.key === "ArrowRight") setI((x) => (x + 1) % photos.length);
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, photos.length]);
  if (!photos.length) return null;
  const p = photos[Math.min(i, photos.length - 1)];
  const pid = photoId(p.url);
  return (
    <div className="dt-gallery">
      <button type="button" className="dt-gallery-main" onClick={() => setZoom(true)} aria-label="View photo larger">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt={p.caption ?? `${name}'s photo`} style={cropStyle(p.crop)} />
        {p.caption ? <span className="dt-gallery-caption">{p.caption}</span> : null}
      </button>
      {photos.length > 1 ? (
        <>
          <button type="button" className="dt-gallery-nav is-prev" onClick={() => setI((x) => (x - 1 + photos.length) % photos.length)} aria-label="Previous photo">
            <ChevronLeft size={20} />
          </button>
          <button type="button" className="dt-gallery-nav is-next" onClick={() => setI((x) => (x + 1) % photos.length)} aria-label="Next photo">
            <ChevronRight size={20} />
          </button>
          <div className="dt-gallery-dots">
            {photos.map((ph, n) => (
              <button key={ph.url} type="button" className={n === i ? "is-on" : undefined} onClick={() => setI(n)} aria-label={`Photo ${n + 1}`} />
            ))}
          </div>
        </>
      ) : null}
      {pid ? (
        <div className="dt-gallery-report">
          <ReportButton target={owner} type="photo" photoId={pid} label="Report photo" small />
        </div>
      ) : null}
      {/* On <body> so it sits above every card (the columns create their own layers) */}
      {zoom
        ? createPortal(
            <div className="dt-lightbox" onClick={() => setZoom(false)} role="dialog" aria-modal="true" aria-label="Photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? ""} onClick={(e) => e.stopPropagation()} />
              {photos.length > 1 ? (
                <>
                  <button type="button" className="dt-gallery-nav is-prev" onClick={(e) => (e.stopPropagation(), setI((x) => (x - 1 + photos.length) % photos.length))} aria-label="Previous photo">
                    <ChevronLeft size={22} />
                  </button>
                  <button type="button" className="dt-gallery-nav is-next" onClick={(e) => (e.stopPropagation(), setI((x) => (x + 1) % photos.length))} aria-label="Next photo">
                    <ChevronRight size={22} />
                  </button>
                  <span className="dt-lightbox-count">
                    {Math.min(i, photos.length - 1) + 1} / {photos.length}
                  </span>
                </>
              ) : null}
              <button type="button" className="dt-modal-close" aria-label="Close">
                <X size={20} />
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Socials and gaming tags as logo chips: links open the site; IDs (friend codes, gamertags) copy. */
function SocialChips({ items }: { items: { key: string; label: string; value: string; href: string | null }[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  // A pasted link shows as just the handle (steamcommunity.com/id/kitty -> kitty)
  const shown = (v: string) => (/^https?:\/\//.test(v) ? v.replace(/^https?:\/\/(www\.)?[^/]+\/((id|profiles|user)\/)?/, "").replace(/\/+$/, "") || v : v);
  return (
    <div className="dt-socials">
      {items.map((it) =>
        it.href ? (
          <a key={it.key} className={`dt-social-chip is-${it.key}`} href={it.href} target="_blank" rel="noopener noreferrer nofollow" title={`${it.label}: ${shown(it.value)}`}>
            <BrandIcon k={it.key} size={17} />
            <span className="dt-sr">{`${it.label}: ${shown(it.value)}`}</span>
          </a>
        ) : (
          <button
            key={it.key}
            type="button"
            className={`dt-social-chip is-${it.key}`}
            title={`${it.label}: ${it.value} (click to copy)`}
            onClick={() => {
              void navigator.clipboard?.writeText(it.value).then(() => {
                setCopied(it.key);
                window.setTimeout(() => setCopied(null), 1500);
              });
            }}
          >
            {copied === it.key ? <Check size={17} aria-hidden="true" /> : <BrandIcon k={it.key} size={17} />}
            <span className="dt-sr">{`${it.label}: ${it.value}`}</span>
          </button>
        ),
      )}
    </div>
  );
}

/** A fursona with its art as a gallery (click to view full size, arrows between pieces). */
function FursonaCard({ sona }: { sona: View["fursonas"][number] }) {
  const images = sona.art_links.filter(isImage);
  const links = sona.art_links.filter((l) => !isImage(l));
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % images.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length]);
  const [main, ...more] = images;
  return (
    <article className={`dt-sona${main ? " has-art" : ""}`}>
      {main ? (
        <div className="dt-sona-art">
          <button type="button" className="dt-sona-main" onClick={() => setOpen(0)} aria-label={`View ${sona.name} art`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={main} alt="" loading="lazy" referrerPolicy="no-referrer" />
          </button>
          {more.length ? (
            <div className="dt-sona-thumbs">
              {more.slice(0, 4).map((l, i) => (
                <button key={l} type="button" onClick={() => setOpen(i + 1)} aria-label={`View ${sona.name} art ${i + 2}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  {i === 3 && more.length > 4 ? <span className="dt-sona-more">+{more.length - 4}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="dt-sona-text">
        <b>{sona.name}</b>
        {sona.description ? <p>{sona.description}</p> : null}
        {images.length ? (
          <small className="dt-muted">
            {images.length} piece{images.length === 1 ? "" : "s"} of art · click to view
          </small>
        ) : null}
        {links.length ? (
          <div className="dt-sona-links">
            {links.map((l) => (
              <a key={l} href={l} target="_blank" rel="noopener noreferrer nofollow">
                <Link2 size={13} aria-hidden="true" /> {l.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      {open !== null
        ? createPortal(
            <div className="dt-lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={`${sona.name} art`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[open]} alt="" referrerPolicy="no-referrer" onClick={(e) => e.stopPropagation()} />
              {images.length > 1 ? (
                <>
                  <button type="button" className="dt-gallery-nav is-prev" onClick={(e) => (e.stopPropagation(), setOpen((open - 1 + images.length) % images.length))} aria-label="Previous">
                    <ChevronLeft size={22} />
                  </button>
                  <button type="button" className="dt-gallery-nav is-next" onClick={(e) => (e.stopPropagation(), setOpen((open + 1) % images.length))} aria-label="Next">
                    <ChevronRight size={22} />
                  </button>
                  <span className="dt-lightbox-count">
                    {open + 1} / {images.length}
                  </span>
                </>
              ) : null}
              <button type="button" className="dt-modal-close" aria-label="Close">
                <X size={20} />
              </button>
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}

/** A member's full profile (also what "My profile" shows you about yourself). */
export function ProfileScreen({ id }: { id: string }) {
  const { data, error, reload } = useApi<Data>(`/api/dating/users/${id}`);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 4000);
    return () => window.clearTimeout(t);
  }, [note]);
  // Close the "more" menu when clicking elsewhere
  useEffect(() => {
    if (!menu) return;
    // Clicks inside a window opened from the menu (like Report) don't count as "elsewhere"
    const close = (e: MouseEvent) => !(e.target as HTMLElement).closest(".dt-more, .dt-modal-backdrop") && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  if (error)
    return (
      <Empty icon={<TriangleAlert size={28} />} title="Profile not available">
        <p>{error}</p>
        <a className="dt-btn" href="/social/browse">
          Back to Browse
        </a>
      </Empty>
    );
  if (!data) return <div className="dt-loading dt-loading--tall" aria-busy="true" />;
  const { profile: p, compat: c, relation: r, views: v } = data;
  // Orientations rule dating out completely (they can still be friends)
  const noDating = Boolean(c && !c.partnered && c.blocked && /orientation/i.test(c.blocked));

  const act = async (action: string, done?: string) => {
    setBusy(true);
    const res = await post<{ mutual?: boolean }>("/api/dating/actions", { action, target: p.id });
    setBusy(false);
    setMenu(false);
    if (!res.ok) return setNote(res.error ?? "That didn't work.");
    setNote(res.mutual ? `It's a match with ${p.name}! Say hi in Messages.` : done ?? null);
    await reload();
  };

  const active = ago(p.lastActive);
  const cover = p.photos[0]?.url ?? p.avatar;
  const coverCrop = p.photos[0]?.crop ?? null;
  const facts = p.facts.map((f) => ({ ...f, Icon: FACT_ICONS[f.key] ?? Sparkles }));
  // Socials and gaming tags live in the header; everything else goes in the columns
  const socials = p.sections.filter((s) => s.id === "socials" || s.id === "gaming").flatMap((s) => s.items);
  const sections = p.sections.filter((s) => s.id !== "socials" && s.id !== "gaming");

  return (
    <div className="dt-profile dt-profile--v2" style={{ "--acc": p.accent, "--acc-ink": inkFor(p.accent) } as CSSProperties}>
      {data.own ? (
        <div className="dt-banner dt-banner--soft">
          <Eye size={16} aria-hidden="true" />
          <span>This is your profile, exactly as other members see it.</span>
        </div>
      ) : null}
      {r.blockedByMe ? (
        <div className="dt-banner dt-banner--warn">
          <Ban size={16} aria-hidden="true" />
          <span>You blocked {p.name}. They can&apos;t see you or message you.</span>
          <button type="button" className="dt-btn dt-btn--small" disabled={busy} onClick={() => void act("unblock", "Unblocked.")}>
            Unblock
          </button>
        </div>
      ) : null}

      {/* Header card */}
      <header className="dt-hero">
        <div
          className={`dt-hero-cover${p.banner ? " has-banner" : " dt-banner-default"}`}
          style={p.banner ? { backgroundImage: `url(${p.banner})`, backgroundPosition: `center ${p.bannerY}%` } : undefined}
          aria-hidden="true"
        />
        <div className="dt-hero-body">
          <div className="dt-hero-side">
            <div className="dt-hero-photo">
              <Photo src={cover} name={p.name} accent={p.accent} crop={coverCrop} />
              {active === "online now" ? <span className="dt-face-dot" title="Online now" /> : null}
            </div>
            {socials.length ? <SocialChips items={socials} /> : null}
            {/* Their badge title and pinned badges from the website (hover for details) */}
            {p.badges ? <ShowcaseBadges showcase={p.badges.showcase} earned={p.badges.earned} size={34} className="dt-hero-showcase" /> : null}
          </div>
          <div className="dt-hero-info">
            <h1>
              {p.name}
              {p.age ? <span>, {p.age}</span> : null}
              {p.isNew ? <span className="dt-new">New</span> : null}
            </h1>
            {p.headline ? <p className="dt-headline">{p.headline}</p> : null}
            {p.discordName ? <p className="dt-muted dt-hero-handle">@{p.discordName}</p> : null}
            <ul className="dt-hero-facts">
              {facts.map((f) => (
                <li key={f.key} title={f.label} className={`is-${f.key}`}>
                  <f.Icon size={14} aria-hidden="true" /> {f.value}
                </li>
              ))}
              {active ? (
                <li className={`is-active${active === "online now" ? " is-online" : ""}`}>
                  <Activity size={14} aria-hidden="true" /> {active}
                </li>
              ) : null}
            </ul>
            <div className="dt-hero-badges">
              {r.match ? (
                <span className="dt-badge dt-badge--match">
                  <HeartHandshake size={12} aria-hidden="true" /> You matched
                </span>
              ) : r.likesMe ? (
                <span className="dt-badge dt-badge--match">
                  <Mail size={12} aria-hidden="true" /> Likes you
                </span>
              ) : null}
              {!p.lookingFor.open ? (
                <span className="dt-badge">
                  <Users size={12} aria-hidden="true" /> Here for friends
                </span>
              ) : null}
              {!p.inServer ? (
                <span className="dt-badge dt-badge--muted" title="They left the Discord server but kept their profile">
                  Left the server
                </span>
              ) : null}
              {p.paused ? <span className="dt-badge dt-badge--muted">Paused</span> : null}
              {v && v.total >= 0 ? (
                <span className="dt-badge dt-badge--muted" title={`${v.week} this week`}>
                  <Eye size={12} aria-hidden="true" /> {v.total} view{v.total === 1 ? "" : "s"}
                </span>
              ) : null}
              {v && !data.own ? (
                v.theyViewedMe ? (
                  <span className="dt-badge dt-badge--seen">
                    <Eye size={12} aria-hidden="true" /> Viewed your profile {ago(v.theyViewedMe)?.replace("active ", "").replace("online now", "just now")}
                  </span>
                ) : (
                  <span className="dt-badge dt-badge--muted">
                    <EyeOff size={12} aria-hidden="true" /> Hasn&apos;t viewed your profile
                  </span>
                )
              ) : null}
            </div>
            {p.partners.length ? (
              <div className="dt-partners">
                <span>
                  <HeartHandshake size={14} aria-hidden="true" /> {p.partners.length === 1 ? "Partner" : "Partners"}
                </span>
                {p.partners.map((pt) =>
                  pt.hasProfile ? (
                    <a key={pt.id} href={`/social/u/${pt.id}`} className="dt-partner-chip">
                      <Photo src={pt.avatar} name={pt.name} accent={p.accent} />
                      {pt.name}
                    </a>
                  ) : (
                    <span key={pt.id} className="dt-partner-chip">
                      <Photo src={pt.avatar} name={pt.name} accent={p.accent} />
                      {pt.name}
                    </span>
                  ),
                )}
              </div>
            ) : null}
          </div>

          {data.own ? (
            <div className="dt-hero-actions">
              <a className="dt-btn" href="/social/profile/edit">
                <PenLine size={15} aria-hidden="true" /> Edit profile
              </a>
              <a className="dt-btn dt-btn--ghost" href="/settings">
                <Settings2 size={15} aria-hidden="true" /> Settings
              </a>
            </div>
          ) : null}
          {!data.own && !r.blockedByMe ? (
            <div className="dt-hero-actions">
              {r.iLiked ? (
                <button type="button" className="dt-btn dt-btn--liked" disabled={busy} onClick={() => void act("unlike", "Like removed.")} title="Click to unlike">
                  <Heart size={15} fill="currentColor" aria-hidden="true" /> {r.match ? "Matched" : "Liked"}
                </button>
              ) : (
                <button type="button" className="dt-btn dt-btn--like" disabled={busy} onClick={() => void act("like", `You liked ${p.name}.`)}>
                  <Heart size={15} aria-hidden="true" /> {r.likesMe ? "Like back" : "Like"}
                </button>
              )}
              <a className="dt-btn" href={`/social/messages/${p.id}`}>
                <MessageCircle size={15} aria-hidden="true" /> Message
              </a>
              {r.friend === "friends" ? (
                <span className="dt-btn dt-btn--friends" title="You're friends">
                  <Check size={15} aria-hidden="true" /> Friends
                </span>
              ) : r.friend === "received" ? (
                <button type="button" className="dt-btn dt-btn--ghost" disabled={busy} onClick={() => void act("accept", "You're friends now!")}>
                  <UserCheck size={15} aria-hidden="true" /> Accept friend
                </button>
              ) : r.friend === "sent" ? (
                <button type="button" className="dt-btn dt-btn--ghost" disabled={busy} onClick={() => void act("unfriend", "Request cancelled.")} title="Click to cancel">
                  <Clock size={15} aria-hidden="true" /> Request sent
                </button>
              ) : (
                <button type="button" className="dt-btn dt-btn--ghost" disabled={busy} onClick={() => void act("friend", "Friend request sent.")}>
                  <UserPlus size={15} aria-hidden="true" /> Add friend
                </button>
              )}
              <div className="dt-more">
                <button type="button" className="dt-btn dt-btn--ghost dt-btn--icon" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="More">
                  <MoreHorizontal size={16} />
                </button>
                {menu ? (
                  <div className="dt-menu" role="menu">
                    {r.passed ? (
                      <button type="button" role="menuitem" onClick={() => void act("unpass", "They'll show in Discover again.")}>
                        <Undo2 size={14} aria-hidden="true" /> Undo "Not for me"
                      </button>
                    ) : !r.iLiked && !r.match ? (
                      <button type="button" role="menuitem" onClick={() => void act("pass", "Passed. They won't show in Discover.")}>
                        <ThumbsDown size={14} aria-hidden="true" /> Not for me
                      </button>
                    ) : null}
                    {r.friend === "friends" ? (
                      <button type="button" role="menuitem" onClick={() => void act("unfriend", "Removed from friends.")}>
                        <UserMinus size={14} aria-hidden="true" /> Remove friend
                      </button>
                    ) : null}
                    {r.friend === "received" ? (
                      <button type="button" role="menuitem" onClick={() => void act("decline", "Request declined.")}>
                        <X size={14} aria-hidden="true" /> Decline friend request
                      </button>
                    ) : null}
                    <button type="button" role="menuitem" className="is-danger" onClick={() => setConfirmBlock(true)}>
                      <Ban size={14} aria-hidden="true" /> Block
                    </button>
                    <ReportButton target={p.id} label="Report profile" />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className="dt-profile-grid">
        <div className="dt-profile-left">
          {p.photos.length ? <Gallery photos={p.photos} name={p.name} owner={p.id} /> : null}

          {c && !data.own ? (
            <section className="dt-card dt-compat">
              <header>
                {/* Orientations rule out dating entirely: no match percentage, just a clear no */}
                <div className={`dt-ring dt-ring--big${noDating ? " is-none" : ""}`} style={{ "--p": noDating ? 0 : c.score } as CSSProperties}>
                  <b>{noDating ? "—" : `${c.score}%`}</b>
                </div>
                <div>
                  {c.partnered ? (
                    <>
                      <b className="dt-h-icon">
                        <HeartHandshake size={16} aria-hidden="true" /> You&apos;re partners
                      </b>
                      <small className="dt-muted">Linked and confirmed. Here&apos;s what you two share.</small>
                    </>
                  ) : (
                    <>
                      <b className="dt-h-icon">
                        <TierIcon score={c.score} fit={!c.blocked} size={16} /> {noDating ? "Not a dating match" : c.blocked ? "Friendly fit" : `${c.tier} match`}
                      </b>
                      {noDating ? (
                        <small className="dt-muted">
                          {c.blocked}. As friends you&apos;d get along {c.score}%.
                        </small>
                      ) : (
                        <>
                          <small className="dt-muted">{c.ai ? "Matched by meaning with our AI" : "Matched on shared words"}</small>
                          {c.blocked ? <small className="dt-muted">Not a dating fit: {c.blocked}</small> : null}
                        </>
                      )}
                    </>
                  )}
                </div>
              </header>
              <div className="dt-bars">
                {Object.entries(c.parts)
                  .filter(([, val]) => val !== null)
                  .map(([k, val]) => {
                    const [label, Icon] = PART_LABELS[k] ?? [k, BarChart3];
                    return (
                      <div key={k} className="dt-bar">
                        <span>
                          <Icon size={13} aria-hidden="true" /> {label}
                        </span>
                        <span className="dt-bar-track">
                          <span style={{ width: `${Math.round((val as number) * 100)}%` }} />
                        </span>
                        <small>{Math.round((val as number) * 100)}</small>
                      </div>
                    );
                  })}
              </div>
              {c.pairs.length ? (
                <div>
                  <small className="dt-label">You both like</small>
                  <div className="dt-tags">
                    {c.pairs.map((x) => (
                      <span key={`${x.a}-${x.b}`}>{x.a === x.b ? x.a : `${x.a} ↔ ${x.b}`}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {c.agreements.length ? (
                <ul className="dt-list dt-list--good">
                  {c.agreements.map((a) => (
                    <li key={a}>
                      <Check size={13} aria-hidden="true" /> {noEmoji(a)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {c.conflicts.length ? (
                <ul className="dt-list dt-list--bad">
                  {c.conflicts.map((a) => (
                    <li key={a}>
                      <TriangleAlert size={13} aria-hidden="true" /> {noEmoji(a)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="dt-starter">
                <MessageCircle size={14} aria-hidden="true" /> {c.starter}
              </p>
            </section>
          ) : null}
        </div>

        <div className="dt-profile-main">
          {p.prompts.length ? (
            <div className="dt-prompt-row" data-count={p.prompts.length}>
              {p.prompts.map((pr) => (
                <blockquote key={pr.q} className="dt-prompt">
                  <Quote size={18} aria-hidden="true" className="dt-prompt-mark" />
                  <small>{pr.q}</small>
                  <p>{pr.a}</p>
                </blockquote>
              ))}
            </div>
          ) : null}


          <div className="dt-masonry">
            {/* Each fursona gets its own card, first in the columns */}
            {p.fursonas.map((f, n) => (
              <section key={`${f.name}-${n}`} className="dt-card dt-sonas-card">
                <h3 className="dt-h-icon">
                  <SectionIcon id="fursonas" /> Fursona
                </h3>
                <FursonaCard sona={f} />
              </section>
            ))}
            <section className="dt-card">
              <h3 className="dt-h-icon">
                <SectionIcon id="targets" /> Looking for
              </h3>
              {p.lookingFor.open ? (
                <div className="dt-facts">
                  {p.lookingFor.genders.length ? (
                    <div>
                      <small>Into</small>
                      <b>{p.lookingFor.genders.join(", ")}</b>
                    </div>
                  ) : null}
                  {p.lookingFor.ages ? (
                    <div>
                      <small>Ages</small>
                      <b>{p.lookingFor.ages}</b>
                    </div>
                  ) : null}
                  {p.lookingFor.relTypes.length ? (
                    <div>
                      <small>Relationship</small>
                      <b>{p.lookingFor.relTypes.join(", ")}</b>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="dt-muted">Not looking to date right now. Here for friends.</p>
              )}
            </section>

            {sections.map((s) => (
              <section key={s.id} className="dt-card">
                <h3 className="dt-h-icon">
                  <SectionIcon id={s.id} /> {s.label}
                </h3>
                <div className="dt-fields">
                  {s.items.map((it) => (
                    <div key={it.key} className={it.long ? "is-long" : undefined}>
                      <small>{it.label}</small>
                      {it.href ? (
                        <p>
                          <a className="dt-social" href={it.href} target="_blank" rel="noopener noreferrer nofollow">
                            {it.value}
                          </a>
                        </p>
                      ) : (
                        <p>{it.value}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

        </div>
      </div>

      {confirmBlock ? (
        <div className="dt-modal-backdrop" onClick={() => setConfirmBlock(false)}>
          <div className="dt-modal" role="dialog" aria-modal="true" aria-label="Block" onClick={(e) => e.stopPropagation()}>
            <h3>Block {p.name}?</h3>
            <p className="dt-muted">
              They won&apos;t see your profile or be able to message you, and any likes, match or friendship between you is removed. They aren&apos;t told. You can
              unblock later from Settings → Hidden profiles.
            </p>
            <div className="dt-row">
              <button
                type="button"
                className="dt-btn dt-btn--danger"
                disabled={busy}
                onClick={async () => {
                  setConfirmBlock(false);
                  await act("block", `${p.name} is blocked.`);
                }}
              >
                Block
              </button>
              <button type="button" className="dt-btn dt-btn--ghost" onClick={() => setConfirmBlock(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {note ? (
        <div className="dt-toast" role="status">
          {note}
        </div>
      ) : null}
    </div>
  );
}
