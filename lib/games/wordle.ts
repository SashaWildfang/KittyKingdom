// The daily Wordle on the website: the same game as the Economy bot's /wordle (Economy/cmds/wordle.py).
// Both read and write zeo_bot.wordle { discordId, wordle_active, wordle_target, wordle_guesses, message_id,
// next_wordle_time }, so it's one game every 24 hours whether it's played in Discord or here, and a game
// started in one can be finished in the other.
//
// The answer never leaves the server until the game is over: guesses are checked here and only the colours
// come back. Solving it pays the Wordle Leaves and XP from Admin → Bots → Economy → Wordle & QOTD.

import { randomInt } from "node:crypto";
import { Long, type Document } from "mongodb";
import { economyNumber } from "../bot-settings/live";
import { getBotCollection } from "../mongodb";
import { GameError, getBalance, num, userFilter } from "./core";
import { ANSWERS, VALID_GUESSES } from "./wordle-words";

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
const COOLDOWN_S = 24 * 3600;

const answers = ANSWERS.split(" ");
const valid = new Set(VALID_GUESSES.split(" "));

export type Mark = "correct" | "present" | "absent";
export type WordleRow = { word: string; marks: Mark[] };
export type WordleStatus = "ready" | "playing" | "won" | "lost" | "cooldown";
export type WordleState = {
  status: WordleStatus;
  rows: WordleRow[];
  /** Unix ms when the next game opens (after a finished game) */
  nextAt: number | null;
  /** Only once the game is over */
  answer: string | null;
  reward: { leaves: number; xp: number };
  /** True when the game in progress was started from Discord */
  fromDiscord: boolean;
};

/** Same rules as the bot (and the real Wordle): greens first, then yellows for letters still unused. */
export function markGuess(guess: string, target: string): Mark[] {
  const marks: Mark[] = Array(guess.length).fill("absent");
  const left: (string | null)[] = target.split("");
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === target[i]) {
      marks[i] = "correct";
      left[i] = null;
    }
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] !== "absent") continue;
    const at = left.indexOf(guess[i]);
    if (at >= 0) {
      marks[i] = "present";
      left[at] = null;
    }
  }
  return marks;
}

async function col() {
  return getBotCollection("wordle");
}

async function rewards() {
  const [leaves, xp] = await Promise.all([economyNumber("wordle.leaves", 300), economyNumber("wordle.xp", 300)]);
  return { leaves, xp };
}

const nowS = () => Math.floor(Date.now() / 1000);

function view(doc: Document | null, reward: { leaves: number; xp: number }): WordleState {
  const target = String(doc?.wordle_target ?? "");
  const guesses = ((doc?.wordle_guesses ?? []) as unknown[]).map(String);
  const active = Boolean(doc?.wordle_active) && target.length === WORD_LENGTH;
  const next = num(doc?.next_wordle_time);
  const rows = target.length === WORD_LENGTH ? guesses.map((w) => ({ word: w, marks: markGuess(w, target) })) : [];
  if (active) return { status: "playing", rows, nextAt: null, answer: null, reward, fromDiscord: Boolean(doc?.message_id) };
  if (next > nowS() && target.length === WORD_LENGTH) {
    const won = guesses[guesses.length - 1] === target;
    return { status: won ? "won" : "lost", rows, nextAt: next * 1000, answer: target, reward, fromDiscord: false };
  }
  return { status: "ready", rows: [], nextAt: null, answer: null, reward, fromDiscord: false };
}

export async function wordleState(discordId: string) {
  const [doc, reward, balance] = await Promise.all([(await col()).findOne(userFilter(discordId)), rewards(), getBalance(discordId)]);
  return { wordle: view(doc, reward), balance };
}

/** XP the same way the bot's leveling does: totalXp, plus xp left over in the current level and level-ups. */
async function addXp(discordId: string, gain: number) {
  if (gain <= 0) return;
  const users = await getBotCollection("users");
  const doc = await users.findOne(userFilter(discordId), { projection: { totalXp: 1, xp: 1, level: 1 }, useBigInt64: true });
  let level = Math.max(1, num(doc?.level) || 1);
  let leftover = num(doc?.xp) + gain;
  const needed = (l: number) => (l <= 1 ? 100 : Math.floor(100 * l ** 1.2));
  while (leftover >= needed(level)) {
    leftover -= needed(level);
    level += 1;
  }
  await users.updateOne(userFilter(discordId), { $set: { totalXp: num(doc?.totalXp) + gain, xp: leftover, level } }, { upsert: true });
}

export async function wordleGuess(discordId: string, raw: unknown) {
  const guess = String(raw ?? "").trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(guess)) throw new GameError("Guesses are 5 letters (A to Z).");
  if (!valid.has(guess)) throw new GameError(`${guess} isn't in the word list. Try a real word: that didn't use a guess.`);
  const c = await col();
  let doc = await c.findOne(userFilter(discordId));
  const reward = await rewards();
  let state = view(doc, reward);

  if (state.status === "won" || state.status === "lost" || state.status === "cooldown") throw new GameError("You've played today's Wordle. Come back when the timer runs out.", 409);
  if (state.status === "ready") {
    // A fresh word (and the bot's old message can't be used for it)
    const target = answers[randomInt(answers.length)];
    await c.updateOne(userFilter(discordId), { $set: { wordle_active: true, wordle_target: target, wordle_guesses: [], message_id: null }, $setOnInsert: { discordId: Long.fromString(discordId) } }, { upsert: true });
    doc = await c.findOne(userFilter(discordId));
    state = view(doc, reward);
  }
  const target = String(doc!.wordle_target);
  const guesses = ((doc!.wordle_guesses ?? []) as unknown[]).map(String);
  if (guesses.includes(guess)) throw new GameError(`You already guessed ${guess}.`);

  const won = guess === target;
  const over = won || guesses.length + 1 >= MAX_GUESSES;
  // Only if nothing else added a guess in the meantime (a second tab, or Discord)
  const res = await c.updateOne(
    { ...userFilter(discordId), wordle_active: true, wordle_target: target, [`wordle_guesses.${guesses.length}`]: { $exists: false } },
    { $push: { wordle_guesses: guess } as never, ...(over ? { $set: { wordle_active: false, next_wordle_time: nowS() + COOLDOWN_S } } : {}) },
  );
  if (!res.modifiedCount) throw new GameError("Your game changed somewhere else. Refresh and try again.", 409);

  if (won) {
    const users = await getBotCollection("users");
    await users.updateOne(userFilter(discordId), { $inc: { balance: reward.leaves }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    await addXp(discordId, reward.xp).catch(() => undefined);
  }
  return wordleState(discordId);
}

export async function wordleGiveUp(discordId: string) {
  const c = await col();
  const res = await c.updateOne({ ...userFilter(discordId), wordle_active: true }, { $set: { wordle_active: false, next_wordle_time: nowS() + COOLDOWN_S } });
  if (!res.modifiedCount) throw new GameError("There's no game to give up.", 409);
  return wordleState(discordId);
}
