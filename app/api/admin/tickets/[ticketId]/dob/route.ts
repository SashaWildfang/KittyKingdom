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
import { getTicket, isNsfwTicket } from "../../../../../../lib/tickets";

export const dynamic = "force-dynamic";

const LABEL = { app: "Join application DOB", id: "ID DOB" } as const;
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/**
 * Admins: record a missing date of birth on an 18+ verification ticket, either the one on the member's join
 * application or the one printed on their ID. Locked down:
 * - admins only, with 2FA turned on for their account
 * - the date typed twice, and a confirmation that it was checked
 * - only fills in a missing date: one that's already recorded can't be changed here
 * - saved to the admin action log and posted in the ticket log channel
 */
export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const no2fa = await requireTwoFactorForAction();
  if (no2fa) return no2fa;

  const body = (await request.json().catch(() => ({}))) as { kind?: string; dob?: string; repeat?: string; checked?: boolean; openedBy?: string };
  const kind = body.kind === "app" || body.kind === "id" ? body.kind : null;
  if (!kind) return fail("Pick which date of birth you're recording.");
  const ticket = await getTicket(Number(params.ticketId));
  if (!ticket || !isNsfwTicket(ticket.type) || !ticket.openedBy) return fail("That isn't an 18+ verification ticket.", 404);
  // Ticket numbers move after deletions: make sure this is still the member the page showed
  if (body.openedBy !== ticket.openedBy) return fail("Ticket numbers changed since this page loaded. Reload and try again.", 409);
  if (!body.checked) return fail("Confirm you checked the date first.");

  const dob = parseDateOfBirth(String(body.dob ?? ""));
  const repeat = parseDateOfBirth(String(body.repeat ?? ""));
  if (!dob || dob.getUTCFullYear() < 1900 || dob.getTime() > Date.now()) return fail("Type the date like 10/12/2001.");
  if (!repeat || repeat.toISOString().slice(0, 10) !== dob.toISOString().slice(0, 10)) return fail("The two dates don't match. Type it the same way twice.");

  // The real signed-in admin (not someone the owner is viewing the site as)
  const real = await getRealUser().catch(() => null);
  if (!real || String(real.discordId ?? "") !== admin.discordId) return fail("Sign in with your own admin account to do this.", 403);

  const iso = dob.toISOString().slice(0, 10);
  const mdy = `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
  const now = new Date();
  if (kind === "app") {
    const app = await getJoinApplication(ticket.openedBy);
    if (!app?._id) return fail("They don't have a join application to add it to.", 404);
    if (applicationBirthday(app).birthDate) return fail("Their join application already has a date of birth. It can't be changed here.", 409);
    // Only if nobody filled it in meanwhile (two admins saving at once: the second one gets the 409)
    const res = await (await getJoinApplicationsCollection()).updateOne(
      { _id: app._id, dobSetAt: { $exists: false } } as never,
      { $set: { dateOfBirth: mdy, dobSetBy: admin.discordId, dobSetByName: admin.name, dobSetAt: now, dobSetVia: "website", dobSetTicket: ticket.ticketId } },
    );
    if (!res.modifiedCount) return fail("Their join application already has a date of birth. It can't be changed here.", 409);
  } else {
    const users = await getBotCollection("users");
    const filter = { discordId: { $in: [Long.fromString(ticket.openedBy), ticket.openedBy] } } as never;
    const taken = () => fail("An ID date of birth is already recorded for them. It can't be changed here.", 409);
    const fields = { nsfwIdDob: iso, nsfwIdRecordedBy: admin.discordId, nsfwIdRecordedVia: "website", nsfwIdRecordedAt: now, nsfwIdRecordedTicket: ticket.ticketId };
    const existing = await users.findOne(filter, { projection: { _id: 1, nsfwIdDob: 1 } });
    if (existing?.nsfwIdDob) return taken();
    if (existing) {
      // Only if it's still empty (two admins saving at once: the second one gets the 409)
      const res = await users.updateOne({ _id: existing._id, nsfwIdDob: { $in: [null, ""] } } as never, { $set: fields });
      if (!res.modifiedCount) return taken();
    } else {
      // No bot record yet: create it, unless one appeared meanwhile
      const res = await users.updateOne(filter, { $setOnInsert: { discordId: Long.fromString(ticket.openedBy), ...fields } }, { upsert: true });
      if (!res.upsertedCount) return taken();
    }
  }

  const age = calculateAge(dob);
  const site = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
  await site
    .collection("admin_audit")
    .insertOne({ at: now, action: kind === "app" ? "ticket-app-dob" : "ticket-id-dob", ticketId: ticket.ticketId, memberId: ticket.openedBy, age, adminDiscordId: admin.discordId, adminName: admin.name })
    .catch(() => undefined);
  // The log says who recorded what and the age, not the date itself
  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: `🔒 ${LABEL[kind]} recorded from the website`,
        color: age < 18 ? 0xe5484d : 0xd56300,
        fields: [
          { name: "Ticket", value: `#${ticket.ticketId} · 18+ verification`, inline: true },
          { name: "Member", value: `<@${ticket.openedBy}>\n\`${ticket.openedBy}\``, inline: true },
          { name: "Age", value: age < 18 ? `**${age} (under 18)**` : String(age), inline: true },
          { name: "Recorded by", value: `<@${admin.discordId}>`, inline: true },
        ],
        timestamp: now.toISOString(),
      },
    ],
  }).catch(() => false);

  const summary = await summarizeTicket(ticket.ticketId, admin, true);
  return NextResponse.json({ ok: true, summary, age });
}
