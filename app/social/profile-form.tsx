"use client";

// Form pieces shared by the profile editor and the setup wizard. Every field is drawn from the
// bot's schema (lib/dating/schema-data.ts), so adding a field there makes it appear here.

import { ArrowLeft, ArrowRight, ImagePlus, Link2, Loader2, Minus, Move, Palette, Plus, RotateCcw, Star, Trash2, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ACCENTS, FIELDS, MAX_FURSONAS, MAX_PHOTOS, MAX_PROMPTS, PROMPTS } from "../../lib/dating/schema";
import { SectionIcon } from "./icons";
import { Chips, Photo, cropStyle, type Crop } from "./ui";

export type Own = {
  values: Record<string, unknown>;
  legacy: Record<string, string>;
  review: string[];
  reviewConfirmed: boolean;
  prompts: { q: string; a: string }[];
  fursonas: { name: string; description: string; art_links: string[] }[];
  photos: { id: string; ext: string; caption?: string; url: string; crop?: Crop | null }[];
  web: { accent?: string; headline?: string; paused?: boolean; pausedByStaff?: boolean; hideAge?: boolean; showOnline?: boolean; banner?: string; bannerY?: number };
  strength: { score: number; missing: { points: number; label: string; tip: string }[] };
  createdOn: string;
  ageLocked?: boolean;
};

export type Birth = { age: number | null; fromBirthday: boolean; source: "application" | "account" | null } | null;

/** Age isn't typed: it's read from their birthday and updates by itself. Only someone with no age on
 *  file anywhere gets a box to enter it (once). */
export function AgeField({ value, locked, birth, onChange }: { value: unknown; locked: boolean; birth: Birth; onChange: (v: unknown) => void }) {
  const age = birth?.age ?? (typeof value === "number" ? value : null);
  if (locked || birth?.age) {
    return (
      <div className="dt-field">
        <label>Age</label>
        <p className="dt-age">
          <b>{age ?? "—"}</b>
          <small className="dt-muted">
            {birth?.fromBirthday
              ? `From the birthday on your ${birth.source === "account" ? "account" : "join application"}. It updates on its own every birthday.`
              : birth?.age
                ? "From your join application."
                : "Set when you made your profile. Ask staff in a ticket if it's wrong."}
          </small>
        </p>
      </div>
    );
  }
  return <FieldInput k="age" value={value} onChange={onChange} />;
}

const HELP: Record<string, string> = {
  bio: "A few sentences about your personality, what you're like to be around and what you want. Our AI reads this to find people like you.",
  hobbies_interests: "Separate with commas, e.g. drawing, hiking, Stardew Valley. Matching weighs these the most.",
  likes: "Things you love, separated by commas.",
  dislikes: "Pet peeves and things you'd rather avoid. Matching uses these to spot clashes.",
  favorite_games: "Separate with commas.",
  dealbreakers: "Things that are an instant no. Matching lowers scores with people who have them.",
  location: "As broad as you like, e.g. Texas, USA. Never share your address.",
  independence_level: "1 = always together, 10 = lots of personal space.",
  partner_independence_level: "How much space you'd like your partner to want.",
  sexual_position: "Optional, and only used to filter dating matches.",
};

/** One schema field as the right kind of input. */
export function FieldInput({ k, value, onChange, flagged, legacy, compact }: { k: string; value: unknown; onChange: (v: unknown) => void; flagged?: boolean; legacy?: string; compact?: boolean }) {
  const f = FIELDS[k];
  if (!f) return null;
  const id = `f-${k}`;
  const help = HELP[k];
  let input;
  if (f.kind === "choice" && f.options.length > 12) {
    input = (
      <select id={id} className="dt-select" value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Choose…</option>
        {f.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value}
          </option>
        ))}
      </select>
    );
  } else if (f.kind === "choice" || f.kind === "multi") {
    input = <Chips options={f.options} value={(value as string | string[] | null) ?? (f.kind === "multi" ? [] : null)} multi={f.kind === "multi"} onChange={onChange} />;
  } else if (f.kind === "number") {
    input = (
      <input
        id={id}
        className="dt-input dt-input--num"
        inputMode="numeric"
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, "").slice(0, 2);
          onChange(t ? Number(t) : null);
        }}
        placeholder={f.min !== null ? String(f.min) : ""}
      />
    );
  } else if (f.paragraph) {
    const t = String(value ?? "");
    input = (
      <>
        <textarea id={id} className="dt-input" rows={k === "bio" ? 5 : 3} maxLength={f.maxLen} value={t} onChange={(e) => onChange(e.target.value)} placeholder={f.prompt} />
        <small className={`dt-counter${t.length > f.maxLen * 0.9 ? " is-near" : ""}`}>
          {t.length}/{f.maxLen}
        </small>
      </>
    );
  } else {
    input = <input id={id} className="dt-input" maxLength={f.maxLen} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={f.prompt} />;
  }
  return (
    <div className={`dt-field${flagged ? " is-flagged" : ""}${compact ? " is-compact" : ""}`}>
      <label htmlFor={id}>
        {f.label}
      </label>
      {flagged ? (
        <p className="dt-flag">
          <TriangleAlert size={13} aria-hidden="true" /> Please check this one. {legacy ? <>You originally wrote: <q>{legacy}</q></> : "We couldn't read your old answer."}
        </p>
      ) : legacy && (value === null || value === undefined || value === "") ? (
        <p className="dt-muted dt-legacy">
          Your old answer: <q>{legacy}</q>
        </p>
      ) : null}
      {help && !compact ? <p className="dt-help">{help}</p> : null}
      {input}
    </div>
  );
}

// ---------- Photos ----------
/** Big phone photos are scaled down (and re-encoded, dropping metadata) before upload. */
async function shrink(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || (file.size < 2_500_000 && !/heic/i.test(file.type))) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.88));
  } catch {
    return file;
  }
}

/** Frame a photo: drag to move, zoom with the slider, the buttons or the mouse wheel. Saves only
 *  the framing (the photo file itself is untouched), so it can be changed any time. */
function CropEditor({ url, crop, onSave, onClose }: { url: string; crop: Crop | null | undefined; onSave: (c: Crop) => Promise<void>; onClose: () => void }) {
  const [c, setC] = useState<Crop>(crop ?? { x: 50, y: 50, z: 1 });
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const zoom = (dz: number) => setC((o) => ({ ...o, z: clamp(Math.round((o.z + dz) * 20) / 20, 1, 3) }));
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 0.1 : -0.1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Rendered on <body>: inside a blurred card, "position: fixed" would be trapped in that card
  return createPortal(
    <div className="dt-modal-backdrop" onClick={onClose}>
      <div className="dt-modal dt-crop" role="dialog" aria-modal="true" aria-label="Adjust photo" onClick={(e) => e.stopPropagation()}>
        <h3>Adjust photo</h3>
        <p className="dt-muted">Drag to move it, zoom to fill the frame. This is how it shows on cards and your profile.</p>
        <div
          ref={frame}
          className="dt-crop-frame"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = { px: e.clientX, py: e.clientY, x: c.x, y: c.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            const el = frame.current;
            if (!d || !el) return;
            // Dragging right shows more of the left side: move the focus point the other way
            const k = 100 / c.z;
            setC((o) => ({ ...o, x: clamp(d.x - ((e.clientX - d.px) / el.clientWidth) * k, 0, 100), y: clamp(d.y - ((e.clientY - d.py) / el.clientHeight) * k, 0, 100) }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" draggable={false} style={cropStyle(c)} />
          <span className="dt-crop-hint">
            <Move size={14} aria-hidden="true" /> Drag to move
          </span>
        </div>
        <div className="dt-crop-zoom">
          <button type="button" className="dt-btn dt-btn--ghost dt-btn--icon dt-btn--small" onClick={() => zoom(-0.1)} aria-label="Zoom out">
            <Minus size={14} />
          </button>
          <input type="range" min={1} max={3} step={0.05} value={c.z} onChange={(e) => setC({ ...c, z: Number(e.target.value) })} aria-label="Zoom" />
          <button type="button" className="dt-btn dt-btn--ghost dt-btn--icon dt-btn--small" onClick={() => zoom(0.1)} aria-label="Zoom in">
            <Plus size={14} />
          </button>
          <span className="dt-muted">{Math.round(c.z * 100)}%</span>
        </div>
        <div className="dt-row">
          <button
            type="button"
            className="dt-btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(c);
              setBusy(false);
              onClose();
            }}
          >
            {busy ? <Loader2 size={14} className="dt-spin" aria-hidden="true" /> : null} Save
          </button>
          <button type="button" className="dt-btn dt-btn--ghost" onClick={() => setC({ x: 50, y: 50, z: 1 })}>
            <RotateCcw size={14} aria-hidden="true" /> Reset
          </button>
          <button type="button" className="dt-btn dt-btn--ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PhotoManager({ photos, onChange }: { photos: Own["photos"]; onChange: (own: Own) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [adjusting, setAdjusting] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
      const form = new FormData();
      form.append("file", await shrink(file), file.name);
      const res = await fetch("/api/dating/photos", { method: "POST", body: form }).then((r) => r.json()).catch(() => ({ ok: false, error: "Upload failed." }));
      if (!res.ok) {
        setErr(res.error ?? "Upload failed.");
        break;
      }
      onChange(res.profile);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  const save = async (next: { id: string; caption?: string; crop?: Crop | null }[]) => {
    const res = await fetch("/api/dating/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photos: next }) }).then((r) => r.json()).catch(() => null);
    if (res?.ok) onChange(res.profile);
    else setErr(res?.error ?? "Couldn't save.");
  };
  const move = (i: number, to: number) => {
    const next = photos.map((p) => ({ id: p.id, caption: p.caption, crop: p.crop ?? null }));
    const [x] = next.splice(i, 1);
    next.splice(to, 0, x);
    void save(next);
  };
  const remove = async (id: string) => {
    const res = await fetch(`/api/dating/photos/${id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => null);
    if (res?.ok) onChange(res.profile);
  };

  return (
    <div className="dt-photos">
      <div className="dt-photo-grid">
        {photos.map((p, i) => (
          <figure key={p.id} className={i === 0 ? "is-main" : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" style={cropStyle(p.crop)} />
            {i === 0 ? <span className="dt-photo-main">Main</span> : null}
            <div className="dt-photo-tools">
              <button type="button" onClick={() => setAdjusting(p.id)} title="Adjust (move and zoom)" aria-label="Adjust photo">
                <Move size={14} />
              </button>
              {i > 0 ? (
                <button type="button" onClick={() => move(i, 0)} title="Make main photo" aria-label="Make main photo">
                  <Star size={14} />
                </button>
              ) : null}
              {i > 0 ? (
                <button type="button" onClick={() => move(i, i - 1)} aria-label="Move earlier">
                  <ArrowLeft size={14} />
                </button>
              ) : null}
              {i < photos.length - 1 ? (
                <button type="button" onClick={() => move(i, i + 1)} aria-label="Move later">
                  <ArrowRight size={14} />
                </button>
              ) : null}
              <button type="button" className="is-danger" onClick={() => void remove(p.id)} aria-label="Delete photo">
                <Trash2 size={14} />
              </button>
            </div>
            <input
              className="dt-caption"
              placeholder="Add a caption"
              maxLength={120}
              value={captions[p.id] ?? p.caption ?? ""}
              onChange={(e) => setCaptions((c) => ({ ...c, [p.id]: e.target.value }))}
              onBlur={() => {
                if ((captions[p.id] ?? p.caption ?? "") === (p.caption ?? "")) return;
                void save(photos.map((x) => ({ id: x.id, caption: x.id === p.id ? captions[p.id] : x.caption, crop: x.crop ?? null })));
              }}
            />
          </figure>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <button type="button" className="dt-photo-add" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={22} className="dt-spin" aria-hidden="true" /> : <ImagePlus size={22} aria-hidden="true" />}
            <span>{busy ? "Uploading…" : "Add photo or art"}</span>
          </button>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => void upload(e.target.files)} />
      {err ? <p className="dt-error">{err}</p> : null}
      {adjusting ? (
        <CropEditor
          url={photos.find((p) => p.id === adjusting)?.url ?? ""}
          crop={photos.find((p) => p.id === adjusting)?.crop}
          onClose={() => setAdjusting(null)}
          onSave={(crop) => save(photos.map((x) => ({ id: x.id, caption: x.caption, crop: x.id === adjusting ? crop : x.crop ?? null })))}
        />
      ) : null}
      <p className="dt-fine">
        Up to {MAX_PHOTOS} photos or pieces of art, SFW only (no nudity or explicit content). Location data is removed automatically. Only verified 18+ members can see them, and anyone can report a photo.
      </p>
    </div>
  );
}

// ---------- Prompts ----------
export function PromptsEditor({ value, onChange }: { value: Own["prompts"]; onChange: (v: Own["prompts"]) => void }) {
  const used = new Set(value.map((p) => p.q));
  return (
    <div className="dt-prompts-edit">
      {value.map((p, i) => (
        <div key={i} className="dt-prompt-edit">
          <div className="dt-prompt-edit-head">
            <select className="dt-select" value={p.q} onChange={(e) => onChange(value.map((x, n) => (n === i ? { ...x, q: e.target.value } : x)))} aria-label="Prompt">
              {PROMPTS.filter((q) => q === p.q || !used.has(q)).map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
            <button type="button" className="dt-btn dt-btn--ghost dt-btn--icon" onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label="Remove prompt">
              <X size={15} />
            </button>
          </div>
          <textarea className="dt-input" rows={2} maxLength={300} value={p.a} placeholder="Your answer…" onChange={(e) => onChange(value.map((x, n) => (n === i ? { ...x, a: e.target.value } : x)))} />
        </div>
      ))}
      {value.length < MAX_PROMPTS ? (
        <button type="button" className="dt-btn dt-btn--ghost" onClick={() => onChange([...value, { q: PROMPTS.find((q) => !used.has(q))!, a: "" }])}>
          <Plus size={14} aria-hidden="true" /> Add a prompt ({value.length}/{MAX_PROMPTS})
        </button>
      ) : null}
    </div>
  );
}

// ---------- Fursonas ----------
const MAX_ART = 6;
const isImageLink = (l: string) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(l) || l.startsWith("/api/dating/media/");

/** One fursona's art: uploaded images or links, shown as thumbnails. */
function ArtPicker({ links, onChange }: { links: string[]; onChange: (links: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [dead, setDead] = useState<Set<string>>(new Set());
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    let next = [...links];
    for (const file of Array.from(files).slice(0, MAX_ART - links.length)) {
      const form = new FormData();
      form.append("file", await shrink(file), file.name);
      const res = await fetch("/api/dating/art", { method: "POST", body: form }).then((r) => r.json()).catch(() => ({ ok: false, error: "Upload failed." }));
      if (!res.ok) {
        setErr(res.error ?? "Upload failed.");
        break;
      }
      next = [...next, res.url];
      onChange(next);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  const addLink = () => {
    const l = link.trim();
    if (!/^https:\/\/[^\s"'<>]+$/.test(l)) return setErr("Links must start with https://");
    onChange([...links, l]);
    setLink("");
    setErr(null);
  };
  return (
    <div className="dt-art">
      <div className="dt-art-grid">
        {links.map((l, n) => (
          <figure key={`${l}-${n}`}>
            {isImageLink(l) && !dead.has(l) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l} alt="" referrerPolicy="no-referrer" onError={() => setDead((d) => new Set(d).add(l))} />
            ) : (
              <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="dt-art-link">
                <Link2 size={14} aria-hidden="true" /> {l.replace(/^https:\/\/(www\.)?/, "").slice(0, 28)}
              </a>
            )}
            <button type="button" className="dt-art-remove" onClick={() => onChange(links.filter((_, k) => k !== n))} aria-label="Remove art">
              <X size={13} />
            </button>
          </figure>
        ))}
        {links.length < MAX_ART ? (
          <button type="button" className="dt-photo-add dt-art-add" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={18} className="dt-spin" aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}
            <span>{busy ? "Uploading…" : "Upload art"}</span>
          </button>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => void upload(e.target.files)} />
      {links.length < MAX_ART ? (
        <div className="dt-prompt-edit-head">
          <input
            className="dt-input"
            placeholder="…or paste a link (https://)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            aria-label="Art link"
          />
          <button type="button" className="dt-btn dt-btn--ghost dt-btn--small" onClick={addLink} disabled={!link.trim()}>
            Add link
          </button>
        </div>
      ) : null}
      {err ? <p className="dt-error">{err}</p> : null}
    </div>
  );
}

export function FursonaEditor({ value, onChange }: { value: Own["fursonas"]; onChange: (v: Own["fursonas"]) => void }) {
  const set = (i: number, patch: Partial<Own["fursonas"][number]>) => onChange(value.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  return (
    <div className="dt-sona-edit">
      {value.map((s, i) => (
        <div key={i} className="dt-card dt-card--inset">
          <div className="dt-prompt-edit-head">
            <input className="dt-input" maxLength={60} placeholder="Fursona name" value={s.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Fursona name" />
            <button type="button" className="dt-btn dt-btn--ghost dt-btn--icon" onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label="Remove fursona">
              <Trash2 size={15} />
            </button>
          </div>
          <textarea className="dt-input" rows={3} maxLength={800} placeholder="Species, personality, colors…" value={s.description} onChange={(e) => set(i, { description: e.target.value })} />
          <label className="dt-help">Art (up to {MAX_ART}, SFW). Uploads are kept when you save.</label>
          <ArtPicker links={s.art_links.filter(Boolean)} onChange={(art_links) => set(i, { art_links })} />
        </div>
      ))}
      {value.length < MAX_FURSONAS ? (
        <button type="button" className="dt-btn dt-btn--ghost" onClick={() => onChange([...value, { name: "", description: "", art_links: [] }])}>
          <Plus size={14} aria-hidden="true" /> Add a fursona
        </button>
      ) : null}
    </div>
  );
}

// ---------- Looks ----------
/** "#abc", "#aabbcc", "rgb(1, 2, 3)" or "1, 2, 3" -> "#rrggbb" (null if it isn't a color). */
export function parseColor(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  let m = t.match(/^#?([0-9a-f]{6})$/);
  if (m) return `#${m[1]}`;
  m = t.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  m = t.match(/^(?:rgb\s*\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/);
  if (m && [m[1], m[2], m[3]].every((n) => Number(n) <= 255)) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  return null;
}

export function LooksEditor({ web, onChange, name }: { web: Own["web"]; onChange: (w: Own["web"]) => void; name: string }) {
  const accent = web.accent ?? ACCENTS[0];
  const custom = !ACCENTS.includes(accent);
  const [text, setText] = useState(accent);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setText(accent), [accent]);

  const uploadBanner = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr(null);
    const form = new FormData();
    form.append("file", await shrink(f), f.name);
    const res = await fetch("/api/dating/art", { method: "POST", body: form }).then((r) => r.json()).catch(() => ({ ok: false, error: "Upload failed." }));
    setBusy(false);
    if (file.current) file.current.value = "";
    if (!res.ok) return setErr(res.error ?? "Upload failed.");
    onChange({ ...web, banner: res.url, bannerY: 50 });
  };

  return (
    <div className="dt-looks">
      <div className="dt-field">
        <label htmlFor="f-headline">Headline</label>
        <p className="dt-help">A short line under your name, like a tagline.</p>
        <input id="f-headline" className="dt-input" maxLength={80} value={web.headline ?? ""} placeholder="e.g. Professional snack thief" onChange={(e) => onChange({ ...web, headline: e.target.value })} />
      </div>

      <div className="dt-field">
        <label>Profile color</label>
        <div className="dt-swatches" role="radiogroup" aria-label="Profile color">
          {ACCENTS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={accent === c} aria-label={c} className={accent === c ? "is-on" : undefined} style={{ "--sw": c } as CSSProperties} onClick={() => onChange({ ...web, accent: c })} />
          ))}
          <label className={`dt-swatch-custom${custom ? " is-on" : ""}`} style={{ "--sw": custom ? accent : "transparent" } as CSSProperties} title="Pick any color">
            <input type="color" value={accent} onChange={(e) => onChange({ ...web, accent: e.target.value })} aria-label="Pick any color" />
            <Palette size={15} aria-hidden="true" />
          </label>
        </div>
        <div className="dt-color-text">
          <span className="dt-color-dot" style={{ background: accent }} aria-hidden="true" />
          <input
            className="dt-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const c = parseColor(e.target.value);
              if (c) onChange({ ...web, accent: c });
            }}
            placeholder="#f59b2a or rgb(245, 155, 42)"
            aria-label="Color as hex or RGB"
          />
          {text && !parseColor(text) ? <small className="dt-error">Use a hex code like #f59b2a or RGB like 245, 155, 42</small> : null}
        </div>
      </div>

      <div className="dt-field">
        <label>Banner</label>
        <p className="dt-help">A wide image across the top of your profile. Without one you get the cozy paw pattern in your color.</p>
        <div className={`dt-banner-preview${web.banner ? "" : " dt-banner-default"}`} style={{ "--acc": accent, backgroundImage: web.banner ? `url(${web.banner})` : undefined, backgroundPosition: `center ${web.bannerY ?? 50}%` } as CSSProperties}>
          <span className="dt-banner-name">
            <b>{name || "Your name"}</b>
            <span>{web.headline || "Your headline"}</span>
          </span>
        </div>
        {web.banner ? (
          <label className="dt-banner-pos">
            <span>Move up / down</span>
            <input type="range" min={0} max={100} value={web.bannerY ?? 50} onChange={(e) => onChange({ ...web, bannerY: Number(e.target.value) })} />
          </label>
        ) : null}
        <div className="dt-row">
          <button type="button" className="dt-btn dt-btn--ghost dt-btn--small" disabled={busy} onClick={() => file.current?.click()}>
            {busy ? <Loader2 size={14} className="dt-spin" aria-hidden="true" /> : <ImagePlus size={14} aria-hidden="true" />} {web.banner ? "Change banner" : "Upload banner"}
          </button>
          {web.banner ? (
            <button type="button" className="dt-btn dt-btn--ghost dt-btn--small" onClick={() => onChange({ ...web, banner: "", bannerY: 50 })}>
              <Trash2 size={14} aria-hidden="true" /> Use the paw pattern
            </button>
          ) : null}
        </div>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => void uploadBanner(e.target.files?.[0])} />
        {err ? <p className="dt-error">{err}</p> : null}
      </div>
    </div>
  );
}

/** Values that differ from the saved ones (for a small PUT). */
export function changed(saved: Record<string, unknown>, draft: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(draft)) {
    const norm = (x: unknown) => JSON.stringify(x === "" || (Array.isArray(x) && !x.length) || x === undefined ? null : x);
    if (norm(v) !== norm(saved[k])) out[k] = v;
  }
  return out;
}

export async function saveMe(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; profile?: Own }> {
  try {
    const res = await fetch("/api/dating/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await res.json();
  } catch {
    return { ok: false, error: "Couldn't reach the site." };
  }
}

// ---------- Drafts ----------
// Unsaved answers are kept in this tab's session storage, so a refresh, a crashed tab or a site
// update doesn't lose what someone was typing. Session storage (not local) so nothing personal is
// left behind on a shared computer once the tab is closed.
export function readDraft<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(`kk_dating_draft:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function writeDraft(key: string, value: unknown) {
  try {
    sessionStorage.setItem(`kk_dating_draft:${key}`, JSON.stringify({ ...(value as object), savedAt: Date.now() }));
  } catch {
    // storage full or blocked: drafts are a nicety, not required
  }
}
export function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(`kk_dating_draft:${key}`);
  } catch {}
}

// ---------- Partners ----------
type PartnerRow = { id: string; status: "partners" | "sent" | "received"; name: string; username: string | null; avatar: string | null; hasProfile: boolean };
type Found = { id: string; name: string; username: string; avatar: string | null };

/** Link the people you're with. They confirm before it shows on either profile. */
export function PartnerManager({ onCount }: { onCount?: (linked: number) => void } = {}) {
  const [rows, setRows] = useState<PartnerRow[] | null>(null);
  const [max, setMax] = useState(8);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await fetch("/api/dating/partners", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) {
      setRows(r.partners);
      setMax(r.max);
      onCount?.((r.partners as PartnerRow[]).filter((p) => p.status === "partners").length);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) {
      setFound([]);
      return;
    }
    const t = window.setTimeout(async () => {
      const r = await fetch(`/api/dating/partners/search?q=${encodeURIComponent(q.trim())}`).then((x) => x.json()).catch(() => null);
      setFound(r?.ok ? r.results : []);
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const act = async (action: string, target: string, done?: string) => {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/dating/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, target }) }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setErr(r?.error ?? "That didn't work.");
    setNote(done ?? null);
    setQ("");
    setFound([]);
    await load();
  };
  const known = new Set((rows ?? []).map((r) => r.id));

  return (
    <div className="dt-partners-edit">
      <h2 className="dt-h-icon">
        <SectionIcon id="partners" /> {(rows?.filter((r) => r.status === "partners").length ?? 0) === 1 ? "Partner" : "Partners"}
      </h2>
      <p className="dt-help">
        Search for anyone in the server. They get a request to confirm, and it only shows on your profiles once they do. If they haven&apos;t joined the website yet, it waits for them.
      </p>
      {rows === null ? (
        <div className="dt-loading" style={{ height: 60 }} aria-busy="true" />
      ) : rows.length ? (
        <div className="dt-partner-list">
          {rows.map((r) => (
            <div key={r.id} className={`dt-partner-row is-${r.status}`}>
              <Photo src={r.avatar} name={r.name} accent="#e0487a" className="dt-avatar dt-avatar--sm" />
              <span>
                <b>{r.hasProfile ? <a href={`/social/u/${r.id}`}>{r.name}</a> : r.name}</b>
                <small className="dt-muted">
                  {r.status === "partners" ? "Linked" : r.status === "sent" ? `Waiting for ${r.name} to confirm` : `${r.name} says you're partners`}
                  {r.username ? ` · @${r.username}` : ""}
                </small>
              </span>
              {r.status === "received" ? (
                <>
                  <button type="button" className="dt-btn dt-btn--small" disabled={busy} onClick={() => void act("accept", r.id, `You and ${r.name} are linked!`)}>
                    Confirm
                  </button>
                  <button type="button" className="dt-btn dt-btn--small dt-btn--ghost" disabled={busy} onClick={() => void act("decline", r.id)}>
                    Decline
                  </button>
                </>
              ) : (
                <button type="button" className="dt-btn dt-btn--small dt-btn--ghost" disabled={busy} onClick={() => void act("remove", r.id, r.status === "sent" ? "Request cancelled." : `Unlinked from ${r.name}.`)}>
                  {r.status === "sent" ? "Cancel" : "Unlink"}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="dt-muted">No partners linked.</p>
      )}
      {(rows?.length ?? 0) < max ? (
        <div className="dt-field">
          <input className="dt-input" placeholder="Search server members by name…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={32} aria-label="Search for a partner" />
          {found.length ? (
            <div className="dt-partner-results">
              {found.map((m) => (
                <button key={m.id} type="button" disabled={busy || known.has(m.id)} onClick={() => void act("request", m.id, `Sent! ${m.name} needs to confirm.`)}>
                  <Photo src={m.avatar} name={m.name} accent="#e0487a" className="dt-avatar dt-avatar--sm" />
                  <span>
                    <b>{m.name}</b>
                    <small className="dt-muted">@{m.username}</small>
                  </span>
                  <small className="dt-textlink">{known.has(m.id) ? "Already linked" : "Link as partner"}</small>
                </button>
              ))}
            </div>
          ) : q.trim().length >= 2 ? (
            <p className="dt-help">No members found.</p>
          ) : null}
        </div>
      ) : null}
      {note ? <p className="dt-ok">{note}</p> : null}
      {err ? <p className="dt-error">{err}</p> : null}
    </div>
  );
}
