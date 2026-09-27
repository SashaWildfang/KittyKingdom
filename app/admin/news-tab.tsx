"use client";

import { Eye, Pencil, Pin, PinOff, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NewsBody } from "../news-body";
import { formatDate, timeAgo, useLive, useStored } from "./admin-shared";

type Post = {
  id: string;
  title: string;
  body: string;
  tag: string;
  pinned: boolean;
  published: boolean;
  publishedAt: string;
  updatedAt: string | null;
  authorName: string | null;
};

const TAGS = ["Update", "Announcement", "Event", "Website", "Economy", "Community"];

/** "2026-09-27T14:30" for a datetime-local input */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Post text without the **bold** / *italic* / [link](url) markers, for the list preview */
function plainText(body: string) {
  return body.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*?([^*]+)\*\*?/g, "$1");
}

export function NewsTab() {
  const [sort, setSort] = useStored("news-sort", "newest");
  const [status, setStatus] = useStored("news-status", "all");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Post | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ sort, status, search: query, tag });
  const { data, reload } = useLive<{ posts: Post[] }>(`/api/admin/news?${params}`, 30_000);

  async function send(method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown) {
    setMessage(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const out = await res.json().catch(() => ({ ok: false, error: "That didn't work." }));
    if (!res.ok || !out.ok) {
      setMessage({ text: out.error ?? "That didn't work.", tone: "error" });
      return false;
    }
    setMessage({ text: out.message, tone: "ok" });
    await reload();
    return true;
  }

  const quickSave = (p: Post, patch: Partial<Post>) => send("PATCH", `/api/admin/news/${p.id}`, { ...p, ...patch });

  return (
    <div className="adm-panel">
      <div className="adm-filters">
        <label className="adm-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Search posts…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select className="adm-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">All posts</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="pinned">Pinned</option>
        </select>
        <select className="adm-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="newest">Pinned, then newest</option>
          <option value="oldest">Oldest first</option>
          <option value="updated">Recently edited</option>
          <option value="title">Title A–Z</option>
        </select>
        <button type="button" className="adm-btn" onClick={() => setEditing("new")}>
          <Plus size={15} aria-hidden="true" /> New post
        </button>
      </div>
      <div className="adm-chips">
        {["", ...TAGS].map((t) => (
          <button key={t || "all"} type="button" className={`adm-chip${tag === t ? " is-on" : ""}`} style={{ "--c": "#f59b2a" } as React.CSSProperties} onClick={() => setTag(t)}>
            {t || "All tags"}
          </button>
        ))}
      </div>

      {message ? <p className={message.tone === "ok" ? "adm-notice" : "adm-error"}>{message.text}</p> : null}

      <ul className="adm-news-list">
        {data?.posts.map((p) => (
          <li key={p.id} className={`adm-news-item${p.published ? "" : " is-draft"}`}>
            <div className="adm-news-main">
              <div className="adm-news-meta">
                <span className="adm-tag">{p.tag}</span>
                {p.pinned ? (
                  <span className="adm-tag adm-tag--pin">
                    <Pin size={11} aria-hidden="true" /> Pinned
                  </span>
                ) : null}
                {!p.published ? <span className="adm-tag adm-tag--draft">Draft</span> : null}
                {p.published && new Date(p.publishedAt).getTime() > Date.now() ? <span className="adm-tag">Scheduled</span> : null}
                <span className="adm-muted" title={formatDate(p.publishedAt)}>
                  {new Date(p.publishedAt).getTime() > Date.now() ? `goes live ${timeAgo(p.publishedAt)}` : timeAgo(p.publishedAt)}
                </span>
                {p.authorName ? <span className="adm-muted">· {p.authorName}</span> : null}
              </div>
              <h3>{p.title}</h3>
              <p className="adm-news-excerpt">{(() => {
                  const text = plainText(p.body);
                  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
                })()}</p>
            </div>
            <div className="adm-news-actions">
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setEditing(p)}>
                <Pencil size={14} aria-hidden="true" /> Edit
              </button>
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => void quickSave(p, { pinned: !p.pinned })}>
                {p.pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />} {p.pinned ? "Unpin" : "Pin"}
              </button>
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => void quickSave(p, { published: !p.published })}>
                <Eye size={14} aria-hidden="true" /> {p.published ? "Unpublish" : "Publish"}
              </button>
              {confirmDelete === p.id ? (
                <>
                  <button type="button" className="adm-btn adm-btn--danger adm-btn--small" onClick={() => void send("DELETE", `/api/admin/news/${p.id}`).then(() => setConfirmDelete(null))}>
                    Yes, delete
                  </button>
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirmDelete(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--small adm-news-delete" onClick={() => setConfirmDelete(p.id)}>
                  <Trash2 size={14} aria-hidden="true" /> Delete
                </button>
              )}
            </div>
          </li>
        ))}
        {data && !data.posts.length ? <li className="adm-empty">No posts match.</li> : null}
      </ul>

      {editing
        ? createPortal(
            <NewsEditor
              post={editing === "new" ? null : editing}
              onClose={() => setEditing(null)}
              onSave={async (values) => {
                const ok = editing === "new" ? await send("POST", "/api/admin/news", values) : await send("PATCH", `/api/admin/news/${editing.id}`, values);
                if (ok) setEditing(null);
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function NewsEditor({ post, onClose, onSave }: { post: Post | null; onClose: () => void; onSave: (values: Record<string, unknown>) => Promise<void> }) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [tag, setTag] = useState(post?.tag ?? "Update");
  const [pinned, setPinned] = useState(post?.pinned ?? false);
  const [published, setPublished] = useState(post?.published ?? true);
  const [publishedAt, setPublishedAt] = useState(toLocalInput(post?.publishedAt ?? new Date().toISOString()));
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ title, body, tag, pinned, published, publishedAt: new Date(publishedAt).toISOString() });
    setSaving(false);
  }

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <aside className="adm-drawer adm-news-editor" onClick={(e) => e.stopPropagation()} aria-label={post ? "Edit post" : "New post"}>
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <header>
          <p className="adm-drill-kicker">News</p>
          <h2>{post ? "Edit post" : "New post"}</h2>
        </header>
        <form onSubmit={save} className="adm-form">
          <label>
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="What's new?" />
          </label>
          <div className="adm-form-row">
            <label>
              <span>Tag</span>
              <select className="adm-select" value={tag} onChange={(e) => setTag(e.target.value)}>
                {TAGS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Publish date</span>
              <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
            </label>
          </div>
          <label>
            <span>
              Post{" "}
              <button type="button" className="adm-link" onClick={() => setPreview((v) => !v)}>
                {preview ? "Edit" : "Preview"}
              </button>
            </span>
            {preview ? (
              <div className="adm-news-preview news-card-body">
                <NewsBody body={body || "Nothing written yet."} />
              </div>
            ) : (
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={8000} required placeholder="Write the update. Leave a blank line between paragraphs. **bold**, *italic* and [links](https://…) work." />
            )}
            <small className="adm-muted">{body.length.toLocaleString()} / 8,000</small>
          </label>
          <div className="adm-form-toggles">
            <label className="adm-toggle">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              <span>Published {published ? "(visible on the site)" : "(draft)"}</span>
            </label>
            <label className="adm-toggle">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              <span>Pin to the top</span>
            </label>
          </div>
          <div className="adm-form-actions">
            <button type="submit" className="adm-btn" disabled={saving}>
              {saving ? "Saving…" : post ? "Save changes" : published ? "Publish post" : "Save draft"}
            </button>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
