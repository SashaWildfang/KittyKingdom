import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../../lib/admin";
import { requireTwoFactorForAction } from "../../../../../../../lib/admin-2fa";
import { PanelError, POWER_SIGNALS, sendPower, serverByKey, type PowerSignal } from "../../../../../../../lib/bot-console";
import { getMongoClient } from "../../../../../../../lib/mongodb";

export const dynamic = "force-dynamic";

const DONE: Record<PowerSignal, string> = { start: "Starting", stop: "Stopping", restart: "Restarting", kill: "Force-stopped" };

/** Admins with two-factor on: start, stop, restart or force-stop a bot. Every attempt is logged. */
export async function POST(request: Request, { params }: { params: { server: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  if (await requireTwoFactorForAction())
    return NextResponse.json({ ok: false, error: "Turn on two-factor authentication first (My Account → Security). It's required to start, stop or restart the bots.", code: "needs-2fa" }, { status: 403 });
  const server = serverByKey(params.server);
  if (!server) return NextResponse.json({ ok: false, error: "Unknown bot." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { signal?: unknown } | null;
  const signal = String(body?.signal ?? "") as PowerSignal;
  if (!POWER_SIGNALS.includes(signal)) return NextResponse.json({ ok: false, error: "Pick start, stop, restart or force stop." }, { status: 400 });

  let error: string | null = null;
  let status = 200;
  try {
    await sendPower(server, signal);
  } catch (e) {
    error = e instanceof Error ? e.message : "SparkedHost didn't accept that.";
    status = e instanceof PanelError ? e.status : 502;
  }
  const client = await getMongoClient();
  await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: "bot-power", server: server.key, signal, ok: !error, error, adminDiscordId: panel.discordId, adminName: panel.name })
    .catch(() => undefined);
  if (error) return NextResponse.json({ ok: false, error }, { status });
  return NextResponse.json({ ok: true, message: `${DONE[signal]} the ${server.name}${signal === "kill" ? "." : "…"}` });
}
