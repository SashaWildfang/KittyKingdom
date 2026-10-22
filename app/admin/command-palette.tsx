"use client";

// Ctrl+K (⌘K on Mac) anywhere in the admin panel: type a tab, a member's name or ID, or a ticket number and press
// Enter to go straight there. Tabs you open often float to the top.

import "./command-palette.css";
import { CornerDownLeft, Hash, LayoutGrid, Search, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TabEntry = { key: string; label: string; group: string; icon: LucideIcon };
type Result = { id: string; kind: "tab" | "member" | "ticket"; label: string; hint: string; icon: LucideIcon; run: () => void };
type Member = { id: string; username: string; displayName: string; avatar: string | null; bot?: boolean };

const RECENT_KEY = "kk-admin-recent-tabs";
const readRecent = (): string[] => {
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

/** Remembers a tab as recently used (call when a tab is opened). */
export function rememberTab(key: string) {
  try {
    const next = [key, ...readRecent().filter((k) => k !== key)].slice(0, 8);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // private mode: fine
  }
}

export function CommandPalette({ tabs, onTab, onMember, onTicket }: { tabs: TabEntry[]; onTab: (key: string) => void; onMember: (id: string) => void; onTicket: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // Ctrl+K / ⌘K toggles it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!open) return;
    setQ("");
    setMembers([]);
    setActive(0);
    window.setTimeout(() => input.current?.focus(), 20);
  }, [open]);

  // Members by name (after a short pause while typing)
  useEffect(() => {
    const text = q.trim();
    if (!open || text.length < 2 || /^#?\d{1,7}$/.test(text) || /^\d{15,21}$/.test(text)) {
      setMembers([]);
      return;
    }
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/admin/members?q=${encodeURIComponent(text)}`, { signal: controller.signal, cache: "no-store" })
        .then((r) => r.json())
        .then((b) => setMembers(((b.members ?? []) as Member[]).filter((m) => !m.bot).slice(0, 6)))
        .catch(() => undefined);
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [q, open]);

  const results = useMemo<Result[]>(() => {
    const text = q.trim().toLowerCase();
    const close = (fn: () => void) => () => {
      setOpen(false);
      fn();
    };
    const out: Result[] = [];
    const ticket = /^#?(\d{1,7})$/.exec(text);
    if (ticket) out.push({ id: `t${ticket[1]}`, kind: "ticket", label: `Open ticket #${ticket[1]}`, hint: "Transcript", icon: Hash, run: close(() => onTicket(Number(ticket[1]))) });
    if (/^\d{15,21}$/.test(text)) out.push({ id: `m${text}`, kind: "member", label: `Open member ${text}`, hint: "Member profile", icon: User, run: close(() => onMember(text)) });
    const recent = readRecent();
    const score = (t: TabEntry) => {
      const hay = `${t.label} ${t.group}`.toLowerCase();
      // Nothing typed yet: recently used tabs first, then the rest in their usual order
      if (!text) return recent.includes(t.key) ? recent.indexOf(t.key) : 100 + tabs.indexOf(t);
      if (t.label.toLowerCase().startsWith(text)) return 0;
      if (hay.includes(text)) return 10;
      // Letters in order ("pun" → Punishments, "rp" → Role Picker)
      let i = 0;
      for (const ch of hay) if (ch === text[i]) i += 1;
      return i === text.length ? 20 : Infinity;
    };
    const tabHits = tabs
      .map((t) => ({ t, s: score(t) }))
      .filter((x) => Number.isFinite(x.s))
      .sort((a, b) => a.s - b.s)
      .slice(0, text ? 8 : 6);
    for (const { t } of tabHits) out.push({ id: `tab:${t.key}`, kind: "tab", label: t.label, hint: t.group, icon: t.icon ?? LayoutGrid, run: close(() => onTab(t.key)) });
    for (const m of members) out.push({ id: `mem:${m.id}`, kind: "member", label: m.displayName || m.username, hint: `@${m.username}`, icon: User, run: close(() => onMember(m.id)) });
    return out;
  }, [q, tabs, members, onTab, onMember, onTicket]);

  useEffect(() => setActive((a) => Math.min(a, Math.max(0, results.length - 1))), [results.length]);

  if (!open) return null;
  return createPortal(
    <div className="cmdk-wrap" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Go to">
        <label className="cmdk-input">
          <Search size={17} aria-hidden="true" />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => (setQ(e.target.value), setActive(0))}
            placeholder="Go to a tab, member or ticket #…"
            aria-label="Search"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
              else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
              else if (e.key === "Enter" && results[active]) (e.preventDefault(), results[active].run());
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <ul className="cmdk-list" role="listbox">
          {!results.length ? <li className="cmdk-empty">Nothing matches “{q}”.</li> : null}
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? "is-active" : undefined} onMouseEnter={() => setActive(i)} onClick={r.run}>
                <r.icon size={15} aria-hidden="true" />
                <span>{r.label}</span>
                <small>{r.hint}</small>
                {i === active ? <CornerDownLeft size={13} className="cmdk-enter" aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
        <p className="cmdk-foot">
          <kbd>↑</kbd>
          <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Ctrl</kbd>+<kbd>K</kbd> any time
        </p>
      </div>
    </div>,
    document.body,
  );
}
