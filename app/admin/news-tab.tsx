"use client";

import { Bold, Code, EyeOff, Eye, Heading, Italic, Link2, List, ListOrdered, Minus, Pencil, Pin, PinOff, Plus, Quote, Search, Strikethrough, Tags, Trash2, Underline, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { newsExcerpt } from "../../lib/news-format";
import { NewsBody } from "../news-body";
import { LeafEmote } from "../ui-icons";
import { formatDate, timeAgo, useLive, useStored } from "./admin-shared";

type Post = {
  id: string;
  title: string;
  body: string;
  tag: string;
  tagColor: string;
  pinned: boolean;
  published: boolean;
  publishedAt: string;
  updatedAt: string | null;
  authorName: string | null;
};

type Tag = { id: string; name: string; color: string; count: number };

/** "2026-09-27T14:30" for a datetime-local input */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewsTab() {
  const [sort, setSort] = useStored("news-sort", "newest");
  const [status, setStatus] = useStored("news-status", "all");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Post | "new" | null>(null);
  const [managingTags, setManagingTags] = useState(false);
  const tagsLive = useLive<{ tags: Tag[] }>("/api/admin/news/tags", 60_000);
  const tags = tagsLive.data?.tags ?? [];
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
        <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setManagingTags(true)}>
          <Tags size={15} aria-hidden="true" /> Manage tags
        </button>
        <button type="button" className="adm-btn" onClick={() => setEditing("new")}>
          <Plus size={15} aria-hidden="true" /> New post
        </button>
      </div>
      <div className="adm-chips">
        <button type="button" className={`adm-chip${tag === "" ? " is-on" : ""}`} style={{ "--c": "#f59b2a" } as CSSProperties} onClick={() => setTag("")}>
          All tags
        </button>
        {tags.map((t) => (
          <button key={t.id} type="button" className={`adm-chip${tag === t.name ? " is-on" : ""}`} style={{ "--c": t.color } as CSSProperties} onClick={() => setTag(tag === t.name ? "" : t.name)}>
            {t.name} <small>{t.count}</small>
          </button>
        ))}
      </div>

      {message ? <p className={message.tone === "ok" ? "adm-notice" : "adm-error"}>{message.text}</p> : null}

      <ul className="adm-news-list">
        {data?.posts.map((p) => (
          <li key={p.id} className={`adm-news-item${p.published ? "" : " is-draft"}`}>
            <div className="adm-news-main">
              <div className="adm-news-meta">
                <span className="adm-tag adm-news-tagchip" style={{ "--c": p.tagColor } as CSSProperties}>
                  {p.tag}
                </span>
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
              <p className="adm-news-excerpt">{newsExcerpt(p.body, 220).text}</p>
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

      {managingTags
        ? createPortal(
            <TagManager
              tags={tags}
              onClose={() => setManagingTags(false)}
              onChanged={async () => {
                await Promise.all([tagsLive.reload(), reload()]);
              }}
            />,
            document.body,
          )
        : null}

      {editing
        ? createPortal(
            <NewsEditor
              tags={tags}
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

function NewsEditor({ post, tags, onClose, onSave }: { post: Post | null; tags: Tag[]; onClose: () => void; onSave: (values: Record<string, unknown>) => Promise<void> }) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [tag, setTag] = useState(post?.tag ?? tags[0]?.name ?? "");
  const textRef = useRef<HTMLTextAreaElement>(null);
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
              <select className="adm-select" value={tag} onChange={(e) => setTag(e.target.value)} required>
                {!tags.some((t) => t.name === tag) ? <option value="">Pick a tag…</option> : null}
                {tags.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
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
              <>
                <FormatBar textRef={textRef} value={body} onChange={setBody} />
                <textarea
                  ref={textRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  maxLength={8000}
                  required
                  placeholder="Write the update. Select text and use the buttons above, or type Discord-style formatting like **bold** and *italic*."
                />
              </>
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

type FormatAction =
  | { kind: "wrap"; before: string; after: string; placeholder: string }
  | { kind: "line"; prefix: string | ((i: number) => string); pattern: RegExp }
  | { kind: "insert"; text: string }
  | { kind: "link" };

const FORMATS: { key: string; label: string; icon: LucideIcon | null; text?: string; shortcut?: string; action: FormatAction }[] = [
  { key: "b", label: "Bold", icon: Bold, shortcut: "b", action: { kind: "wrap", before: "**", after: "**", placeholder: "bold text" } },
  { key: "i", label: "Italic", icon: Italic, shortcut: "i", action: { kind: "wrap", before: "*", after: "*", placeholder: "italic text" } },
  { key: "u", label: "Underline", icon: Underline, shortcut: "u", action: { kind: "wrap", before: "__", after: "__", placeholder: "underlined text" } },
  { key: "s", label: "Strikethrough", icon: Strikethrough, action: { kind: "wrap", before: "~~", after: "~~", placeholder: "crossed out" } },
  { key: "sp", label: "Spoiler", icon: EyeOff, action: { kind: "wrap", before: "||", after: "||", placeholder: "hidden text" } },
  { key: "code", label: "Code", icon: Code, action: { kind: "wrap", before: "`", after: "`", placeholder: "code" } },
  { key: "h", label: "Heading", icon: Heading, action: { kind: "line", prefix: "## ", pattern: /^#{1,3}\s+/ } },
  { key: "ul", label: "Bullet list", icon: List, action: { kind: "line", prefix: "- ", pattern: /^[-*•]\s+/ } },
  { key: "ol", label: "Numbered list", icon: ListOrdered, action: { kind: "line", prefix: (i) => `${i + 1}. `, pattern: /^\d+[.)]\s+/ } },
  { key: "q", label: "Quote", icon: Quote, action: { kind: "line", prefix: "> ", pattern: /^>\s?/ } },
  { key: "link", label: "Link", icon: Link2, shortcut: "k", action: { kind: "link" } },
  { key: "hr", label: "Divider", icon: Minus, action: { kind: "insert", text: "\n---\n" } },
  { key: "leaf", label: "Leaf emoji", icon: null, action: { kind: "insert", text: ":leaf:" } },
];

/** Formatting buttons above the post box: wrap the selection, or format whole lines. */
function FormatBar({ textRef, value, onChange }: { textRef: React.RefObject<HTMLTextAreaElement>; value: string; onChange: (v: string) => void }) {
  function apply(action: FormatAction) {
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    let next = value;
    let selStart = start;
    let selEnd = end;

    if (action.kind === "wrap" || action.kind === "link") {
      const selected = value.slice(start, end);
      if (action.kind === "wrap") {
        // Clicking again on already-wrapped text removes the formatting
        const outer = value.slice(start - action.before.length, end + action.after.length);
        if (selected && outer === action.before + selected + action.after) {
          next = value.slice(0, start - action.before.length) + selected + value.slice(end + action.after.length);
          selStart = start - action.before.length;
          selEnd = selStart + selected.length;
        } else {
          const inner = selected || action.placeholder;
          next = value.slice(0, start) + action.before + inner + action.after + value.slice(end);
          selStart = start + action.before.length;
          selEnd = selStart + inner.length;
        }
      } else {
        const label = selected || "link text";
        const url = "https://";
        next = `${value.slice(0, start)}[${label}](${url})${value.slice(end)}`;
        selStart = start + label.length + 3;
        selEnd = selStart + url.length;
      }
    } else if (action.kind === "line") {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const nextBreak = value.indexOf("\n", end);
      const lineEnd = nextBreak === -1 ? value.length : nextBreak;
      const lines = value.slice(lineStart, lineEnd).split("\n");
      const all = lines.every((l) => action.pattern.test(l));
      const changed = lines.map((l, i) => (all ? l.replace(action.pattern, "") : (typeof action.prefix === "function" ? action.prefix(i) : action.prefix) + l.replace(action.pattern, ""))).join("\n");
      next = value.slice(0, lineStart) + changed + value.slice(lineEnd);
      selStart = lineStart;
      selEnd = lineStart + changed.length;
    } else {
      next = value.slice(0, start) + action.text + value.slice(end);
      selStart = selEnd = start + action.text.length;
    }

    if (next.length > 8000) return;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  // Ctrl/⌘ + B, I, U, K while typing
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const f = FORMATS.find((x) => x.shortcut === e.key.toLowerCase());
      if (f) {
        e.preventDefault();
        apply(f.action);
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  });

  return (
    <div className="adm-format-bar" role="toolbar" aria-label="Formatting">
      {FORMATS.map((f) => (
        <button
          key={f.key}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply(f.action)}
          title={f.shortcut ? `${f.label} (Ctrl/⌘ + ${f.shortcut.toUpperCase()})` : f.label}
          aria-label={f.label}
        >
          {f.icon ? <f.icon size={15} aria-hidden="true" /> : <LeafEmote size={16} />}
        </button>
      ))}
    </div>
  );
}

/** Add, rename, recolor and delete news tags. */
function TagManager({ tags, onClose, onChanged }: { tags: Tag[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#f59b2a");
  const [drafts, setDrafts] = useState<Record<string, { name: string; color: string }>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(method: "POST" | "PATCH" | "DELETE", url: string, body: unknown) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({ ok: false, error: "That didn't work." }));
      if (!res.ok || !out.ok) {
        setMessage({ text: out.error ?? "That didn't work.", tone: "error" });
        return false;
      }
      setMessage({ text: out.message, tone: "ok" });
      await onChanged();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <aside className="adm-drawer adm-tag-manager" onClick={(e) => e.stopPropagation()} aria-label="Manage tags">
        <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <header>
          <p className="adm-drill-kicker">News</p>
          <h2>Manage tags</h2>
          <p className="adm-muted">Renaming a tag updates every post that uses it.</p>
        </header>

        <form
          className="adm-tag-add"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send("POST", "/api/admin/news/tags", { name, color })) setName("");
          }}
        >
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Tag color" />
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="New tag name" required />
          <button type="submit" className="adm-btn" disabled={busy || !name.trim()}>
            <Plus size={15} aria-hidden="true" /> Add tag
          </button>
        </form>

        {message ? <p className={message.tone === "ok" ? "adm-notice" : "adm-error"}>{message.text}</p> : null}

        <ul className="adm-tag-list">
          {tags.map((t) => {
            const draft = drafts[t.id] ?? { name: t.name, color: t.color };
            const dirty = draft.name !== t.name || draft.color !== t.color;
            const setDraft = (d: Partial<typeof draft>) => setDrafts((all) => ({ ...all, [t.id]: { ...draft, ...d } }));
            return (
              <li key={t.id} style={{ "--c": draft.color } as CSSProperties}>
                <div className="adm-tag-row">
                  <input type="color" value={draft.color} onChange={(e) => setDraft({ color: e.target.value })} aria-label={`${t.name} color`} />
                  <input value={draft.name} onChange={(e) => setDraft({ name: e.target.value })} maxLength={24} aria-label="Tag name" />
                  <span className="adm-muted adm-tag-count">
                    {t.count} post{t.count === 1 ? "" : "s"}
                  </span>
                  {dirty ? (
                  <button
                    type="button"
                    className="adm-btn adm-btn--small"
                    disabled={busy}
                    onClick={async () => {
                      if (await send("PATCH", `/api/admin/news/tags/${t.id}`, draft)) setDrafts(({ [t.id]: _gone, ...rest }) => rest);
                    }}
                  >
                    Save
                  </button>
                  ) : null}
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--small adm-news-delete"
                    aria-label={`Delete ${t.name}`}
                    onClick={() => {
                      setDeleting(deleting === t.id ? null : t.id);
                      setMoveTo(tags.find((x) => x.id !== t.id)?.id ?? "");
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
                {deleting === t.id ? (
                  <div className="adm-tag-confirm">
                    {t.count ? (
                      <label>
                        Move its {t.count} post{t.count === 1 ? "" : "s"} to
                        <select className="adm-select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                          {tags
                            .filter((x) => x.id !== t.id)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : (
                      <span>No posts use this tag.</span>
                    )}
                    <button
                      type="button"
                      className="adm-btn adm-btn--danger adm-btn--small"
                      disabled={busy}
                      onClick={async () => {
                        if (await send("DELETE", `/api/admin/news/tags/${t.id}`, { moveTo })) setDeleting(null);
                      }}
                    >
                      Yes, delete “{t.name}”
                    </button>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setDeleting(null)}>
                      Cancel
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
