// Shared bits for the admin news API routes.
import { NextResponse } from "next/server";
import { getMongoClient } from "./mongodb";
import { NewsError } from "./news";

/** Records an admin news change in the audit log. */
export async function audit(action: string, details: Record<string, unknown>, admin: { discordId: string; name: string }) {
  const client = await getMongoClient();
  await client.db(process.env.MONGODB_DB ?? "website").collection("admin_audit").insertOne({ at: new Date(), action, ...details, adminDiscordId: admin.discordId, adminName: admin.name });
}

export function tagError(error: unknown) {
  if (error instanceof NewsError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("News tag request failed", error);
  return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
}
