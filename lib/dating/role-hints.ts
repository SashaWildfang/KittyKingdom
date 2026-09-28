// Suggested answers from a member's self-assigned Discord roles (role names come from the bot's role
// selectors in lib/role-catalog.ts). Setup uses these to fill in blanks; members can change anything.

import { memberRoleIdsCached } from "../discord-member";
import { ROLE_CATEGORIES } from "../role-catalog";

const ONE: Record<string, [string, string]> = {
  // Gender
  male: ["gender", "Male"],
  female: ["gender", "Female"],
  nonbinary: ["gender", "Nonbinary"],
  "trans (mtf)": ["gender", "Trans (MtF)"],
  "trans (ftm)": ["gender", "Trans (FtM)"],
  intersex: ["gender", "Intersex"],
  "other gender": ["gender", "Other"],
  // Sexuality
  gay: ["sexuality", "Gay / Lesbian"],
  lesbian: ["sexuality", "Gay / Lesbian"],
  bisexual: ["sexuality", "Bisexual"],
  pansexual: ["sexuality", "Pansexual"],
  asexual: ["sexuality", "Asexual / Aro spectrum"],
  aromantic: ["sexuality", "Asexual / Aro spectrum"],
  straight: ["sexuality", "Straight"],
  questioning: ["sexuality", "Questioning"],
  demisexual: ["sexuality", "Demisexual"],
  // Location (broad regions) and timezone
  "united states": ["location", "United States"],
  canada: ["location", "Canada"],
  europe: ["location", "Europe"],
  asia: ["location", "Asia"],
  oceania: ["location", "Oceania"],
  "south america": ["location", "South America"],
  africa: ["location", "Africa"],
  est: ["timezone", "EST (UTC-5)"],
  cst: ["timezone", "CST (UTC-6)"],
  mst: ["timezone", "MST (UTC-7)"],
  pst: ["timezone", "PST (UTC-8)"],
  akst: ["timezone", "AKST (UTC-9)"],
  gmt: ["timezone", "GMT (UTC+0)"],
  cet: ["timezone", "CET (UTC+1)"],
  aest: ["timezone", "AEST (UTC+10)"],
  // Position
  top: ["sexual_position", "Top"],
  bottom: ["sexual_position", "Bottom"],
  switch: ["sexual_position", "Switch / Vers"],
  "vers top": ["sexual_position", "Vers Top"],
  "vers bottom": ["sexual_position", "Vers Bottom"],
  // Looking
  looking: ["is_looking", "Yes"],
  partner: ["is_looking", "Yes"],
  "not looking": ["is_looking", "No"],
  "stoner furry": ["uses_weed", "Yes"],
};

// Roles that add to a list field
const MANY: Record<string, [string, string][]> = {
  "he/him": [["pronouns", "He/Him"]],
  "she/her": [["pronouns", "She/Her"]],
  "they/them": [["pronouns", "They/Them"]],
  "any pronouns": [["pronouns", "Any pronouns"]],
  "ask pronouns": [["pronouns", "Ask me"]],
  taken: [["relationship_status", "Taken"]],
  polyamorous: [["relationship_status", "Polyamorous"], ["looking_for_relationship_type", "Polyamorous"]],
  "open relationship": [["relationship_status", "Open relationship"], ["looking_for_relationship_type", "Open"]],
  monogamous: [["looking_for_relationship_type", "Monogamous"]],
  "closed relationship": [["looking_for_relationship_type", "Monogamous"]],
  "poly connections": [["looking_for_relationship_type", "Polyamorous"]],
  "mono connections": [["looking_for_relationship_type", "Monogamous"]],
  friends: [["looking_for_relationship_type", "Friends first"]],
};

const HOBBIES: Record<string, string> = {
  writer: "writing",
  musician: "music",
  "pet owner": "pets",
  fursuiter: "fursuiting",
  "fitness furry": "fitness",
  "pc gamer": "pc gaming",
  "console gamer": "console gaming",
  "mobile gamer": "mobile games",
};

const NAMES = new Map(ROLE_CATEGORIES.flatMap((c) => c.roles.map((r) => [r.id, r.name.toLowerCase().trim()] as const)));

/** { field: suggested value } from their roles (lists for multi fields). */
export async function roleHints(discordId: string): Promise<Record<string, unknown>> {
  const roles = await memberRoleIdsCached(discordId).catch(() => null);
  if (!roles) return {};
  const names = roles.map((id) => NAMES.get(id)).filter((n): n is string => Boolean(n));
  const out: Record<string, unknown> = {};
  const lists: Record<string, Set<string>> = {};
  const hobbies: string[] = [];
  for (const n of names) {
    const one = ONE[n];
    if (one && out[one[0]] === undefined) out[one[0]] = one[1];
    for (const [field, value] of MANY[n] ?? []) (lists[field] ??= new Set()).add(value);
    if (HOBBIES[n]) hobbies.push(HOBBIES[n]);
  }
  for (const [field, set] of Object.entries(lists)) out[field] = Array.from(set);
  if (hobbies.length) out.hobbies_interests = hobbies.join(", ");
  // Not taken and looking: single
  if (!lists.relationship_status?.has("Taken") && out.is_looking === "Yes") out.relationship_status = [...Array.from(lists.relationship_status ?? []), "Single"];
  return out;
}
