// Email notification choices (Settings → Email). Shared by the server and the settings page.
// Every one starts off: members only get these emails after turning them on. Security and
// account emails (password resets, two-factor changes, appeal replies) always send.

export type EmailPrefKey = "news" | "events" | "eventReminders" | "giveaways" | "socialMatches" | "socialMessages" | "socialFriends";
export type EmailPrefs = Record<EmailPrefKey, boolean>;

export const EMAIL_PREF_GROUPS: { title: string; social?: boolean; items: { key: EmailPrefKey; label: string; hint: string }[] }[] = [
  {
    title: "Community",
    items: [
      { key: "news", label: "News posts", hint: "When staff post an update, patch notes or an announcement." },
      { key: "events", label: "New events", hint: "When a new event is added to the calendar." },
      { key: "eventReminders", label: "Event reminders", hint: "About an hour before an event you asked to be reminded about." },
      { key: "giveaways", label: "New giveaways", hint: "When a giveaway starts, so you don't miss entering." },
    ],
  },
  {
    title: "Social",
    social: true,
    items: [
      { key: "socialMatches", label: "New matches", hint: "When you and someone like each other." },
      { key: "socialMessages", label: "New messages", hint: "When a message is still unread after 15 minutes. At most one every 6 hours, and never the message itself." },
      { key: "socialFriends", label: "Friend requests", hint: "When someone sends you a friend request." },
    ],
  },
];

export const EMAIL_PREF_KEYS = EMAIL_PREF_GROUPS.flatMap((g) => g.items.map((i) => i.key));
export const EMAIL_PREF_LABELS = Object.fromEntries(EMAIL_PREF_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label]))) as Record<EmailPrefKey, string>;

export const isEmailPrefKey = (v: unknown): v is EmailPrefKey => typeof v === "string" && (EMAIL_PREF_KEYS as string[]).includes(v);

/** Missing answers count as off. */
export function readEmailPrefs(raw: unknown): EmailPrefs {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(EMAIL_PREF_KEYS.map((k) => [k, src[k] === true])) as EmailPrefs;
}
