"use client";

import "./emails-tab.css";
import { AlertTriangle, CheckCircle2, Mail, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { EMAIL_KINDS, type EmailRow } from "../../lib/email-kinds";
import { Pager, formatDate, timeAgo, useLive } from "./admin-shared";

type List = { ok: boolean; error?: string; rows: EmailRow[]; total: number; page: number; pageSize: number; today: number; failedToday: number };
type Full = EmailRow & { html: string; text: string };

/** Admin → Emails: everything the website emailed members (verify, resets, appeals…). One-time links are hidden. */
export function EmailsTab() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState<"" | "sent" | "failed">("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [full, setFull] = useState<Full | null>(null);
  const [view, setView] = useState<"html" | "text">("html");

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ q: query, kind, status, page: String(page) });
  const { data } = useLive<List>(`/api/admin/emails?${params}`, 30_000);

  useEffect(() => {
    setFull(null);
    if (!open) return;
    fetch(`/api/admin/emails?id=${open}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setFull(r.email))
      .catch(() => undefined);
  }, [open]);

  return (
    <section className="adm-panel em">
      <div className="adm-kpis em-kpis">
        <div className="adm-kpi adm-kpi--blue">
          <small>Sent in the last 24h</small>
          <strong>{data?.today?.toLocaleString() ?? "…"}</strong>
        </div>
        <button type="button" className={`adm-kpi is-link${data?.failedToday ? " adm-kpi--red" : ""}`} onClick={() => (setStatus("failed"), setPage(1))}>
          <small>Failed in the last 24h</small>
          <strong>{data?.failedToday?.toLocaleString() ?? "…"}</strong>
        </button>
      </div>

      <div className="adm-filters">
        <div className="adm-seg" role="tablist" aria-label="Status">
          {(["", "sent", "failed"] as const).map((s) => (
            <button key={s || "all"} type="button" className={status === s ? "is-active" : undefined} onClick={() => (setStatus(s), setPage(1))}>
              {s === "" ? "All" : s === "sent" ? "Delivered" : "Failed"}
            </button>
          ))}
        </div>
        <select className="adm-select" value={kind} onChange={(e) => (setKind(e.target.value), setPage(1))} aria-label="Email type">
          <option value="">Every type</option>
          {Object.entries(EMAIL_KINDS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <label className="adm-search">
          <Search size={15} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search address or subject" aria-label="Search emails" />
        </label>
      </div>

      {data && !data.ok ? <p className="adm-error">{data.error}</p> : null}
      <div className={`em-layout${open ? " has-open" : ""}`}>
        <div className="em-list">
          {!data ? (
            <div className="adm-skeleton" style={{ height: 300 }} />
          ) : !data.rows?.length ? (
            <div className="adm-empty">
              <Mail size={22} aria-hidden="true" /> No emails{query || kind || status ? " match these filters" : " logged yet. They appear here as they're sent"}.
            </div>
          ) : (
            <>
              <ul className="em-rows">
                {data.rows.map((r) => (
                  <li key={r.id}>
                    <button type="button" className={open === r.id ? "is-on" : undefined} onClick={() => setOpen(open === r.id ? null : r.id)}>
                      {r.sent ? <CheckCircle2 size={16} className="em-ok" aria-label="Delivered" /> : <AlertTriangle size={16} className="em-bad" aria-label="Failed" />}
                      <span className="em-main">
                        <b>{r.subject}</b>
                        <small>
                          {r.to} · {EMAIL_KINDS[r.kind] ?? r.kind}
                        </small>
                      </span>
                      <time title={formatDate(r.at)}>{timeAgo(r.at)}</time>
                    </button>
                  </li>
                ))}
              </ul>
              <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
            </>
          )}
        </div>

        {open ? (
          <article className="adm-card em-view">
            <header>
              <div>
                <b>{full?.subject ?? "Loading…"}</b>
                {full ? (
                  <small className="adm-muted">
                    To {full.to} · {formatDate(full.at)} · {EMAIL_KINDS[full.kind] ?? full.kind}
                  </small>
                ) : null}
              </div>
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setOpen(null)} aria-label="Close">
                <X size={15} aria-hidden="true" />
              </button>
            </header>
            {full?.error ? <p className="adm-error">Not delivered: {full.error}</p> : null}
            <div className="adm-seg em-view-seg">
              <button type="button" className={view === "html" ? "is-active" : undefined} onClick={() => setView("html")}>
                As sent
              </button>
              <button type="button" className={view === "text" ? "is-active" : undefined} onClick={() => setView("text")}>
                Plain text
              </button>
            </div>
            {full ? (
              view === "html" ? (
                <iframe className="em-frame" title={`Email: ${full.subject}`} sandbox="" srcDoc={full.html} />
              ) : (
                <pre className="em-text">{full.text}</pre>
              )
            ) : (
              <div className="adm-skeleton" style={{ height: 360 }} />
            )}
            <p className="adm-muted em-note">One-time links (confirm email, password reset) are hidden in this copy, so they can't be used from here.</p>
          </article>
        ) : null}
      </div>
    </section>
  );
}
