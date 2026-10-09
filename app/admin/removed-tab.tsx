"use client";

import "./removed-tab.css";
import { ArrowLeft, FileText, Film, Images, MessageSquare, Search, Trash2, UserX, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ArchiveRow, ArchivedMessage } from "../../lib/removed-messages";
import { CopyId, Pager, formatDate, timeAgo, useLive } from "./admin-shared";

type List = { ok: boolean; error?: string; rows: ArchiveRow[]; total: number; page: number; pageSize: number; totals: { archives: number; messages: number; files: number; bytes: number } };
type Detail = { ok: boolean; error?: string; archive: ArchiveRow; channels: { name: string; count: number }[]; messages: ArchivedMessage[]; total: number; page: number; pageSize: number };

const REASONS: Record<string, string> = { left: "Left the server", deleted: "Deleted account", wipe: "Wiped by staff", manual: "Cleaned up by staff" };
const size = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b > 1e3 ? `${Math.round(b / 1e3)} KB` : `${b} B`);

/** Admin → Removed messages: what the Moderation bot removed (people who left, deleted accounts, /wipe), with their media. */
export function RemovedTab() {
  const [open, setOpen] = useState<string | null>(() => (typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("archive") : null));
  const select = (id: string | null) => {
    setOpen(id);
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("archive", id);
    else u.searchParams.delete("archive");
    window.history.replaceState(null, "", u.toString());
  };
  return open ? <ArchiveView id={open} onBack={() => select(null)} /> : <ArchiveList onOpen={select} />;
}

function ArchiveList({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => (setSearch(q), setPage(1)), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error } = useLive<List>(`/api/admin/removed?${new URLSearchParams({ search, reason, page: String(page) })}`, 30_000);

  return (
    <section className="adm-panel rm">
      <div className="adm-kpis rm-kpis">
        <div className="adm-kpi">
          <small>People</small>
          <strong>{data?.totals.archives.toLocaleString() ?? "…"}</strong>
          <span>cleanups archived</span>
        </div>
        <div className="adm-kpi adm-kpi--orange">
          <small>Messages</small>
          <strong>{data?.totals.messages.toLocaleString() ?? "…"}</strong>
          <span>removed and kept here</span>
        </div>
        <div className="adm-kpi adm-kpi--blue">
          <small>Files</small>
          <strong>{data?.totals.files.toLocaleString() ?? "…"}</strong>
          <span>{data ? size(data.totals.bytes) : "…"} of media</span>
        </div>
      </div>
      <p className="adm-muted rm-intro">
        Messages the Moderation bot removed from people who left, deleted Discord accounts and <code>/wipe</code>, with their pictures, videos and files. Settings: Admin → Bots → Moderation Bot → Message cleanup.
      </p>
      <div className="adm-filters">
        <div className="adm-seg" role="tablist" aria-label="Why">
          {[["", "All"], ["left", "Left"], ["deleted", "Deleted accounts"], ["wipe", "Wiped"]].map(([k, label]) => (
            <button key={k || "all"} type="button" className={reason === k ? "is-active" : undefined} onClick={() => (setReason(k), setPage(1))}>
              {label}
            </button>
          ))}
        </div>
        <label className="adm-search">
          <Search size={15} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name or Discord ID" aria-label="Search" />
        </label>
      </div>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data ? (
        error ? null :
        <div className="adm-skeleton" style={{ height: 320 }} />
      ) : !data.rows?.length ? (
        <div className="adm-empty">
          <UserX size={22} aria-hidden="true" /> {search || reason ? "Nothing matches." : "Nothing removed yet. Archives appear here as the bot cleans up."}
        </div>
      ) : (
        <>
          <ul className="rm-list">
            {data.rows.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r.id)}>
                  <span className="rm-avatar" aria-hidden="true">
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="rm-main">
                    <b>{r.name}</b>
                    <small>
                      {r.userId ?? "ID unknown"} · {r.channels.slice(0, 3).map((c) => `#${c}`).join(", ")}
                      {r.channels.length > 3 ? ` +${r.channels.length - 3}` : ""}
                    </small>
                  </span>
                  <span className={`rm-reason is-${r.reason}`}>{REASONS[r.reason] ?? r.reason}</span>
                  <span className="rm-counts">
                    <span>
                      <MessageSquare size={13} aria-hidden="true" /> {r.messages.toLocaleString()}
                    </span>
                    <span>
                      <Images size={13} aria-hidden="true" /> {r.files.toLocaleString()}
                    </span>
                  </span>
                  <time title={formatDate(r.at)}>{r.at ? timeAgo(r.at) : ""}</time>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
    </section>
  );
}

function Media({ f }: { f: ArchivedMessage["files"][number] }) {
  if (!f.url) return <span className="rm-missing">{f.name} (not saved)</span>;
  if (f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif)$/i.test(f.name))
    return (
      <a href={f.url} target="_blank" rel="noreferrer" className="rm-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.url} alt={f.name} loading="lazy" />
      </a>
    );
  if (f.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(f.name)) return <video className="rm-video" src={f.url} controls preload="metadata" />;
  if (f.type.startsWith("audio/") || /\.(mp3|ogg|wav|m4a|flac|opus)$/i.test(f.name)) return <audio src={f.url} controls preload="none" />;
  return (
    <a className="rm-file" href={`${f.url}&download=1`}>
      <FileText size={15} aria-hidden="true" /> {f.name} <small>{size(f.size)}</small>
    </a>
  );
}

function ArchiveView({ id, onBack }: { id: string; onBack: () => void }) {
  const [channel, setChannel] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"messages" | "gallery">("messages");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => (setSearch(q), setPage(1)), 300);
    return () => clearTimeout(t);
  }, [q]);
  const params = new URLSearchParams({ channel, search, page: String(page), ...(view === "gallery" ? { media: "1" } : {}) });
  const { data, error } = useLive<Detail>(`/api/admin/removed/${id}?${params}`, 0);

  const remove = async () => {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/admin/removed/${id}`, { method: "DELETE" }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setErr(r?.error ?? "Couldn't delete it.");
    onBack();
  };

  if (error && !data)
    return (
      <section className="adm-panel rm">
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--small rm-back" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" /> All removed messages
        </button>
        <p className="adm-error">{error}</p>
      </section>
    );
  if (!data) return <div className="adm-skeleton" style={{ height: 420 }} />;
  const a = data.archive;
  let lastDay = "";
  let lastChannel = "";

  return (
    <section className="adm-panel rm">
      <button type="button" className="adm-btn adm-btn--ghost adm-btn--small rm-back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden="true" /> All removed messages
      </button>
      <header className="adm-card rm-head">
        <span className="rm-avatar rm-avatar--big" aria-hidden="true">
          {a.name.charAt(0).toUpperCase()}
        </span>
        <div className="rm-head-text">
          <h2>{a.name}</h2>
          <p className="adm-muted">
            {REASONS[a.reason] ?? a.reason} · removed {a.at ? formatDate(a.at) : "on an unknown date"}
            {a.source === "old-wipe" ? " · imported from the old /wipe logs" : a.source === "old-cleanup" ? " · imported from an older cleanup log" : ""}
          </p>
          {a.userId ? <CopyId id={a.userId} /> : <small className="adm-muted">Discord ID not recorded</small>}
        </div>
        <div className="rm-head-stats">
          <div>
            <b>{a.messages.toLocaleString()}</b>
            <small>messages</small>
          </div>
          <div>
            <b>{a.files.toLocaleString()}</b>
            <small>files · {size(a.bytes)}</small>
          </div>
        </div>
        <div className="rm-head-actions">
          {confirm ? (
            <>
              <button type="button" className="adm-btn adm-btn--small adm-btn--danger" disabled={busy} onClick={() => void remove()}>
                {busy ? "Deleting…" : "Delete for good"}
              </button>
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirm(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirm(true)} title="Delete this archive and its stored media">
              <Trash2 size={14} aria-hidden="true" /> Delete archive
            </button>
          )}
        </div>
      </header>
      {err ? <p className="adm-error">{err}</p> : null}

      <div className="adm-filters">
        <div className="adm-seg" role="tablist">
          <button type="button" className={view === "messages" ? "is-active" : undefined} onClick={() => (setView("messages"), setPage(1))}>
            <MessageSquare size={14} aria-hidden="true" /> Messages
          </button>
          <button type="button" className={view === "gallery" ? "is-active" : undefined} onClick={() => (setView("gallery"), setPage(1))}>
            <Images size={14} aria-hidden="true" /> Media
          </button>
        </div>
        <label className="adm-search">
          <Search size={15} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search their messages" aria-label="Search messages" />
        </label>
      </div>
      {data.channels.length > 1 ? (
        <div className="rm-channels">
          <button type="button" className={!channel ? "is-on" : undefined} onClick={() => (setChannel(""), setPage(1))}>
            Every channel
          </button>
          {data.channels.map((c) => (
            <button key={c.name} type="button" className={channel === c.name ? "is-on" : undefined} onClick={() => (setChannel(c.name), setPage(1))}>
              #{c.name} <small>{c.count}</small>
            </button>
          ))}
          {channel ? (
            <button type="button" onClick={() => setChannel("")} aria-label="Clear channel">
              <X size={12} />
            </button>
          ) : null}
        </div>
      ) : null}

      {!data.messages.length ? (
        <div className="adm-empty">
          {view === "gallery" ? <Film size={22} aria-hidden="true" /> : <MessageSquare size={22} aria-hidden="true" />} {view === "gallery" ? "No media." : "No messages match."}
        </div>
      ) : view === "gallery" ? (
        <div className="rm-gallery">
          {data.messages.flatMap((m) =>
            m.files.map((f, i) => (
              <figure key={`${m.id}-${i}`}>
                <Media f={f} />
                <figcaption>
                  #{m.channel} · {m.at ? formatDate(m.at) : ""}
                </figcaption>
              </figure>
            )),
          )}
        </div>
      ) : (
        <div className="adm-card rm-chat">
          {data.messages.map((m) => {
            const day = m.at ? new Date(m.at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "Unknown date";
            const showDay = day !== lastDay;
            const showChannel = m.channel !== lastChannel || showDay;
            lastDay = day;
            lastChannel = m.channel;
            return (
              <div key={m.id}>
                {showDay ? (
                  <div className="rm-day">
                    <span>{day}</span>
                  </div>
                ) : null}
                <article className="rm-msg">
                  {showChannel ? <div className="rm-msg-channel">#{m.channel}</div> : null}
                  <div className="rm-msg-row">
                    <time title={m.at ? formatDate(m.at) : undefined}>{m.at ? new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""}</time>
                    <div className="rm-msg-body">
                      {m.content ? <p>{m.content}</p> : !m.files.length ? <p className="adm-muted">(no text)</p> : null}
                      {m.stickers.length ? <p className="adm-muted">Sticker: {m.stickers.join(", ")}</p> : null}
                      {m.files.length ? (
                        <div className="rm-files">
                          {m.files.map((f, i) => (
                            <Media key={i} f={f} />
                          ))}
                        </div>
                      ) : null}
                      {m.links.map((u) => (
                        <a key={u} className="rm-link" href={u} target="_blank" rel="noreferrer nofollow">
                          {u}
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      )}
      <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
    </section>
  );
}
