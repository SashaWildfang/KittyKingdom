// Short numbers for amounts: 22400 → "22.4k", 1250000 → "1.3M", 950 → "950".
// Same as compact() in the Main Bot's events/giveaways.py.

const UNITS: [number, string][] = [
  [1_000_000_000, "B"],
  [1_000_000, "M"],
  [1_000, "k"],
];

export function compact(value: number) {
  const n = Math.abs(Math.round(value || 0));
  const sign = value < 0 ? "-" : "";
  for (let i = 0; i < UNITS.length; i++) {
    let [size, unit] = UNITS[i];
    if (n < size) continue;
    let r = Math.round((n * 10) / size) / 10;
    // 999,999 rounds to "1000k": say "1M" instead
    if (r >= 1000 && i > 0) {
      [size, unit] = UNITS[i - 1];
      r = Math.round((n * 10) / size) / 10;
    }
    return `${sign}${String(r)}${unit}`;
  }
  return `${sign}${n.toLocaleString("en-US")}`;
}
