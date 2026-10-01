"use client";

// Shared pieces for the Dating pages: data loading, profile cards, option chips, avatars and the
// report dialog. Keeping them here keeps every page consistent and easy to extend.

import { FlairName } from "../cosmetic-flair";
import { Flag, Heart, HeartHandshake, MapPin, Sparkles, Users, X } from "lucide-react";
import { Score } from "./icons";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type Card = {
  id: string;
  name: string;
  age: number | null;
  headline: string | null;
  photo: string | null;
  photoCount: number;
  photoCrop?: Crop | null;
  accent: string;
  location: string | null;
  gender: string | null;
  pronouns: string | null;
  lookingFor: string | null;
  bio: string;
  score: number | null;
  tier: string | null;
  emoji: string | null;
  shared: string[];
  datingFit: boolean;
  lastActive: string | null;
  isNew: boolean;
  liked: boolean;
  inServer: boolean;
  openToDating: boolean;
  username?: string | null;
  online?: boolean;
  partnered?: boolean;
  myPartner?: boolean;
  spotlight?: boolean;
  flair?: { frame: string | null; banner: string | null; nameplate: string | null } | null;
};

/** GET a dating API route; `reload()` fetches again. */
export function useApi<T>(url: string | null, refreshMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body.ok) setError(body.error ?? "Something went wrong.");
      else {
        setData(body as T);
        setError(null);
      }
    } catch {
      setError("Couldn't reach the site. Check your connection.");
    }
  }, [url]);
  useEffect(() => {
    void load();
    if (!refreshMs) return;
    const t = window.setInterval(() => document.visibilityState === "visible" && void load(), refreshMs);
    return () => window.clearInterval(t);
  }, [load, refreshMs]);
  return { data, error, reload: load, setData };
}

export async function post<T = Record<string, unknown>>(url: string, body: unknown, method = "POST"): Promise<{ ok: boolean; error?: string } & T> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await res.json();
  } catch {
    return { ok: false, error: "Couldn't reach the site." } as { ok: boolean; error?: string } & T;
  }
}

export function ago(iso: string | null) {
  if (!iso) return null;
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 5) return "online now";
  if (m < 60) return `active ${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `active ${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `active ${d}d ago` : "active a while ago";
}

export type Crop = { x: number; y: number; z: number };

/** Styles that frame a photo the way its owner adjusted it (focus point + zoom). */
export function cropStyle(crop: Crop | null | undefined): CSSProperties | undefined {
  if (!crop) return undefined;
  return { objectPosition: `${crop.x}% ${crop.y}%`, transform: crop.z > 1 ? `scale(${crop.z})` : undefined, transformOrigin: `${crop.x}% ${crop.y}%` };
}

/** A photo, or a soft gradient with their initial in their accent color. */
export function Photo({ src, name, accent, className = "", crop }: { src: string | null; name: string; accent: string; className?: string; crop?: Crop | null }) {
  // One quiet retry before falling back (a busy first load can fail a request or two)
  const [tries, setTries] = useState(0);
  useEffect(() => {
    setTries(0);
  }, [src]);
  if (src && tries < 2) {
    const url = tries ? `${src}${src.includes("?") ? "&" : "?"}retry=1` : src;
    // Zoomed photos get a clipping frame so the zoom stays inside their box
    if (crop && crop.z > 1) {
      return (
        <span className={`dt-photo dt-photo-frame ${className}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={cropStyle(crop)} onError={() => window.setTimeout(() => setTries((t) => t + 1), tries ? 0 : 900)} />
        </span>
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`dt-photo ${className}`}
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        style={cropStyle(crop)}
        onError={() => window.setTimeout(() => setTries((t) => t + 1), tries ? 0 : 900)}
      />
    );
  }
  return (
    <span className={`dt-photo dt-photo--empty ${className}`} style={{ "--acc": accent } as CSSProperties} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** A profile in a grid: photo, name, age, match score, what you share. */
export function ProfileTile({ card, extra, onLike }: { card: Card; extra?: ReactNode; onLike?: (c: Card) => void }) {
  const active = ago(card.lastActive);
  return (
    <article className={`dt-tile${card.spotlight ? " is-spotlight" : ""}${card.flair?.frame ? ` cos-tile cos-tile--${card.flair.frame}` : ""}`} style={{ "--acc": card.accent } as CSSProperties}>
      {card.spotlight ? (
        <span className="dt-spotlight-ribbon">
          <Sparkles size={11} aria-hidden="true" /> Spotlight
        </span>
      ) : null}
      <a href={`/social/u/${card.id}`} className="dt-tile-link" aria-label={`Open ${card.name}'s profile`}>
        <Photo src={card.photo} name={card.name} accent={card.accent} className="dt-tile-photo" crop={card.photoCrop} />
        <span className="dt-tile-badges">
          {card.score !== null ? (
            <span className={`dt-score${card.datingFit ? "" : " is-friendly"}`} title={card.datingFit ? `${card.tier} match` : "Compatibility (not a dating fit on preferences)"}>
              <Score score={card.score} fit={card.datingFit} size={12} />
            </span>
          ) : null}
          {card.isNew ? <span className="dt-new">New</span> : null}
        </span>
        <span className="dt-tile-tags">
          {!card.openToDating ? (
            <span className="dt-chip-mini is-friends">
              <Users size={10} aria-hidden="true" /> Friends
            </span>
          ) : null}
          {card.myPartner ? (
            <span className="dt-chip-mini is-partner">
              <HeartHandshake size={10} aria-hidden="true" /> Your partner
            </span>
          ) : card.partnered ? (
            <span className="dt-chip-mini is-partner" title="Has a linked partner">
              <HeartHandshake size={10} aria-hidden="true" /> Partnered
            </span>
          ) : null}
          {!card.inServer ? <span className="dt-chip-mini is-left">Left server</span> : null}
        </span>
        <span className="dt-tile-body">
          <b>
            <FlairName nameplate={card.flair?.nameplate} text={card.name}>
              {card.name}
            </FlairName>
            {card.age ? <span>, {card.age}</span> : null}
          </b>
          {card.headline ? <em>{card.headline}</em> : null}
          <small>
            {card.location ? (
              <>
                <MapPin size={11} aria-hidden="true" /> {card.location}
              </>
            ) : null}
            {active ? <span className={active === "online now" ? "is-online" : ""}>{card.location ? "· " : ""}{active}</span> : null}
          </small>
          {card.shared.length ? (
            <small className="dt-shared">
              <Sparkles size={11} aria-hidden="true" /> {card.shared.slice(0, 2).join(" · ")}
            </small>
          ) : null}
        </span>
      </a>
      {extra ?? (onLike ? (
        <button type="button" className={`dt-tile-like${card.liked ? " is-on" : ""}`} onClick={() => onLike(card)} aria-label={card.liked ? "Liked" : `Like ${card.name}`} disabled={card.liked}>
          <Heart size={16} fill={card.liked ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      ) : null)}
    </article>
  );
}

/** Tappable option chips for a choice (single) or multi field. */
export function Chips({ options, value, multi, onChange, max }: { options: { value: string; emoji?: string | null }[]; value: string | string[] | null; multi?: boolean; onChange: (v: string | string[] | null) => void; max?: number }) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  return (
    <div className="dt-chips" role={multi ? "group" : "radiogroup"}>
      {options.map((o) => {
        const on = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            className={on ? "is-on" : undefined}
            onClick={() => {
              if (!multi) return onChange(on ? null : o.value);
              const next = new Set(selected);
              if (on) next.delete(o.value);
              else {
                // "Everyone" / "Any" stand alone
                if (o.value === "Everyone" || o.value === "Any") next.clear();
                else {
                  next.delete("Everyone");
                  next.delete("Any");
                }
                if (max && next.size >= max) return;
                next.add(o.value);
              }
              onChange(Array.from(next));
            }}
          >
            {o.value}
          </button>
        );
      })}
    </div>
  );
}

export const REPORT_REASONS = ["Harassment or bullying", "Hate or slurs", "Spam or scam", "Underage", "Not SFW / explicit photo", "Fake or impersonation", "Threats or safety concern", "Something else"];

/** "Report" button + dialog. Only what's reported is shared with staff. */
export function ReportButton({ target, type = "profile", photoId, messageId, label = "Report", small }: { target: string; type?: "profile" | "photo" | "message"; photoId?: string; messageId?: string; label?: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className={`dt-btn dt-btn--ghost${small ? " dt-btn--small" : ""}`} onClick={() => setOpen(true)}>
        <Flag size={14} aria-hidden="true" /> {label}
      </button>
      {open
        ? createPortal(
        <div className="dt-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="dt-modal" role="dialog" aria-modal="true" aria-label="Report" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="dt-modal-close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={16} />
            </button>
            {done ? (
              <>
                <h3>Thanks for letting us know</h3>
                <p>{done}</p>
                <button type="button" className="dt-btn" onClick={() => setOpen(false)}>
                  Done
                </button>
              </>
            ) : (
              <>
                <h3>Report {type === "message" ? "this message" : type === "photo" ? "this photo" : "this profile"}</h3>
                <p className="dt-muted">Moderators see what you report{type === "message" ? " (this message and a couple around it)" : ""}. They won&apos;t be told who reported them.</p>
                <div className="dt-chips dt-chips--stack">
                  {REPORT_REASONS.map((r) => (
                    <button key={r} type="button" className={reason === r ? "is-on" : undefined} onClick={() => setReason(r)}>
                      {r}
                    </button>
                  ))}
                </div>
                <textarea className="dt-input" rows={3} maxLength={1000} placeholder="Anything staff should know? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
                <button
                  type="button"
                  className="dt-btn dt-btn--danger"
                  disabled={!reason || busy}
                  onClick={async () => {
                    setBusy(true);
                    const r = await post<{ message?: string }>("/api/dating/report", { type, target, reason, details, photoId, messageId });
                    setBusy(false);
                    setDone(r.ok ? r.message ?? "Staff will review it." : r.error ?? "That didn't work.");
                  }}
                >
                  Send report
                </button>
              </>
            )}
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="dt-empty">
      <span className="dt-empty-icon">{icon}</span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
