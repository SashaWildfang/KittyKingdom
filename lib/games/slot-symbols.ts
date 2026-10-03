// The slot machine's symbols (same emoji, payouts and weights as the bot's /slots). Safe to use on the client.

export type SlotSymbol = { id: string; name: string; emoji: string; payout: number | "jackpot"; weight: number };

const sym = (id: string, name: string, emojiId: string, payout: number | "jackpot", weight: number): SlotSymbol => ({ id, name, emoji: `<:${id}:${emojiId}>`, payout, weight });

/** Least to most rare, with the bot's emoji, payouts (× bet) and weights. */
// 12% of spins are three of a kind (which paw is picked by these weights), 26% a pair (bet back), 62% lose.
// That pays back about 95% of what's bet (a normal 5% house edge for slots), plus the progressive jackpot,
// which three gold mice win about once in a million spins.
export const TRIPLE_CHANCE = 0.12;
export const PAIR_CHANCE = 0.26;
export const SLOT_SYMBOLS: SlotSymbol[] = [
  sym("paw_brown", "Brown paw", "1506386117379883008", 2.5, 45),
  sym("paw_black", "Black paw", "1506386099482792037", 4, 25),
  sym("paw_white", "White paw", "1506386132730908814", 6, 15),
  sym("paw_yellow", "Yellow paw", "1506386002976051382", 10, 8),
  sym("paw_orange", "Orange paw", "1506385978527322252", 15, 4),
  sym("paw_red", "Red paw", "1506385961653637181", 25, 1.5),
  sym("paw_green", "Green paw", "1506385943043641415", 40, 0.8),
  sym("paw_blue", "Blue paw", "1506386051634036868", 75, 0.4),
  sym("paw_purple", "Purple paw", "1506386067002097805", 100, 0.2),
  sym("paw_pink", "Pink paw", "1506386080637911142", 150, 0.0975),
  sym("gold_mouse", "Gold mouse", "1506387138118287420", "jackpot", 0.0025 / 3),
];
/** The emoji image from Discord's CDN. */
export const emojiUrl = (s: SlotSymbol) => `https://cdn.discordapp.com/emojis/${s.emoji.split(":")[2].slice(0, -1)}.webp?size=96&quality=lossless`;
