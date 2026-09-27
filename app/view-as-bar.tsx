"use client";

import { Eye, LogOut, Search, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Account = { id: string; name: string; username: string | null; discordId: string; avatar: string };

/**
 * Shown on every page while an admin is viewing the site as a member: who, a switcher to jump to
 * another member, and Exit view. Everything is read only in this mode.
 */
export function ViewAsBar() {
  const [on, setOn] = useState(false);
  const [current, setCurrent] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Account[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!/(?:^|;\s*)kk_view_as_on=1/.test(document.cookie)) return;
    setOn(true);
    const url = new URL(window.location.href);
    if (url.searchParams.get("viewas") === "read-only") {
      setNotice("Changes are turned off while you're viewing as someone.");
      url.searchParams.delete("viewas");
      history.replaceState(null, "", url.toString());
    }
    fetch("/api/admin/view-as", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => {
        if (b.ok && b.current) setCurrent(b.current);
        else setOn(false); // expired or no longer an admin
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      fetch(`/api/admin/view-as?q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((b) => b.ok && setResults(b.accounts))
        .catch(() => undefined);
    }, 200);
    return () => window.clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    const close = (e: MouseEvent) => open && box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!on || !current) return null;

  const go = async (method: "POST" | "DELETE", body?: object) => {
    setBusy(true);
    const res = await fetch("/api/admin/view-as", { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const b = await res.json().catch(() => ({}));
    if (b.ok) window.location.href = b.redirect ?? "/account";
    else {
      setBusy(false);
      setNotice(b.error ?? "That didn't work.");
    }
  };

  return (
    <div className="viewas-bar" role="status" ref={box}>
      <span className="viewas-eye" aria-hidden="true">
        <Eye size={16} />
      </span>
      <img src={current.avatar} alt="" width={26} height={26} />
      <span className="viewas-text">
        Viewing as <b>{current.name}</b>
        <small>Read only</small>
      </span>
      <button type="button" className="viewas-btn" onClick={() => setOpen((o) => !o)} disabled={busy} aria-expanded={open}>
        <Users size={14} aria-hidden="true" /> Switch user
      </button>
      <button type="button" className="viewas-btn viewas-exit" onClick={() => void go("DELETE")} disabled={busy}>
        <LogOut size={14} aria-hidden="true" /> Exit view
      </button>
      {notice ? (
        <p className="viewas-notice" onClick={() => setNotice(null)}>
          {notice}
        </p>
      ) : null}
      {open ? (
        <div className="viewas-menu">
          <label className="viewas-search">
            <Search size={14} aria-hidden="true" />
            <input autoFocus placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <ul>
            {results.map((a) => (
              <li key={a.id}>
                <button type="button" disabled={busy || a.id === current.id} onClick={() => void go("POST", { accountId: a.id })}>
                  <img src={a.avatar} alt="" width={24} height={24} />
                  <span>
                    {a.name}
                    {a.username ? <small>@{a.username}</small> : null}
                  </span>
                  {a.id === current.id ? <em>Viewing</em> : null}
                </button>
              </li>
            ))}
            {!results.length ? <li className="viewas-empty">No matching members with a linked Discord and verified email.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
