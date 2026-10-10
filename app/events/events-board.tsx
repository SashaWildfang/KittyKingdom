"use client";

import { Bell, BellRing, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Hash, List, MapPin, Mic, Repeat, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EVENT_KINDS, type PublicEvent } from "../../lib/events-shared";

type Data = { events: PublicEvent[]; mine: string[]; past: PublicEvent[] };

const KIND = Object.fromEntries(EVENT_KINDS.map((k) => [k.key, k]));
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function dayTitle(d: Date) {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86_400_000);
  if (dayKey(d) === dayKey(today)) return "Today";
  if (dayKey(d) === dayKey(tomorrow)) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

function countdown(ms: number) {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

function EventCard({ e, reminded, onRemind, busy, signedIn, linked, now }: { e: PublicEvent; reminded: boolean; onRemind: () => void; busy: boolean; signedIn: boolean; linked: boolean; now: number }) {
  const start = new Date(e.startAt).getTime();
  const end = e.endAt ? new Date(e.endAt).getTime() : start + 2 * 3600_000;
  const live = !e.cancelled && now >= start && now < end;
  const k = KIND[e.kind];
  return (
    <article className={`evp-card${e.cancelled ? " is-cancelled" : ""}${live ? " is-live" : ""}`} id={`event-${e.id}`}>
      {e.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="evp-card-img" src={e.image} alt="" loading="lazy" />
      ) : (
        <div className="evp-card-art" aria-hidden="true">
          {k?.emoji}
        </div>
      )}
      <div className="evp-card-body">
        <div className="evp-card-tags">
          <span className="evp-kind">
            {k?.emoji} {k?.label}
          </span>
          {live ? <span className="evp-live">Live now</span> : e.cancelled ? <span className="evp-cancelled">Cancelled</span> : <span className="evp-soon">{start > now ? countdown(start - now) : "Ended"}</span>}
          {e.weekly ? (
            <span className="evp-tag">
              <Repeat size={11} aria-hidden="true" /> Weekly
            </span>
          ) : null}
        </div>
        <h3>{e.title}</h3>
        <p className="evp-when">
          {time(e.startAt)}
          {e.endAt ? ` – ${time(e.endAt)}` : ""}
          <span>·</span>
          {e.channelName ? (
            <>
              {e.voice ? <Mic size={13} aria-hidden="true" /> : <Hash size={13} aria-hidden="true" />} {e.channelName}
            </>
          ) : (
            <>
              <MapPin size={13} aria-hidden="true" /> {e.place ?? "Discord"}
            </>
          )}
          {e.hostName ? (
            <>
              <span>·</span>
              <UserRound size={13} aria-hidden="true" /> {e.hostName}
            </>
          ) : null}
        </p>
        {e.description ? <p className="evp-desc">{e.description}</p> : null}
        {!e.cancelled && start > now ? (
          <div className="evp-card-actions">
            {linked ? (
              <button type="button" className={`evp-remind${reminded ? " is-on" : ""}`} disabled={busy} onClick={onRemind} aria-pressed={reminded}>
                {reminded ? <BellRing size={15} aria-hidden="true" /> : <Bell size={15} aria-hidden="true" />} {reminded ? "You'll get a reminder" : "Remind me"}
              </button>
            ) : (
              <a className="evp-remind" href={signedIn ? "/account#discord" : "/login?next=/events"}>
                <Bell size={15} aria-hidden="true" /> {signedIn ? "Link Discord for reminders" : "Log in for reminders"}
              </a>
            )}
            <a className="evp-ics" href={`/api/events/${e.id}/ics`} title="Add to your calendar">
              <CalendarPlus size={15} aria-hidden="true" /> Add to calendar
            </a>
            {e.going ? <span className="evp-going">{e.going} interested</span> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Month({ events, month, onMonth, onPick }: { events: PublicEvent[]; month: Date; onMonth: (d: Date) => void; onPick: (key: string) => void }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startPad = first.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const byDay = new Map<string, PublicEvent[]>();
  for (const e of events) {
    const k = dayKey(new Date(e.startAt));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const today = dayKey(new Date());
  return (
    <div className="evp-month">
      <div className="evp-month-head">
        <button type="button" aria-label="Previous month" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <ChevronLeft size={18} />
        </button>
        <b>{month.toLocaleDateString([], { month: "long", year: "numeric" })}</b>
        <button type="button" aria-label="Next month" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="evp-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d} className="evp-dow">
            {d}
          </span>
        ))}
        {Array.from({ length: startPad }, (_, i) => (
          <span key={`p${i}`} className="evp-day is-pad" />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
          const k = dayKey(d);
          const list = byDay.get(k) ?? [];
          return (
            <button key={k} type="button" className={`evp-day${k === today ? " is-today" : ""}${list.length ? " has-events" : ""}`} onClick={() => list.length && onPick(k)} disabled={!list.length}>
              <span className="evp-day-num">{i + 1}</span>
              {list.slice(0, 2).map((e) => (
                <span key={e.id} className={`evp-day-event${e.cancelled ? " is-cancelled" : ""}`}>
                  {KIND[e.kind]?.emoji} <span>{e.title}</span>
                </span>
              ))}
              {list.length > 2 ? <span className="evp-day-more">+{list.length - 2} more</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EventsBoard({ initial, signedIn, linked }: { initial: Data | null; signedIn: boolean; linked: boolean }) {
  const [data, setData] = useState<Data | null>(initial);
  const [mine, setMine] = useState<Set<string>>(new Set(initial?.mine ?? []));
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "month">("list");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [kind, setKind] = useState<string>("all");
  const now = useNow();

  // Month view loads the whole month (and the one after)
  useEffect(() => {
    if (view !== "month") return;
    fetch(`/api/events?from=${encodeURIComponent(month.toISOString())}&days=62`, { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setData((d) => ({ events: r.events, mine: r.mine, past: d?.past ?? [] })))
      .catch(() => undefined);
  }, [view, month]);

  const shown = useMemo(() => (data?.events ?? []).filter((e) => (kind === "all" || e.kind === kind) && (view === "month" || new Date(e.endAt ?? e.startAt).getTime() > now - 3600_000)), [data, kind, view, now]);
  const days = useMemo(() => {
    const out = new Map<string, { date: Date; list: PublicEvent[] }>();
    for (const e of shown) {
      const d = new Date(e.startAt);
      const k = dayKey(d);
      out.set(k, { date: d, list: [...(out.get(k)?.list ?? []), e] });
    }
    return Array.from(out.entries());
  }, [shown]);

  const remind = async (e: PublicEvent) => {
    setBusy(e.id);
    setErr(null);
    const on = !mine.has(e.id);
    const r = await fetch(`/api/events/${e.id}/remind`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(null);
    if (!r?.ok) return setErr(r?.error ?? "Couldn't save that.");
    setMine((m) => {
      const next = new Set(m);
      if (on) next.add(e.id);
      else next.delete(e.id);
      return next;
    });
    setData((d) => (d ? { ...d, events: d.events.map((x) => (x.id === e.id ? { ...x, going: r.going } : x)) } : d));
  };

  const next = (data?.events ?? []).find((e) => !e.cancelled && new Date(e.startAt).getTime() > now);

  return (
    <div className="evp">
      <header className="evp-hero">
        <div>
          <p className="evp-eyebrow">
            <CalendarDays size={14} aria-hidden="true" /> Events
          </p>
          <h1>What&apos;s happening in the kingdom</h1>
          <p className="evp-lead">Game nights, movie nights, voice hangouts and contests. Tap Remind me and the bot will DM you before it starts.</p>
        </div>
        {next ? (
          <a className="evp-next" href={`#event-${next.id}`}>
            <small>Up next</small>
            <b>
              {KIND[next.kind]?.emoji} {next.title}
            </b>
            <span>
              {dayTitle(new Date(next.startAt))}, {time(next.startAt)} · {countdown(new Date(next.startAt).getTime() - now)}
            </span>
          </a>
        ) : null}
      </header>

      <div className="evp-toolbar">
        <div className="evp-seg" role="tablist" aria-label="View">
          <button type="button" className={view === "list" ? "is-active" : undefined} onClick={() => setView("list")}>
            <List size={15} aria-hidden="true" /> Upcoming
          </button>
          <button type="button" className={view === "month" ? "is-active" : undefined} onClick={() => setView("month")}>
            <CalendarDays size={15} aria-hidden="true" /> Calendar
          </button>
        </div>
        <div className="evp-kinds">
          <button type="button" className={kind === "all" ? "is-on" : undefined} onClick={() => setKind("all")}>
            All
          </button>
          {EVENT_KINDS.filter((k) => (data?.events ?? []).some((e) => e.kind === k.key)).map((k) => (
            <button key={k.key} type="button" className={kind === k.key ? "is-on" : undefined} onClick={() => setKind(k.key)}>
              {k.emoji} {k.label}
            </button>
          ))}
        </div>
      </div>
      {err ? <p className="evp-error">{err}</p> : null}

      {view === "month" ? (
        <Month
          events={shown}
          month={month}
          onMonth={setMonth}
          onPick={(k) => {
            setView("list");
            window.setTimeout(() => document.getElementById(`day-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
          }}
        />
      ) : !data ? (
        <p className="evp-empty">Events couldn&apos;t load right now. Try again in a moment.</p>
      ) : !days.length ? (
        <div className="evp-empty">
          <CalendarDays size={28} aria-hidden="true" />
          <p>Nothing on the calendar yet. Keep an eye on #announcements in the Discord!</p>
        </div>
      ) : (
        <div className="evp-days">
          {days.map(([k, { date, list }]) => (
            <section key={k} id={`day-${k}`} className="evp-day-group">
              <h2>{dayTitle(date)}</h2>
              <div className="evp-cards">
                {list.map((e) => (
                  <EventCard key={e.id} e={e} reminded={mine.has(e.id)} onRemind={() => remind(e)} busy={busy === e.id} signedIn={signedIn} linked={linked} now={now} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {data?.past.length ? (
        <section className="evp-past">
          <h2>Recently</h2>
          <ul>
            {data.past.map((e) => (
              <li key={e.id}>
                <span aria-hidden="true">{KIND[e.kind]?.emoji}</span>
                <b>{e.title}</b>
                <small>{new Date(e.startAt).toLocaleDateString([], { month: "short", day: "numeric" })}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
