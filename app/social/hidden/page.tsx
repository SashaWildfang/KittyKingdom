"use client";

import { Ban, EyeOff, ThumbsDown, Undo2, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { Empty, Photo, post, useApi, type Card } from "../ui";

type Tab = "blocked" | "passed" | "skipped";
const TABS: { key: Tab; label: string; icon: typeof Ban; undo: string; action: string; empty: string; hint: string }[] = [
  { key: "blocked", label: "Blocked", icon: Ban, undo: "Unblock", action: "unblock", empty: "You haven't blocked anyone.", hint: "Blocked members can't see your profile or message you. They aren't told." },
  { key: "passed", label: "Not for me", icon: ThumbsDown, undo: "Undo", action: "unpass", empty: "You haven't passed on anyone.", hint: "People you passed on in Discover (dating). Undo to see them there again." },
  { key: "skipped", label: "Skipped friends", icon: UserX, undo: "Undo", action: "unskip", empty: "You haven't skipped anyone.", hint: "People you skipped in Discover → Friends. Undo to see them there again." },
];

/** Everyone you've hidden from yourself, with a way to take it back. */
export default function Hidden() {
  const [tab, setTab] = useState<Tab>("blocked");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "passed" || t === "skipped") setTab(t);
  }, []);
  const { data, error, reload } = useApi<{ cards: Card[]; ids?: { id: string }[] }>(`/api/dating/lists?list=${tab}`);
  const [busy, setBusy] = useState<string | null>(null);
  const cur = TABS.find((t) => t.key === tab)!;
  // Blocked people may have deleted their profile; show them by id so they can still be unblocked
  const rows = tab === "blocked" ? (data?.ids ?? []).map(({ id }) => data?.cards.find((c) => c.id === id) ?? ({ id, name: "Former member", photo: null, accent: "#888" } as Card)) : data?.cards ?? [];

  return (
    <div className="dt-list-page">
      <div className="dt-page-head">
        <h1 className="dt-h-icon">
          <EyeOff size={20} aria-hidden="true" /> Hidden profiles
        </h1>
        <p className="dt-muted">People you&apos;ve blocked, passed on or skipped. Nothing here is shared with them.</p>
      </div>
      <div className="dt-seg" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "is-on" : undefined} onClick={() => setTab(t.key)}>
            <t.icon size={14} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>
      <p className="dt-help">{cur.hint}</p>
      {error ? <p className="dt-error">{error}</p> : null}
      {!data ? (
        <div className="dt-loading" aria-busy="true" />
      ) : rows.length ? (
        <div className="dt-stack">
          {rows.map((c) => (
            <div key={c.id} className="dt-rowcard">
              <a href={tab === "blocked" ? undefined : `/social/u/${c.id}`}>
                <Photo src={c.photo} name={c.name} accent={c.accent} crop={c.photoCrop} className="dt-avatar" />
                <span>
                  <b>{c.name}</b>
                  <small className="dt-muted">{[c.age, c.location].filter(Boolean).join(" · ")}</small>
                </span>
              </a>
              <button
                type="button"
                className="dt-btn dt-btn--small dt-btn--ghost"
                disabled={busy === c.id}
                onClick={async () => {
                  setBusy(c.id);
                  await post("/api/dating/actions", { action: cur.action, target: c.id });
                  setBusy(null);
                  await reload();
                }}
              >
                <Undo2 size={13} aria-hidden="true" /> {cur.undo}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<cur.icon size={26} />} title={cur.empty} />
      )}
    </div>
  );
}
