"use client";

// Admin → Overview → Insights: the join funnel, why people leave, economy health, and how events and giveaways did.

import "./insights.css";
import { Coins, DoorOpen, Filter, PartyPopper } from "lucide-react";
import { useState } from "react";
import { PersonLink, formatDate, useLive, type People } from "./admin-shared";
import { useCurrency } from "../season-context";
import { LeafEmote } from "../ui-icons";

type Section = "funnel" | "leavers" | "economy" | "events";
const SECTIONS: { key: Section; label: string; icon: typeof Filter }[] = [
  { key: "funnel", label: "Join funnel", icon: Filter },
  { key: "leavers", label: "Why people leave", icon: DoorOpen },
  { key: "economy", label: "Economy", icon: Coins },
  { key: "events", label: "Events & giveaways", icon: PartyPopper },
];

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");
/** An amount of the season's currency, with its emote. */
function Amt({ n }: { n: number }) {
  return (
    <span className="ins-amt">
      {Math.round(n).toLocaleString()} <LeafEmote size={15} />
    </span>
  );
}
const span = (ms: number | null) => (ms === null ? "?" : ms < 3_600_000 ? `${Math.max(1, Math.round(ms / 60_000))}m` : ms < 86_400_000 ? `${Math.round(ms / 3_600_000)}h` : `${Math.round(ms / 86_400_000)}d`);

export function InsightsTab({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [section, setSection] = useState<Section>("funnel");
  return (
    <div className="ins">
      <header className="ins-head">
        <h2>Insights</h2>
        <div className="ins-tabs" role="tablist" aria-label="Insight">
          {SECTIONS.map((s) => (
            <button key={s.key} type="button" role="tab" aria-selected={section === s.key} className={section === s.key ? "is-on" : undefined} onClick={() => setSection(s.key)}>
              <s.icon size={14} aria-hidden="true" /> {s.label}
            </button>
          ))}
        </div>
      </header>
      {section === "funnel" ? <Funnel /> : null}
      {section === "leavers" ? <Leavers onOpenMember={onOpenMember} /> : null}
      {section === "economy" ? <Economy /> : null}
      {section === "events" ? <Events /> : null}
    </div>
  );
}

type Cohort = { week: string; joined: number; applied: number; accepted: number; spoke: number; active: number | null; stayed: number | null };

function Funnel() {
  const { data, error } = useLive<{ cohorts: Cohort[] }>("/api/admin/insights?kind=funnel", 300_000);
  const rows = data?.cohorts ?? [];
  const steps: { key: keyof Cohort; label: string; help: string }[] = [
    { key: "joined", label: "Joined", help: "New members that week" },
    { key: "applied", label: "Sent a join app", help: "" },
    { key: "accepted", label: "Accepted", help: "" },
    { key: "spoke", label: "Said something", help: "At least one message, ever" },
    { key: "active", label: "Still chatting", help: "5+ messages in their own weeks 2–4 (shows once the whole week is 4 weeks old)" },
    { key: "stayed", label: "Still here at 30 days", help: "" },
  ];
  // The whole 8 weeks together (only weeks old enough count for the later steps)
  const total = (k: keyof Cohort) => rows.reduce((a, r) => a + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);
  const base = (k: keyof Cohort) => rows.filter((r) => r[k] !== null).reduce((a, r) => a + r.joined, 0);
  return (
    <section className="ins-card">
      <h3>From joining to sticking around</h3>
      <p className="adm-muted">The last 8 weeks of new members, step by step. Where the biggest drop is, that&apos;s where to look.</p>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data ? <div className="adm-skeleton" style={{ height: 220 }} /> : null}
      {data ? (
        <>
          <ol className="ins-funnel">
            {steps.map((s) => {
              const n = total(s.key);
              const of = s.key === "active" || s.key === "stayed" ? base(s.key) : total("joined");
              const w = of ? Math.max(2, (n / of) * 100) : 0;
              return (
                <li key={s.key}>
                  <span className="ins-funnel-label">
                    <b>{s.label}</b>
                    {s.help ? <small className="adm-muted">{s.help}</small> : null}
                  </span>
                  <span className="ins-bar" aria-hidden="true">
                    <span style={{ width: `${w}%` }} />
                  </span>
                  <span className="ins-funnel-n">
                    {n.toLocaleString()} <small className="adm-muted">{s.key === "joined" ? "" : pct(n, of)}</small>
                  </span>
                </li>
              );
            })}
          </ol>
          <table className="ins-table">
            <caption>Week by week</caption>
            <thead>
              <tr>
                <th scope="col">Week of</th>
                {steps.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.week}>
                  <td>{new Date(`${r.week}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                  <td>{r.joined}</td>
                  <td>{r.applied} <small className="adm-muted">{pct(r.applied, r.joined)}</small></td>
                  <td>{r.accepted} <small className="adm-muted">{pct(r.accepted, r.joined)}</small></td>
                  <td>{r.spoke} <small className="adm-muted">{pct(r.spoke, r.joined)}</small></td>
                  <td>{r.active === null ? <span className="adm-muted">too soon</span> : <>{r.active} <small className="adm-muted">{pct(r.active, r.joined)}</small></>}</td>
                  <td>{r.stayed === null ? <span className="adm-muted">too soon</span> : <>{r.stayed} <small className="adm-muted">{pct(r.stayed, r.joined)}</small></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="adm-muted ins-note">Join dates come from the member list (Discord only keeps someone&apos;s latest join), and messages from the Moderation Bot&apos;s message history.</p>
        </>
      ) : null}
    </section>
  );
}

type LeaverData = { days: number; total: number; stayed: { label: string; n: number }[]; stage: { label: string; n: number }[]; quietLeavers: number; punishedBefore: number; recent: { id: string; joinedAt: string | null; leftAt: string | null; stayedMs: number | null; stage: string; messages: number; punished: boolean }[]; people: People };

function Leavers({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const [days, setDays] = useState(30);
  const { data, error } = useLive<LeaverData>(`/api/admin/insights?kind=leavers&days=${days}`, 300_000);
  const max = (list: { n: number }[]) => Math.max(1, ...list.map((x) => x.n));
  return (
    <section className="ins-card">
      <div className="ins-card-head">
        <div>
          <h3>Who left, and when</h3>
          <p className="adm-muted">Discord doesn&apos;t say why people leave, but where they were when they left usually tells the story.</p>
        </div>
        <select className="adm-select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data ? <div className="adm-skeleton" style={{ height: 220 }} /> : null}
      {data ? (
        <>
          <div className="ins-kpis">
            <div>
              <b>{data.total}</b>
              <span>left</span>
            </div>
            <div>
              <b>{pct(data.quietLeavers, data.total)}</b>
              <span>never said a word</span>
            </div>
            <div>
              <b>{data.punishedBefore}</b>
              <span>left within 3 days of a punishment</span>
            </div>
          </div>
          <div className="ins-two">
            <div>
              <h4>How long they stayed</h4>
              <ul className="ins-bars">
                {data.stayed.map((s) => (
                  <li key={s.label}>
                    <span>{s.label}</span>
                    <span className="ins-bar" aria-hidden="true">
                      <span style={{ width: `${(s.n / max(data.stayed)) * 100}%` }} />
                    </span>
                    <b>{s.n}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Where they were in joining</h4>
              <ul className="ins-bars">
                {data.stage.map((s) => (
                  <li key={s.label}>
                    <span>{s.label}</span>
                    <span className="ins-bar" aria-hidden="true">
                      <span style={{ width: `${(s.n / max(data.stage)) * 100}%` }} />
                    </span>
                    <b>{s.n}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {data.recent.length ? (
            <table className="ins-table">
              <caption>Most recent</caption>
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Stayed</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Messages</th>
                  <th scope="col">Left</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <PersonLink id={r.id} people={data.people} onOpen={onOpenMember} compact />
                    </td>
                    <td>{span(r.stayedMs)}</td>
                    <td>
                      {r.stage}
                      {r.punished ? <span className="adm-tag ins-pun">after a punishment</span> : null}
                    </td>
                    <td>{r.messages}</td>
                    <td>{r.leftAt ? formatDate(r.leftAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

type Econ = { supply: number; holders: number; median: number; top1Share: number; top10Share: number; days: { day: string; store: number; gambled: number; houseNet: number; gifts: number }[]; totals: { store: number; houseNet: number; gifts: number } };

function Economy() {
  const [days, setDays] = useState(30);
  const { data, error } = useLive<Econ>(`/api/admin/insights?kind=economy&days=${days}`, 300_000);
  const cur = useCurrency();
  const maxStore = Math.max(1, ...(data?.days ?? []).map((d) => d.store));
  return (
    <section className="ins-card">
      <div className="ins-card-head">
        <div>
          <h3>Economy health</h3>
          <p className="adm-muted">{cur.text("How many Leaves exist, how spread out they are, and how much goes out of circulation through the store and the casino.")}</p>
        </div>
        <select className="adm-select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data ? <div className="adm-skeleton" style={{ height: 220 }} /> : null}
      {data ? (
        <>
          <div className="ins-kpis">
            <div>
              <b><Amt n={data.supply} /></b>
              <span>in circulation, held by {data.holders.toLocaleString()} members</span>
            </div>
            <div>
              <b><Amt n={data.median} /></b>
              <span>typical balance</span>
            </div>
            <div>
              <b>{Math.round(data.top1Share * 100)}%</b>
              <span>held by the richest 1% ({Math.round(data.top10Share * 100)}% by the top 10%)</span>
            </div>
            <div>
              <b><Amt n={data.totals.store} /></b>
              <span>spent in the store</span>
            </div>
            <div>
              <b className={data.totals.houseNet < 0 ? "ins-neg" : undefined}><Amt n={data.totals.houseNet} /></b>
              <span>{data.totals.houseNet >= 0 ? "kept by the casino" : "paid out by the casino (more than it took in)"}</span>
            </div>
          </div>
          {data.top1Share > 0.4 ? <p className="ins-flag">{cur.text("A few members hold most of the Leaves. Store prices may feel out of reach for everyone else.")}</p> : null}
          {data.totals.houseNet < 0 ? <p className="ins-flag">{cur.text("The casino paid out more than it took in this period, which adds Leaves to the economy.")}</p> : null}
          <h4>Store spending per day</h4>
          <div className="ins-cols" role="img" aria-label="Store spending per day">
            {data.days.map((d) => (
              <span key={d.day} className="ins-col" title={`${d.day}: ${d.store.toLocaleString()} in the store, ${d.gambled.toLocaleString()} gambled, ${d.gifts} gifts`}>
                <span style={{ height: `${(d.store / maxStore) * 100}%` }} />
              </span>
            ))}
          </div>
          <table className="ins-table">
            <caption>Day by day</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Store</th>
                <th scope="col">Gambled</th>
                <th scope="col">Casino kept</th>
                <th scope="col">Gifts</th>
              </tr>
            </thead>
            <tbody>
              {[...data.days].reverse().slice(0, 14).map((d) => (
                <tr key={d.day}>
                  <td>{new Date(`${d.day}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                  <td>{d.store.toLocaleString()}</td>
                  <td>{d.gambled.toLocaleString()}</td>
                  <td className={d.houseNet < 0 ? "ins-neg" : undefined}>{d.houseNet.toLocaleString()}</td>
                  <td>{d.gifts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}

type EventsData = { events: { id: string; title: string; startAt: string; going: number; chatted: number | null; goingAndChatted: number | null }[]; giveaways: { id: string; title: string; endAt: string; entries: number; winners: number; awarded: number; newMembers: number }[] };

function Events() {
  const [days, setDays] = useState(60);
  const { data, error } = useLive<EventsData>(`/api/admin/insights?kind=events&days=${days}`, 300_000);
  return (
    <section className="ins-card">
      <div className="ins-card-head">
        <div>
          <h3>How events and giveaways did</h3>
          <p className="adm-muted">For events: how many said they&apos;d come, and how many people chatted in the event&apos;s channel while it was on. For giveaways: entries, and entrants who joined the server during it.</p>
        </div>
        <select className="adm-select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={120}>Last 4 months</option>
        </select>
      </div>
      {error ? <p className="adm-error">{error}</p> : null}
      {!data ? <div className="adm-skeleton" style={{ height: 220 }} /> : null}
      {data ? (
        <>
          <table className="ins-table">
            <caption>Events</caption>
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Said they&apos;d come</th>
                <th scope="col">Chatted during it</th>
                <th scope="col">Of those who said yes</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <b>{e.title}</b> <small className="adm-muted">{formatDate(e.startAt)}</small>
                  </td>
                  <td>{e.going}</td>
                  <td>{e.chatted ?? <span className="adm-muted">no channel</span>}</td>
                  <td>{e.goingAndChatted === null ? "—" : <>{e.goingAndChatted} <small className="adm-muted">{pct(e.goingAndChatted, e.going)}</small></>}</td>
                </tr>
              ))}
              {!data.events.length ? (
                <tr>
                  <td colSpan={4} className="adm-muted">
                    No events in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <table className="ins-table">
            <caption>Giveaways</caption>
            <thead>
              <tr>
                <th scope="col">Giveaway</th>
                <th scope="col">Entries</th>
                <th scope="col">Prizes given</th>
                <th scope="col">Entrants who joined during it</th>
              </tr>
            </thead>
            <tbody>
              {data.giveaways.map((g) => (
                <tr key={g.id}>
                  <td>
                    <b>{g.title}</b> <small className="adm-muted">ended {formatDate(g.endAt)}</small>
                  </td>
                  <td>{g.entries}</td>
                  <td>
                    {g.awarded} of {g.winners}
                  </td>
                  <td>{g.newMembers}</td>
                </tr>
              ))}
              {!data.giveaways.length ? (
                <tr>
                  <td colSpan={4} className="adm-muted">
                    No giveaways ended in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}
