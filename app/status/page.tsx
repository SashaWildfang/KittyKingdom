import type { Metadata } from "next";
import { getStatus, type StatusView } from "../../lib/status";
import { StatusBoard } from "./status-board";
import "./status.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status | Bear Nation",
  description: "Live status of the Bear Nation website, database and Discord bots, with 90 days of uptime and incident history.",
  alternates: { canonical: "https://status.bear-nation.net" },
};

/** status.bear-nation.net (also /status on the main site). */
export default async function StatusPage() {
  let initial: StatusView | null = null;
  try {
    initial = await getStatus();
  } catch (error) {
    console.error("Status page failed", error);
  }
  return (
    <main className="sp-shell">
      <StatusBoard initial={initial} />
    </main>
  );
}
