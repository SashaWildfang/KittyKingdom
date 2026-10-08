"use client";

import { History, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { BOTS } from "../../../lib/bot-settings/schema";
import type { LogEntry } from "../../../lib/bot-settings/store";
import { Pager, formatDate, timeAgo, useLive } from "../admin-shared";

const BOT_NAMES: Record<string, string> = { ...Object.fromEntries(BOTS.map((b) => [b.key, b.name])), server: "Discord Server" };

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (Array.isArray(v)) return v.length ? `${v.length} item${v.length === 1 ? "" : "s"}: ${v.slice(0, 3).map(String).join(", ")}${v.length > 3 ? "…" : ""}` : "(none)";
  if (typeof v === "boolean") return v ? "On" : "Off";
  return String(v);
}

/** Who changed which setting, when, from what to what, with one-click undo. `bot` empty = every bot. */
export function ChangeLog({ bot, settingKey, onClearKey, onReverted }: { bot?: string; settingKey?: string | null; onClearKey?: () => void; onReverted?: () => void }) {
  const [page, setPage] = useState(1);
  const [filterBot, setFilterBot] = useState(bot ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const params = new URLSearchParams({ page: String(page), ...(filterBot ? { bot: filterBot } : {}), ...(settingKey ? { key: settingKey } : {}) });
  const { data, reload } = useLive<{ ok: boolean; rows: LogEntry[]; total: number; page: number; pageSize: number }>(`/api/admin/bots/log?${params}`, 20_000);

  const undo = async (id: string) => {
    if (!window.confirm("Put this setting back to what it was before this change?")) return;
    setBusy(id);
    setErr(null);
    const r = await fetch("/api/admin/bots/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revert: id }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(null);
    if (!r?.ok) return setErr(r?.error ?? "Couldn't undo that.");
    await reload();
    onReverted?.();
  };

  return (
    <div className="adm-card bs-log">
      <header className="bs-log-head">
        <h3>
          <History size={17} aria-hidden="true" /> Change history
        </h3>
        {!bot ? (
          <select className="adm-select" value={filterBot} onChange={(e) => (setFilterBot(e.target.value), setPage(1))} aria-label="Which bot">
            <option value="">Every bot and the server</option>
            {Object.entries(BOT_NAMES).map(([k, name]) => (
              <option key={k} value={k}>
                {name}
              </option>
            ))}
          </select>
        ) : null}
        {settingKey ? (
          <span className="bs-chip">
            <code>{settingKey}</code>
            <button type="button" aria-label="Show every setting" onClick={onClearKey}>
              <X size={12} />
            </button>
          </span>
        ) : null}
      </header>
      {err ? <p className="adm-error">{err}</p> : null}
      {!data ? (
        <div className="adm-skeleton" style={{ height: 200 }} />
      ) : !data.rows?.length ? (
        <p className="adm-muted">No changes yet. Everything saved here is listed with who changed it, so it&apos;s easy to see or undo later.</p>
      ) : (
        <>
          <ol className="bs-log-list">
            {data.rows.map((r) => (
              <li key={r.id}>
                <div className="bs-log-main">
                  <b>{r.label}</b>
                  {!bot ? <span className="adm-tag">{BOT_NAMES[r.bot] ?? r.bot}</span> : null}
                  {r.kind === "reset" ? <span className="adm-tag">reset to default</span> : null}
                  <span className="bs-log-diff">
                    <del>{show(r.old)}</del> → <ins>{show(r.new)}</ins>
                  </span>
                  {r.note ? <small className="bs-log-note">“{r.note}”</small> : null}
                </div>
                <div className="bs-log-meta">
                  <small title={formatDate(r.at)}>
                    {r.byName || "Someone"} · {timeAgo(r.at)}
                    {r.version ? ` · v${r.version}` : ""}
                  </small>
                  {r.bot !== "server" ? (
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy === r.id} onClick={() => void undo(r.id)}>
                      <RotateCcw size={13} aria-hidden="true" /> Undo
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/** Admin → Bots → History: every change across all bots and the server. */
export function BotsHistoryTab() {
  return (
    <section className="adm-panel">
      <ChangeLog />
    </section>
  );
}
