"use client";

import { ArrowLeft, Eye, EyeOff, Radio, Spade } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { LiveEntry, PublicScratch, Spectate } from "../../lib/games/live";
import { LeafEmote } from "../ui-icons";
import { BlackjackTable } from "./blackjack";
import { ScratchSpectator } from "./scratch";

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
};

function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="lv-avatar" src={src} alt="" width={size} height={size} onError={() => setFailed(true)} />
  ) : (
    <span className="lv-avatar is-letter" style={{ width: size, height: size }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Watch({ id, entry, tableUrl, minBet, onBack }: { id: string; entry: LiveEntry | null; tableUrl: (id: string) => string; minBet: number; onBack: () => void }) {
  const [data, setData] = useState<Spectate | null>(null);
  const [viewers, setViewers] = useState(entry?.viewers ?? 0);
  const [error, setError] = useState<string | null>(null);
  const isBj = id.startsWith("bj:");

  // First look (and, for tickets, keep following: blackjack follows itself)
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const res = await fetch(tableUrl(id), { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (stop) return;
      if (!res?.ok) return setError(res?.error ?? "Couldn't load this table.");
      setError(null);
      setData(res.table);
      setViewers(res.table.viewers);
    };
    void tick();
    if (isBj) return () => void (stop = true);
    const t = setInterval(tick, 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id, isBj, tableUrl]);

  const onData = useCallback((d: { viewers: number }) => setViewers(d.viewers), []);
  const player = data?.player ?? entry?.player ?? null;

  return (
    <div className="lv-watch">
      <div className="lv-watch-head">
        <button type="button" className="sc-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> All live games
        </button>
        {player ? (
          <span className="lv-watch-who">
            <Avatar src={player.avatar} name={player.name} size={30} />
            Watching <b>{player.name}</b> play {isBj ? "blackjack" : "a scratch-off"}
          </span>
        ) : null}
        <span className="lv-viewers" title="People watching this table">
          <Eye size={14} aria-hidden="true" /> {viewers}
        </span>
      </div>
      {error ? <p className="gm-error">{error}</p> : null}
      {data ? (
        isBj ? (
          <BlackjackTable key={id} initialTable={data.blackjack} minBet={minBet} watch={{ url: tableUrl(id), onData }} />
        ) : (
          <ScratchSpectator scratch={data.scratch as PublicScratch | null} />
        )
      ) : !error ? (
        <div className="lv-loading">Pulling up a chair…</div>
      ) : null}
    </div>
  );
}

/** Live tables: a lobby you can pick from, then a spectator's view of one. */
export function LiveGames({
  listUrl,
  tableUrl,
  minBet,
  initialWatch = null,
  privacy = false,
  onCount,
}: {
  listUrl: string;
  tableUrl: (id: string) => string;
  minBet: number;
  initialWatch?: string | null;
  /** Show the "let others watch my games" switch (members) */
  privacy?: boolean;
  onCount?: (n: number) => void;
}) {
  const [list, setList] = useState<LiveEntry[] | null>(null);
  const [watching, setWatching] = useState<string | null>(initialWatch);
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const res = await fetch(listUrl, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (stop) return;
      if (!res?.ok) return setError(res?.error ?? "Couldn't load live games.");
      setError(null);
      setList(res.live);
      onCount?.(res.live.filter((x: LiveEntry) => x.live).length);
    };
    void tick();
    const t = setInterval(tick, watching ? 8000 : 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [listUrl, watching, onCount]);

  useEffect(() => {
    if (!privacy) return;
    fetch("/api/games/audience", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setHidden(r.private))
      .catch(() => undefined);
  }, [privacy]);

  const pick = (id: string | null) => {
    setWatching(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("watch", id);
    else url.searchParams.delete("watch");
    window.history.replaceState(null, "", url);
  };

  const togglePrivacy = async () => {
    const next = !hidden;
    setHidden(next);
    await fetch("/api/games/audience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ private: next }) }).catch(() => undefined);
  };

  if (watching) return <Watch id={watching} entry={list?.find((x) => x.id === watching) ?? null} tableUrl={tableUrl} minBet={minBet} onBack={() => pick(null)} />;

  const live = (list ?? []).filter((x) => x.live);
  const recent = (list ?? []).filter((x) => !x.live);

  return (
    <div className="lv">
      <div className="lv-head">
        <h2>
          <Radio size={18} aria-hidden="true" /> Live now
          {list ? <span className="lv-count">{live.length}</span> : null}
        </h2>
        {privacy && hidden !== null ? (
          <button type="button" className={`lv-privacy${hidden ? " is-hidden" : ""}`} onClick={togglePrivacy} title="Choose whether other members can watch your games">
            {hidden ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            {hidden ? "Your games are private" : "Others can watch your games"}
          </button>
        ) : null}
      </div>
      {error ? <p className="gm-error">{error}</p> : null}
      {!list ? (
        <div className="lv-loading">Looking for tables…</div>
      ) : !list.length ? (
        <div className="lv-empty">
          <Spade size={28} aria-hidden="true" />
          <p>No one&apos;s playing right now.</p>
          <small>Deal a hand or scratch a ticket, and other members can pull up a chair.</small>
        </div>
      ) : (
        <>
          <div className="lv-grid">
            {live.map((x, i) => (
              <LiveCard key={x.id} x={x} i={i} onWatch={() => pick(x.id)} />
            ))}
          </div>
          {recent.length ? (
            <>
              <h3 className="lv-sub">Just finished</h3>
              <div className="lv-grid">
                {recent.map((x, i) => (
                  <LiveCard key={x.id} x={x} i={i} onWatch={() => pick(x.id)} />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function LiveCard({ x, i, onWatch }: { x: LiveEntry; i: number; onWatch: () => void }) {
  const tone = /^(Won|Blackjack|Free)/.test(x.status) ? "is-up" : /^(Lost|No luck)/.test(x.status) ? "is-down" : "";
  return (
    <button type="button" className={`lv-card${x.live ? " is-live" : ""}`} style={{ "--i": i } as React.CSSProperties} onClick={onWatch}>
      <span className="lv-card-top">
        <Avatar src={x.player.avatar} name={x.player.name} />
        <span className="lv-card-who">
          <b>{x.player.name}</b>
          <small>{x.game === "blackjack" ? "🃏 Blackjack" : `${x.ticket?.icon ?? "🎟️"} ${x.ticket?.name ?? "Scratch-off"}`}</small>
        </span>
        {x.live ? <span className="lv-live">LIVE</span> : <span className="lv-ago">{ago(x.updatedAt)}</span>}
      </span>
      <span className="lv-card-bottom">
        <span className={`lv-status ${tone}`}>{x.status}</span>
        <span className="lv-stake">
          {x.stake.toLocaleString()} <LeafEmote size={13} />
        </span>
        <span className="lv-viewers" title="Watching">
          <Eye size={13} aria-hidden="true" /> {x.viewers}
        </span>
      </span>
    </button>
  );
}
