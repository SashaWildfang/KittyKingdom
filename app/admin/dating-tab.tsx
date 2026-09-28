"use client";

import { Check, EyeOff, Flag, ImageOff } from "lucide-react";
import { useState } from "react";
import { PersonLink, timeAgo, useLive, type People } from "./admin-shared";

type Snap = {
  name?: string;
  photos?: { url: string; caption: string | null }[];
  sections?: { label: string; items: { label: string; value: string }[] }[];
  messages?: { id: string; from: string; text: string; at: string; reported: boolean }[];
};
type Report = { id: string; type: string; reporter: string; reported: string; reason: string; details: string; photoId: string | null; snapshot: Snap | null; at: string; status: string; handledBy: string | null; action: string | null };

const ACTION_LABEL: Record<string, string> = { dismiss: "Dismissed", "remove-photo": "Photo removed", "pause-profile": "Profile paused" };

/** Dating reports: only what members reported (a profile, one photo, or a message with a little context). */
export function DatingTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [status, setStatus] = useState<"open" | "closed">("open");
  const { data, reload } = useLive<{ reports: Report[]; people: People }>(`/api/admin/dating/reports?status=${status}`, 20_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const people = data?.people ?? {};

  const resolve = async (id: string, action: string) => {
    setBusy(id);
    setErr(null);
    const r = await fetch("/api/admin/dating/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) }).then((x) => x.json()).catch(() => null);
    setBusy(null);
    if (!r?.ok) setErr(r?.error ?? "That didn't work.");
    await reload();
  };

  return (
    <section className="adm-panel dtr">
      <div className="adm-filters">
        <div className="adm-seg" role="tablist">
          {(["open", "closed"] as const).map((s) => (
            <button key={s} type="button" className={status === s ? "is-active" : undefined} onClick={() => setStatus(s)}>
              {s === "open" ? "Open" : "Handled"}
            </button>
          ))}
        </div>
        <p className="adm-muted">Staff only see what members reported. Private chats stay private: a reported message shows two messages before and after it, nothing else.</p>
      </div>
      {err ? <p className="adm-error">{err}</p> : null}
      {!data ? (
        <p className="adm-muted">Loading…</p>
      ) : !data.reports.length ? (
        <div className="adm-empty">
          <Flag size={22} aria-hidden="true" /> {status === "open" ? "No open Social reports." : "Nothing handled yet."}
        </div>
      ) : (
        <div className="dtr-list">
          {data.reports.map((r) => {
            const photo = r.photoId ? r.snapshot?.photos?.find((p) => p.url.includes(r.photoId!)) : null;
            return (
              <article key={r.id} className="adm-card dtr-card">
                <header>
                  <span className={`adm-tag dtr-type dtr-type--${r.type}`}>{r.type}</span>
                  <b>{r.reason}</b>
                  <small className="adm-muted">{timeAgo(r.at)}</small>
                </header>
                <div className="dtr-people">
                  <span>
                    <small className="adm-muted">Reported</small>
                    <PersonLink id={r.reported} people={people} onOpen={onOpenMember} />
                  </span>
                  <span>
                    <small className="adm-muted">By</small>
                    <PersonLink id={r.reporter} people={people} onOpen={onOpenMember} compact />
                  </span>
                </div>
                {r.details ? <blockquote className="dtr-details">{r.details}</blockquote> : null}

                {r.type === "message" && r.snapshot?.messages ? (
                  <div className="dtr-chat">
                    {r.snapshot.messages.map((m) => (
                      <div key={m.id} className={`dtr-msg${m.reported ? " is-reported" : ""}${m.from === r.reported ? " is-them" : ""}`}>
                        <small>
                          {people[m.from]?.name ?? m.from} · {new Date(m.at).toLocaleString()}
                        </small>
                        <p>{m.text || <em>(unsent)</em>}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {r.type === "photo" ? (
                  photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="dtr-photo" src={photo.url} alt="Reported photo" />
                  ) : (
                    <p className="adm-muted">That photo has already been removed.</p>
                  )
                ) : null}
                {r.type === "profile" && r.snapshot ? (
                  <details className="dtr-snap">
                    <summary>Profile as it was when reported</summary>
                    {r.snapshot.photos?.length ? (
                      <div className="dtr-thumbs">
                        {r.snapshot.photos.map((p) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={p.url} src={p.url} alt="" />
                        ))}
                      </div>
                    ) : null}
                    {r.snapshot.sections?.map((s) => (
                      <div key={s.label}>
                        <b>{s.label}</b>
                        {s.items.map((it) => (
                          <p key={it.label}>
                            <small className="adm-muted">{it.label}:</small> {it.value}
                          </p>
                        ))}
                      </div>
                    ))}
                  </details>
                ) : null}

                {r.status === "open" ? (
                  <footer>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--small" disabled={busy === r.id} onClick={() => void resolve(r.id, "dismiss")}>
                      <Check size={13} aria-hidden="true" /> Dismiss
                    </button>
                    {r.type === "photo" && photo ? (
                      <button type="button" className="adm-btn adm-btn--small" disabled={busy === r.id} onClick={() => void resolve(r.id, "remove-photo")}>
                        <ImageOff size={13} aria-hidden="true" /> Remove photo
                      </button>
                    ) : null}
                    <button type="button" className="adm-btn adm-btn--small" disabled={busy === r.id} onClick={() => void resolve(r.id, "pause-profile")}>
                      <EyeOff size={13} aria-hidden="true" /> Pause their profile
                    </button>
                    <small className="adm-muted">For bans or mutes, open the member and use the usual tools.</small>
                  </footer>
                ) : (
                  <footer>
                    <small className="adm-muted">
                      {ACTION_LABEL[r.action ?? ""] ?? r.action} by {r.handledBy}
                    </small>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
