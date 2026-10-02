// The slot machine's symbols (same emoji, payouts and weights as the bot's /slots). Safe to use on the client.

export type SlotSymbol = { id: string; name: string; emoji: string; payout: number | "jackpot"; weight: number };

const sym = (id: string, name: string, emojiId: string, payout: number | "jackpot", weight: number): SlotSymbol => ({ id, name, emoji: `<:${id}:${emojiId}>`, payout, weight });

/** Least to most rare, with the bot's emoji, payouts (× bet) and weights. */
export const SLOT_SYMBOLS: SlotSymbol[] = [
  sym("paw_brown", "Brown paw", "1506386117379883008", 1.5, 45),
  sym("paw_black", "Black paw", "1506386099482792037", 2, 25),
  sym("paw_white", "White paw", "1506386132730908814", 3, 15),
  sym("paw_yellow", "Yellow paw", "1506386002976051382", 5, 8),
  sym("paw_orange", "Orange paw", "1506385978527322252", 8, 4),
  sym("paw_red", "Red paw", "1506385961653637181", 12, 1.5),
  sym("paw_green", "Green paw", "1506385943043641415", 20, 0.8),
  sym("paw_blue", "Blue paw", "1506386051634036868", 35, 0.4),
  sym("paw_purple", "Purple paw", "1506386067002097805", 50, 0.2),
  sym("paw_pink", "Pink paw", "1506386080637911142", 75, 0.0975),
  sym("gold_mouse", "Gold mouse", "1506387138118287420", "jackpot", 0.0025),
];
/** The emoji image from Discord's CDN. */
export const emojiUrl = (s: SlotSymbol) => `https://cdn.discordapp.com/emojis/${s.emoji.split(":")[2].slice(0, -1)}.webp?size=96&quality=lossless`;
