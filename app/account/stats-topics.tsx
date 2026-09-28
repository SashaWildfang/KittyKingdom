"use client";

import {
  Angry,
  BedDouble,
  Bitcoin,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Camera,
  Car,
  Castle,
  Cigarette,
  Clapperboard,
  CloudSun,
  Code2,
  Coffee,
  Cpu,
  Crosshair,
  CupSoda,
  Dices,
  Dog,
  Dumbbell,
  EyeOff,
  Flame,
  Gamepad,
  Gamepad2,
  Ghost,
  Gift,
  Glasses,
  GraduationCap,
  Guitar,
  Hand,
  Hash,
  Heart,
  HeartHandshake,
  HelpCircle,
  Home,
  Languages,
  Laugh,
  Leaf,
  Lock,
  MessagesSquare,
  Mic2,
  MonitorPlay,
  Moon,
  Music,
  Newspaper,
  Palette,
  PartyPopper,
  PawPrint,
  Pickaxe,
  Pizza,
  Plane,
  Rainbow,
  Rocket,
  Scissors,
  Shirt,
  Sparkles,
  Sprout,
  Star,
  Swords,
  Thermometer,
  Trees,
  Trophy,
  Users,
  Wallet,
  Wine,
  Zap,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import type { MemberStats } from "../../lib/member-stats";
import { TOPIC_GROUPS } from "../../lib/topics";
import { TopicMessages } from "./stats-topic-messages";

const ICONS: Record<string, LucideIcon> = { Angry, BedDouble, Bitcoin, BookOpen, Bot, Brain, Briefcase, Camera, Car, Castle, Cigarette, Clapperboard, CloudSun, Code2, Coffee, Cpu, Crosshair, CupSoda, Dices, Dog, Dumbbell, EyeOff, Flame, Gamepad, Gamepad2, Ghost, Gift, Glasses, GraduationCap, Guitar, Hand, Hash, Heart, HeartHandshake, HelpCircle, Home, Languages, Laugh, Leaf, Lock, Mic2, MonitorPlay, Moon, Music, Newspaper, Palette, PartyPopper, PawPrint, Pickaxe, Pizza, Plane, Rainbow, Rocket, Scissors, Shirt, Sparkles, Sprout, Star, Swords, Thermometer, Trees, Trophy, Users, Wallet, Wine, Zap };
const fmt = (n: number) => Math.round(n).toLocaleString();
const pct = (x: number) => `${Math.round(x * 100)}%`;

type Topic = MemberStats["topics"]["list"][number];
type Bubble = { t: Topic; i: number; x: number; y: number; r: number };

/** Packs topic bubbles (bigger = talked about more) around the middle. */
function pack(list: Topic[], W: number, H: number): Bubble[] {
  const max = Math.max(1, ...list.map((t) => t.n));
  const minR = 26;
  const maxR = Math.min(W, H) * 0.2;
  const placed: Bubble[] = [];
  list.forEach((t, i) => {
    const r = minR + Math.sqrt(t.n / max) * (maxR - minR);
    if (!placed.length) {
      placed.push({ t, i, r, x: W / 2, y: H / 2 });
      return;
    }
    // Walk outward on a spiral until it fits without touching anything
    for (let step = 0; step < 4000; step++) {
      const angle = step * 0.35;
      const dist = 4 + step * 0.9;
      const x = W / 2 + Math.cos(angle) * dist * 1.35;
      const y = H / 2 + Math.sin(angle) * dist;
      if (x - r < 6 || x + r > W - 6 || y - r < 6 || y + r > H - 6) continue;
      if (placed.every((b) => Math.hypot(b.x - x, b.y - y) >= b.r + r + 6)) {
        placed.push({ t, i, r, x, y });
        return;
      }
    }
  });
  return placed;
}

/** A one-line "vibe" from the top topics (templates, no text generation). */
function vibe(list: Topic[]) {
  const top = list.slice(0, 3).map((t) => t.label.toLowerCase());
  if (!top.length) return null;
  const lead = list[0];
  const tone =
    lead.group === "games" ? "a gamer at heart" :
    lead.group === "social" ? "the heart of the conversation" :
    lead.group === "community" ? "a true regular of the kingdom" :
    lead.group === "creative" ? "a creative soul" :
    lead.group === "entertainment" ? "always up on the latest" :
    lead.group === "mind" ? "a curious mind" :
    lead.group === "nsfw" ? "a certified menace (18+)" : "living your best life";
  return `You're ${tone}: you talk most about ${top.length > 1 ? `${top.slice(0, -1).join(", ")} and ${top[top.length - 1]}` : top[0]}.`;
}

export function TopicMap({ topics: all }: { topics: MemberStats["topics"] }) {
  const [group, setGroup] = useState<string>("all");
  const [hideNsfw, setHideNsfw] = useState(false);
  const topics = useMemo(() => {
    const list = all.list.filter((t) => (group === "all" || t.group === group) && !(hideNsfw && t.group === "nsfw"));
    const total = list.reduce((acc, t) => acc + t.n, 0) || 1;
    return { ...all, list: list.map((t) => ({ ...t, share: t.n / total })) };
  }, [all, group, hideNsfw]);
  const groupsPresent = Array.from(new Set(all.list.map((t) => t.group)));
  const [picked, setPickedRaw] = useState<string | null>(null);
  // The context window: a word of the picked topic, or the whole topic ("*")
  const [word, setWord] = useState<string | null>(null);
  const setPicked = (key: string | null, w: string | null = null) => {
    setPickedRaw(key);
    setWord(w);
  };
  const [hover, setHover] = useState<string | null>(null);
  const W = 760;
  const H = 440;
  const bubbles = useMemo(() => pack(topics.list.slice(0, 26), W, H), [topics.list]);
  const selected = topics.list.find((t) => t.key === picked) ?? null;
  const maxWord = Math.max(1, ...(selected?.words ?? []).map((w) => w.n));
  const topicOf = (word: string) => topics.list.find((t) => t.words.some((w) => w.word === word)) ?? null;
  const cloud = topics.topWords.filter((w) => topicOf(w.word));
  const cloudMax = Math.max(1, ...all.topWords.map((w) => w.n));

  if (!all.list.length) {
    return (
      <p className="st-empty">
        Your topics fill in as you chat. The bot&apos;s topic AI reads each message as it arrives and only saves which topics it touched (and any topic
        keywords), never the message itself, so check back after chatting a bit.
      </p>
    );
  }

  const line = vibe(all.list.filter((t) => !(hideNsfw && t.group === "nsfw")));
  return (
    <div className="st-topics">
      {line ? (
        <p className="st-vibe">
          <Sparkles size={15} aria-hidden="true" /> {line}
        </p>
      ) : null}
      <div className="st-bfilters">
        <div className="st-seg st-seg--small" role="tablist" aria-label="Topic group">
          <button type="button" role="tab" aria-selected={group === "all"} className={group === "all" ? "is-on" : undefined} onClick={() => setGroup("all")}>
            All
          </button>
          {Object.entries(TOPIC_GROUPS)
            .filter(([g]) => groupsPresent.includes(g) && !(hideNsfw && g === "nsfw"))
            .map(([g, v]) => (
              <button key={g} type="button" role="tab" aria-selected={group === g} className={group === g ? "is-on" : undefined} onClick={() => setGroup(g)}>
                {v.label}
              </button>
            ))}
        </div>
        {groupsPresent.includes("nsfw") ? (
          <label className="st-toggle">
            <input type="checkbox" checked={hideNsfw} onChange={(e) => { setHideNsfw(e.target.checked); if (e.target.checked && group === "nsfw") setGroup("all"); }} /> Hide 18+
          </label>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your topic map" className="st-topic-svg">
        {bubbles.map((b) => {
          const Icon = ICONS[b.t.icon] ?? Hash;
          const on = picked === b.t.key || hover === b.t.key;
          const dim = (picked || hover) && !on;
          return (
            <g
              key={b.t.key}
              className={`st-topic-bubble${on ? " is-on" : ""}${dim ? " is-dim" : ""}`}
              style={{ "--d": `${b.i * 60}ms`, "--f": `${(b.i % 5) * 0.7}s`, transformOrigin: `${b.x}px ${b.y}px` } as CSSProperties}
              onMouseEnter={() => setHover(b.t.key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setPicked(picked === b.t.key ? null : b.t.key)}
              role="button"
              tabIndex={0}
              aria-label={`${b.t.label}: ${pct(b.t.share)} of your topics`}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPicked(picked === b.t.key ? null : b.t.key)}
            >
              <title>{`${b.t.label}: ${fmt(b.t.n)} messages`}</title>
              <circle cx={b.x} cy={b.y} r={b.r} fill={b.t.color} fillOpacity={on ? 0.95 : 0.78} stroke="#fff" strokeOpacity={on ? 0.8 : 0.15} strokeWidth={on ? 3 : 1.5} />
              <circle cx={b.x - b.r * 0.3} cy={b.y - b.r * 0.35} r={b.r * 0.55} fill="#fff" fillOpacity={0.12} />
              {b.r >= 34 ? (
                <>
                  <foreignObject x={b.x - 11} y={b.y - (b.r >= 50 ? 26 : 20)} width={22} height={22}>
                    <Icon size={22} color="#fff" />
                  </foreignObject>
                  <text x={b.x} y={b.y + (b.r >= 50 ? 12 : 10)} textAnchor="middle" className="st-topic-label">
                    {b.t.label.length * 7.4 <= b.r * 1.8 ? b.t.label : b.t.label.split(" ")[0]}
                  </text>
                  <text x={b.x} y={b.y + (b.r >= 50 ? 28 : 24)} textAnchor="middle" className="st-topic-share">
                    {pct(b.t.share)}
                  </text>
                </>
              ) : (
                <foreignObject x={b.x - 10} y={b.y - 10} width={20} height={20}>
                  <Icon size={20} color="#fff" />
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>

      {selected ? (
        <div className="st-topic-detail" style={{ "--hue": selected.color } as CSSProperties}>
          <header>
            <span className="st-topic-dot">{(() => { const I = ICONS[selected.icon] ?? Hash; return <I size={18} />; })()}</span>
            <div>
              <b>{selected.label}</b>
              <small>
                #{topics.list.indexOf(selected) + 1} topic · {fmt(selected.n)} messages · {pct(selected.share)} of your topics
              </small>
            </div>
            <button type="button" className={`st-topic-see${word === "*" ? " is-on" : ""}`} onClick={() => setWord(word === "*" ? null : "*")}>
              <MessagesSquare size={14} /> See messages
            </button>
            <button type="button" className="st-x" onClick={() => setPicked(null)} aria-label="Close">
              <X size={15} />
            </button>
          </header>
          {selected.words.length ? (
            <>
              <ul className="st-rank-list st-rank-list--click st-topic-words">
                {selected.words.map((w) => (
                  <li key={w.word}>
                    <button
                      type="button"
                      className={word === w.word ? "is-on" : undefined}
                      aria-pressed={word === w.word}
                      onClick={() => setWord(word === w.word ? null : w.word)}
                      title={`See your messages with “${w.word}”`}
                    >
                      <span className="st-rank-name">{w.word}</span>
                      <span className="st-rank-bar">
                        <i style={{ "--w": `${(w.n / maxWord) * 100}%`, background: selected.color } as CSSProperties} />
                      </span>
                      <span className="st-rank-val">{fmt(w.n)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {!word ? <p className="st-bars-readout">Tap a word to see messages where you used it.</p> : null}
            </>
          ) : null}
          {word ? <TopicMessages word={word === "*" ? null : word} topic={selected.key} color={selected.color} onClose={() => setWord(null)} /> : null}
        </div>
      ) : (
        <p className="st-bars-readout">Tap a bubble to see the words behind it.</p>
      )}

      <div className="st-topic-list">
        {topics.list.map((t, i) => (
          <button key={t.key} type="button" className={picked === t.key ? "is-on" : undefined} onClick={() => setPicked(picked === t.key ? null : t.key)} style={{ "--hue": t.color, "--w": `${t.share * 100}%`, "--d": `${i * 30}ms` } as CSSProperties}>
            <span>{t.label}</span>
            <b>{pct(t.share)}</b>
            <i />
          </button>
        ))}
      </div>

      {cloud.length ? (
        <>
          <p className="st-note">Your most-used topic words</p>
          <div className="st-cloud">
            {cloud.map((w, i) => {
              const t = topicOf(w.word);
              return (
                <button
                  key={w.word}
                  type="button"
                  onClick={() => t && setPicked(t.key, w.word)}
                  style={{ "--hue": t?.color ?? "#f59b2a", fontSize: `${0.8 + (w.n / cloudMax) * 1.5}rem`, "--d": `${i * 20}ms` } as CSSProperties}
                  title={`${w.word}: ${fmt(w.n)} messages${t ? ` · ${t.label}` : ""}`}
                >
                  {w.word}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
