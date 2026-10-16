"use client";

import "./rules-tab.css";
import { ArrowDown, ArrowUp, BookOpen, ExternalLink, Plus, RotateCcw, Save, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { RulePartSource, RuleSource, RulesSource } from "../../lib/rules-source";
import { timeAgo, useLive } from "./admin-shared";
import { askConfirm } from "../confirm-dialog";

type State = {
  ok: boolean;
  error?: string;
  source: RulesSource;
  edited: boolean;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  names: { channels: Record<string, string>; roles: Record<string, string> };
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const toHex = (c: number[]) => `#${c.map((n) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, "0")).join("")}`;
const fromHex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
function move<T>(list: T[], i: number, by: number) {
  const out = list.slice();
  const j = i + by;
  if (j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
const emptyRule = (): RuleSource => ({ title: "", points: [""], bad: [], good: [] });

/** A list of short texts, one box each, with add and remove. */
function TextList({ items, onChange, label, add, rows = 2, max }: { items: string[]; onChange: (v: string[]) => void; label: string; add: string; rows?: number; max: number }) {
  return (
    <div className="rt-list">
      {items.map((t, i) => (
        <div key={i} className="rt-list-row">
          <textarea rows={rows} value={t} aria-label={`${label} ${i + 1}`} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="rt-icon-btn" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X size={15} />
          </button>
        </div>
      ))}
      {items.length < max ? (
        <button type="button" className="rt-add" onClick={() => onChange([...items, ""])}>
          <Plus size={14} /> {add}
        </button>
      ) : null}
    </div>
  );
}

/** Admin → Rules: the server rules for Discord's #rules and the website's Rules page. */
export function RulesTab() {
  const { data, error, reload } = useLive<State>("/api/admin/rules", 0);
  const [form, setForm] = useState<RulesSource | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<number>(-1); // -1 = welcome & short version
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (data?.ok && !dirty) setForm(clone(data.source));
  }, [data, dirty]);

  // Don't lose an edit to a stray click away
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!data && error)
    return (
      <div className="adm-error" role="alert">
        Couldn&apos;t load the rules: {error}{" "}
        <button type="button" className="adm-btn adm-btn--small" onClick={() => void reload()}>
          Retry
        </button>
      </div>
    );
  if (!data || (data.ok && !form)) return <div className="adm-skeleton" style={{ height: 520 }} />;
  if (!data.ok || !form) return <p className="adm-error">{data.error ?? "Couldn't load the rules."}</p>;

  const change = (next: RulesSource) => {
    setForm(next);
    setDirty(true);
    setMsg(null);
  };
  const setPart = (i: number, patch: Partial<RulePartSource>) => change({ ...form, parts: form.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setRule = (pi: number, ri: number, patch: Partial<RuleSource>) =>
    setPart(pi, { rules: form.parts[pi].rules.map((r, j) => (j === ri ? { ...r, ...patch } : r)) });

  const send = async (method: "PUT" | "DELETE") => {
    setBusy(true);
    const r = await fetch("/api/admin/rules", { method, headers: { "Content-Type": "application/json" }, body: method === "PUT" ? JSON.stringify({ source: form }) : undefined })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return setMsg({ ok: false, text: r?.error ?? "Couldn't save." });
    setDirty(false);
    setForm(clone(r.source));
    setMsg({ ok: true, text: r.message });
    await reload();
  };
  const copyToken = async (token: string) => {
    await navigator.clipboard?.writeText(token).catch(() => undefined);
    setCopied(token);
    window.setTimeout(() => setCopied((c) => (c === token ? null : c)), 1500);
  };

  // Rule numbers run on across parts, like in Discord
  const firstNumber = (pi: number) => 1 + form.parts.slice(0, pi).reduce((n, p) => n + p.rules.length, 0);
  const part = open >= 0 ? form.parts[open] : null;

  return (
    <section className="adm-panel rt">
      <div className="adm-card rt-top">
        <span className="rt-top-icon" aria-hidden="true">
          <BookOpen size={20} />
        </span>
        <div>
          <h3>Server rules</h3>
          <p className="adm-muted">
            One text for Discord&apos;s #rules (every posted copy is edited within a minute of saving) and the website&apos;s{" "}
            <a href="/rules" target="_blank" rel="noopener noreferrer">
              Rules page <ExternalLink size={12} aria-hidden="true" />
            </a>
            . Use <b>**bold**</b> and <b>[text](https://link)</b>. {data.edited ? `Last edited ${data.updatedAt ? timeAgo(data.updatedAt) : ""}${data.updatedBy ? ` by ${data.updatedBy}` : ""}.` : "Showing the original rules from the bot's code."}
          </p>
        </div>
      </div>

      <div className="rt-layout">
        <nav className="adm-card rt-nav" aria-label="Rules parts">
          <button type="button" className={open === -1 ? "is-on" : undefined} onClick={() => setOpen(-1)}>
            <span className="rt-nav-emoji" aria-hidden="true">
              📜
            </span>
            <span>
              <b>Welcome &amp; short version</b>
              <small>{form.tldr.length} short rules</small>
            </span>
          </button>
          {form.parts.map((p, i) => {
            const first = firstNumber(i);
            return (
              <button key={i} type="button" className={open === i ? "is-on" : undefined} onClick={() => setOpen(i)}>
                <span className="rt-nav-emoji" aria-hidden="true" style={{ background: `${toHex(p.color)}33` }}>
                  {p.emoji}
                </span>
                <span>
                  <b>{p.title || "Untitled part"}</b>
                  <small>{p.rules.length > 1 ? `Rules ${first}–${first + p.rules.length - 1}` : p.rules.length ? `Rule ${first}` : "No rules yet"}</small>
                </span>
              </button>
            );
          })}
          {form.parts.length < 12 ? (
            <button
              type="button"
              className="rt-nav-add"
              onClick={() => {
                let n = form.parts.length + 1;
                while (form.parts.some((p) => p.key === `part${n}`)) n++;
                change({ ...form, parts: [...form.parts, { key: `part${n}`, title: `Part ${form.parts.length + 1} · New part`, emoji: "📜", color: [232, 124, 45], intro: "", rules: [emptyRule()], info: [] }] });
                setOpen(form.parts.length);
              }}
            >
              <Plus size={15} /> Add a part
            </button>
          ) : null}
        </nav>

        <div className="rt-main">
          {part === null ? (
            <div className="adm-card rt-card">
              <h3>Welcome text</h3>
              <p className="adm-muted">The top of #rules and of the Rules page. Leave an empty line between paragraphs.</p>
              <textarea className="rt-big" rows={9} value={form.intro} onChange={(e) => change({ ...form, intro: e.target.value })} aria-label="Welcome text" />
              <h3>The short version</h3>
              <p className="adm-muted">One line each, up to 12.</p>
              <TextList items={form.tldr} onChange={(tldr) => change({ ...form, tldr })} label="Short rule" add="Add a line" rows={1} max={12} />
            </div>
          ) : (
            <>
              <div className="adm-card rt-card">
                <div className="rt-part-head">
                  <label className="rt-field rt-field--emoji">
                    <span>Emoji</span>
                    <input value={part.emoji} maxLength={8} onChange={(e) => setPart(open, { emoji: e.target.value })} />
                  </label>
                  <label className="rt-field rt-field--grow">
                    <span>Title</span>
                    <input value={part.title} maxLength={80} onChange={(e) => setPart(open, { title: e.target.value })} placeholder="Part 1 · The Basics" />
                  </label>
                  <label className="rt-field rt-field--color">
                    <span>Color</span>
                    <input type="color" value={toHex(part.color)} onChange={(e) => setPart(open, { color: fromHex(e.target.value) })} />
                  </label>
                </div>
                <p className="adm-muted rt-hint">“Part 1 · The Basics” shows “Part 1” as a small label on the website.</p>
                <label className="rt-field">
                  <span>Intro (optional)</span>
                  <textarea rows={2} value={part.intro} onChange={(e) => setPart(open, { intro: e.target.value })} />
                </label>
                <div className="rt-part-tools">
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={open === 0} onClick={() => (change({ ...form, parts: move(form.parts, open, -1) }), setOpen(open - 1))}>
                    <ArrowUp size={14} /> Move up
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--small"
                    disabled={open === form.parts.length - 1}
                    onClick={() => (change({ ...form, parts: move(form.parts, open, 1) }), setOpen(open + 1))}
                  >
                    <ArrowDown size={14} /> Move down
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--small rt-danger"
                    disabled={form.parts.length <= 1}
                    onClick={async () => {
                      if (!(await askConfirm(`Delete "${part.title}" and its ${part.rules.length} rules?`, { danger: true, confirmLabel: "Delete" }))) return;
                      change({ ...form, parts: form.parts.filter((_, j) => j !== open) });
                      setOpen(Math.max(-1, open - 1));
                    }}
                  >
                    <Trash2 size={14} /> Delete part
                  </button>
                </div>
              </div>

              {part.rules.map((rule, ri) => (
                <div key={ri} className="adm-card rt-card rt-rule">
                  <div className="rt-rule-head">
                    <span className="rt-rule-n" style={{ background: toHex(part.color) }}>
                      {firstNumber(open) + ri}
                    </span>
                    <input className="rt-rule-title" value={rule.title} maxLength={120} placeholder="Rule title" aria-label="Rule title" onChange={(e) => setRule(open, ri, { title: e.target.value })} />
                    <button type="button" className="rt-icon-btn" aria-label="Move rule up" disabled={ri === 0} onClick={() => setPart(open, { rules: move(part.rules, ri, -1) })}>
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" className="rt-icon-btn" aria-label="Move rule down" disabled={ri === part.rules.length - 1} onClick={() => setPart(open, { rules: move(part.rules, ri, 1) })}>
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      className="rt-icon-btn rt-danger"
                      aria-label="Delete rule"
                      onClick={async () => {
                        if (rule.title && !(await askConfirm(`Delete the rule "${rule.title}"?`, { danger: true, confirmLabel: "Delete" }))) return;
                        setPart(open, { rules: part.rules.filter((_, j) => j !== ri) });
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <TextList items={rule.points} onChange={(points) => setRule(open, ri, { points })} label="Point" add="Add a point" max={12} />
                  <div className="rt-examples">
                    <div>
                      <span className="rt-ex-label rt-ex-label--bad">❌ Not okay (examples)</span>
                      <TextList items={rule.bad} onChange={(bad) => setRule(open, ri, { bad })} label="Bad example" add="Add" rows={1} max={6} />
                    </div>
                    <div>
                      <span className="rt-ex-label rt-ex-label--good">✅ Okay (examples)</span>
                      <TextList items={rule.good} onChange={(good) => setRule(open, ri, { good })} label="Good example" add="Add" rows={1} max={6} />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" className="rt-add rt-add--big" onClick={() => setPart(open, { rules: [...part.rules, emptyRule()] })}>
                <Plus size={16} /> Add a rule
              </button>

              <div className="adm-card rt-card">
                <h3>Notes under the rules</h3>
                <p className="adm-muted">Extra boxes at the end of this part, like “How to report something”.</p>
                {part.info.map(([title, body], ii) => (
                  <div key={ii} className="rt-note">
                    <div className="rt-list-row">
                      <input value={title} maxLength={120} placeholder="Title" aria-label="Note title" onChange={(e) => setPart(open, { info: part.info.map((x, j) => (j === ii ? [e.target.value, x[1]] : x)) })} />
                      <button type="button" className="rt-icon-btn" aria-label="Remove note" onClick={() => setPart(open, { info: part.info.filter((_, j) => j !== ii) })}>
                        <X size={15} />
                      </button>
                    </div>
                    <textarea rows={3} value={body} aria-label="Note text" onChange={(e) => setPart(open, { info: part.info.map((x, j) => (j === ii ? [x[0], e.target.value] : x)) })} />
                  </div>
                ))}
                {part.info.length < 6 ? (
                  <button type="button" className="rt-add" onClick={() => setPart(open, { info: [...part.info, ["", ""]] })}>
                    <Plus size={14} /> Add a note
                  </button>
                ) : null}
              </div>
            </>
          )}

          <div className="adm-card rt-card rt-tokens">
            <h3>Mention a channel or role</h3>
            <p className="adm-muted">Click to copy, then paste into any text. Discord shows a clickable mention; the website shows the name. A point containing {"{PASSWORD}"} shows the join password in Discord only.</p>
            <div className="rt-chips">
              {Object.entries(data.names.channels).map(([k, name]) => (
                <button key={k} type="button" onClick={() => void copyToken(`[[ch:${k}]]`)} title={name}>
                  {copied === `[[ch:${k}]]` ? "Copied!" : `#${k}`}
                </button>
              ))}
              {Object.entries(data.names.roles).map(([k, name]) => (
                <button key={k} type="button" onClick={() => void copyToken(`[[role:${k}]]`)} title={name}>
                  {copied === `[[role:${k}]]` ? "Copied!" : `@${name}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`rt-bar${dirty || msg ? " is-shown" : ""}`} role="status">
        <span className={msg ? (msg.ok ? "rt-ok" : "rt-err") : undefined}>{msg ? msg.text : dirty ? "You have unsaved changes." : ""}</span>
        <div>
          {data.edited && !dirty ? (
            <button
              type="button"
              className="adm-btn adm-btn--ghost adm-btn--small"
              disabled={busy}
              onClick={async () => (await askConfirm("Go back to the original rules from the bot's code? Your edits will be gone.", { danger: true, confirmLabel: "Use the original" })) && void send("DELETE")}
            >
              <RotateCcw size={14} /> Use the original rules
            </button>
          ) : null}
          {dirty ? (
            <button
              type="button"
              className="adm-btn adm-btn--ghost adm-btn--small"
              disabled={busy}
              onClick={() => {
                setForm(clone(data.source));
                setDirty(false);
                setMsg(null);
                if (open >= data.source.parts.length) setOpen(-1);
              }}
            >
              <Undo2 size={14} /> Discard
            </button>
          ) : null}
          <button type="button" className="adm-btn adm-btn--small" disabled={busy || !dirty} onClick={() => void send("PUT")}>
            <Save size={14} /> {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {!data.edited && !dirty ? (
        <p className="adm-muted rt-foot">
          <RotateCcw size={13} aria-hidden="true" /> Nothing edited yet: these are the rules from the bot&apos;s code.
        </p>
      ) : null}
    </section>
  );
}
