"use client";

import { BadgeCheck, Bold, GripVertical, Clock, Code, EyeOff, Eye, Film, Heading, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Pencil, Pin, PinOff, Plus, Quote, Search, Strikethrough, Tags, Trash2, Underline, X, type LucideIcon } from "lucide-react";
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
  status: "published" | "draft" | "pending";
  publishedAt: string;
  updatedAt: string | null;
  authorName: string | null;
  views?: number;
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
  const { data, reload } = useLive<{ posts: Post[]; pending: number }>(`/api/admin/news?${params}`, 30_000);

  // Drag to reorder: only while showing every post in display order (so the order is unambiguous)
  const canReorder = sort === "newest" && status === "all" && !query && !tag;
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  useEffect(() => setOrder(null), [data]);
  const listed = order && data ? (order.map((id) => data.posts.find((p) => p.id === id)).filter(Boolean) as Post[]) : data?.posts ?? [];
  async function dropOn(targetId: string) {
    if (!dragId || dragId === targetId || !data) return;
    const ids = listed.map((p) => p.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setOrder(ids);
    setDragId(null);
    setOverId(null);
    const res = await fetch("/api/admin/news/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }).then((r) => r.json()).catch(() => null);
    setMessage(res?.ok ? { text: "New order saved. This is the order readers see (pinned posts stay on top).", tone: "ok" } : { text: "Couldn't save the new order.", tone: "error" });
    await reload();
  }

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

  // The post open on the right (defaults to the first in the list)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data?.posts.find((p) => p.id === selectedId) ?? data?.posts[0] ?? null;

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
          <option value="pending">Pending review{data?.pending ? ` (${data.pending})` : ""}</option>
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

      {data?.pending && status !== "pending" ? (
        <button type="button" className="adm-news-pending-banner" onClick={() => setStatus("pending")}>
          <Clock size={15} aria-hidden="true" /> {data.pending} post{data.pending === 1 ? " is" : "s are"} waiting for review. Read and approve {data.pending === 1 ? "it" : "them"} →
        </button>
      ) : null}
      {message ? <p className={message.tone === "ok" ? "adm-notice" : "adm-error"}>{message.text}</p> : null}

      <div className="adm-news-split">
        <ul className="adm-news-index" aria-label="Posts">
          <li className="adm-news-order-hint">
            {canReorder ? (
              <>
                <GripVertical size={13} aria-hidden="true" /> Drag posts to change the order readers see
              </>
            ) : (
              "Show all posts, sorted Pinned then newest, to drag and reorder"
            )}
          </li>
          {listed.map((p) => (
            <li
              key={p.id}
              draggable={canReorder}
              onDragStart={(e) => {
                setDragId(p.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(p.id);
              }}
              onDragLeave={() => setOverId((o) => (o === p.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                void dropOn(p.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={`${canReorder ? "is-draggable" : ""}${dragId === p.id ? " is-dragging" : ""}${overId === p.id && dragId !== p.id ? " is-over" : ""}`}
            >
              {canReorder ? <GripVertical size={14} className="adm-news-grip" aria-hidden="true" /> : null}
              <button type="button" className={`${selected?.id === p.id ? "is-on" : ""}${p.status !== "published" ? " is-" + p.status : ""}`} onClick={() => setSelectedId(p.id)}>
                <span className="adm-news-index-meta">
                  <i style={{ background: p.tagColor }} aria-hidden="true" />
                  {p.tag}
                  {p.status === "pending" ? <em className="is-pending">Pending</em> : p.status === "draft" ? <em>Draft</em> : null}
                  {p.pinned ? <Pin size={11} aria-label="Pinned" /> : null}
                </span>
                <b>{p.title}</b>
                <small>
                  {p.status === "published" ? (new Date(p.publishedAt).getTime() > Date.now() ? `goes live ${timeAgo(p.publishedAt)}` : timeAgo(p.publishedAt)) : `saved ${timeAgo(p.updatedAt ?? p.publishedAt)}`}
                  {p.status === "published" && p.views ? ` · ${p.views.toLocaleString()} views` : ""}
                </small>
              </button>
            </li>
          ))}
          {data && !data.posts.length ? <li className="adm-empty">No posts match.</li> : null}
        </ul>

        <section className="adm-news-reader" aria-label="Post">
          {selected ? (
            <>
              <header>
                <div className="adm-news-meta">
                  <span className="adm-tag adm-news-tagchip" style={{ "--c": selected.tagColor } as CSSProperties}>
                    {selected.tag}
                  </span>
                  {selected.pinned ? (
                    <span className="adm-tag adm-tag--pin">
                      <Pin size={11} aria-hidden="true" /> Pinned
                    </span>
                  ) : null}
                  {selected.status === "draft" ? <span className="adm-tag adm-tag--draft">Draft</span> : null}
                  {selected.status === "pending" ? (
                    <span className="adm-tag adm-tag--pending">
                      <Clock size={11} aria-hidden="true" /> Pending review
                    </span>
                  ) : null}
                  {selected.status === "published" && new Date(selected.publishedAt).getTime() > Date.now() ? <span className="adm-tag">Scheduled</span> : null}
                  <span className="adm-muted" title={formatDate(selected.publishedAt)}>
                    {selected.status === "published" ? formatDate(selected.publishedAt) : "Not public"}
                    {selected.authorName ? ` · ${selected.authorName}` : ""}
                    {selected.status === "published" ? ` · ${(selected.views ?? 0).toLocaleString()} view${selected.views === 1 ? "" : "s"}` : ""}
                  </span>
                </div>
                <h2>{selected.title}</h2>
                <div className="adm-news-actions">
                  <button type="button" className="adm-btn adm-btn--small" onClick={() => setEditing(selected)}>
                    <Pencil size={14} aria-hidden="true" /> Edit
                  </button>
                  {selected.status === "pending" ? (
                    <button type="button" className="adm-btn adm-btn--small adm-btn--approve" onClick={() => void quickSave(selected, { status: "published", published: true, publishedAt: new Date().toISOString() })}>
                      <BadgeCheck size={14} aria-hidden="true" /> Approve &amp; publish
                    </button>
                  ) : (
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => void quickSave(selected, selected.status === "published" ? { status: "draft", published: false } : { status: "published", published: true })}>
                      <Eye size={14} aria-hidden="true" /> {selected.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                  )}
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => void quickSave(selected, { pinned: !selected.pinned })}>
                    {selected.pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />} {selected.pinned ? "Unpin" : "Pin"}
                  </button>
                  {selected.status === "published" ? (
                    <a className="adm-btn adm-btn--ghost adm-btn--small" href={`/news/${selected.id}`} target="_blank" rel="noreferrer">
                      <Eye size={14} aria-hidden="true" /> View live
                    </a>
                  ) : null}
                  {confirmDelete === selected.id ? (
                    <>
                      <button type="button" className="adm-btn adm-btn--danger adm-btn--small" onClick={() => void send("DELETE", `/api/admin/news/${selected.id}`).then(() => setConfirmDelete(null))}>
                        Yes, delete
                      </button>
                      <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--small adm-news-delete" onClick={() => setConfirmDelete(selected.id)}>
                      <Trash2 size={14} aria-hidden="true" /> Delete
                    </button>
                  )}
                </div>
              </header>
              <div className="adm-news-read news-card-body">
                <NewsBody body={selected.body} />
              </div>
            </>
          ) : (
            <p className="adm-empty">{data ? "Pick a post on the left to read it." : "Loading…"}</p>
          )}
        </section>
      </div>

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
              onDelete={async () => {
                if (editing !== "new" && (await send("DELETE", `/api/admin/news/${editing.id}`))) setEditing(null);
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function NewsEditor({
  post,
  tags,
  onClose,
  onSave,
  onDelete,
}: {
  post: Post | null;
  tags: Tag[];
  onClose: () => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [tag, setTag] = useState(post?.tag ?? tags[0]?.name ?? "");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [pinned, setPinned] = useState(post?.pinned ?? false);
  const [status, setStatus] = useState<Post["status"]>(post?.status ?? "published");
  const [publishedAt, setPublishedAt] = useState(toLocalInput(post?.publishedAt ?? new Date().toISOString()));
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saveDraft() {
    setSaving(true);
    await onSave({ title, body, tag, pinned, status: "draft", published: false, publishedAt: new Date(publishedAt).toISOString() });
    setSaving(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ title, body, tag, pinned, status, published: status === "published", publishedAt: new Date(publishedAt).toISOString() });
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
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required={status !== "draft"} placeholder="What's new?" />
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
            {status === "published" ? (
              <label>
                <span>Publish date</span>
                <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
              </label>
            ) : (
              <p className="adm-news-when">{status === "pending" ? "Stays pending until an admin presses Approve & publish. It never posts by itself." : "Drafts are only visible here."}</p>
            )}
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
                  required={status !== "draft"}
                  placeholder="Write the update. Select text and use the buttons above, or type Discord-style formatting like **bold** and *italic*."
                />
              </>
            )}
            <small className="adm-muted">{body.length.toLocaleString()} / 8,000</small>
          </label>
          <div className="adm-news-status" role="radiogroup" aria-label="Status">
            {(
              [
                ["published", "Publish", "Live on the site at the publish date"],
                ["pending", "Pend review", "Never goes live on its own: an admin reads and approves it"],
                ["draft", "Draft", "Only visible here"],
              ] as const
            ).map(([value, label, hint]) => (
              <button key={value} type="button" role="radio" aria-checked={status === value} className={status === value ? "is-on" : undefined} onClick={() => setStatus(value)}>
                <b>{label}</b>
                <small>{hint}</small>
              </button>
            ))}
          </div>
          <div className="adm-form-toggles">
            <label className="adm-toggle">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              <span>Pin to the top</span>
            </label>
          </div>
          <div className="adm-form-actions">
            <button type="submit" className="adm-btn" disabled={saving}>
              {saving ? "Saving…" : status === "published" ? (post ? "Save & keep live" : "Publish post") : status === "pending" ? "Pend review" : "Save draft"}
            </button>
            {status !== "draft" ? (
              <button type="button" className="adm-btn adm-btn--ghost" disabled={saving} onClick={() => void saveDraft()} title="Save it as a draft (only visible here) and finish later">
                Save as draft
              </button>
            ) : null}
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            {post && post.status !== "published" ? (
              confirmingDelete ? (
                <span className="adm-news-editor-delete">
                  <button type="button" className="adm-btn adm-btn--danger adm-btn--small" onClick={() => void onDelete()}>
                    Yes, delete {post.status === "draft" ? "draft" : "post"}
                  </button>
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setConfirmingDelete(false)}>
                    Keep it
                  </button>
                </span>
              ) : (
                <button type="button" className="adm-btn adm-btn--ghost adm-news-delete adm-news-editor-delete" onClick={() => setConfirmingDelete(true)}>
                  <Trash2 size={14} aria-hidden="true" /> Delete {post.status === "draft" ? "draft" : "post"}
                </button>
              )
            ) : null}
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

  const [uploading, setUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  /** Puts a media line on its own line at the cursor (add a caption inside the square brackets). */
  function insertBlock(line: string) {
    const el = textRef.current;
    const at = el ? el.selectionStart : value.length;
    const before = value.slice(0, at);
    const after = value.slice(at);
    const text = `${before && !before.endsWith("\n") ? "\n" : ""}${line}\n${after.startsWith("\n") || !after ? "" : "\n"}`;
    const next = before + text + after;
    if (next.length > 8000) return setMediaError("The post is too long to add that.");
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const caret = before.length + text.indexOf("![") + 2;
      el?.setSelectionRange(caret, caret);
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
      <span className="adm-format-sep" aria-hidden="true" />
      <label className={`adm-format-media${uploading ? " is-busy" : ""}`} title="Upload an image or short video (up to 4 MB)">
        <ImagePlus size={13} aria-hidden="true" /> {uploading ? "Uploading…" : "Media"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
          hidden
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setUploading(true);
            setMediaError(null);
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/admin/news/media", { method: "POST", body: form }).catch(() => null);
            const out = res ? await res.json().catch(() => null) : null;
            setUploading(false);
            if (!out?.ok) return setMediaError(out?.error ?? "Upload failed.");
            insertBlock(`![](${out.url})`);
          }}
        />
      </label>
      <button
        type="button"
        className="adm-format-media"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const url = window.prompt("Paste a YouTube link, or a direct https:// link to an image or video:")?.trim();
          if (!url) return;
          if (!/^https:\/\/\S+$/.test(url)) return setMediaError("That needs to be an https:// link.");
          setMediaError(null);
          insertBlock(`![](${url})`);
        }}
        title="Embed a YouTube video or a linked image/video"
      >
        <Film size={13} aria-hidden="true" /> Embed
      </button>
      {mediaError ? <span className="adm-format-error">{mediaError}</span> : null}
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
