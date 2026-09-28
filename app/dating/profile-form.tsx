"use client";

// Form pieces shared by the profile editor and the setup wizard. Every field is drawn from the
// bot's schema (lib/dating/schema-data.ts), so adding a field there makes it appear here.

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Plus, Star, Trash2, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ACCENTS, FIELDS, MAX_FURSONAS, MAX_PHOTOS, MAX_PROMPTS, PROMPTS } from "../../lib/dating/schema";
import { Chips, Photo } from "./ui";

export type Own = {
  values: Record<string, unknown>;
  legacy: Record<string, string>;
  review: string[];
  reviewConfirmed: boolean;
  prompts: { q: string; a: string }[];
  fursonas: { name: string; description: string; art_links: string[] }[];
  photos: { id: string; ext: string; caption?: string; url: string }[];
  web: { accent?: string; headline?: string; paused?: boolean; pausedByStaff?: boolean; hideAge?: boolean; showOnline?: boolean };
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
        {f.emoji ? <span aria-hidden="true">{f.emoji} </span> : null}
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

export function PhotoManager({ photos, onChange }: { photos: Own["photos"]; onChange: (own: Own) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});

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
  const save = async (next: { id: string; caption?: string }[]) => {
    const res = await fetch("/api/dating/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photos: next }) }).then((r) => r.json()).catch(() => null);
    if (res?.ok) onChange(res.profile);
    else setErr(res?.error ?? "Couldn't save.");
  };
  const move = (i: number, to: number) => {
    const next = photos.map((p) => ({ id: p.id, caption: p.caption }));
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
            <img src={p.url} alt="" />
            {i === 0 ? <span className="dt-photo-main">Main</span> : null}
            <div className="dt-photo-tools">
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
                void save(photos.map((x) => ({ id: x.id, caption: x.id === p.id ? captions[p.id] : x.caption })));
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
                🔗 {l.replace(/^https:\/\/(www\.)?/, "").slice(0, 28)}
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
export function LooksEditor({ web, onChange, name }: { web: Own["web"]; onChange: (w: Own["web"]) => void; name: string }) {
  const accent = web.accent ?? ACCENTS[0];
  return (
    <div className="dt-looks">
      <div className="dt-field">
        <label htmlFor="f-headline">Headline</label>
        <p className="dt-help">A short line under your name, like a tagline.</p>
        <input id="f-headline" className="dt-input" maxLength={80} value={web.headline ?? ""} placeholder="e.g. Professional snack thief 🍪" onChange={(e) => onChange({ ...web, headline: e.target.value })} />
      </div>
      <div className="dt-field">
        <label>Profile color</label>
        <div className="dt-swatches" role="radiogroup" aria-label="Profile color">
          {ACCENTS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={accent === c} aria-label={c} className={accent === c ? "is-on" : undefined} style={{ "--sw": c } as CSSProperties} onClick={() => onChange({ ...web, accent: c })} />
          ))}
        </div>
      </div>
      <div className="dt-looks-preview" style={{ "--acc": accent } as CSSProperties}>
        <b>{name || "Your name"}</b>
        <span>{web.headline || "Your headline"}</span>
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
export function PartnerManager() {
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
                <b>{r.hasProfile ? <a href={`/dating/u/${r.id}`}>{r.name}</a> : r.name}</b>
                <small className="dt-muted">
                  {r.status === "partners" ? "💞 Linked" : r.status === "sent" ? `Waiting for ${r.name} to confirm` : `${r.name} says you're partners`}
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
