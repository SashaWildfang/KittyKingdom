import { requireTwoFactorForAction } from "../../../../../../lib/admin-2fa";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin";
import { getCurrentSessionId } from "../../../../../../lib/auth";
import { getMongoClient } from "../../../../../../lib/mongodb";
import { ONLINE_WINDOW_MS, revokeSession, sessionsCollection } from "../../../../../../lib/sessions";

export const dynamic = "force-dynamic";

/** Every device this account has signed in from recently. */
export async function GET(request: Request, { params }: { params: { accountId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  if (!ObjectId.isValid(params.accountId)) return NextResponse.json({ ok: false, error: "Unknown account." }, { status: 404 });
  const [sessions, current] = await Promise.all([sessionsCollection(), getCurrentSessionId()]);
  const list = await sessions
    .find({ userId: new ObjectId(params.accountId), $or: [{ revokedAt: { $exists: false } }, { revokedAt: { $gte: new Date(Date.now() - 30 * 86_400_000) } }] })
    .sort({ lastSeenAt: -1 })
    .limit(40)
    .toArray();
  const now = Date.now();
  return NextResponse.json(
    {
      ok: true,
      sessions: list.map((s) => ({
        id: s._id,
        device: s.device,
        ip: s.ip,
        location: s.location,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        online: !s.revokedAt && now - s.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
        active: !s.revokedAt && now - s.lastSeenAt.getTime() < 8 * 3_600_000,
        revokedAt: s.revokedAt?.toISOString() ?? null,
        revokedBy: s.revokedBy ?? null,
        current: s._id === current,
        userAgent: s.userAgent,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** { sessionId } — disconnects one device. */
export async function POST(request: Request, { params }: { params: { accountId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const twoFactor = await requireTwoFactorForAction();
  if (twoFactor) return twoFactor;
  const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
  if (!ObjectId.isValid(params.accountId) || typeof body.sessionId !== "string") {
    return NextResponse.json({ ok: false, error: "Pick a device." }, { status: 400 });
  }
  const sessions = await sessionsCollection();
  const record = await sessions.findOne({ _id: body.sessionId, userId: new ObjectId(params.accountId) });
  if (!record) return NextResponse.json({ ok: false, error: "That device isn't on this account." }, { status: 404 });
  await revokeSession(record._id, `admin:${admin.discordId}`);

  const client = await getMongoClient();
  await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: "disconnect-device", targetUserId: params.accountId, device: `${record.device.browser} on ${record.device.os}`, adminDiscordId: admin.discordId, adminName: admin.name });
  return NextResponse.json({ ok: true, message: `Disconnected ${record.device.browser} on ${record.device.os}.` });
}
