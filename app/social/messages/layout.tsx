"use client";

import { Inbox, MessageCircle, PenSquare, Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Photo, useApi, type Card } from "../ui";

/** Start a chat: your matches and friends, searchable. */
function NewMessage({ onClose }: { onClose: () => void }) {
  const matches = useApi<{ cards: Card[] }>("/api/dating/lists?list=matches");
  const friends = useApi<{ cards: (Card & { friend: string })[] }>("/api/dating/lists?list=friends");
  const [q, setQ] = useState("");
  const seen = new Set<string>();
  const people = [
    ...(matches.data?.cards ?? []).map((c) => ({ ...c, why: "Match" })),
    ...(friends.data?.cards ?? []).filter((c) => c.friend === "friends").map((c) => ({ ...c, why: "Friend" })),
  ].filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  const shown = people.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const loading = !matches.data || !friends.data;
  return (
    <div className="dt-newmsg">
      <div className="dt-newmsg-head">
        <b>New message</b>
        <button type="button" className="dt-btn dt-btn--ghost dt-btn--icon dt-btn--small" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <label className="dt-search dt-search--small">
        <Search size={14} aria-hidden="true" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search matches and friends" aria-label="Search matches and friends" />
      </label>
      {loading ? (
        <div className="dt-loading" style={{ height: 80 }} aria-busy="true" />
      ) : shown.length ? (
        <ul>
          {shown.map((c) => (
            <li key={c.id}>
              <a href={`/social/messages/${c.id}`}>
                <Photo src={c.photo} name={c.name} accent={c.accent} className="dt-avatar" />
                <span className="dt-inbox-text">
                  <b>{c.name}</b>
                  <small>{c.why}</small>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dt-muted dt-pad">{people.length ? "Nobody by that name." : "No matches or friends yet. You can also message anyone from their profile."}</p>
      )}
    </div>
  );
}

type Conv = { id: string; other: string; state: string; incomingRequest: boolean; lastText: string; lastFromMe: boolean; lastAt: string | null; unread: number };
type Data = { inbox: Conv[]; requests: Conv[]; unread: number; requestCount: number; people: Record<string, { name: string; photo: string | null; accent: string }> };

function when(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 86_400_000 && d.getDate() === new Date().getDate()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff < 7 * 86_400_000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const openId = path.split("/")[3] ?? null;
  const { data } = useApi<Data>("/api/dating/messages", 8000);
  const [tab, setTab] = useState<"inbox" | "requests">("inbox");
  const [composing, setComposing] = useState(false);
  const list = tab === "inbox" ? data?.inbox ?? [] : data?.requests ?? [];
  return (
    <div className={`dt-messages${openId ? " has-thread" : ""}`}>
      <aside className="dt-inbox">
        <button type="button" className="dt-btn dt-btn--block dt-newmsg-btn" onClick={() => setComposing((c) => !c)} aria-expanded={composing}>
          <PenSquare size={15} aria-hidden="true" /> New message
        </button>
        {composing ? <NewMessage onClose={() => setComposing(false)} /> : null}
        <div className="dt-seg dt-seg--full" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "inbox"} className={tab === "inbox" ? "is-on" : undefined} onClick={() => setTab("inbox")}>
            <MessageCircle size={14} aria-hidden="true" /> Chats {data?.unread ? <span className="is-hot">{data.unread}</span> : null}
          </button>
          <button type="button" role="tab" aria-selected={tab === "requests"} className={tab === "requests" ? "is-on" : undefined} onClick={() => setTab("requests")}>
            <Inbox size={14} aria-hidden="true" /> Requests {data?.requestCount ? <span className="is-hot">{data.requestCount}</span> : null}
          </button>
        </div>
        {!data ? (
          <div className="dt-loading" aria-busy="true" />
        ) : list.length ? (
          <ul>
            {list.map((c) => {
              const who = data.people[c.other] ?? { name: "Member", photo: null, accent: "#888" };
              return (
                <li key={c.id}>
                  <a href={`/social/messages/${c.other}`} className={`${openId === c.other ? "is-open " : ""}${c.unread ? "is-unread" : ""}`}>
                    <Photo src={who.photo} name={who.name} accent={who.accent} className="dt-avatar" />
                    <span className="dt-inbox-text">
                      <b>{who.name}</b>
                      <small>
                        {c.state === "request" && !c.incomingRequest ? "Request sent · " : ""}
                        {c.lastFromMe ? "You: " : ""}
                        {c.lastText || "…"}
                      </small>
                    </span>
                    <span className="dt-inbox-meta">
                      <small>{when(c.lastAt)}</small>
                      {c.unread ? <span className="dt-dot-count">{c.unread}</span> : null}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="dt-muted dt-pad">{tab === "inbox" ? "No chats yet. Start one with New message above, or from anyone's profile." : "No message requests. When someone who isn't a match or friend messages you, it lands here first."}</p>
        )}
      </aside>
      <section className="dt-thread-pane">{children}</section>
    </div>
  );
}
