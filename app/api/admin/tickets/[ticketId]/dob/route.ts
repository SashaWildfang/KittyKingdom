import { Long } from "mongodb";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin";
import { requireTwoFactorForAction } from "../../../../../../lib/admin-2fa";
import { getRealUser } from "../../../../../../lib/auth";
import { calculateAge, parseDateOfBirth } from "../../../../../../lib/dates";
import { postChannelMessage } from "../../../../../../lib/discord-member";
import { applicationBirthday, getJoinApplication } from "../../../../../../lib/join-application";
import { getBotCollection, getJoinApplicationsCollection, getMongoClient } from "../../../../../../lib/mongodb";
import { STAFF_LOG_CHANNEL_ID } from "../../../../../../lib/ticket-delete";
import { summarizeTicket } from "../../../../../../lib/ticket-summary";
import { findTicket, isNsfwTicket } from "../../../../../../lib/tickets";

export const dynamic = "force-dynamic";

const LABEL = { app: "Join application DOB", id: "ID DOB" } as const;
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const userFilter = (id: string) => ({ discordId: { $in: [Long.fromString(id), id] } }) as never;

async function load(request: Request, ticketId: string, key: string | null) {
  const ticket = await findTicket(Number(ticketId), key);
  if (!ticket || !isNsfwTicket(ticket.type) || !ticket.openedBy) return null;
  const [app, user] = await Promise.all([
    getJoinApplication(ticket.openedBy),
    getBotCollection("users").then((c) => c.findOne(userFilter(ticket.openedBy!), { projection: { _id: 1, nsfwIdDob: 1, nsfwVerifiedAt: 1, nsfwVerifiedBy: 1, verificationHistory: 1 } })),
  ]);
  const appDob = app ? applicationBirthday(app).birthDate : null;
  // Same rule as the ticket's description (lib/ticket-summary.ts): a ticket from before the member left and came
  // back shows the 18+ verification saved in their history, so that's the ID date this ticket is about
  const opened = ticket.created ? new Date(ticket.created).getTime() : 0;
  const history = (Array.isArray(user?.verificationHistory) ? user!.verificationHistory : []) as Record<string, unknown>[];
  const pastIndex = history.findIndex((h) => Boolean(h.nsfwVerifiedAt || h.nsfwVerifiedBy) && h.resetAt instanceof Date && h.resetAt.getTime() > opened);
  const historyIndex = !user?.nsfwVerifiedAt && !user?.nsfwVerifiedBy && pastIndex >= 0 ? pastIndex : null;
  const idRaw = historyIndex !== null ? history[historyIndex].nsfwIdDob : user?.nsfwIdDob;
  const idDob = idRaw ? parseDateOfBirth(String(idRaw)) : null;
  return { ticket, app, user, appDob, idDob, idRaw, historyIndex };
}

/** Admins: the dates of birth on file for an 18+ ticket (for the Record / edit DOB dialog). */
export async function GET(request: Request, { params }: { params: { ticketId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const data = await load(request, params.ticketId, new URL(request.url).searchParams.get("key"));
  if (!data) return fail("That isn't an 18+ verification ticket.", 404);
  return NextResponse.json({
    ok: true,
    hasApp: Boolean(data.app),
    app: isoDay(data.appDob),
    appAnswer: data.app ? String(data.app.ageAndDob ?? data.app.age_and_dob ?? "").slice(0, 120) || null : null,
    id: isoDay(data.idDob),
    // The ID date shown is from before they left the server (their saved verification)
    idFromHistory: data.historyIndex !== null,
  });
}

/**
 * Admins: record a date of birth on an 18+ verification ticket (the member's join application, or the one on
 * their ID), or correct one that was typed wrong. Locked down:
 * - admins only, with 2FA turned on for their account, and their own sign-in (not "view as")
 * - the date typed twice, and a confirmation that it was checked
 * - changing a recorded date needs a reason, and only goes through if nobody changed it since the dialog opened
 * - every change keeps the old value (dobEdits / nsfwIdDobEdits), goes in the admin action log and is posted in
 *   the ticket log channel (ages, not the dates themselves)
 */
export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const no2fa = await requireTwoFactorForAction();
  if (no2fa) return no2fa;

  const body = (await request.json().catch(() => ({}))) as { kind?: string; dob?: string; repeat?: string; checked?: boolean; openedBy?: string; key?: string; expect?: string | null; reason?: string };
  const kind = body.kind === "app" || body.kind === "id" ? body.kind : null;
  if (!kind) return fail("Pick which date of birth you're recording.");
  const data = await load(request, params.ticketId, body.key ?? null);
  if (!data) return fail("That isn't an 18+ verification ticket.", 404);
  const { ticket, app, user } = data;
  // Ticket numbers move after deletions: make sure this is still the member the page showed
  if (body.openedBy !== ticket.openedBy) return fail("Ticket numbers changed since this page loaded. Reload and try again.", 409);
  if (!body.checked) return fail("Confirm you checked the date first.");

  const dob = parseDateOfBirth(String(body.dob ?? ""));
  const repeat = parseDateOfBirth(String(body.repeat ?? ""));
  if (!dob || dob.getUTCFullYear() < 1900 || dob.getTime() > Date.now()) return fail("Type the date like 10/12/2001.");
  if (!repeat || isoDay(repeat) !== isoDay(dob)) return fail("The two dates don't match. Type it the same way twice.");

  // The real signed-in admin (not someone the owner is viewing the site as)
  const real = await getRealUser().catch(() => null);
  if (!real || String(real.discordId ?? "") !== admin.discordId) return fail("Sign in with your own admin account to do this.", 403);

  const current = kind === "app" ? data.appDob : data.idDob;
  const before = isoDay(current);
  // Someone else changed it after this dialog was opened
  if ((body.expect ?? null) !== before) return fail("Someone else changed this date since you opened the dialog. Close it and open it again.", 409);
  const iso = isoDay(dob)!;
  if (before === iso) return fail("That's already the date on file.");
  const editing = Boolean(before);
  const reason = String(body.reason ?? "").trim().slice(0, 300);
  if (editing && reason.length < 3) return fail("Say why you're changing it (for example: typo when it was recorded).");

  const mdy = `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
  const now = new Date();
  const changed = () => fail("Someone else changed this date at the same moment. Close the dialog and open it again.", 409);
  const edit = { from: before, to: iso, by: admin.discordId, byName: admin.name, at: now, reason: reason || null, ticketId: ticket.ticketId };

  if (kind === "app") {
    if (!app?._id) return fail("They don't have a join application to add it to.", 404);
    // Only if the form's date is still what this dialog saw (dateOfBirth wins over their free-text answer)
    const res = await (await getJoinApplicationsCollection()).updateOne(
      { _id: app._id, dateOfBirth: app.dateOfBirth === undefined ? { $exists: false } : app.dateOfBirth } as never,
      {
        $set: { dateOfBirth: mdy, dobSetBy: admin.discordId, dobSetByName: admin.name, dobSetAt: now, dobSetVia: "website", dobSetTicket: ticket.ticketId },
        $push: { dobEdits: { $each: [edit], $slice: -20 } },
      } as never,
    );
    if (!res.modifiedCount) return changed();
  } else if (data.historyIndex !== null && user) {
    // An older ticket: correct the ID date in the saved verification it shows, not their current record
    const at = `verificationHistory.${data.historyIndex}`;
    const res = await (await getBotCollection("users")).updateOne(
      { _id: user._id, [`${at}.nsfwIdDob`]: data.idRaw ?? { $in: [null, ""] } } as never,
      { $set: { [`${at}.nsfwIdDob`]: iso, [`${at}.nsfwIdUnder18`]: calculateAge(dob) < 18 }, $push: { nsfwIdDobEdits: { $each: [{ ...edit, history: data.historyIndex }], $slice: -20 } } } as never,
    );
    if (!res.modifiedCount) return changed();
  } else {
    const users = await getBotCollection("users");
    const fields = { nsfwIdDob: iso, nsfwIdUnder18: calculateAge(dob) < 18, nsfwIdRecordedBy: admin.discordId, nsfwIdRecordedVia: "website", nsfwIdRecordedAt: now, nsfwIdRecordedTicket: ticket.ticketId };
    if (user) {
      const res = await users.updateOne(
        { _id: user._id, nsfwIdDob: user.nsfwIdDob ?? { $in: [null, ""] } } as never,
        { $set: fields, $push: { nsfwIdDobEdits: { $each: [edit], $slice: -20 } } } as never,
      );
      if (!res.modifiedCount) return changed();
    } else {
      // No bot record yet: create it, unless one appeared meanwhile
      const res = await users.updateOne(userFilter(ticket.openedBy), { $setOnInsert: { discordId: Long.fromString(ticket.openedBy), ...fields, nsfwIdDobEdits: [edit] } }, { upsert: true });
      if (!res.upsertedCount) return changed();
    }
  }

  const age = calculateAge(dob);
  const oldAge = current ? calculateAge(current) : null;
  const site = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
  await site
    .collection("admin_audit")
    .insertOne({ at: now, action: `ticket-${kind}-dob${editing ? "-edit" : ""}`, ticketId: ticket.ticketId, memberId: ticket.openedBy, age, oldAge, reason: reason || null, adminDiscordId: admin.discordId, adminName: admin.name })
    .catch(() => undefined);
  // The log says who changed what and the ages, not the dates themselves
  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: editing ? `✏️ ${LABEL[kind]} corrected from the website` : `🔒 ${LABEL[kind]} recorded from the website`,
        color: age < 18 ? 0xe5484d : 0xd56300,
        fields: [
          { name: "Ticket", value: `#${ticket.ticketId} · 18+ verification`, inline: true },
          { name: "Member", value: `<@${ticket.openedBy}>\n\`${ticket.openedBy}\``, inline: true },
          { name: "Age", value: `${editing && oldAge !== null ? `${oldAge} → ` : ""}${age < 18 ? `**${age} (under 18)**` : age}`, inline: true },
          { name: editing ? "Changed by" : "Recorded by", value: `<@${admin.discordId}>`, inline: true },
          ...(editing ? [{ name: "Reason", value: reason.slice(0, 1000), inline: false }] : []),
        ],
        timestamp: now.toISOString(),
      },
    ],
  }).catch(() => false);

  const summary = await summarizeTicket(ticket.ticketId, admin, true, ticket.key);
  return NextResponse.json({ ok: true, summary, age });
}
