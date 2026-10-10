"use client";

import { CalendarClock, Check, Gift, Package, PartyPopper, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicGiveaway } from "../../lib/giveaways";
import { useCurrency } from "../season-context";
import { LeafEmote } from "../ui-icons";

type Data = { running: PublicGiveaway[]; upcoming: PublicGiveaway[]; ended: PublicGiveaway[]; entered: string[] };

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

function left(ms: number) {
  if (ms <= 0) return "ending…";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

function Prize({ g }: { g: PublicGiveaway }) {
  const cur = useCurrency();
  if (g.prize.type === "leaves")
    return (
      <span className="gwp-prize">
        <LeafEmote size={28} /> <b>{(g.prize.amount ?? 0).toLocaleString()}</b> {cur.many}
      </span>
    );
  if (g.prize.type === "item")
    return (
      <span className="gwp-prize">
        <Package size={26} aria-hidden="true" /> <b>{(g.prize.quantity ?? 1) > 1 ? `${g.prize.quantity}× ` : ""}{g.prize.itemName}</b>
      </span>
    );
  return (
    <span className="gwp-prize">
      <Gift size={26} aria-hidden="true" /> <b>{g.prize.text}</b>
    </span>
  );
}

export function GiveawayBoard({ initial, signedIn, linked }: { initial: Data | null; signedIn: boolean; linked: boolean }) {
  const [data, setData] = useState<Data | null>(initial);
  const [entered, setEntered] = useState<Set<string>>(new Set(initial?.entered ?? []));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const now = useNow();
  // Countdowns depend on the visitor's clock, so they're drawn in the browser only
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/giveaways", { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => {
          if (!r?.ok) return;
          setData(r);
          setEntered(new Set(r.entered));
        })
        .catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const toggle = async (g: PublicGiveaway) => {
    const enter = !entered.has(g.id);
    setBusy(g.id);
    setMsg(null);
    const r = await fetch(`/api/giveaways/${g.id}/enter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enter }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(null);
    if (!r?.ok) return setMsg({ id: g.id, ok: false, text: r?.error ?? "Couldn't do that right now." });
    setEntered((s) => {
      const next = new Set(s);
      if (enter) next.add(g.id);
      else next.delete(g.id);
      return next;
    });
    setData((d) => (d ? { ...d, running: d.running.map((x) => (x.id === g.id ? { ...x, entries: r.entries } : x)) } : d));
    setMsg({ id: g.id, ok: true, text: enter ? "You're in! Good luck 🍀" : "You left the giveaway." });
  };

  if (!mounted)
    return (
      <div className="gwp">
        <div className="gwp-loading" aria-busy="true" />
      </div>
    );

  return (
    <div className="gwp">
      <header className="gwp-hero">
        <p className="gwp-eyebrow">
          <Gift size={14} aria-hidden="true" /> Giveaways
        </p>
        <h1>Win something nice</h1>
        <p className="gwp-lead">Currency, store items and surprises. Enter here or with the button in Discord; winners are picked by the bot and paid automatically.</p>
      </header>

      {!data ? (
        <p className="gwp-empty">Giveaways couldn&apos;t load right now.</p>
      ) : (
        <>
          {data.running.length ? (
            <div className="gwp-grid">
              {data.running.map((g) => {
                const ms = new Date(g.endAt).getTime() - now;
                const isIn = entered.has(g.id);
                return (
                  <article key={g.id} className={`gwp-card${isIn ? " is-in" : ""}`} style={g.color ? ({ ["--gw" as string]: g.color } as React.CSSProperties) : undefined}>
                    {g.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="gwp-img" src={g.image} alt="" loading="lazy" />
                    ) : null}
                    <div className="gwp-card-body">
                      <span className="gwp-timer">
                        <CalendarClock size={14} aria-hidden="true" /> Ends in {left(ms)}
                      </span>
                      <h2>{g.title}</h2>
                      <Prize g={g} />
                      {g.description ? <p className="gwp-desc">{g.description}</p> : null}
                      <ul className="gwp-facts">
                        <li>
                          <Trophy size={14} aria-hidden="true" /> {g.winners} winner{g.winners === 1 ? "" : "s"}
                        </li>
                        <li>
                          <Users size={14} aria-hidden="true" /> {g.entries.toLocaleString()} entered
                        </li>
                      </ul>
                      {g.needs.length ? (
                        <p className="gwp-needs">
                          To enter: {g.needs.join(" · ")}
                        </p>
                      ) : null}
                      {linked ? (
                        <button type="button" className={`gwp-enter${isIn ? " is-in" : ""}`} disabled={busy === g.id || ms <= 0} onClick={() => toggle(g)}>
                          {isIn ? (
                            <>
                              <Check size={16} aria-hidden="true" /> Entered (tap to leave)
                            </>
                          ) : (
                            <>
                              <PartyPopper size={16} aria-hidden="true" /> Enter giveaway
                            </>
                          )}
                        </button>
                      ) : (
                        <a className="gwp-enter" href={signedIn ? "/account#discord" : "/login?next=/giveaways"}>
                          {signedIn ? "Link Discord to enter" : "Log in to enter"}
                        </a>
                      )}
                      {msg?.id === g.id ? <p className={msg.ok ? "gwp-ok" : "gwp-err"}>{msg.text}</p> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="gwp-empty">
              <Gift size={28} aria-hidden="true" />
              <p>No giveaways running right now. Check back soon!</p>
            </div>
          )}

          {data.upcoming.length ? (
            <section className="gwp-section">
              <h2>Coming up</h2>
              <ul className="gwp-list">
                {data.upcoming.map((g) => (
                  <li key={g.id}>
                    <Prize g={g} />
                    <span>
                      <b>{g.title}</b>
                      <small>Starts in {left(new Date(g.startAt ?? g.endAt).getTime() - now)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.ended.length ? (
            <section className="gwp-section">
              <h2>Recent winners</h2>
              <ul className="gwp-list">
                {data.ended.map((g) => (
                  <li key={g.id}>
                    <Trophy size={18} aria-hidden="true" />
                    <span>
                      <b>{g.winnerNames.length ? g.winnerNames.join(", ") : "Nobody qualified"}</b>
                      <small>
                        won {g.title} · {new Date(g.endAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
