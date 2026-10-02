// Scratch-off tickets for the website, with the same tickets, odds and prizes as the bot
// (Economy/cmds/scratchoff.py). A ticket is generated and settled the moment it's bought, so the
// scratching on screen is only the reveal: closing the page can't change the result. There's no daily
// limit; Black Diamond and every ticket above it are Nitro-only.

import { getMemberRoleIds } from "../discord-member";
import { addToJackpot, charge, credit, gameCollections, GameError, num, random, recordGame, shuffle, userFilter } from "./core";

const NITRO_ROLE_ID = "1360260086500561237";

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
  t("apple", "🍎", "Apple Orchard", "low", 10, 0.18, ["#e5484d", "#7a1a1e"], [["🎟️", 10, 8000], ["🍏", 15, 1500], ["🥧", 25, 400], ["🌳", 100, 90], ["🍎", 500, 10]]),
  t("coffee", "☕", "Coffee Break", "low", 15, 0.18, ["#a0663a", "#3a2214"], [["🎟️", 15, 8200], ["🍩", 25, 1300], ["🥐", 50, 400], ["🍵", 150, 95], ["☕", 750, 5]]),
  t("dog", "🐶", "Lucky Dog", "low", 25, 0.17, ["#f2a23a", "#7a4a12"], [["🎟️", 25, 8500], ["🦴", 40, 1100], ["🎾", 75, 300], ["🐕", 250, 95], ["🏆", 1000, 5]]),
  t("dice", "🎲", "Pocket Dice", "low", 30, 0.17, ["#3e9bff", "#0b2a6b"], [["🎟️", 30, 8500], ["🃏", 50, 1100], ["🎱", 100, 300], ["🎰", 300, 95], ["🎲", 1500, 5]]),
  t("bronze", "🍀", "Lucky 7s", "low", 50, 0.16, ["#46a758", "#14401c"], [["🎟️", 50, 8500], ["🍒", 75, 1200], ["🍉", 150, 250], ["🔔", 500, 45], ["7️⃣", 2500, 5]]),
  t("taco", "🌮", "Taco Tuesday", "low", 75, 0.16, ["#ffb21e", "#8a3a0b"], [["🎟️", 75, 8500], ["🌶️", 120, 1200], ["🥑", 250, 250], ["🌯", 750, 45], ["🌮", 3500, 5]]),
  t("fish", "🎣", "Gone Fishing", "mid", 100, 0.15, ["#12a5b4", "#0b3a4a"], [["🎟️", 100, 8800], ["🐟", 150, 900], ["🐡", 300, 250], ["🦈", 1000, 47], ["🐋", 5000, 3]]),
  t("beach", "🏖️", "Beach Bums", "mid", 150, 0.15, ["#ffd166", "#1fa2b4"], [["🎟️", 150, 8800], ["🐚", 250, 900], ["🥥", 500, 250], ["🏄", 1500, 47], ["🏝️", 7500, 3]]),
  t("silver", "💸", "Cash Grab", "mid", 250, 0.15, ["#3ddc84", "#0f5a32"], [["🎟️", 250, 8900], ["💵", 400, 800], ["💰", 750, 250], ["🎰", 2500, 48], ["✖️", 12500, 2]]),
  t("party", "🎈", "Party Time", "mid", 300, 0.14, ["#ff4d8d", "#6b1a8a"], [["🎟️", 300, 8900], ["🎁", 500, 800], ["🎂", 1000, 250], ["🎊", 3000, 48], ["🎉", 15000, 2]]),
  t("speed", "🏎️", "Need for Speed", "mid", 500, 0.14, ["#e5484d", "#1a1a24"], [["🎟️", 500, 9000], ["⛽", 750, 700], ["🔧", 1500, 250], ["🏁", 5000, 48], ["🏎️", 25000, 2]]),
  t("rock", "🎸", "Rock Star", "mid", 750, 0.14, ["#b46cff", "#1a0b35"], [["🎟️", 750, 9000], ["🎤", 1200, 700], ["🥁", 2500, 250], ["⭐", 7500, 48], ["🎸", 40000, 2]]),
  t("gold", "🌟", "24K Gold Rush", "high", 1000, 0.13, ["#ffd56a", "#8a5a00"], [["🎟️", 1000, 9100], ["🪙", 1500, 600], ["⭐", 3000, 250], ["🔥", 10000, 48], ["👑", 50000, 2]]),
  t("castle", "🏰", "Medieval Castle", "high", 1500, 0.13, ["#8a94a3", "#2a3346"], [["🎟️", 1500, 9100], ["🛡️", 2500, 600], ["⚔️", 5000, 250], ["🐉", 15000, 48], ["🏰", 75000, 2]]),
  t("magic", "🔮", "Mystic Magic", "high", 2000, 0.13, ["#9d4edd", "#240b4a"], [["🎟️", 2000, 9100], ["📜", 3000, 600], ["🧪", 6000, 250], ["🧙", 20000, 48], ["🔮", 100000, 2]]),
  t("nitro", "💎", "Black Diamond", "high", 2500, 0.12, ["#ff73fa", "#14082a"], [["🎟️", 2500, 9200], ["💳", 4000, 550], ["🥂", 7500, 200], ["💎", 25000, 48], ["🌌", 150000, 2]], true),
  t("moon", "🚀", "To the Moon", "high", 5000, 0.12, ["#4dc3ff", "#05082a"], [["🎟️", 5000, 9300], ["🛰️", 7500, 500], ["👽", 15000, 150], ["🛸", 50000, 48], ["🚀", 250000, 2]]),
  t("dragon", "🐉", "Dragon's Hoard", "high", 7500, 0.12, ["#ff6a00", "#3a0a04"], [["🎟️", 7500, 9300], ["🦴", 12000, 500], ["🔥", 25000, 150], ["👁️", 75000, 48], ["🐉", 400000, 2]]),
  t("olympus", "🏛️", "Mount Olympus", "high", 10000, 0.11, ["#fff3c4", "#8a7a52"], [["🎟️", 10000, 9400], ["🍷", 15000, 450], ["🦅", 30000, 100], ["⚡", 100000, 48], ["🏛️", 500000, 2]]),
  t("heist", "🏦", "Bank Heist", "high", 15000, 0.11, ["#3ddc84", "#0a1a14"], [["🎟️", 15000, 9400], ["🔦", 25000, 450], ["🗝️", 50000, 100], ["💰", 150000, 48], ["🏦", 750000, 2]]),
  t("royal", "👑", "Royal Fortune", "vip", 25000, 0.1, ["#ffd56a", "#4a0a2a"], [["🎟️", 25000, 9500], ["💍", 40000, 350], ["🏰", 75000, 100], ["👑", 250000, 49], ["⚜️", 1250000, 1]]),
  t("pirate", "🏴‍☠️", "Pirate's Booty", "vip", 50000, 0.1, ["#c9a04a", "#1a1008"], [["🎟️", 50000, 9600], ["⚔️", 75000, 250], ["🗺️", 150000, 100], ["⚓", 500000, 49], ["🏴‍☠️", 2500000, 1]]),
  t("cosmic", "🌌", "Cosmic Jackpot", "vip", 75000, 0.09, ["#b46cff", "#020414"], [["🎟️", 75000, 9700], ["🌠", 120000, 175], ["🪐", 250000, 75], ["☄️", 750000, 49], ["🌌", 4000000, 1]]),
  t("whale", "🐋", "Whale's Wealth", "vip", 100000, 0.08, ["#2bb8ff", "#021a3a"], [["🎟️", 100000, 9800], ["🦐", 150000, 100], ["🐙", 300000, 50], ["🔱", 1000000, 49], ["🐋", 10000000, 1]]),
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

async function isNitro(discordId: string) {
  const roles = await getMemberRoleIds(discordId).catch(() => null);
  return Boolean(roles?.includes(NITRO_ROLE_ID));
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
  if (ticket.nitro && !nitro) throw new GameError(`${ticket.name} is a premium ticket: Black Diamond and up are for Nitro boosters.`, 403);

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
