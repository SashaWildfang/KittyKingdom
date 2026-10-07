"use client";

import { ArrowLeft, Check, CheckCheck, EyeOff, Send, Trash2, Undo2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, use } from "react";
import { Photo, ReportButton, ago, post, useApi } from "../../ui";

type Msg = { id: string; from: string; text: string; deleted: boolean; at: string };
type Thread = { me: string; id: string; state: string; incomingRequest: boolean; canSend: boolean; requestPending: boolean; theirReadAt: string | null; messages: Msg[]; more: boolean };
type Who = { profile: { id: string; name: string; photos: { url: string }[]; avatar: string | null; accent: string; lastActive: string | null }; relation: { match: boolean; friend: string } };

const MAX = 2000;
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
};

export default function ThreadPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { data, error, reload, setData } = useApi<Thread>(`/api/dating/messages/${params.id}`, 4000);
  const who = useApi<Who>(`/api/dating/users/${params.id}`);
  const prefs = useApi<{ settings: { enterToSend: boolean } }>("/api/dating/settings");
  const enterToSend = prefs.data?.settings.enterToSend !== false;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [older, setOlder] = useState<Msg[]>([]);
  const [hasOlder, setHasOlder] = useState<boolean | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastCount = useRef(0);

  const messages = [...older, ...(data?.messages ?? [])];
  // Keep pinned to the bottom when new messages arrive (unless they scrolled up to read)
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (messages.length !== lastCount.current && stick.current) el.scrollTop = el.scrollHeight;
    lastCount.current = messages.length;
  });
  useEffect(() => {
    if (data && hasOlder === null) setHasOlder(data.more);
  }, [data, hasOlder]);

  if (error) return <div className="dt-thread-empty"><p className="dt-error">{error}</p><a className="dt-btn dt-btn--ghost" href="/social/messages">Back</a></div>;
  if (!data) return <div className="dt-loading" aria-busy="true" />;
  const p = who.data?.profile;
  const name = p?.name ?? "Member";

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setErr(null);
    const r = await post<{ id?: string }>(`/api/dating/messages/${params.id}`, { text: body });
    setSending(false);
    if (!r.ok) return setErr(r.error ?? "Couldn't send that.");
    setText("");
    stick.current = true;
    await reload();
  };
  const loadOlder = async () => {
    const first = messages[0];
    if (!first) return;
    const res = await fetch(`/api/dating/messages/${params.id}?before=${first.id}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (res?.ok) {
      setOlder((o) => [...res.messages, ...o]);
      setHasOlder(res.more);
    }
  };
  const answer = async (a: "accept" | "decline") => {
    const r = await post(`/api/dating/messages/${params.id}`, { request: a });
    if (!r.ok) return setErr(r.error ?? "That didn't work.");
    if (a === "decline") window.location.href = "/social/messages";
    else await reload();
  };
  // Delete for everyone: it shows as "Message unsent" on both sides
  const unsend = async (id: string) => {
    if (!window.confirm("Delete this message for everyone? It will show as \"Message unsent\" for both of you.")) return;
    await post(`/api/dating/messages/${params.id}`, { unsend: id });
    setOlder((o) => o.map((m) => (m.id === id ? { ...m, deleted: true, text: "" } : m)));
    if (data) setData({ ...data, messages: data.messages.map((m) => (m.id === id ? { ...m, deleted: true, text: "" } : m)) });
  };
  // Delete for me: gone from your side only
  const deleteForMe = async (id: string) => {
    await post(`/api/dating/messages/${params.id}`, { deleteForMe: id });
    setOlder((o) => o.filter((m) => m.id !== id));
    if (data) setData({ ...data, messages: data.messages.filter((m) => m.id !== id) });
  };
  const hide = async () => {
    await post(`/api/dating/messages/${params.id}`, { hide: true });
    window.location.href = "/social/messages";
  };

  const lastMine = [...messages].reverse().find((m) => m.from === data.me && !m.deleted);
  const seen = Boolean(lastMine && data.theirReadAt && new Date(data.theirReadAt) >= new Date(lastMine.at));
  let lastDay = "";

  return (
    <div className="dt-thread">
      <header className="dt-thread-head">
        <a href="/social/messages" className="dt-back" aria-label="Back to chats">
          <ArrowLeft size={18} />
        </a>
        <a href={`/social/u/${params.id}`} className="dt-thread-who">
          <Photo src={p?.photos[0]?.url ?? p?.avatar ?? null} name={name} accent={p?.accent ?? "#888"} className="dt-avatar" />
          <span>
            <b>{name}</b>
            <small className="dt-muted">{who.data?.relation.match ? "Match" : who.data?.relation.friend === "friends" ? "Friend" : data.state === "request" ? "Message request" : ""}{p?.lastActive ? ` · ${ago(p.lastActive)}` : ""}</small>
          </span>
        </a>
        <button type="button" className="dt-btn dt-btn--ghost dt-btn--small" onClick={() => void hide()} title="Hide this chat until they message again">
          <EyeOff size={13} aria-hidden="true" /> Hide
        </button>
      </header>

      <div
        className="dt-thread-body"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {hasOlder ? (
          <button type="button" className="dt-textlink dt-center-block" onClick={() => void loadOlder()}>
            Load older messages
          </button>
        ) : null}
        {!messages.length ? (
          <p className="dt-muted dt-center">
            {data.state === "none" ? `Say hi to ${name}! Since you aren't matched or friends yet, this starts as a message request in their Requests tab.` : "No messages yet. Say hi!"}
          </p>
        ) : null}
        {messages.map((m) => {
          const day = dayLabel(m.at);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.from === data.me;
          return (
            <div key={m.id} className="dt-msg-wrap">
              {showDay ? <div className="dt-day">{day}</div> : null}
              <div className={`dt-msg${mine ? " is-mine" : ""}${m.deleted ? " is-deleted" : ""}`}>
                <div className="dt-bubble" title={new Date(m.at).toLocaleString()} tabIndex={0}>
                  {m.deleted ? <em>Message unsent</em> : m.text}
                </div>
                <div className="dt-msg-tools">
                  <small>{new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>
                  {mine && !m.deleted ? (
                    <button type="button" onClick={() => void unsend(m.id)} title="Delete for everyone">
                      <Undo2 size={12} aria-hidden="true" /> Unsend
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void deleteForMe(m.id)} title="Delete for me (they still see it)">
                    <Trash2 size={12} aria-hidden="true" /> Delete for me
                  </button>
                  {!mine && !m.deleted ? <ReportButton target={params.id} type="message" messageId={m.id} label="" small /> : null}
                </div>
              </div>
            </div>
          );
        })}
        {lastMine ? (
          <div className="dt-seen">
            {seen ? <CheckCheck size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />} {seen ? "Seen" : "Sent"}
          </div>
        ) : null}
      </div>

      {data.incomingRequest ? (
        <div className="dt-request-bar">
          <p>
            <b>{name}</b> wants to chat. Accept to reply, or decline and they won&apos;t be able to message you for a week.
          </p>
          <div className="dt-row">
            <button type="button" className="dt-btn" onClick={() => void answer("accept")}>
              Accept
            </button>
            <button type="button" className="dt-btn dt-btn--ghost" onClick={() => void answer("decline")}>
              Decline
            </button>
            <ReportButton target={params.id} label="Report" small />
          </div>
        </div>
      ) : data.canSend ? (
        <form
          className="dt-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {err ? <p className="dt-error">{err}</p> : null}
          {data.requestPending ? <small className="dt-muted">Message request sent · it shows in their Requests until they accept</small> : null}
          <div>
            <textarea
              className="dt-input"
              rows={1}
              value={text}
              maxLength={MAX}
              placeholder={`Message ${name}…`}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && enterToSend) {
                  e.preventDefault();
                  void send();
                }
              }}
              aria-label="Message"
            />
            <button type="submit" className="dt-btn dt-btn--icon" disabled={!text.trim() || sending} aria-label="Send">
              <Send size={16} />
            </button>
          </div>
          {text.length > MAX - 200 ? <small className="dt-muted">{MAX - text.length} characters left</small> : null}
        </form>
      ) : (
        <div className="dt-request-bar">
          <p className="dt-muted">{data.state === "declined" ? "They passed on your message request for now." : "You can't message this member right now."}</p>
          {err ? <p className="dt-error">{err}</p> : null}
        </div>
      )}
    </div>
  );
}
