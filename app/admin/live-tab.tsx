"use client";

import { Bot, ChevronDown, ExternalLink, EyeOff, FileText, Hash, Headphones, ImageIcon, MicOff, MonitorUp, Pause, Play, Radio, Search, Trash2, User, Video, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChannelTile, LiveMessage, LiveSnapshot } from "../../lib/live-chat";
import { RichText, useStored, type Mentions, type People } from "./admin-shared";

const POLL_MS = 2000;
const KEEP = 400;
const PULSE_MS = 2600;

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

function ago(iso: string | null, now: number) {
  if (!iso) return "quiet";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
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

/** An image/video that stays blurred until clicked when it's a spoiler. */
function Media({ src, video, spoiler, alt }: { src: string; video?: boolean; spoiler: boolean; alt: string }) {
  const [shown, setShown] = useState(!spoiler);
  return (
    <div className={`live-media${shown ? "" : " is-hidden"}`}>
      {video ? <video src={src} controls={shown} preload="none" muted /> : <img src={src} alt={alt} loading="lazy" />}
      {!shown ? (
        <button type="button" className="live-spoiler" onClick={() => setShown(true)}>
          <EyeOff size={16} aria-hidden="true" /> Spoiler · click to show
        </button>
      ) : null}
    </div>
  );
}

function MessageRow({
  m,
  guildId,
  mentions,
  people,
  onChannel,
  onOpenMember,
  onDelete,
}: {
  m: LiveMessage;
  guildId: string | null;
  mentions: Mentions;
  people: People;
  onChannel: (id: string) => void;
  onOpenMember: (id: string) => void;
  onDelete: (m: LiveMessage) => Promise<boolean>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const channelId = m.parentId ?? m.channelId;
  return (
    <li className={`live-msg${m.deleted ? " is-deleted" : ""}${m.bot ? " is-bot" : ""}`}>
      <button type="button" className="live-msg-face" onClick={() => onOpenMember(m.authorId)} title="Open their profile">
        <Face src={m.avatar} name={m.displayName} size={36} />
      </button>
      <div className="live-msg-main">
        <div className="live-msg-head">
          <button type="button" className="live-msg-name" onClick={() => onOpenMember(m.authorId)} title={`@${m.authorName}`}>
            {m.displayName}
          </button>
          {m.bot ? <span className="live-tag live-tag--bot">BOT</span> : null}
          <button type="button" className="live-chan" onClick={() => onChannel(channelId)} title={m.categoryName ? `${m.categoryName} · show only this channel` : "Show only this channel"}>
            <Hash size={12} aria-hidden="true" />
            {m.parentName ? `${m.parentName} › ${m.channelName}` : m.channelName}
          </button>
          <time dateTime={m.ts}>{time(m.ts)}</time>
          {m.edited ? <span className="live-tag">edited</span> : null}
        </div>
        {m.reply ? (
          <p className="live-reply">
            ↳ {m.reply.authorName ? <strong>{m.reply.authorName}</strong> : "reply"} {m.reply.content ? `: ${m.reply.content}` : null}
          </p>
        ) : null}
        {m.content ? (
          <div className="live-text">
            <RichText text={m.content} mentions={mentions} people={people} onOpenMember={onOpenMember} />
          </div>
        ) : null}
        {m.attachments.length ? (
          <div className="live-files">
            {m.attachments.map((a) => {
              const src = `/api/admin/live/file/${m.id}/${a.id}`;
              return a.image || a.video ? (
                <Media key={a.id} src={src} video={a.video} spoiler={a.spoiler || m.forceSpoiler} alt={a.filename} />
              ) : (
                <a key={a.id} className="live-file" href={src} target="_blank" rel="noreferrer">
                  <FileText size={14} aria-hidden="true" /> {a.filename}
                </a>
              );
            })}
          </div>
        ) : null}
        {m.embeds.filter((e) => e.image || e.title).length ? (
          <div className="live-files">
            {m.embeds.map((e, i) =>
              e.image ? (
                <Media key={i} src={e.image} spoiler={m.forceSpoiler} alt={e.title ?? "embed"} />
              ) : e.title ? (
                <a key={i} className="live-file" href={e.url ?? "#"} target="_blank" rel="noreferrer nofollow">
                  <ExternalLink size={13} aria-hidden="true" /> {e.title}
                </a>
              ) : null,
            )}
          </div>
        ) : null}
        {m.stickers.length ? <p className="live-muted">Sticker: {m.stickers.join(", ")}</p> : null}
        {m.deleted ? <p className="live-deleted-note"><Trash2 size={12} aria-hidden="true" /> Deleted{m.deletedBy ? ` by ${m.deletedBy} from the website` : " in Discord"}</p> : null}
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
              <button type="button" className="live-icon-btn" onClick={() => onOpenMember(m.authorId)} title="Their profile" aria-label="Their profile">
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

function Tile({ c, now, active, pulse, onPick }: { c: ChannelTile; now: number; active: boolean; pulse: boolean; onPick: () => void }) {
  const heat = c.kind === "voice" ? Math.min(1, c.voice.length / 6) : Math.min(1, c.count5 / 12);
  const live = c.kind === "voice" ? c.voice.length > 0 : c.count5 > 0;
  return (
    <button
      type="button"
      className={`live-tile live-tile--${c.kind}${live ? " is-live" : ""}${active ? " is-active" : ""}${pulse ? " is-pulse" : ""}`}
      style={{ "--heat": heat } as React.CSSProperties}
      onClick={onPick}
      disabled={c.kind === "voice"}
      title={c.kind === "voice" ? `${c.voice.length} in voice` : `${c.count5} in the last 5 min · ${c.count60} in the last hour`}
    >
      <span className="live-tile-head">
        {c.kind === "voice" ? <Volume2 size={13} aria-hidden="true" /> : <Hash size={13} aria-hidden="true" />}
        <span className="live-tile-name">{c.name}</span>
        {c.spoiler ? <EyeOff size={12} aria-label="Images blurred" /> : null}
        {c.kind === "text" && c.count5 ? <b className="live-tile-count">{c.count5}</b> : null}
      </span>
      {c.kind === "voice" ? (
        c.voice.length ? (
          <span className="live-voice">
            {c.voice.map((v) => (
              <span key={v.id} className="live-voice-member" title={v.name}>
                <Face src={v.avatar} name={v.name} size={20} />
                <span>{v.name}</span>
                {v.deafened ? <Headphones size={11} aria-label="Deafened" /> : v.muted ? <MicOff size={11} aria-label="Muted" /> : null}
                {v.streaming ? <MonitorUp size={11} aria-label="Streaming" /> : null}
                {v.video ? <Video size={11} aria-label="Camera on" /> : null}
              </span>
            ))}
          </span>
        ) : (
          <span className="live-tile-sub">empty</span>
        )
      ) : (
        <span className="live-tile-sub">
          {c.lastAuthors.length ? (
            <span className="live-tile-faces">
              {c.lastAuthors.map((a) => (
                <Face key={a.id} src={a.avatar} name={a.name} size={18} />
              ))}
            </span>
          ) : null}
          {ago(c.lastAt, now)}
        </span>
      )}
      <span className="live-tile-heat" aria-hidden="true" />
    </button>
  );
}

/** Admin -> Live Chat: live messages, channel activity and voice, with delete for staff. */
export function LiveTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [channel, setChannel] = useState<string | null>(null);
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [search, setSearch] = useState("");
  const [hideBots, setHideBots] = useStored("live-hide-bots", false);
  const [mediaOnly, setMediaOnly] = useState(false);
  const [quietShown, setQuietShown] = useStored("live-show-quiet", false);
  const [collapsed, setCollapsed] = useStored<string[]>("live-collapsed", []);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const [known, setKnown] = useState<{ people: People; mentions: Mentions }>({ people: {}, mentions: { channels: {}, roles: {} } });
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);

  const cursor = useRef<{ after: string | null; since: string | null }>({ after: null, since: null });
  const pending = useRef<LiveMessage[]>([]);
  const pausedRef = useRef(paused);
  const lastAt = useRef<Record<string, string | null>>({});
  const feed = useRef<HTMLOListElement>(null);
  const busy = useRef(false);
  pausedRef.current = paused;

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
      if (channel) params.set("channel", channel);
      const res = await fetch(`/api/admin/live?${params}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Couldn't load live chat.");
      const data = body as LiveSnapshot;
      const extra = body as { people?: People; mentions?: Mentions };
      if (extra.people && Object.keys(extra.people).length || extra.mentions && (Object.keys(extra.mentions.channels).length || Object.keys(extra.mentions.roles).length)) {
        setKnown((k) => ({
          people: { ...k.people, ...(extra.people ?? {}) },
          mentions: { channels: { ...k.mentions.channels, ...(extra.mentions?.channels ?? {}) }, roles: { ...k.mentions.roles, ...(extra.mentions?.roles ?? {}) } },
        }));
      }

      // Channels that just got a message pulse on the map
      const fresh: Record<string, number> = {};
      for (const cat of data.categories)
        for (const c of cat.channels) {
          const before = lastAt.current[c.id];
          if (c.lastAt && before !== undefined && before !== c.lastAt) fresh[c.id] = Date.now();
          lastAt.current[c.id] = c.lastAt;
        }
      if (Object.keys(fresh).length) setPulses((p) => ({ ...p, ...fresh }));

      const last = data.messages[data.messages.length - 1];
      if (last) cursor.current.after = last.ts;
      cursor.current.since = data.serverTime;
      if (pausedRef.current) {
        pending.current = [...pending.current, ...data.messages];
        setWaiting(new Set(pending.current.map((m) => m.id)).size);
        setMessages((list) => merge(list, [], data.changed));
      } else {
        setMessages((list) => merge(list, data.messages, data.changed));
      }
      setSnap(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load live chat.");
    } finally {
      busy.current = false;
    }
  }, [channel, merge]);

  // Start over when the channel filter changes
  useEffect(() => {
    cursor.current = { after: null, since: null };
    pending.current = [];
    setWaiting(0);
    setMessages([]);
    void poll();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void poll(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

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
        (!mediaOnly || m.attachments.length || m.embeds.some((e) => e.image)) &&
        (!q || m.content.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q) || m.authorName.toLowerCase().includes(q) || m.channelName.toLowerCase().includes(q)),
    );
  }, [messages, search, hideBots, mediaOnly]);

  // Follow new messages while scrolled to the bottom; otherwise count what arrived
  const lastCount = useRef(0);
  useEffect(() => {
    const el = feed.current;
    const added = shown.length - lastCount.current;
    lastCount.current = shown.length;
    if (!el) return;
    if (atBottom) el.scrollTo({ top: el.scrollHeight, behavior: "instant" as ScrollBehavior });
    else if (added > 0) setUnseen((n) => n + added);
  }, [shown, atBottom]);

  // Images finishing loading make the list taller; stay pinned to the newest message
  const atBottomRef = useRef(atBottom);
  atBottomRef.current = atBottom;
  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    const onLoad = () => {
      if (atBottomRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "instant" as ScrollBehavior });
    };
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

  const mentions = useMemo<Mentions>(() => {
    const channels: Record<string, string> = {};
    for (const cat of snap?.categories ?? []) for (const c of cat.channels) channels[c.id] = c.name;
    return { channels: { ...known.mentions.channels, ...channels }, roles: known.mentions.roles };
  }, [snap, known.mentions]);

  async function remove(m: LiveMessage) {
    try {
      const res = await fetch("/api/admin/live/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: m.id }) });
      const body = await res.json().catch(() => ({ ok: false, error: "That didn't work." }));
      if (!res.ok || !body.ok) {
        setToast({ text: body.error ?? "That didn't work.", tone: "error" });
        return false;
      }
      setMessages((list) => merge(list, [], [body.item]));
      setToast({ text: "Message deleted.", tone: "ok" });
      return true;
    } finally {
      window.setTimeout(() => setToast(null), 3500);
    }
  }

  const pickedName = channel ? snap?.categories.flatMap((c) => c.channels).find((c) => c.id === channel)?.name : null;
  const stats = snap?.stats;

  return (
    <div className="live">
      <div className="live-top">
        <span className={`live-status${snap?.bot.online ? " is-on" : ""}`}>
          <Radio size={15} aria-hidden="true" />
          {snap ? (snap.bot.online ? "Live" : `Bot feed offline${snap.bot.lastSeen ? ` · last seen ${ago(snap.bot.lastSeen, now)}` : ""}`) : "Connecting…"}
        </span>
        <span className="live-stat">
          <strong>{stats?.perMinute ?? "…"}</strong> msgs / min
        </span>
        <span className="live-stat">
          <strong>{stats?.activeChannels ?? "…"}</strong> active channels
        </span>
        <span className="live-stat">
          <strong>{stats?.chatters ?? "…"}</strong> chatting (1h)
        </span>
        <span className="live-stat">
          <strong>{stats?.inVoice ?? "…"}</strong> in voice
        </span>
      </div>
      {snap && !snap.bot.online ? (
        <p className="adm-error">
          The bot isn&apos;t sending live messages. Make sure <code>main_bot/events/live_chat.py</code> is uploaded and the bot is running.
        </p>
      ) : null}
      {error ? <p className="adm-error">{error}</p> : null}

      <div className="live-layout">
        <aside className="live-map" aria-label="Channel map">
          <div className="live-map-head">
            <h3>Channels</h3>
            <label className="adm-toggle">
              <input type="checkbox" checked={quietShown} onChange={(e) => setQuietShown(e.target.checked)} />
              <span>Show quiet</span>
            </label>
          </div>
          {(snap?.categories ?? []).map((cat) => {
            const tiles = cat.channels.filter((c) => quietShown || c.count60 > 0 || c.voice.length > 0 || c.id === channel);
            if (!tiles.length) return null;
            const key = cat.id ?? "none";
            const closed = collapsed.includes(key);
            const liveCount = cat.channels.filter((c) => c.count5 > 0 || c.voice.length > 0).length;
            return (
              <section key={key} className="live-cat">
                <button type="button" className="live-cat-head" onClick={() => setCollapsed(closed ? collapsed.filter((k) => k !== key) : [...collapsed, key])} aria-expanded={!closed}>
                  <ChevronDown size={14} aria-hidden="true" className={closed ? "is-closed" : undefined} />
                  <span>{cat.name}</span>
                  {liveCount ? <b>{liveCount} live</b> : null}
                </button>
                {!closed ? (
                  <div className="live-tiles">
                    {tiles.map((c) => (
                      <Tile key={c.id} c={c} now={now} active={channel === c.id} pulse={Boolean(pulses[c.id] && now - pulses[c.id] < PULSE_MS)} onPick={() => setChannel(channel === c.id ? null : c.id)} />
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
          {snap && !snap.categories.some((c) => c.channels.some((t) => quietShown || t.count60 > 0 || t.voice.length > 0)) ? (
            <p className="adm-empty">No activity in the last hour. Tick “Show quiet” to see every channel.</p>
          ) : null}
        </aside>

        <section className="live-feed-wrap" aria-label="Live messages">
          <div className="live-feed-bar">
            <label className="adm-search">
              <Search size={15} aria-hidden="true" />
              <input type="search" placeholder="Filter messages, people, channels…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            {channel ? (
              <button type="button" className="adm-chip is-on" style={{ "--c": "#f59b2a" } as React.CSSProperties} onClick={() => setChannel(null)}>
                #{pickedName ?? "channel"} <X size={12} aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" className={`adm-chip${hideBots ? " is-on" : ""}`} style={{ "--c": "#8b8d98" } as React.CSSProperties} onClick={() => setHideBots(!hideBots)}>
              <Bot size={12} aria-hidden="true" /> Hide bots
            </button>
            <button type="button" className={`adm-chip${mediaOnly ? " is-on" : ""}`} style={{ "--c": "#3e63dd" } as React.CSSProperties} onClick={() => setMediaOnly(!mediaOnly)}>
              <ImageIcon size={12} aria-hidden="true" /> Media only
            </button>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => (paused ? resume() : setPaused(true))}>
              {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />} {paused ? `Resume${waiting ? ` (${waiting} new)` : ""}` : "Pause"}
            </button>
          </div>

          <ol className="live-feed" ref={feed} onScroll={onScroll}>
            {shown.map((m) => (
              <MessageRow key={m.id} m={m} guildId={snap?.guildId ?? null} mentions={mentions} people={known.people} onChannel={setChannel} onOpenMember={onOpenMember} onDelete={remove} />
            ))}
            {snap && !shown.length ? <li className="adm-empty">{messages.length ? "Nothing matches your filters." : "No messages yet. New ones appear here the moment they're sent."}</li> : null}
          </ol>
          {!atBottom && unseen > 0 ? (
            <button
              type="button"
              className="live-jump"
              onClick={() => {
                const el = feed.current;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: "instant" as ScrollBehavior });
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
