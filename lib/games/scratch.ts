// Scratch-off tickets for the website, with the same tickets, odds and prizes as the bot
// (Economy/cmds/scratchoff.py). A ticket is generated and settled the moment it's bought, so the
// scratching on screen is only the reveal: closing the page can't change the result. There's no daily
// limit; Black Diamond and every ticket above it are Nitro-only.

import { withTierAliases } from "../tier-roles";
import { hasPremiumGames } from "../perks";
import { getMemberRoleIds } from "../discord-member";
import { addToJackpot, charge, credit, gameCollections, GameError, num, random, recordGame, shuffle, userFilter } from "./core";


type Prize = { symbol: string; payout: number; weight: number };
export type Ticket = { id: string; name: string; icon: string; tier: "low" | "mid" | "high" | "vip"; cost: number; winChance: number; prizes: Prize[]; nitro?: boolean; colors: [string, string] };

const t = (id: string, icon: string, name: string, tier: Ticket["tier"], cost: number, winChance: number, colors: [string, string], prizes: [string, number, number][], nitro = false): Ticket => ({
  id,
  icon,
  name,
  tier,
  cost,
  winChance,
  colors,
  nitro,
  prizes: prizes.map(([symbol, payout, weight]) => ({ symbol, payout, weight })),
});

export const TICKETS: Ticket[] = [
  t("apple", "🍎", "Apple Orchard", "low", 10, 0.254, ["#e5484d", "#7a1a1e"], [["🎟️", 10, 4500], ["🍏", 20, 3000], ["🥧", 50, 1600], ["🌳", 150, 800], ["🍎", 500, 100]]),
  t("coffee", "☕", "Coffee Break", "low", 15, 0.255, ["#a0663a", "#3a2214"], [["🎟️", 15, 4500], ["🍩", 30, 3000], ["🥐", 75, 1600], ["🍵", 220, 800], ["☕", 750, 100]]),
  t("dog", "🐶", "Lucky Dog", "low", 25, 0.262, ["#f2a23a", "#7a4a12"], [["🎟️", 25, 4500], ["🦴", 50, 3000], ["🎾", 120, 1600], ["🐕", 380, 800], ["🏆", 1000, 100]]),
  t("dice", "🎲", "Pocket Dice", "low", 30, 0.254, ["#3e9bff", "#0b2a6b"], [["🎟️", 30, 4500], ["🃏", 60, 3000], ["🎱", 150, 1600], ["🎰", 450, 800], ["🎲", 1500, 100]]),
  t("bronze", "🍀", "Lucky 7s", "low", 50, 0.254, ["#46a758", "#14401c"], [["🎟️", 50, 4500], ["🍒", 100, 3000], ["🍉", 250, 1600], ["🔔", 750, 800], ["7️⃣", 2500, 100]]),
  t("taco", "🌮", "Taco Tuesday", "low", 75, 0.257, ["#ffb21e", "#8a3a0b"], [["🎟️", 75, 4500], ["🌶️", 150, 3000], ["🥑", 380, 1600], ["🌯", 1100, 800], ["🌮", 3500, 100]]),
  t("fish", "🎣", "Gone Fishing", "mid", 100, 0.254, ["#12a5b4", "#0b3a4a"], [["🎟️", 100, 4500], ["🐟", 200, 3000], ["🐡", 500, 1600], ["🦈", 1500, 800], ["🐋", 5000, 100]]),
  t("beach", "🏖️", "Beach Bums", "mid", 150, 0.255, ["#ffd166", "#1fa2b4"], [["🎟️", 150, 4500], ["🐚", 300, 3000], ["🥥", 750, 1600], ["🏄", 2200, 800], ["🏝️", 7500, 100]]),
  t("silver", "💸", "Cash Grab", "mid", 250, 0.255, ["#3ddc84", "#0f5a32"], [["🎟️", 250, 4500], ["💵", 500, 3000], ["💰", 1200, 1600], ["🎰", 3800, 800], ["✖️", 12500, 100]]),
  t("party", "🎈", "Party Time", "mid", 300, 0.254, ["#ff4d8d", "#6b1a8a"], [["🎟️", 300, 4500], ["🎁", 600, 3000], ["🎂", 1500, 1600], ["🎊", 4500, 800], ["🎉", 15000, 100]]),
  t("speed", "🏎️", "Need for Speed", "mid", 500, 0.254, ["#e5484d", "#1a1a24"], [["🎟️", 500, 4500], ["⛽", 1000, 3000], ["🔧", 2500, 1600], ["🏁", 7500, 800], ["🏎️", 25000, 100]]),
  t("rock", "🎸", "Rock Star", "mid", 750, 0.252, ["#b46cff", "#1a0b35"], [["🎟️", 750, 4500], ["🎤", 1500, 3000], ["🥁", 3800, 1600], ["⭐", 11000, 800], ["🎸", 40000, 100]]),
  t("gold", "🌟", "24K Gold Rush", "high", 1000, 0.254, ["#ffd56a", "#8a5a00"], [["🎟️", 1000, 4500], ["🪙", 2000, 3000], ["⭐", 5000, 1600], ["🔥", 15000, 800], ["👑", 50000, 100]]),
  t("castle", "🏰", "Medieval Castle", "high", 1500, 0.255, ["#8a94a3", "#2a3346"], [["🎟️", 1500, 4500], ["🛡️", 3000, 3000], ["⚔️", 7500, 1600], ["🐉", 22000, 800], ["🏰", 75000, 100]]),
  t("magic", "🔮", "Mystic Magic", "high", 2000, 0.254, ["#9d4edd", "#240b4a"], [["🎟️", 2000, 4500], ["📜", 4000, 3000], ["🧪", 10000, 1600], ["🧙", 30000, 800], ["🔮", 100000, 100]]),
  t("nitro", "💎", "Black Diamond", "high", 2500, 0.248, ["#ff73fa", "#14082a"], [["🎟️", 2500, 4500], ["💳", 5000, 3000], ["🥂", 12000, 1600], ["💎", 38000, 800], ["🌌", 150000, 100]], true),
  t("moon", "🚀", "To the Moon", "high", 5000, 0.254, ["#4dc3ff", "#05082a"], [["🎟️", 5000, 4500], ["🛰️", 10000, 3000], ["👽", 25000, 1600], ["🛸", 75000, 800], ["🚀", 250000, 100]]),
  t("dragon", "🐉", "Dragon's Hoard", "high", 7500, 0.252, ["#ff6a00", "#3a0a04"], [["🎟️", 7500, 4500], ["🦴", 15000, 3000], ["🔥", 38000, 1600], ["👁️", 110000, 800], ["🐉", 400000, 100]]),
  t("olympus", "🏛️", "Mount Olympus", "high", 10000, 0.254, ["#fff3c4", "#8a7a52"], [["🎟️", 10000, 4500], ["🍷", 20000, 3000], ["🦅", 50000, 1600], ["⚡", 150000, 800], ["🏛️", 500000, 100]]),
  t("heist", "🏦", "Bank Heist", "high", 15000, 0.255, ["#3ddc84", "#0a1a14"], [["🎟️", 15000, 4500], ["🔦", 30000, 3000], ["🗝️", 75000, 1600], ["💰", 220000, 800], ["🏦", 750000, 100]]),
  t("royal", "👑", "Royal Fortune", "vip", 25000, 0.255, ["#ffd56a", "#4a0a2a"], [["🎟️", 25000, 4500], ["💍", 50000, 3000], ["🏰", 120000, 1600], ["👑", 380000, 800], ["⚜️", 1250000, 100]]),
  t("pirate", "🏴‍☠️", "Pirate's Booty", "vip", 50000, 0.254, ["#c9a04a", "#1a1008"], [["🎟️", 50000, 4500], ["⚔️", 100000, 3000], ["🗺️", 250000, 1600], ["⚓", 750000, 800], ["🏴‍☠️", 2500000, 100]]),
  t("cosmic", "🌌", "Cosmic Jackpot", "vip", 75000, 0.252, ["#b46cff", "#020414"], [["🎟️", 75000, 4500], ["🌠", 150000, 3000], ["🪐", 380000, 1600], ["☄️", 1100000, 800], ["🌌", 4000000, 100]]),
  t("whale", "🐋", "Whale's Wealth", "vip", 100000, 0.222, ["#2bb8ff", "#021a3a"], [["🎟️", 100000, 4500], ["🦐", 200000, 3000], ["🐙", 500000, 1600], ["🔱", 1500000, 800], ["🐋", 10000000, 100]]),
];

// Black Diamond and every ticket above it are premium: Nitro boosters only (same as /scratchoff)
const PREMIUM_FROM = TICKETS.findIndex((x) => x.id === "nitro");
TICKETS.forEach((x, i) => {
  if (i >= PREMIUM_FROM) x.nitro = true;
});

const byId = new Map(TICKETS.map((x) => [x.id, x]));

function pickWeighted(prizes: Prize[]) {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let roll = random() * total;
  for (const p of prizes) {
    roll -= p.weight;
    if (roll < 0) return p;
  }
  return prizes[prizes.length - 1];
}

const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
const count = (grid: string[], s: string) => grid.filter((x) => x === s).length;

/** Same generator as the bot: winners get exactly one triple; losers a teasing pair of a top prize. */
function generate(ticket: Ticket) {
  const symbols = ticket.prizes.map((p) => p.symbol);
  const grid: string[] = [];
  let win: Prize | null = null;
  if (random() < ticket.winChance) {
    win = pickWeighted(ticket.prizes);
    grid.push(win.symbol, win.symbol, win.symbol);
    while (grid.length < 9) {
      const f = pick(symbols);
      if (f !== win.symbol && count(grid, f) < 2) grid.push(f);
    }
  } else {
    const top = [...ticket.prizes].sort((a, b) => b.payout - a.payout).slice(0, 2);
    const tease = pick(top).symbol;
    grid.push(tease, tease);
    while (grid.length < 9) {
      const f = pick(symbols);
      if (count(grid, f) < 2) grid.push(f);
    }
  }
  return { grid: shuffle(grid), win };
}

/** The member's latest ticket, kept so it can be watched while it's scratched (`_id: "sc:<discordId>"`). */
export type ScratchSession = { _id: string; discordId: string; ticket: string; grid: string[]; winSymbol: string | null; payout: number; revealed: number[]; finished: boolean; startedAt: Date; updatedAt: Date };

async function openScratch(discordId: string, ticket: string, grid: string[], winSymbol: string | null, payout: number) {
  const { sessions } = await gameCollections();
  const now = new Date();
  const doc: ScratchSession = { _id: `sc:${discordId}`, discordId, ticket, grid, winSymbol, payout, revealed: [], finished: false, startedAt: now, updatedAt: now };
  await sessions.replaceOne({ _id: doc._id } as never, doc as never, { upsert: true });
}

/** The player reports which cells they've scratched open (only for spectators: the result was settled at purchase). */
export async function scratchProgress(discordId: string, raw: unknown) {
  const cells = Array.isArray(raw) ? raw.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 9) : [];
  const { sessions } = await gameCollections();
  const doc = (await sessions.findOneAndUpdate(
    { _id: `sc:${discordId}`, finished: false } as never,
    { $addToSet: { revealed: { $each: cells } }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  )) as unknown as ScratchSession | null;
  if (doc && doc.revealed.length >= 9) await sessions.updateOne({ _id: doc._id } as never, { $set: { finished: true, updatedAt: new Date() } });
  return { saved: true };
}

/** Premium games (25 spins, premium scratch-offs): Nitro boosters and Prince / Princess+ Patreon supporters */
async function isNitro(discordId: string) {
  const roles = await withTierAliases(await getMemberRoleIds(discordId).catch(() => null));
  return hasPremiumGames(roles);
}

export async function scratchStatus(discordId: string) {
  const { users } = await gameCollections();
  const [doc, nitro] = await Promise.all([users.findOne(userFilter(discordId), { projection: { balance: 1 }, useBigInt64: true }), isNitro(discordId)]);
  return { balance: num(doc?.balance), nitro };
}

export async function buyTicket(discordId: string, ticketId: unknown) {
  const ticket = typeof ticketId === "string" ? byId.get(ticketId) : undefined;
  if (!ticket) throw new GameError("Pick a ticket.");
  const nitro = await isNitro(discordId);
  if (ticket.nitro && !nitro) throw new GameError(`${ticket.name} is a premium ticket: Black Diamond and up are for Nitro boosters and Prince / Princess ($10) supporters and up.`, 403);

  await charge(discordId, ticket.cost).catch(() => {
    throw new GameError(`You need ${ticket.cost.toLocaleString()} leaves for a ${ticket.name} ticket.`);
  });

  const { grid, win } = generate(ticket);
  const payout = win?.payout ?? 0;
  if (payout > 0) await credit(discordId, payout);
  else await addToJackpot(ticket.cost);
  await recordGame(discordId, "scratchoff", ticket.cost, payout, `Scratch: ${grid.slice(0, 3).join("")} | ${grid.slice(3, 6).join("")} | ${grid.slice(6).join("")}`);

  await openScratch(discordId, ticket.id, grid, win?.symbol ?? null, payout).catch(() => undefined);
  const status = await scratchStatus(discordId);
  return { ticket: ticket.id, grid, winSymbol: win?.symbol ?? null, payout, ...status };
}
