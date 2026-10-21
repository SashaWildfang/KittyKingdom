// Discord DMs for Social notifications (Settings → Notifications → Discord DMs; on by default for everything
// but profile views). Members with a Social profile but no website account also get the steps to make one,
// since they can't reply without it. Each one is a small embed about the other member in their profile color,
// with a button back to the website. Dating photos are only served to signed-in 18+ members, so the
// embed uses their Discord avatar instead.

import { sendDirectMessage } from "../discord-member";
import { getUsersCollection } from "../mongodb";
import type { NotificationType } from "../notifications";
import { MINUTE, allow } from "../rate-limit";
import { datingPool } from "./pool";
import { accentFor, display } from "./schema";
import { bigAvatar } from "./text";
import type { DatingSettings } from "./settings";

const SITE = process.env.SITE_URL ?? "https://bear-nation.net";

/** How to get on the website, for members who only have a Social profile from the old Discord bot. */
export const SIGNUP_STEPS = [
  `1. Create an account at ${SITE}/register`,
  "2. Open the link in the email we send you to verify it",
  "3. In My Account, press **Link Discord**, then use the code with `/link` in the server",
].join("\n");

const STYLE: Partial<Record<NotificationType, { emoji: string; button: string }>> = {
  view: { emoji: "👀", button: "View their profile" },
  like: { emoji: "💖", button: "See your likes" },
  superlike: { emoji: "⭐", button: "See their profile" },
  match: { emoji: "💞", button: "Say hi" },
  message: { emoji: "💬", button: "Reply" },
  request: { emoji: "📨", button: "Open message request" },
  "friend-request": { emoji: "🤝", button: "See the request" },
  "friend-accepted": { emoji: "🫂", button: "View their profile" },
  partner: { emoji: "💞", button: "Open Social" },
};

const LINES: Partial<Record<NotificationType, (name: string) => string>> = {
  view: (n) => `**${n}** just peeked at your profile! Maybe take a look at theirs? ✨`,
  like: (n) => `**${n}** liked your profile! Like them back and it's a match. 💕`,
  superlike: (n) => `**${n}** **super liked** you! ⭐ They really want to get to know you.`,
  match: (n) => `You and **${n}** like each other! Now's the perfect time to say hi. 🥰`,
  message: (n) => `**${n}** sent you a message:`,
  request: (n) => `**${n}** wants to chat! Accept their request to reply.`,
  "friend-request": (n) => `**${n}** wants to be friends! 🐾`,
  "friend-accepted": (n) => `You and **${n}** are friends now! 🐾`,
  partner: (n) => `Something new with **${n}** and your partner link. 💞`,
};

/** Sends the DM if they asked for this kind. Never throws; gives up quietly if their DMs are closed. */
export async function sendDatingDm(to: string, settings: DatingSettings, n: { type: NotificationType; actor?: string | null; title: string; body?: string; link: string }) {
  if (n.type === "system" || !settings.dm[(n.type === "superlike" ? "like" : n.type) as keyof DatingSettings["dm"]]) return;
  // A burst of activity shouldn't flood anyone's DMs
  if (!(await allow([{ key: `dating-dm:${to}`, limit: 12, windowMs: 10 * MINUTE }]).catch(() => false))) return;
  const style = STYLE[n.type] ?? { emoji: "🔔", button: "Open Social" };
  const pool = await datingPool().catch(() => null);
  const doc = n.actor ? pool?.profiles.get(n.actor) : undefined;
  const who = n.actor ? pool?.who.get(n.actor) : undefined;
  const name = String(doc ? display(doc, "name")?.text ?? who?.name ?? "Someone" : who?.name ?? "Someone");
  const web = (doc?.web ?? {}) as { accent?: string; headline?: string; hideAge?: boolean };
  const color = parseInt(accentFor(n.actor ?? "0", web.accent).slice(1), 16);
  const fields = doc
    ? [
        !web.hideAge && typeof doc.age === "number" ? { name: "🎂 Age", value: String(doc.age), inline: true } : null,
        display(doc, "pronouns") ? { name: "💬 Pronouns", value: display(doc, "pronouns")!.text.slice(0, 60), inline: true } : null,
        display(doc, "location") ? { name: "📍 Location", value: display(doc, "location")!.text.slice(0, 60), inline: true } : null,
        doc.is_looking === "Yes" ? { name: "💘 Here for", value: "Dating & friends", inline: true } : { name: "🫂 Here for", value: "Friends", inline: true },
      ].filter(Boolean)
    : [];
  const line = (LINES[n.type] ?? (() => n.title))(name);
  // No website account yet: they need one to see this and reply
  const hasAccount = Boolean(await (await getUsersCollection()).findOne({ discordId: to }, { projection: { _id: 1 } }).catch(() => true));
  const description = n.type === "message" && n.body ? `${line}\n> ${n.body.replace(/\n/g, " ").slice(0, 180)}` : line;
  const url = `${SITE}${n.link}`;
  await Promise.race([
    sendDirectMessage(to, {
      embeds: [
        {
          author: { name: `${style.emoji}  ${n.title.replace(/^[^A-Za-z0-9]+/, "")}` },
          title: web.headline ? `“${String(web.headline).slice(0, 80)}”` : undefined,
          description,
          color,
          fields: hasAccount ? fields : [...fields, { name: "👋 You'll need a Bear Nation account to reply", value: SIGNUP_STEPS, inline: false }],
          thumbnail: who?.avatar ? { url: bigAvatar(who.avatar, 256)! } : undefined,
          footer: { text: "Bear Nation Social · change these DMs in Settings → Notifications" },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [{ type: 1, components: hasAccount ? [{ type: 2, style: 5, label: style.button, url }] : [{ type: 2, style: 5, label: "Create your account", url: `${SITE}/register` }, { type: 2, style: 5, label: style.button, url }] }],
    }).catch(() => false),
    new Promise((r) => setTimeout(r, 4000)),
  ]);
}
