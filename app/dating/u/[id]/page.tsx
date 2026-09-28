"use client";

import { Ban, Check, ChevronLeft, ChevronRight, Clock, Heart, HeartOff, MessageCircle, MoreHorizontal, PenLine, Sparkles, ThumbsDown, TriangleAlert, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { Empty, ReportButton, ago, post, useApi } from "../../ui";

type View = {
  id: string;
  name: string;
  discordName: string | null;
  avatar: string | null;
  age: number | null;
  headline: string | null;
  accent: string;
  photos: { url: string; caption: string | null }[];
  facts: { label: string; value: string; key: string }[];
  sections: { id: string; label: string; emoji: string; items: { key: string; label: string; value: string; legacy: boolean; long: boolean }[] }[];
  prompts: { q: string; a: string }[];
  fursonas: { name: string; description: string; art_links: string[] }[];
  lookingFor: { open: boolean; genders: string[]; relTypes: string[]; ages: string | null };
  lastActive: string | null;
  strength: number;
  paused: boolean;
  isNew: boolean;
};
type Compat = { score: number; tier: string; emoji: string; parts: Record<string, number | null>; pairs: { a: string; b: string }[]; agreements: string[]; conflicts: string[]; blocked: string | null; starter: string; ai: boolean };
type Data = { own: boolean; profile: View; compat: Compat | null; relation: { iLiked: boolean; likesMe: boolean; match: boolean; friend: "none" | "friends" | "sent" | "received"; blockedByMe: boolean } };

const PART_LABELS: Record<string, [string, string]> = {
  interests: ["Interests", "🎮"],
  lifestyle: ["Lifestyle", "🌙"],
  logistics: ["Distance & time", "🌍"],
  vices: ["Habits", "🍷"],
  independence: ["Independence", "🪁"],
  completeness: ["Their profile", "📝"],
  recency: ["Recently active", "⏱️"],
};
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
        <img src={p.url} alt={p.caption ?? `${name}'s photo`} />
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
      {zoom ? (
        <div className="dt-lightbox" onClick={() => setZoom(false)} role="dialog" aria-modal="true" aria-label="Photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt={p.caption ?? ""} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="dt-modal-close" aria-label="Close">
            <X size={18} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function ProfilePage({ params }: { params: { id: string } }) {
  const { data, error, reload } = useApi<Data>(`/api/dating/users/${params.id}`);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 4000);
    return () => window.clearTimeout(t);
  }, [note]);

  if (error)
    return (
      <Empty icon={<TriangleAlert size={28} />} title="Profile not available">
        <p>{error}</p>
        <a className="dt-btn" href="/dating/browse">
          Back to Browse
        </a>
      </Empty>
    );
  if (!data) return <div className="dt-loading" aria-busy="true" />;
  const { profile: p, compat: c, relation: r } = data;

  const act = async (action: string, done?: string) => {
    setBusy(true);
    const res = await post<{ mutual?: boolean }>("/api/dating/actions", { action, target: p.id });
    setBusy(false);
    setMenu(false);
    if (!res.ok) return setNote(res.error ?? "That didn't work.");
    setNote(res.mutual ? `💞 It's a match with ${p.name}!` : done ?? null);
    await reload();
  };

  const factLine = p.facts.filter((f) => ["gender", "pronouns", "sexuality"].includes(f.key)).map((f) => f.value);
  const place = p.facts.filter((f) => ["location", "timezone"].includes(f.key)).map((f) => f.value);

  return (
    <div className="dt-profile" style={{ "--acc": p.accent } as CSSProperties}>
      {data.own ? (
        <div className="dt-banner dt-banner--soft">
          <Sparkles size={16} aria-hidden="true" />
          <span>This is how other members see your profile.</span>
          <a className="dt-btn dt-btn--small" href="/dating/profile">
            <PenLine size={13} aria-hidden="true" /> Edit
          </a>
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

      <div className="dt-profile-grid">
        <div className="dt-profile-left">
          {p.photos.length ? (
            <Gallery photos={p.photos} name={p.name} owner={p.id} />
          ) : (
            <div className="dt-gallery dt-gallery--empty">
              {p.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar} alt="" />
              ) : (
                <span>{p.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
          )}

          {c && !data.own ? (
            <section className="dt-card dt-compat">
              <header>
                <div className="dt-ring dt-ring--big" style={{ "--p": c.score } as CSSProperties}>
                  <b>{c.score}%</b>
                </div>
                <div>
                  <b>
                    {c.blocked ? "🤝" : c.emoji} {c.blocked ? "Friendly fit" : `${c.tier} match`}
                  </b>
                  <small className="dt-muted">{c.ai ? "Matched by meaning with our AI" : "Matched on shared words"}</small>
                  {c.blocked ? <small className="dt-muted">Not a dating fit: {c.blocked}</small> : null}
                </div>
              </header>
              <div className="dt-bars">
                {Object.entries(c.parts)
                  .filter(([, v]) => v !== null)
                  .map(([k, v]) => (
                    <div key={k} className="dt-bar">
                      <span>
                        {PART_LABELS[k]?.[1]} {PART_LABELS[k]?.[0] ?? k}
                      </span>
                      <span className="dt-bar-track">
                        <span style={{ width: `${Math.round((v as number) * 100)}%` }} />
                      </span>
                      <small>{Math.round((v as number) * 100)}</small>
                    </div>
                  ))}
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
                      <Check size={13} aria-hidden="true" /> {a}
                    </li>
                  ))}
                </ul>
              ) : null}
              {c.conflicts.length ? (
                <ul className="dt-list dt-list--bad">
                  {c.conflicts.map((a) => (
                    <li key={a}>
                      <TriangleAlert size={13} aria-hidden="true" /> {a}
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
          <header className="dt-profile-head">
            <div>
              <h1>
                {p.name}
                {p.age ? <span>, {p.age}</span> : null}
                {p.isNew ? <span className="dt-new">New</span> : null}
              </h1>
              {p.headline ? <p className="dt-headline">{p.headline}</p> : null}
              <p className="dt-muted">
                {factLine.join(" · ")}
                {p.discordName ? <> · @{p.discordName}</> : null}
              </p>
              <p className="dt-muted">
                {place.join(" · ")}
                {p.lastActive ? (
                  <>
                    {place.length ? " · " : ""}
                    <span className={ago(p.lastActive) === "online now" ? "is-online" : ""}>
                      <Clock size={12} aria-hidden="true" /> {ago(p.lastActive)}
                    </span>
                  </>
                ) : null}
              </p>
              {r.match ? <span className="dt-badge dt-badge--match">💞 You matched</span> : r.likesMe ? <span className="dt-badge">💌 Likes you</span> : null}
              {r.friend === "friends" ? <span className="dt-badge">🫂 Friends</span> : null}
              {p.paused ? <span className="dt-badge dt-badge--muted">Paused</span> : null}
            </div>
          </header>

          {!data.own && !r.blockedByMe ? (
            <div className="dt-actions">
              {r.iLiked ? (
                <button type="button" className="dt-btn dt-btn--ghost" disabled={busy} onClick={() => void act("unlike", "Like removed.")}>
                  <HeartOff size={15} aria-hidden="true" /> Unlike
                </button>
              ) : (
                <button type="button" className="dt-btn dt-btn--like" disabled={busy} onClick={() => void act("like", `You liked ${p.name}.`)}>
                  <Heart size={15} aria-hidden="true" /> Like
                </button>
              )}
              <a className="dt-btn" href={`/dating/messages/${p.id}`}>
                <MessageCircle size={15} aria-hidden="true" /> Message
              </a>
              {r.friend === "none" ? (
                <button type="button" className="dt-btn dt-btn--ghost" disabled={busy} onClick={() => void act("friend", "Friend request sent.")}>
                  <UserPlus size={15} aria-hidden="true" /> Add friend
                </button>
              ) : r.friend === "received" ? (
                <button type="button" className="dt-btn dt-btn--ghost" disabled={busy} onClick={() => void act("accept", "You're friends now!")}>
                  <UserCheck size={15} aria-hidden="true" /> Accept friend
                </button>
              ) : r.friend === "sent" ? (
                <button type="button" className="dt-btn dt-btn--ghost" disabled={busy} onClick={() => void act("unfriend", "Request cancelled.")}>
                  <UserMinus size={15} aria-hidden="true" /> Cancel request
                </button>
              ) : null}
              <div className="dt-more">
                <button type="button" className="dt-btn dt-btn--ghost dt-btn--icon" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="More">
                  <MoreHorizontal size={16} />
                </button>
                {menu ? (
                  <div className="dt-menu" role="menu">
                    {!r.iLiked && !r.match ? (
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

          {p.prompts.length ? (
            <div className="dt-prompts">
              {p.prompts.map((pr) => (
                <blockquote key={pr.q} className="dt-prompt">
                  <small>{pr.q}</small>
                  <p>{pr.a}</p>
                </blockquote>
              ))}
            </div>
          ) : null}

          <section className="dt-card">
            <h3>💘 Looking for</h3>
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

          {p.sections.map((s) => (
            <section key={s.id} className="dt-card">
              <h3>
                {s.emoji} {s.label}
              </h3>
              <div className="dt-fields">
                {s.items.map((it) => (
                  <div key={it.key} className={it.long ? "is-long" : undefined}>
                    <small>{it.label}</small>
                    <p>{it.value}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {p.fursonas.length ? (
            <section className="dt-card">
              <h3>🐾 Fursonas</h3>
              <div className="dt-sonas">
                {p.fursonas.map((f, n) => (
                  <article key={`${f.name}-${n}`} className="dt-sona">
                    {f.art_links.filter(isImage).slice(0, 1).map((l) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={l} src={l} alt={`${f.name} art`} loading="lazy" referrerPolicy="no-referrer" />
                    ))}
                    <div>
                      <b>{f.name}</b>
                      {f.description ? <p>{f.description}</p> : null}
                      {f.art_links.length ? (
                        <small>
                          {f.art_links.map((l, k) => (
                            <a key={l} href={l} target="_blank" rel="noopener noreferrer nofollow">
                              Art {k + 1}
                            </a>
                          ))}
                        </small>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {confirmBlock ? (
        <div className="dt-modal-backdrop" onClick={() => setConfirmBlock(false)}>
          <div className="dt-modal" role="dialog" aria-modal="true" aria-label="Block" onClick={(e) => e.stopPropagation()}>
            <h3>Block {p.name}?</h3>
            <p className="dt-muted">They won&apos;t see your profile or be able to message you, and any likes, match or friendship between you is removed. They aren&apos;t told. You can unblock later from Friends.</p>
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
