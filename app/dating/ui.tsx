"use client";

// Shared pieces for the Dating pages: data loading, profile cards, option chips, avatars and the
// report dialog. Keeping them here keeps every page consistent and easy to extend.

import { Flag, Heart, MapPin, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";

export type Card = {
  id: string;
  name: string;
  age: number | null;
  headline: string | null;
  photo: string | null;
  photoCount: number;
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

/** A photo, or a soft gradient with their initial in their accent color. */
export function Photo({ src, name, accent, className = "" }: { src: string | null; name: string; accent: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`dt-photo ${className}`} src={src} alt="" loading="lazy" onError={() => setBroken(true)} />;
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
    <article className="dt-tile" style={{ "--acc": card.accent } as CSSProperties}>
      <a href={`/dating/u/${card.id}`} className="dt-tile-link" aria-label={`Open ${card.name}'s profile`}>
        <Photo src={card.photo} name={card.name} accent={card.accent} className="dt-tile-photo" />
        <span className="dt-tile-badges">
          {card.score !== null ? (
            <span className={`dt-score${card.datingFit ? "" : " is-friendly"}`} title={card.datingFit ? `${card.tier} match` : "Compatibility (not a dating fit on preferences)"}>
              {card.datingFit ? card.emoji : "🤝"} {card.score}%
            </span>
          ) : null}
          {card.isNew ? <span className="dt-new">New</span> : null}
        </span>
        <span className="dt-tile-body">
          <b>
            {card.name}
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
            {o.emoji ? <span aria-hidden="true">{o.emoji}</span> : null} {o.value}
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
      {open ? (
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
                <p className="dt-muted">Staff only see what you report{type === "message" ? " (this message and a couple around it)" : ""}. They won&apos;t be told who reported them.</p>
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
        </div>
      ) : null}
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
