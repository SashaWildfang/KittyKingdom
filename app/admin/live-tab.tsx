"use client";

import {
  Bot,
  ChevronDown,
  CornerUpRight,
  Crosshair,
  Eye,
  EyeOff,
  FileText,
  Hash,
  Headphones,
  ImageIcon,
  MicOff,
  MonitorUp,
  Pause,
  Play,
  Radio,
  Search,
  Trash2,
  User,
  Video,
  Volume2,
  X,
  ExternalLink,
  CheckCheck,
  Play as PlayIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChannelTile, LiveAttachment, LiveEmbed, LiveMessage, LivePrefs, LiveSnapshot } from "../../lib/live-chat";
import { useStored, type Mentions, type People } from "./admin-shared";
import { DiscordText, isEmojiLink } from "./discord-text";

const POLL_MS = 2000;
const KEEP = 400;
const PULSE_MS = 2400;
const GROUP_MS = 5 * 60_000;
const FADE_MIN = 8; // channels fade over this many quiet minutes…
const FALLOFF_MIN = 12; // …and leave the list after this many
const FOLLOW_DWELL_MS = 12_000; // auto-follow stays on a channel at least this long before jumping

type Staff = Record<string, { rank: string; color: string | null }>;
type Ctx = { mentions: Mentions; people: People; staff: Staff; onOpenMember: (id: string) => void };

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const key = (m: { parentId: string | null; channelId: string }) => m.parentId ?? m.channelId;

function ago(iso: string | null, now: number) {
  if (!iso) return "quiet";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

/** Activity level: how many messages in the last 5 minutes. */
function heat(count5: number) {
  return count5 >= 16 ? "hot" : count5 >= 6 ? "warm" : count5 > 0 ? "live" : "idle";
}

function Face({ src, name, size = 32 }: { src: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img className="live-face" src={src} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <span className="live-face live-face--blank" style={{ width: size, height: size }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** A picture or clip; blurred until clicked when it's a spoiler. Broken links show a fallback. */
function Media({ src, kind, spoiler, alt, poster, href }: { src: string; kind: "image" | "video" | "gifv"; spoiler: boolean; alt: string; poster?: string | null; href?: string }) {
  const [shown, setShown] = useState(!spoiler);
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <a className="live-file" href={href ?? src} target="_blank" rel="noreferrer">
        <ImageIcon size={14} aria-hidden="true" /> {alt || "Media"} (open)
      </a>
    );
  return (
    <div className={`live-media${shown ? "" : " is-hidden"}`}>
      {kind === "image" ? (
        <a href={href ?? src} target="_blank" rel="noreferrer" onClick={(e) => !shown && e.preventDefault()}>
          <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
        </a>
      ) : kind === "gifv" ? (
        <video src={src} poster={poster ?? undefined} autoPlay={shown} loop muted playsInline onError={() => setFailed(true)} />
      ) : (
        <video src={src} poster={poster ?? undefined} controls={shown} preload="metadata" playsInline onError={() => setFailed(true)} />
      )}
      {!shown ? (
        <button type="button" className="live-spoiler" onClick={() => setShown(true)}>
          <EyeOff size={16} aria-hidden="true" /> Spoiler · click to show
        </button>
      ) : null}
    </div>
  );
}

function Files({ m, files, base }: { m: LiveMessage; files: LiveAttachment[]; base: string }) {
  if (!files.length) return null;
  return (
    <div className="live-files">
      {files.map((a) => {
        const src = `${base}/${a.id}`;
        const spoiler = a.spoiler || m.forceSpoiler;
        if (a.image) return <Media key={a.id} src={src} kind="image" spoiler={spoiler} alt={a.filename} />;
        if (a.video) return <Media key={a.id} src={src} kind="video" spoiler={spoiler} alt={a.filename} />;
        if (a.audio)
          return (
            <div key={a.id} className="live-audio">
              <span>
                <FileText size={13} aria-hidden="true" /> {a.filename}
              </span>
              <audio src={src} controls preload="none" />
            </div>
          );
        return (
          <a key={a.id} className="live-file" href={src} target="_blank" rel="noreferrer">
            <FileText size={14} aria-hidden="true" /> {a.filename}
            {a.size ? <small>{a.size > 1_048_576 ? `${(a.size / 1_048_576).toFixed(1)} MB` : `${Math.ceil(a.size / 1024)} KB`}</small> : null}
          </a>
        );
      })}
    </div>
  );
}

/** An embed drawn the way Discord does: color bar, author, title, text, fields, pictures, footer. */
function Embed({ e, spoiler, ctx }: { e: LiveEmbed; spoiler: boolean; ctx: Ctx }) {
  // Plain link previews of a picture/clip are just the media
  if (e.type === "image" && e.thumbnail) return isEmojiLink(e.url) ? null : <Media src={e.thumbnail.url} kind="image" spoiler={spoiler} alt="image" href={e.url ?? undefined} />;
  if (e.type === "gifv" && e.video) return <Media src={e.video.url} kind="gifv" spoiler={spoiler} alt="GIF" poster={e.thumbnail?.url} />;
  const isVideoLink = e.type === "video" && e.url;
  const text = (t: string) => <DiscordText text={t} {...ctx} />;
  return (
    <div className="live-embed" style={e.color ? ({ "--embed": e.color } as React.CSSProperties) : undefined}>
      <div className="live-embed-body">
        {e.provider ? <small className="live-embed-provider">{e.provider}</small> : null}
        {e.author ? (
          <span className="live-embed-author">
            {e.author.icon ? <img src={e.author.icon} alt="" width={20} height={20} loading="lazy" /> : null}
            {e.author.url ? (
              <a href={e.author.url} target="_blank" rel="noreferrer nofollow">
                {e.author.name}
              </a>
            ) : (
              e.author.name
            )}
          </span>
        ) : null}
        {e.title ? (
          <strong className="live-embed-title">
            {e.url ? (
              <a href={e.url} target="_blank" rel="noreferrer nofollow">
                {text(e.title)}
              </a>
            ) : (
              text(e.title)
            )}
          </strong>
        ) : null}
        {e.description ? <div className="live-embed-desc">{text(e.description)}</div> : null}
        {e.fields.length ? (
          <div className="live-embed-fields">
            {e.fields.map((f, i) => (
              <div key={i} className={f.inline ? "is-inline" : undefined}>
                <strong>{text(f.name)}</strong>
                <div>{text(f.value)}</div>
              </div>
            ))}
          </div>
        ) : null}
        {e.image ? <Media src={e.image.url} kind="image" spoiler={spoiler} alt={e.title ?? "image"} /> : null}
        {isVideoLink && e.thumbnail ? (
          <a className="live-embed-video" href={e.url!} target="_blank" rel="noreferrer nofollow">
            <img src={e.thumbnail.url} alt={e.title ?? "video"} loading="lazy" />
            <span>
              <PlayIcon size={22} aria-hidden="true" />
            </span>
          </a>
        ) : null}
        {e.footer || e.timestamp ? (
          <small className="live-embed-footer">
            {e.footer?.icon ? <img src={e.footer.icon} alt="" width={16} height={16} loading="lazy" /> : null}
            {e.footer?.text}
            {e.footer?.text && e.timestamp ? " • " : null}
            {e.timestamp ? new Date(e.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : null}
          </small>
        ) : null}
      </div>
      {e.thumbnail && !isVideoLink ? <img className="live-embed-thumb" src={e.thumbnail.url} alt="" loading="lazy" /> : null}
    </div>
  );
}

/** A message that's only a link to a picture/GIF/video shows the media, not the link (like Discord). */
function linkOnlyMedia(m: LiveMessage) {
  const text = m.content.trim().replace(/^<(.+)>$/, "$1");
  if (!/^https?:\/\/\S+$/.test(text) || isEmojiLink(text)) return false;
  return m.embeds.some((e) => (e.url === text || e.thumbnail?.url === text || e.video?.url === text) && (e.type === "image" || e.type === "gifv" || e.type === "video" || Boolean(e.image || e.thumbnail || e.video)));
}

function Body({ m, ctx }: { m: LiveMessage; ctx: Ctx }) {
  const embeds = m.embeds.filter((e) => !(e.type === "image" && isEmojiLink(e.url)));
  return (
    <>
      {m.content && !linkOnlyMedia(m) ? (
        <div className="live-text">
          <DiscordText text={m.content} {...ctx} />
        </div>
      ) : null}
      {m.forwarded ? (
        <div className="live-forward">
          <small>
            <CornerUpRight size={12} aria-hidden="true" /> Forwarded
          </small>
          {m.forwarded.content ? (
            <div className="live-text">
              <DiscordText text={m.forwarded.content} {...ctx} />
            </div>
          ) : null}
          <Files m={m} files={m.forwarded.attachments} base={`/api/admin/live/file/${m.id}`} />
          {m.forwarded.embeds.map((e, i) => (
            <Embed key={i} e={e} spoiler={m.forceSpoiler} ctx={ctx} />
          ))}
        </div>
      ) : null}
      <Files m={m} files={m.attachments} base={`/api/admin/live/file/${m.id}`} />
      {embeds.map((e, i) => (
        <Embed key={i} e={e} spoiler={m.forceSpoiler} ctx={ctx} />
      ))}
      {m.stickers.length ? (
        <div className="live-files">
          {m.stickers.map((s, i) =>
            s.url ? <img key={i} className="live-sticker" src={s.url} alt={s.name} title={s.name} loading="lazy" /> : <span key={i} className="live-muted">Sticker: {s.name}</span>,
          )}
        </div>
      ) : null}
    </>
  );
}

function StaffTag({ id, staff }: { id: string; staff: Staff }) {
  const s = staff[id];
  if (!s) return null;
  return (
    <span className="live-rank" style={s.color ? ({ "--rank": s.color } as React.CSSProperties) : undefined}>
      {s.rank}
    </span>
  );
}

function MessageRow({
  m,
  grouped,
  guildId,
  ctx,
  onChannel,
  onDelete,
  onJump,
  observe,
}: {
  m: LiveMessage;
  grouped: boolean;
  guildId: string | null;
  ctx: Ctx;
  onChannel: (id: string) => void;
  onDelete: (m: LiveMessage) => Promise<boolean>;
  onJump: (id: string) => void;
  observe: (el: HTMLElement | null) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <li
      ref={observe}
      data-id={m.id}
      data-ck={key(m)}
      data-ts={m.ts}
      className={`live-msg${grouped ? " is-grouped" : ""}${m.deleted ? " is-deleted" : ""}${m.bot ? " is-bot" : ""}`}
    >
      {m.reply ? (
        <button type="button" className="live-reply" onClick={() => onJump(m.reply!.id)} title="Jump to the message they replied to">
          <span className="live-reply-line" aria-hidden="true" />
          {m.reply.authorName ? (
            <>
              <Face src={m.reply.avatar} name={m.reply.authorName} size={16} />
              <strong>{m.reply.authorName}</strong>
            </>
          ) : null}
          <span className="live-reply-text">
            {m.reply.content && !(m.reply.hasMedia && /^<?https?:\/\/\S+>?$/.test(m.reply.content.trim())) ? (
              <DiscordText text={m.reply.content} compact {...ctx} />
            ) : m.reply.hasMedia ? (
              <em>
                <ImageIcon size={12} aria-hidden="true" /> Click to see attachment
              </em>
            ) : (
              <em>Original message isn&apos;t in the feed</em>
            )}
          </span>
        </button>
      ) : null}
      <div className="live-msg-row">
        {grouped && !m.reply ? (
          <time className="live-msg-gutter" dateTime={m.ts}>
            {clock(m.ts)}
          </time>
        ) : (
          <button type="button" className="live-msg-face" onClick={() => ctx.onOpenMember(m.authorId)} title="Open their profile">
            <Face src={m.avatar} name={m.displayName} size={36} />
          </button>
        )}
        <div className="live-msg-main">
          {!grouped || m.reply ? (
            <div className="live-msg-head">
              <button
                type="button"
                className={`live-msg-name${ctx.staff[m.authorId]?.color ? " is-staff" : ""}`}
                style={ctx.staff[m.authorId]?.color ? ({ "--rank": ctx.staff[m.authorId]!.color } as React.CSSProperties) : undefined}
                onClick={() => ctx.onOpenMember(m.authorId)}
                title={`@${m.authorName}`}
              >
                {m.displayName}
              </button>
              <StaffTag id={m.authorId} staff={ctx.staff} />
              {m.bot ? <span className="live-tag live-tag--bot">BOT</span> : null}
              <button type="button" className="live-chan" onClick={() => onChannel(key(m))} title={m.categoryName ? `${m.categoryName} · focus this channel` : "Focus this channel"}>
                <Hash size={12} aria-hidden="true" />
                {m.parentName ? `${m.parentName} › ${m.channelName}` : m.channelName}
              </button>
              <time dateTime={m.ts} title={new Date(m.ts).toLocaleString()}>
                {clock(m.ts)}
              </time>
              {m.edited ? <span className="live-tag">edited</span> : null}
            </div>
          ) : null}
          <Body m={m} ctx={ctx} />
          {m.deleted ? (
            <p className="live-deleted-note">
              <Trash2 size={12} aria-hidden="true" /> Deleted{m.deletedBy ? ` by ${m.deletedBy} from the website` : " in Discord"}
            </p>
          ) : null}
        </div>
      </div>
      {!m.deleted ? (
        <div className={`live-actions${confirm ? " is-open" : ""}`}>
          {confirm ? (
            <>
              <button
                type="button"
                className="adm-btn adm-btn--danger adm-btn--small"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const ok = await onDelete(m);
                  setBusy(false);
                  if (!ok) setConfirm(false);
                }}
              >
                {busy ? "Deleting…" : "Yes, delete"}
              </button>
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {guildId ? (
                <a className="live-icon-btn" href={`https://discord.com/channels/${guildId}/${m.channelId}/${m.id}`} target="_blank" rel="noreferrer" title="Open in Discord" aria-label="Open in Discord">
                  <ExternalLink size={15} />
                </a>
              ) : null}
              <button type="button" className="live-icon-btn" onClick={() => ctx.onOpenMember(m.authorId)} title="Their profile" aria-label="Their profile">
                <User size={15} />
              </button>
              <button type="button" className="live-icon-btn live-icon-btn--danger" onClick={() => setConfirm(true)} title="Delete message" aria-label="Delete message">
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

function ChannelRow({ c, now, focused, pulse, onPick, onHide }: { c: ChannelTile; now: number; focused: boolean; pulse: boolean; onPick: () => void; onHide: () => void }) {
  const level = c.kind === "voice" ? (c.voice.length ? "live" : "idle") : heat(c.count5);
  // Fades as the channel goes quiet: full strength for 2 minutes, dimmest after FADE_MIN
  const age = c.lastAt ? (now - new Date(c.lastAt).getTime()) / 60_000 : Infinity;
  const fade = c.kind === "voice" ? (c.voice.length ? 1 : 0.5) : c.unread > 0 ? 1 : age <= 2 ? 1 : age >= FADE_MIN ? 0.35 : 1 - ((age - 2) / (FADE_MIN - 2)) * 0.65;
  return (
    <div className={`live-ch live-ch--${level}${focused ? " is-focused" : ""}${pulse ? " is-pulse" : ""}`} style={{ "--fade": fade } as React.CSSProperties}>
      <button type="button" className="live-ch-main" onClick={onPick} disabled={c.kind === "voice"} aria-pressed={focused} title={c.kind === "voice" ? `${c.voice.length} in voice` : focused ? "Click to unfocus" : "Click to focus"}>
        <span className="live-ch-head">
          {c.kind === "voice" ? <Volume2 size={14} aria-hidden="true" /> : <Hash size={14} aria-hidden="true" />}
          <span className="live-ch-name">{c.name}</span>
          {c.spoiler ? <EyeOff size={12} aria-label="Images blurred" /> : null}
          {c.kind === "text" && c.unread > 0 ? (
            <b key={c.unread} className={`live-ch-count live-ch-count--${level}${pulse ? " is-pulse" : ""}`} title={`${c.unread} unread`}>
              {c.unread > 99 ? "99+" : c.unread}
            </b>
          ) : null}
        </span>
        {c.kind === "voice" ? (
          c.voice.length ? (
            <span className="live-voice">
              {c.voice.map((v) => (
                <span key={v.id} className="live-voice-member" title={v.name}>
                  <Face src={v.avatar} name={v.name} size={18} />
                  <span>{v.name}</span>
                  {v.deafened ? <Headphones size={11} aria-label="Deafened" /> : v.muted ? <MicOff size={11} aria-label="Muted" /> : null}
                  {v.streaming ? <MonitorUp size={11} aria-label="Streaming" /> : null}
                  {v.video ? <Video size={11} aria-label="Camera on" /> : null}
                </span>
              ))}
            </span>
          ) : null
        ) : c.lastAt ? (
          <span className="live-ch-sub">
            {c.lastAuthors.length ? (
              <span className="live-ch-faces">
                {c.lastAuthors.map((a) => (
                  <Face key={a.id} src={a.avatar} name={a.name} size={16} />
                ))}
              </span>
            ) : null}
            {c.count5 ? `${c.count5} in 5m · ` : ""}
            {ago(c.lastAt, now)} ago
          </span>
        ) : null}
      </button>
      {c.kind === "text" ? (
        <button type="button" className="live-ch-hide" onClick={onHide} title="Hide this channel from Live Chat" aria-label={`Hide #${c.name}`}>
          <EyeOff size={14} />
        </button>
      ) : null}
    </div>
  );
}

type StatKey = "unread" | "rate" | "active" | "chatting" | "voice";

/** The dropdown under a header number: what's behind it, with shortcuts to focus a channel or open a member. */
function StatDetails({
  which,
  snap,
  now,
  staff,
  onFocus,
  onOpenMember,
  onClearAll,
  onClose,
}: {
  which: StatKey;
  snap: LiveSnapshot;
  now: number;
  staff: Staff;
  onFocus: (id: string) => void;
  onOpenMember: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".live-stat-panel") && !t.closest(".live-stat")) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  const channels = snap.categories.flatMap((c) => c.channels.map((ch) => ({ ...ch, category: c.name }))).filter((c) => !c.hidden);
  const text = channels.filter((c) => c.kind === "text");
  const nameStyle = (id: string) => (staff[id]?.color ? ({ color: staff[id]!.color } as React.CSSProperties) : undefined);
  const channelRow = (c: (typeof channels)[number], right: React.ReactNode, sub?: React.ReactNode) => (
    <li key={c.id}>
      <button type="button" onClick={() => onFocus(c.id)} title="Focus this channel">
        <Hash size={13} aria-hidden="true" />
        <span className="live-stat-name">
          {c.name}
          <small>{sub ?? c.category}</small>
        </span>
        <b>{right}</b>
      </button>
    </li>
  );

  let title = "";
  let body: React.ReactNode = null;
  if (which === "unread") {
    const list = text.filter((c) => c.unread > 0).sort((a, b) => b.unread - a.unread);
    title = "Unread by channel";
    body = list.length ? (
      <>
        <ul>{list.map((c) => channelRow(c, c.unread))}</ul>
        <button type="button" className="adm-btn adm-btn--small live-stat-action" onClick={onClearAll}>
          <CheckCheck size={14} aria-hidden="true" /> Mark all read
        </button>
      </>
    ) : (
      <p className="live-muted">You&apos;re all caught up.</p>
    );
  } else if (which === "rate") {
    const list = text.filter((c) => c.count5 > 0).sort((a, b) => b.count1 - a.count1 || b.count5 - a.count5);
    const max = Math.max(1, ...list.map((c) => c.count5));
    title = "Busiest right now";
    body = list.length ? (
      <ul>
        {list.map((c) =>
          channelRow(
            c,
            `${c.count1}/min`,
            <span className="live-stat-bar">
              <i style={{ width: `${(c.count5 / max) * 100}%` }} /> {c.count5} in 5 min
            </span>,
          ),
        )}
      </ul>
    ) : (
      <p className="live-muted">Nothing in the last 5 minutes.</p>
    );
  } else if (which === "active") {
    const list = text.filter((c) => c.count5 > 0).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
    title = "Active channels (last 5 min)";
    body = list.length ? (
      <ul>
        {list.map((c) =>
          channelRow(
            c,
            `${ago(c.lastAt, now)} ago`,
            <span className="live-stat-faces">
              {c.lastAuthors.map((a) => (
                <Face key={a.id} src={a.avatar} name={a.name} size={16} />
              ))}
              {c.lastAuthors.map((a) => a.name).join(", ")}
            </span>,
          ),
        )}
      </ul>
    ) : (
      <p className="live-muted">No channel has had a message in the last 5 minutes.</p>
    );
  } else if (which === "chatting") {
    title = "Chatting in the last hour";
    body = snap.topChatters.length ? (
      <ul>
        {snap.topChatters.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onOpenMember(p.id)} title="Open their profile">
              <Face src={p.avatar} name={p.name} size={22} />
              <span className="live-stat-name">
                <span style={nameStyle(p.id)}>{p.name}</span>
                {staff[p.id] ? <span className="live-rank" style={staff[p.id]!.color ? ({ "--rank": staff[p.id]!.color } as React.CSSProperties) : undefined}>{staff[p.id]!.rank}</span> : null}
                <small>
                  last in #{p.lastChannel} · {ago(p.lastAt, now)} ago
                </small>
              </span>
              <b>{p.count} msg{p.count === 1 ? "" : "s"}</b>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="live-muted">Nobody has chatted in the last hour.</p>
    );
  } else {
    const list = channels.filter((c) => c.kind === "voice" && c.voice.length);
    title = "In voice";
    body = list.length ? (
      <ul>
        {list.map((c) => (
          <li key={c.id} className="live-stat-voice">
            <span className="live-stat-vchan">
              <Volume2 size={13} aria-hidden="true" /> {c.name} <small>{c.voice.length}</small>
            </span>
            <span className="live-voice">
              {c.voice.map((v) => (
                <button key={v.id} type="button" className="live-voice-member" onClick={() => onOpenMember(v.id)} title={v.name}>
                  <Face src={v.avatar} name={v.name} size={18} />
                  <span style={nameStyle(v.id)}>{v.name}</span>
                  {v.deafened ? <Headphones size={11} aria-label="Deafened" /> : v.muted ? <MicOff size={11} aria-label="Muted" /> : null}
                  {v.streaming ? <MonitorUp size={11} aria-label="Streaming" /> : null}
                  {v.video ? <Video size={11} aria-label="Camera on" /> : null}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="live-muted">Nobody is in voice.</p>
    );
  }

  return (
    <div className="live-stat-panel" role="dialog" aria-label={title}>
      <header>
        <strong>{title}</strong>
        <button type="button" className="live-icon-btn" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </header>
      {body}
    </div>
  );
}

/** Admin -> Live Chat: live messages, channel activity and voice, with delete for staff. */
export function LiveTab({ onOpenMember, onUnread }: { onOpenMember: (id: string) => void; onUnread?: (n: number) => void }) {
  const [focus, setFocus] = useState<string[]>([]);
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [prefs, setPrefs] = useState<LivePrefs | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [search, setSearch] = useState("");
  const [hideBots, setHideBots] = useStored("live-hide-bots", false);
  const [mediaOnly, setMediaOnly] = useState(false);
  const [quietShown, setQuietShown] = useStored("live-show-quiet", false);
  const [collapsed, setCollapsed] = useStored<string[]>("live-collapsed", []);
  const [managingHidden, setManagingHidden] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [openStat, setOpenStat] = useState<StatKey | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [known, setKnown] = useState<{ people: People; mentions: Mentions; staff: Staff }>({ people: {}, mentions: { channels: {}, roles: {} }, staff: {} });

  const cursor = useRef<{ after: string | null; since: string | null }>({ after: null, since: null });
  const pending = useRef<LiveMessage[]>([]);
  const pausedRef = useRef(paused);
  const lastUnread = useRef<Record<string, number>>({});
  const lastNewest = useRef<string | null>(null);
  const lastFollow = useRef(0);
  const feed = useRef<HTMLOListElement>(null);
  const busy = useRef(false);
  const focusRef = useRef(focus);
  const prefsRef = useRef(prefs);
  pausedRef.current = paused;
  focusRef.current = focus;
  prefsRef.current = prefs;

  const merge = useCallback((list: LiveMessage[], incoming: LiveMessage[], changed: LiveMessage[]) => {
    const byId = new Map(list.map((m) => [m.id, m]));
    for (const m of [...incoming, ...changed]) byId.set(m.id, { ...byId.get(m.id), ...m });
    return Array.from(byId.values())
      .sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id))
      .slice(-KEEP);
  }, []);

  const poll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const params = new URLSearchParams();
      if (cursor.current.after) params.set("after", cursor.current.after);
      if (cursor.current.since) params.set("since", cursor.current.since);
      if (focus.length) params.set("channels", focus.join(","));
      const res = await fetch(`/api/admin/live?${params}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Couldn't load live chat.");
      const data = body as LiveSnapshot & { people?: People; mentions?: Mentions };
      if (focus.join(",") !== focusRef.current.join(",")) return; // focus changed while loading

      setKnown((k) => ({
        people: { ...k.people, ...(data.people ?? {}) },
        mentions: { channels: { ...k.mentions.channels, ...(data.mentions?.channels ?? {}) }, roles: { ...k.mentions.roles, ...(data.mentions?.roles ?? {}) } },
        staff: { ...k.staff, ...data.staff },
      }));

      // Unread bubbles pulse when they go up
      const fresh: Record<string, number> = {};
      for (const cat of data.categories)
        for (const c of cat.channels) {
          const before = lastUnread.current[c.id];
          if (before !== undefined && c.unread > before) fresh[c.id] = Date.now();
          lastUnread.current[c.id] = c.unread;
        }
      if (Object.keys(fresh).length) setPulses((p) => ({ ...p, ...fresh }));

      const last = data.messages[data.messages.length - 1];
      if (last) cursor.current.after = last.ts;
      const firstLoad = !cursor.current.since;
      cursor.current.since = data.serverTime;
      if (pausedRef.current) {
        pending.current = [...pending.current, ...data.messages];
        setWaiting(new Set(pending.current.map((m) => m.id)).size);
        setMessages((list) => merge(list, [], data.changed));
      } else {
        setMessages((list) => merge(list, data.messages, data.changed));
      }
      if (!prefsRef.current) setPrefs(data.prefs);
      setSnap(data);
      onUnread?.(data.stats.unread);
      setError(null);

      // Auto-follow: jump to whichever channel had the newest message (from the channel map,
      // since the feed itself only holds the focused channel)
      const p = prefsRef.current ?? data.prefs;
      let newest: { id: string; at: string } | null = null;
      for (const cat of data.categories)
        for (const c of cat.channels) if (c.kind === "text" && !p.hidden.includes(c.id) && c.lastAt && (!newest || c.lastAt > newest.at)) newest = { id: c.id, at: c.lastAt };
      if (p.autoFollow && !firstLoad && !pausedRef.current && newest && newest.at !== lastNewest.current && Date.now() - lastFollow.current >= FOLLOW_DWELL_MS) {
        if (!(focusRef.current.length === 1 && focusRef.current[0] === newest.id)) {
          lastFollow.current = Date.now();
          setFocus([newest.id]);
        }
      }
      if (newest) lastNewest.current = newest.at;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load live chat.");
    } finally {
      busy.current = false;
    }
  }, [focus, merge, onUnread]);

  // Start over when the focused channels change
  useEffect(() => {
    cursor.current = { after: null, since: null };
    pending.current = [];
    setWaiting(0);
    setMessages([]);
    setAtBottom(true);
    setUnseen(0);
    void poll();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void poll(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // ---------- reading: messages that scroll into view count as read ----------
  const readQueue = useRef<Record<string, string>>({});
  const flushRead = useCallback(async () => {
    const channels = readQueue.current;
    if (!Object.keys(channels).length) return;
    readQueue.current = {};
    await fetch("/api/admin/live/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channels }) }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const t = window.setInterval(() => void flushRead(), 1500);
    return () => {
      window.clearInterval(t);
      void flushRead();
    };
  }, [flushRead]);
  const observer = useMemo(
    () =>
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (document.visibilityState !== "visible") return;
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const el = entry.target as HTMLElement;
                const ck = el.dataset.ck;
                const ts = el.dataset.ts;
                if (ck && ts && (!readQueue.current[ck] || readQueue.current[ck] < ts)) readQueue.current[ck] = ts;
              }
            },
            { threshold: 0.6 },
          ),
    [],
  );
  useEffect(() => () => observer?.disconnect(), [observer]);
  const observe = useCallback((el: HTMLElement | null) => el && observer?.observe(el), [observer]);

  function resume() {
    setMessages((list) => merge(list, pending.current, []));
    pending.current = [];
    setWaiting(0);
    setPaused(false);
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter(
      (m) =>
        (!hideBots || !m.bot) &&
        (!mediaOnly || m.attachments.length || m.embeds.some((e) => e.image || e.thumbnail || e.video)) &&
        (!q || m.content.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q) || m.authorName.toLowerCase().includes(q) || m.channelName.toLowerCase().includes(q)),
    );
  }, [messages, search, hideBots, mediaOnly]);

  // Follow new messages while scrolled to the bottom; otherwise count what arrived
  const lastCount = useRef(0);
  const atBottomRef = useRef(atBottom);
  atBottomRef.current = atBottom;
  useEffect(() => {
    const el = feed.current;
    const added = shown.length - lastCount.current;
    lastCount.current = shown.length;
    if (!el) return;
    if (atBottom) el.scrollTo({ top: el.scrollHeight, behavior: "instant" as ScrollBehavior });
    else if (added > 0) setUnseen((n) => n + added);
  }, [shown, atBottom]);
  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    const onLoad = () => atBottomRef.current && el.scrollTo({ top: el.scrollHeight, behavior: "instant" as ScrollBehavior });
    el.addEventListener("load", onLoad, true);
    return () => el.removeEventListener("load", onLoad, true);
  }, []);

  const onScroll = () => {
    const el = feed.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAtBottom(bottom);
    if (bottom) setUnseen(0);
  };

  const ctx: Ctx = useMemo(() => {
    const channels: Record<string, string> = {};
    for (const cat of snap?.categories ?? []) for (const c of cat.channels) channels[c.id] = c.name;
    return { mentions: { channels: { ...known.mentions.channels, ...channels }, roles: known.mentions.roles }, people: known.people, staff: known.staff, onOpenMember };
  }, [snap, known, onOpenMember]);

  async function savePrefs(patch: Partial<Pick<LivePrefs, "hidden" | "autoFollow">>) {
    setPrefs((p) => (p ? { ...p, ...patch } : p));
    const res = await fetch("/api/admin/live/prefs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    if (body?.ok) setPrefs(body.prefs);
    // Hidden channels leave the feed straight away
    if (patch.hidden) {
      setMessages((list) => list.filter((m) => !patch.hidden!.includes(key(m))));
      setFocus((f) => f.filter((id) => !patch.hidden!.includes(id)));
      cursor.current.since = null;
      void poll();
    }
  }

  async function clearAll() {
    await fetch("/api/admin/live/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => undefined);
    readQueue.current = {};
    pending.current = [];
    setWaiting(0);
    setMessages([]);
    setUnseen(0);
    lastUnread.current = {};
    setSnap((s) => (s ? { ...s, stats: { ...s.stats, unread: 0 }, categories: s.categories.map((c) => ({ ...c, channels: c.channels.map((ch) => ({ ...ch, unread: 0 })) })) } : s));
    onUnread?.(0);
    showToast("Cleared. Everything so far is marked read.", "ok");
  }

  function showToast(text: string, tone: "ok" | "error") {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function remove(m: LiveMessage) {
    const res = await fetch("/api/admin/live/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: m.id }) });
    const body = await res.json().catch(() => ({ ok: false, error: "That didn't work." }));
    if (!res.ok || !body.ok) {
      showToast(body.error ?? "That didn't work.", "error");
      return false;
    }
    setMessages((list) => merge(list, [], [body.item]));
    showToast("Message deleted.", "ok");
    return true;
  }

  function jumpTo(id: string) {
    const el = feed.current?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (!el) return showToast("That message isn't loaded in the feed.", "error");
    el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
  }

  // Text channels drop off the list once they've faded out (quiet for FALLOFF_MIN) and have nothing unread
  const isActive = (c: ChannelTile) =>
    c.kind === "voice" ? c.voice.length > 0 : c.unread > 0 || Boolean(c.lastAt && now - new Date(c.lastAt).getTime() < FALLOFF_MIN * 60_000);
  // One channel at a time: clicking the focused channel again shows everything
  const toggleFocus = (id: string) => setFocus((f) => (f[0] === id ? [] : [id]));
  const allTiles = snap?.categories.flatMap((c) => c.channels) ?? [];
  const nameOf = (id: string) => allTiles.find((c) => c.id === id)?.name ?? "channel";
  const hidden = prefs?.hidden ?? [];
  const stats = snap?.stats;

  // Keep the focused channel in view on the map when auto-follow moves it
  const mapRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!prefs?.autoFollow || focus.length !== 1) return;
    mapRef.current?.querySelector<HTMLElement>(`[data-ch="${focus[0]}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus, prefs?.autoFollow]);

  return (
    <div className="live">
      <div className="live-top">
        <span className={`live-status${snap?.bot.online ? " is-on" : ""}`}>
          <Radio size={15} aria-hidden="true" />
          {snap ? (snap.bot.online ? "Live" : `Bot feed offline${snap.bot.lastSeen ? ` · last seen ${ago(snap.bot.lastSeen, now)} ago` : ""}`) : "Connecting…"}
        </span>
        {(
          [
            ["unread", stats?.unread, "unread"],
            ["rate", stats?.perMinute, "msgs / min"],
            ["active", stats?.activeChannels, "active"],
            ["chatting", stats?.chatters, "chatting (1h)"],
            ["voice", stats?.inVoice, "in voice"],
          ] as [StatKey, number | undefined, string][]
        ).map(([k, value, label]) => (
          <button key={k} type="button" className={`live-stat${openStat === k ? " is-open" : ""}`} onClick={() => setOpenStat(openStat === k ? null : k)} aria-expanded={openStat === k}>
            <strong>{value ?? "…"}</strong> {label} <ChevronDown size={13} aria-hidden="true" />
          </button>
        ))}
        {openStat && snap ? (
          <StatDetails
            which={openStat}
            snap={snap}
            now={now}
            staff={known.staff}
            onFocus={(id) => {
              setFocus([id]);
              setOpenStat(null);
            }}
            onOpenMember={onOpenMember}
            onClearAll={() => {
              void clearAll();
              setOpenStat(null);
            }}
            onClose={() => setOpenStat(null)}
          />
        ) : null}
      </div>
      {snap && !snap.bot.online ? (
        <p className="adm-error">
          The bot isn&apos;t sending live messages. Make sure <code>main_bot/events/live_chat.py</code> is uploaded and the bot is running.
        </p>
      ) : null}
      {error ? <p className="adm-error">{error}</p> : null}

      <div className="live-layout">
        <aside className="live-map" aria-label="Channels" ref={mapRef}>
          <div className="live-map-head">
            <h3>Channels</h3>
            <label className="adm-toggle">
              <input type="checkbox" checked={quietShown} onChange={(e) => setQuietShown(e.target.checked)} />
              <span>Show quiet</span>
            </label>
          </div>
          <div className="live-legend" aria-hidden="true">
            <span className="is-live">calm</span>
            <span className="is-warm">busy</span>
            <span className="is-hot">very busy</span>
          </div>
          {(snap?.categories ?? []).map((cat) => {
            const rows = cat.channels.filter((c) => !c.hidden && (quietShown || isActive(c) || focus.includes(c.id)));
            if (!rows.length) return null;
            const catKey = cat.id ?? "none";
            const closed = collapsed.includes(catKey);
            const unread = rows.reduce((n, c) => n + c.unread, 0);
            return (
              <section key={catKey} className="live-cat">
                <button type="button" className="live-cat-head" onClick={() => setCollapsed(closed ? collapsed.filter((k) => k !== catKey) : [...collapsed, catKey])} aria-expanded={!closed}>
                  <ChevronDown size={14} aria-hidden="true" className={closed ? "is-closed" : undefined} />
                  <span>{cat.name}</span>
                  {unread ? <b>{unread}</b> : null}
                </button>
                {!closed
                  ? rows.map((c) => (
                      <div key={c.id} data-ch={c.id}>
                        <ChannelRow
                          c={c}
                          now={now}
                          focused={focus.includes(c.id)}
                          pulse={Boolean(pulses[c.id] && now - pulses[c.id] < PULSE_MS)}
                          onPick={() => toggleFocus(c.id)}
                          onHide={() => void savePrefs({ hidden: [...hidden, c.id] })}
                        />
                      </div>
                    ))
                  : null}
              </section>
            );
          })}
          {snap && !snap.categories.some((c) => c.channels.some((t) => !t.hidden && (quietShown || isActive(t) || focus.includes(t.id)))) ? (
            <p className="adm-empty">No activity right now. Channels appear here when someone talks, and drop off once they&apos;ve been quiet for {FALLOFF_MIN} minutes. Tick “Show quiet” to see every channel.</p>
          ) : null}
          <div className="live-hidden">
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setManagingHidden((v) => !v)} aria-expanded={managingHidden}>
              <EyeOff size={14} aria-hidden="true" /> Hidden channels ({hidden.length})
            </button>
            {managingHidden ? (
              hidden.length ? (
                <>
                  <div className="live-hidden-bulk">
                    <label className="adm-toggle">
                      <input
                        type="checkbox"
                        checked={picked.length === hidden.length}
                        onChange={(e) => setPicked(e.target.checked ? [...hidden] : [])}
                        aria-label="Select all hidden channels"
                      />
                      <span>Select all</span>
                    </label>
                    <button type="button" className="adm-btn adm-btn--small" disabled={!picked.length} onClick={() => void savePrefs({ hidden: hidden.filter((x) => !picked.includes(x)) }).then(() => setPicked([]))}>
                      <Eye size={13} aria-hidden="true" /> Unhide {picked.length ? picked.length : ""}
                    </button>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => void savePrefs({ hidden: [] }).then(() => setPicked([]))}>
                      Unhide all
                    </button>
                  </div>
                  <ul>
                    {hidden.map((id) => (
                      <li key={id}>
                        <label className="live-hidden-pick">
                          <input type="checkbox" checked={picked.includes(id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, id] : p.filter((x) => x !== id)))} />
                          <Hash size={12} aria-hidden="true" /> {nameOf(id)}
                        </label>
                        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => void savePrefs({ hidden: hidden.filter((x) => x !== id) })}>
                          <Eye size={13} aria-hidden="true" /> Show
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="live-muted">Hover a channel and click the eye to hide it. Hidden channels stay hidden on every device.</p>
              )
            ) : null}
          </div>
        </aside>

        <section className="live-feed-wrap" aria-label="Live messages">
          <div className="live-feed-bar">
            <label className="adm-search">
              <Search size={15} aria-hidden="true" />
              <input type="search" placeholder="Filter messages, people, channels…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <button type="button" className={`adm-chip${prefs?.autoFollow ? " is-on" : ""}`} style={{ "--c": "#46a758" } as React.CSSProperties} onClick={() => void savePrefs({ autoFollow: !prefs?.autoFollow })} title="Follow the channel with the newest message (stays at least 12 seconds on each channel)">
              <Crosshair size={12} aria-hidden="true" /> Auto-follow
            </button>
            <button type="button" className={`adm-chip${hideBots ? " is-on" : ""}`} style={{ "--c": "#8b8d98" } as React.CSSProperties} onClick={() => setHideBots(!hideBots)}>
              <Bot size={12} aria-hidden="true" /> Hide bots
            </button>
            <button type="button" className={`adm-chip${mediaOnly ? " is-on" : ""}`} style={{ "--c": "#3e63dd" } as React.CSSProperties} onClick={() => setMediaOnly(!mediaOnly)}>
              <ImageIcon size={12} aria-hidden="true" /> Media
            </button>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => (paused ? resume() : setPaused(true))}>
              {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />} {paused ? `Resume${waiting ? ` (${waiting})` : ""}` : "Pause"}
            </button>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => void clearAll()} title="Clear the feed and mark every channel as read">
              <CheckCheck size={14} aria-hidden="true" /> Clear
            </button>
          </div>
          {focus.length ? (
            <div className="live-focus">
              <span>Focused:</span>
              {focus.map((id) => (
                <button key={id} type="button" className="adm-chip is-on" style={{ "--c": "#f59b2a" } as React.CSSProperties} onClick={() => toggleFocus(id)} title="Unfocus">
                  #{nameOf(id)} <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}

          <ol className="live-feed" ref={feed} onScroll={onScroll}>
            {shown.map((m, i) => {
              const prev = shown[i - 1];
              const grouped = Boolean(prev && prev.authorId === m.authorId && key(prev) === key(m) && !prev.deleted && new Date(m.ts).getTime() - new Date(prev.ts).getTime() < GROUP_MS);
              return <MessageRow key={m.id} m={m} grouped={grouped} guildId={snap?.guildId ?? null} ctx={ctx} onChannel={toggleFocus} onDelete={remove} onJump={jumpTo} observe={observe} />;
            })}
            {snap && !shown.length ? <li className="adm-empty">{messages.length ? "Nothing matches your filters." : "No messages yet. New ones appear here the moment they're sent."}</li> : null}
          </ol>
          {!atBottom && unseen > 0 ? (
            <button
              type="button"
              className="live-jump"
              onClick={() => {
                feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "instant" as ScrollBehavior });
                setAtBottom(true);
                setUnseen(0);
              }}
            >
              {unseen} new message{unseen === 1 ? "" : "s"} ↓
            </button>
          ) : null}
          {toast ? <p className={`live-toast ${toast.tone === "ok" ? "is-ok" : "is-error"}`}>{toast.text}</p> : null}
        </section>
      </div>
    </div>
  );
}
