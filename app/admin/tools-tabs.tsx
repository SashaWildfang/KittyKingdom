"use client";

// Admin: announcement composer + scheduler, auto-replies & custom commands, and server checks (who can do what
// where, and channels nobody uses).

import "./tools.css";
import { Bot, CalendarClock, Check, Hash, KeyRound, Megaphone, MessageCircleReply, Moon, Plus, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate, timeAgo, useLive } from "./admin-shared";

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Couldn't reach the server." }));

type Channel = { id: string; name: string; category: string | null };

function ChannelSelect({ channels, value, onChange, label }: { channels: Channel[]; value: string; onChange: (v: string) => void; label: string }) {
  const groups = useMemo(() => {
    const m = new Map<string, Channel[]>();
    for (const c of channels) m.set(c.category ?? "No category", [...(m.get(c.category ?? "No category") ?? []), c]);
    return Array.from(m);
  }, [channels]);
  return (
    <select className="adm-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">Pick a channel…</option>
      {groups.map(([cat, list]) => (
        <optgroup key={cat} label={cat}>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── Announcements ────────────────────────────────────────────────────────────

type Ann = { id: string; channelId: string; content: string; embed: { title: string; description: string; color: string; image: string } | null; ping: string; sendAt: string | null; status: string; messageId: string | null; error: string | null; createdByName: string; sentAt: string | null; updatedAt: string };
type Draft = { id?: string; channelId: string; content: string; useEmbed: boolean; title: string; description: string; color: string; image: string; ping: string; sendAt: string };
const EMPTY: Draft = { channelId: "", content: "", useEmbed: true, title: "", description: "", color: "#f59b2a", image: "", ping: "", sendAt: "" };

const localInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function AnnouncementsTab() {
  const { data, error, reload } = useLive<{ items: Ann[]; channels: Channel[]; roles: { id: string; name: string; color: string | null }[] }>("/api/admin/announcements", 30_000);
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const chan = (id: string) => data?.channels.find((c) => c.id === id)?.name ?? "channel";
  const pingLabel = (p: string) => (p === "everyone" ? "@everyone" : p === "here" ? "@here" : p ? `@${data?.roles.find((r) => r.id === p)?.name ?? "role"}` : "");

  async function save(mode: "draft" | "schedule" | "now") {
    if (!d) return;
    if (mode === "now" && !window.confirm(`Post this in #${chan(d.channelId)} now${d.ping ? ` and ping ${pingLabel(d.ping)}` : ""}?`)) return;
    setBusy(true);
    setProblem(null);
    const r = await post("/api/admin/announcements", {
      op: "save",
      id: d.id,
      channelId: d.channelId,
      content: d.content,
      embed: d.useEmbed ? { title: d.title, description: d.description, color: d.color, image: d.image } : null,
      ping: d.ping,
      sendAt: mode === "schedule" && d.sendAt ? new Date(d.sendAt).toISOString() : null,
      now: mode === "now",
    });
    setBusy(false);
    if (!r?.ok) return setProblem(r?.error ?? "That didn't work.");
    if (r.item?.status === "failed") return setProblem(r.item.error ?? "Discord didn't accept it.");
    setD(null);
    reload();
  }
  async function remove(a: Ann, fromDiscord: boolean) {
    if (!window.confirm(fromDiscord ? "Delete this announcement from Discord too?" : a.status === "scheduled" ? "Cancel this scheduled announcement?" : "Delete this?")) return;
    const r = await post("/api/admin/announcements", { op: "delete", id: a.id, fromDiscord });
    if (!r?.ok) setProblem(r?.error ?? "Couldn't delete that.");
    reload();
  }
  const edit = (a: Ann) => setD({ id: a.id, channelId: a.channelId, content: a.content, useEmbed: Boolean(a.embed), title: a.embed?.title ?? "", description: a.embed?.description ?? "", color: a.embed?.color ?? "#f59b2a", image: a.embed?.image ?? "", ping: a.ping, sendAt: localInput(a.sendAt) });

  return (
    <div className="tl">
      <header className="tl-head">
        <div>
          <h2>
            <Megaphone size={20} aria-hidden="true" /> Announcements
          </h2>
          <p className="adm-muted">Write it, preview it, then post now or pick a time. Scheduled posts go out within a minute of their time (while the bots are online).</p>
        </div>
        {!d ? (
          <button type="button" className="adm-btn adm-btn--small" onClick={() => setD({ ...EMPTY })}>
            <Plus size={14} aria-hidden="true" /> New announcement
          </button>
        ) : null}
      </header>
      {error ? <p className="adm-error">{error}</p> : null}
      {d ? (
        <div className="tl-compose">
          <div className="tl-form">
            <label>
              Channel
              <ChannelSelect channels={data?.channels ?? []} value={d.channelId} onChange={(v) => setD({ ...d, channelId: v })} label="Channel" />
            </label>
            <label>
              Ping
              <select className="adm-select" value={d.ping} onChange={(e) => setD({ ...d, ping: e.target.value })}>
                <option value="">Nobody</option>
                <option value="everyone">@everyone</option>
                <option value="here">@here</option>
                {data?.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Message
              <textarea rows={3} maxLength={2000} value={d.content} onChange={(e) => setD({ ...d, content: e.target.value })} placeholder="Plain text above the embed (optional). Discord formatting works: **bold**, *italic*, links." />
            </label>
            <label className="tl-check">
              <input type="checkbox" checked={d.useEmbed} onChange={(e) => setD({ ...d, useEmbed: e.target.checked })} /> Add an embed
            </label>
            {d.useEmbed ? (
              <>
                <label>
                  Embed title
                  <input value={d.title} maxLength={256} onChange={(e) => setD({ ...d, title: e.target.value })} />
                </label>
                <label>
                  Embed text
                  <textarea rows={5} maxLength={4000} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
                </label>
                <div className="tl-row">
                  <label>
                    Color
                    <input type="color" value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} />
                  </label>
                  <label className="tl-grow">
                    Image link <small className="adm-muted">(https://…, optional)</small>
                    <input value={d.image} onChange={(e) => setD({ ...d, image: e.target.value })} placeholder="https://bear-nation.net/…" />
                  </label>
                </div>
              </>
            ) : null}
            <label>
              Send at <small className="adm-muted">(your time; leave empty to post now or keep as a draft)</small>
              <input type="datetime-local" value={d.sendAt} onChange={(e) => setD({ ...d, sendAt: e.target.value })} />
            </label>
            {problem ? <p className="adm-error">{problem}</p> : null}
            <div className="tl-actions">
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => (setD(null), setProblem(null))}>
                Cancel
              </button>
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy || !d.channelId} onClick={() => void save("draft")}>
                Save draft
              </button>
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy || !d.channelId || !d.sendAt} onClick={() => void save("schedule")}>
                <CalendarClock size={13} aria-hidden="true" /> Schedule
              </button>
              <button type="button" className="adm-btn adm-btn--small" disabled={busy || !d.channelId} onClick={() => void save("now")}>
                <Send size={13} aria-hidden="true" /> Post now
              </button>
            </div>
          </div>
          <div className="tl-preview" aria-label="Preview">
            <small className="adm-muted">Preview · #{d.channelId ? chan(d.channelId) : "channel"}</small>
            <div className="tl-msg">
              <span className="tl-bot">
                <Bot size={16} aria-hidden="true" />
              </span>
              <div>
                <b>Bear Nation</b> <span className="tl-tag">BOT</span>
                {d.ping || d.content ? (
                  <p>
                    {d.ping ? <span className="tl-mention">{pingLabel(d.ping)}</span> : null} {d.content}
                  </p>
                ) : null}
                {d.useEmbed && (d.title || d.description || d.image) ? (
                  <div className="tl-embed" style={{ borderLeftColor: d.color }}>
                    {d.title ? <b>{d.title}</b> : null}
                    {d.description ? <p>{d.description}</p> : null}
                    {/^https:\/\//.test(d.image) ? <img src={d.image} alt="" /> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <ul className="tl-list">
        {data?.items.map((a) => (
          <li key={a.id} className={`is-${a.status}`}>
            <div className="tl-list-head">
              <span className={`tl-status is-${a.status}`}>{a.status === "scheduled" ? "Scheduled" : a.status === "sent" ? "Posted" : a.status === "failed" ? "Failed" : a.status === "sending" ? "Sending…" : "Draft"}</span>
              <b>{a.embed?.title || a.content.slice(0, 80) || "Untitled"}</b>
              <span className="adm-muted">
                <Hash size={12} aria-hidden="true" />
                {chan(a.channelId)}
                {a.ping ? ` · pings ${pingLabel(a.ping)}` : ""}
              </span>
            </div>
            <small className="adm-muted">
              {a.status === "scheduled" && a.sendAt ? `Goes out ${formatDate(a.sendAt)}` : a.status === "sent" && a.sentAt ? `Posted ${timeAgo(a.sentAt)}` : `Edited ${timeAgo(a.updatedAt)}`} · by {a.createdByName}
              {a.error ? ` · ${a.error}` : ""}
            </small>
            <div className="tl-list-actions">
              {a.status !== "sent" && a.status !== "sending" ? (
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => edit(a)}>
                  Edit
                </button>
              ) : null}
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => void remove(a, a.status === "sent")}>
                <Trash2 size={12} aria-hidden="true" /> {a.status === "sent" ? "Delete from Discord" : a.status === "scheduled" ? "Cancel" : "Delete"}
              </button>
            </div>
          </li>
        ))}
        {data && !data.items.length && !d ? <li className="adm-empty">No announcements yet.</li> : null}
      </ul>
    </div>
  );
}

// ── Auto-replies & custom commands ───────────────────────────────────────────

type Rule = { id: string; kind: "reply" | "command"; trigger: string; match: "contains" | "exact" | "starts"; response: string; channels: string[]; cooldown: number; enabled: boolean; uses: number; lastUsedAt: string | null };

export function AutoRepliesTab() {
  const { data, error, reload } = useLive<{ items: Rule[]; channels: Channel[] }>("/api/admin/auto-replies", 60_000);
  const [edit, setEdit] = useState<Partial<Rule> | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [addChan, setAddChan] = useState("");

  async function run(body: Record<string, unknown>, after?: () => void) {
    setProblem(null);
    const r = await post("/api/admin/auto-replies", body);
    if (!r?.ok) return setProblem(r?.error ?? "That didn't work.");
    after?.();
    reload();
  }
  const chan = (id: string) => data?.channels.find((c) => c.id === id)?.name ?? "channel";

  const section = (kind: "reply" | "command") => {
    const items = (data?.items ?? []).filter((r) => r.kind === kind);
    return (
      <section className="tl-box">
        <header>
          <h3>{kind === "reply" ? "Auto-replies" : "Custom commands"}</h3>
          <p className="adm-muted">{kind === "reply" ? "The bot answers when someone says a phrase. Each one has a cooldown per channel." : "Members type !name (or use /tag) and the bot posts the response."}</p>
          <button type="button" className="adm-btn adm-btn--small" onClick={() => setEdit({ kind, trigger: "", match: "contains", response: "", channels: [], cooldown: kind === "reply" ? 120 : 5, enabled: true })}>
            <Plus size={14} aria-hidden="true" /> {kind === "reply" ? "New auto-reply" : "New command"}
          </button>
        </header>
        {items.length ? (
          <ul className="tl-rules">
            {items.map((r) => (
              <li key={r.id} className={r.enabled ? undefined : "is-off"}>
                <div className="tl-rule-head">
                  <code>{kind === "command" ? `!${r.trigger}` : `“${r.trigger}”`}</code>
                  {kind === "reply" ? <span className="adm-muted">{r.match === "exact" ? "whole message" : r.match === "starts" ? "starts with" : "anywhere"}</span> : null}
                  <span className="adm-muted">
                    used {r.uses}× {r.lastUsedAt ? `· ${timeAgo(r.lastUsedAt)}` : ""}
                  </span>
                  <span className="tl-rule-actions">
                    <label className="tl-switch" title={r.enabled ? "On" : "Off"}>
                      <input type="checkbox" checked={r.enabled} onChange={(e) => void run({ op: "toggle", id: r.id, enabled: e.target.checked })} aria-label={r.enabled ? "Turn off" : "Turn on"} />
                      <span />
                    </label>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" onClick={() => setEdit(r)}>
                      Edit
                    </button>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--tiny" aria-label="Delete" onClick={() => window.confirm("Delete this?") && void run({ op: "delete", id: r.id })}>
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
                <p>{r.response}</p>
                {r.channels.length ? <small className="adm-muted">Only in {r.channels.map((c) => `#${chan(c)}`).join(", ")}</small> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="adm-empty">None yet.</p>
        )}
      </section>
    );
  };

  return (
    <div className="tl">
      <header className="tl-head">
        <div>
          <h2>
            <MessageCircleReply size={20} aria-hidden="true" /> Auto-replies &amp; commands
          </h2>
          <p className="adm-muted">
            The Main Bot picks up changes within a minute. Use <code>{"{user}"}</code> to mention whoever triggered it and <code>{"{server}"}</code> for the server name.
          </p>
        </div>
      </header>
      {error ? <p className="adm-error">{error}</p> : null}
      {edit ? (
        <form
          className="tl-box tl-edit"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ op: "save", ...edit }, () => setEdit(null));
          }}
        >
          <h3>{edit.id ? "Edit" : "New"} {edit.kind === "command" ? "command" : "auto-reply"}</h3>
          <div className="tl-row">
            <label className="tl-grow">
              {edit.kind === "command" ? "Command name" : "When someone says"}
              <input autoFocus value={edit.trigger ?? ""} onChange={(e) => setEdit({ ...edit, trigger: e.target.value })} placeholder={edit.kind === "command" ? "rules" : "how do i verify"} />
            </label>
            {edit.kind === "reply" ? (
              <label>
                Match
                <select className="adm-select" value={edit.match} onChange={(e) => setEdit({ ...edit, match: e.target.value as Rule["match"] })}>
                  <option value="contains">Anywhere in the message</option>
                  <option value="starts">At the start</option>
                  <option value="exact">The whole message</option>
                </select>
              </label>
            ) : null}
            <label>
              Cooldown (sec)
              <input type="number" min={0} max={3600} value={edit.cooldown ?? 60} onChange={(e) => setEdit({ ...edit, cooldown: Number(e.target.value) })} />
            </label>
          </div>
          <label>
            The bot says
            <textarea rows={4} maxLength={1900} value={edit.response ?? ""} onChange={(e) => setEdit({ ...edit, response: e.target.value })} />
          </label>
          <div className="tl-chans">
            <span>Only in:</span>
            {(edit.channels ?? []).map((c) => (
              <button key={c} type="button" className="adm-tag" onClick={() => setEdit({ ...edit, channels: (edit.channels ?? []).filter((x) => x !== c) })}>
                #{chan(c)} <X size={11} aria-hidden="true" />
              </button>
            ))}
            {!(edit.channels ?? []).length ? <span className="adm-muted">every channel</span> : null}
            <ChannelSelect channels={data?.channels ?? []} value={addChan} onChange={(v) => (v && setEdit({ ...edit, channels: Array.from(new Set([...(edit.channels ?? []), v])) }), setAddChan(""))} label="Limit to a channel" />
          </div>
          {problem ? <p className="adm-error">{problem}</p> : null}
          <div className="tl-actions">
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => (setEdit(null), setProblem(null))}>
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn--small" disabled={!edit.trigger?.trim() || !edit.response?.trim()}>
              <Check size={13} aria-hidden="true" /> Save
            </button>
          </div>
        </form>
      ) : null}
      {section("reply")}
      {section("command")}
    </div>
  );
}

// ── Server checks ────────────────────────────────────────────────────────────

type PermRow = { channelId: string; name: string; type: string; category: string | null; allowed: boolean; why: string };
type ChanRow = { channelId: string; name: string; type: string; category: string | null; last: string | null; last30: number; note: string | null };

export function ServerToolsTab() {
  const meta = useLive<{ perms: { key: string; label: string }[]; roles: { id: string; name: string }[] }>("/api/admin/server-tools?tool=meta", 0);
  const [who, setWho] = useState<{ kind: "role" | "member"; id: string }>({ kind: "role", id: "" });
  const [perm, setPerm] = useState("view");
  const [result, setResult] = useState<{ rows: PermRow[]; perm: string; admin: boolean } | null>(null);
  const [onlyAllowed, setOnlyAllowed] = useState<"all" | "yes" | "no">("all");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [fresh, setFresh] = useState(0);
  const chans = useLive<{ rows: ChanRow[] }>(`/api/admin/server-tools?tool=channels${fresh ? `&fresh=1&n=${fresh}` : ""}`, 0);

  async function check() {
    setBusy(true);
    setProblem(null);
    const q = new URLSearchParams({ tool: "perms", perm });
    if (who.id) q.set(who.kind, who.id.trim());
    const r = await fetch(`/api/admin/server-tools?${q}`, { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return setProblem(r?.error ?? "Couldn't check that.");
    setResult(r);
  }

  const cutoff = Date.now() - days * 86_400_000;
  const dead = (chans.data?.rows ?? []).filter((c) => !c.note && (!c.last || new Date(c.last).getTime() < cutoff)).sort((a, b) => (a.last ?? "").localeCompare(b.last ?? ""));
  const shown = (result?.rows ?? []).filter((r) => onlyAllowed === "all" || (onlyAllowed === "yes" ? r.allowed : !r.allowed));

  return (
    <div className="tl">
      <section className="tl-box">
        <header>
          <h3>
            <KeyRound size={16} aria-hidden="true" /> Who can do what, where
          </h3>
          <p className="adm-muted">Pick a role (or a member) and a permission. Each channel shows yes or no and the reason, worked out the same way Discord does.</p>
        </header>
        <div className="tl-row">
          <select className="adm-select" value={who.kind} onChange={(e) => setWho({ kind: e.target.value as "role" | "member", id: "" })} aria-label="Check a role or a member">
            <option value="role">A role</option>
            <option value="member">A member</option>
          </select>
          {who.kind === "role" ? (
            <select className="adm-select" value={who.id} onChange={(e) => setWho({ ...who, id: e.target.value })} aria-label="Role">
              <option value="">@everyone</option>
              {meta.data?.roles
                .filter((r) => r.name !== "@everyone")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
            </select>
          ) : (
            <input value={who.id} onChange={(e) => setWho({ ...who, id: e.target.value })} placeholder="Discord ID" aria-label="Member's Discord ID" />
          )}
          <select className="adm-select" value={perm} onChange={(e) => setPerm(e.target.value)} aria-label="Permission">
            {meta.data?.perms.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" className="adm-btn adm-btn--small" disabled={busy || (who.kind === "member" && !/^\d{15,21}$/.test(who.id.trim()))} onClick={() => void check()}>
            Check
          </button>
        </div>
        {problem ? <p className="adm-error">{problem}</p> : null}
        {result ? (
          <>
            <div className="tl-row">
              <b>{result.perm}</b>
              <span className="adm-muted">
                {result.rows.filter((r) => r.allowed).length} yes · {result.rows.filter((r) => !r.allowed).length} no
              </span>
              <select className="adm-select" value={onlyAllowed} onChange={(e) => setOnlyAllowed(e.target.value as typeof onlyAllowed)} aria-label="Show">
                <option value="all">Every channel</option>
                <option value="yes">Only yes</option>
                <option value="no">Only no</option>
              </select>
            </div>
            <table className="tl-table">
              <thead>
                <tr>
                  <th scope="col">Channel</th>
                  <th scope="col">Can they?</th>
                  <th scope="col">Why</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.channelId}>
                    <td>
                      <span className="adm-muted">{r.category ? `${r.category} › ` : ""}</span>#{r.name}
                    </td>
                    <td>{r.allowed ? <span className="tl-yes">Yes</span> : <span className="tl-no">No</span>}</td>
                    <td className="adm-muted">{r.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </section>

      <section className="tl-box">
        <header>
          <h3>
            <Moon size={16} aria-hidden="true" /> Quiet channels
          </h3>
          <p className="adm-muted">Text channels with no messages in a while: candidates to archive, merge or liven up. Counts come from the Moderation Bot&apos;s message history.</p>
          <div className="tl-row">
            <select className="adm-select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Quiet for">
              <option value={14}>Quiet for 2 weeks</option>
              <option value={30}>Quiet for a month</option>
              <option value={90}>Quiet for 3 months</option>
            </select>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setFresh((n) => n + 1)} disabled={chans.loading}>
              <RefreshCw size={13} aria-hidden="true" /> Recount
            </button>
          </div>
        </header>
        {chans.error ? <p className="adm-error">{chans.error}</p> : null}
        {!chans.data ? <p className="adm-muted">Counting messages per channel… (this can take a little while)</p> : null}
        {chans.data ? (
          dead.length ? (
            <table className="tl-table">
              <thead>
                <tr>
                  <th scope="col">Channel</th>
                  <th scope="col">Last message</th>
                  <th scope="col">Last 30 days</th>
                </tr>
              </thead>
              <tbody>
                {dead.map((c) => (
                  <tr key={c.channelId}>
                    <td>
                      <span className="adm-muted">{c.category ? `${c.category} › ` : ""}</span>#{c.name} <small className="adm-muted">{c.type !== "text" ? c.type : ""}</small>
                    </td>
                    <td>{c.last ? <span title={formatDate(c.last)}>{timeAgo(c.last)}</span> : <span className="adm-muted">never (on record)</span>}</td>
                    <td>{c.last30}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="adm-empty">Every text channel has had messages recently. 🎉</p>
          )
        ) : null}
      </section>
    </div>
  );
}
