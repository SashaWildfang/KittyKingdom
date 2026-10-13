// Admin → Bots → Consoles: the bots' SparkedHost servers through the panel's client API (Pterodactyl), the same API
// the bots use for the Discord console channel and /restartsystem. Needs PTERO_API_KEY (a client key, "ptlc_…",
// from control.sparkedhost.us → Account → API Credentials) in the site's environment; PTERO_PANEL_URL is optional.
//
// Server-only.

import WebSocket from "ws";

export type BotServer = { key: string; name: string; id: string };
export type PowerSignal = "start" | "stop" | "restart" | "kill";
export type ServerState = "running" | "starting" | "stopping" | "offline" | "unknown";
export type ServerStatus = {
  key: string;
  name: string;
  id: string;
  state: ServerState;
  /** Percent of one core (Pterodactyl's "absolute" CPU) */
  cpu: number | null;
  cpuLimit: number | null;
  memory: number | null;
  memoryLimit: number | null;
  disk: number | null;
  diskLimit: number | null;
  uptimeMs: number | null;
  networkRx: number | null;
  networkTx: number | null;
  suspended: boolean;
  error: string | null;
};

// Server ids from Moderation/cmds/restart_bot.py (not secret: they're useless without the key)
export const BOT_SERVERS: BotServer[] = [
  { key: "main", name: "Main Bot", id: "2b11eee5" },
  { key: "moderation", name: "Moderation Bot", id: "92f5ea45" },
  { key: "economy", name: "Economy Bot", id: "068f9699" },
  { key: "ticketing", name: "Ticket Bot", id: "e7d5b99c" },
  { key: "dating", name: "Dating Bot", id: "d39e3b3e" },
];

export const POWER_SIGNALS: PowerSignal[] = ["start", "stop", "restart", "kill"];

const panelUrl = () => (process.env.PTERO_PANEL_URL || "https://control.sparkedhost.us").replace(/\/+$/, "");
const apiKey = () => process.env.PTERO_API_KEY?.trim() || null;
export const consoleConfigured = () => Boolean(apiKey());

export function serverByKey(key: string) {
  return BOT_SERVERS.find((s) => s.key === key) ?? null;
}

class PanelError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function panel(path: string, init?: RequestInit) {
  const key = apiKey();
  if (!key) throw new PanelError("The SparkedHost API key isn't set up yet (PTERO_API_KEY).", 503);
  const res = await fetch(`${panelUrl()}/api/client${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { errors?: { detail?: string }[] } | null;
    const detail = body?.errors?.[0]?.detail;
    const text =
      res.status === 401 || res.status === 403
        ? "SparkedHost refused the API key (check PTERO_API_KEY has access to this server)."
        : res.status === 409
          ? detail ?? "The server is busy (it may be installing, transferring or suspended)."
          : res.status === 429
            ? "SparkedHost is rate-limiting requests. Try again in a moment."
            : detail ?? `SparkedHost returned an error (${res.status}).`;
    throw new PanelError(text, res.status);
  }
  return res.status === 204 ? null : ((await res.json()) as Record<string, unknown>);
}

// Limits change rarely: keep them for 10 minutes per server
const limitsCache = new Map<string, { at: number; limits: { memory: number | null; disk: number | null; cpu: number | null }; suspended: boolean }>();
async function limitsFor(id: string) {
  const hit = limitsCache.get(id);
  if (hit && Date.now() - hit.at < 600_000) return hit;
  const data = (await panel(`/servers/${id}`)) as { attributes?: { limits?: Record<string, number>; is_suspended?: boolean } } | null;
  const l = data?.attributes?.limits ?? {};
  const mb = (v: number | undefined) => (typeof v === "number" && v > 0 ? v * 1048576 : null);
  const entry = { at: Date.now(), limits: { memory: mb(l.memory), disk: mb(l.disk), cpu: typeof l.cpu === "number" && l.cpu > 0 ? l.cpu : null }, suspended: Boolean(data?.attributes?.is_suspended) };
  limitsCache.set(id, entry);
  return entry;
}

const STATES = new Set(["running", "starting", "stopping", "offline"]);

export async function serverStatus(s: BotServer): Promise<ServerStatus> {
  const base: ServerStatus = { key: s.key, name: s.name, id: s.id, state: "unknown", cpu: null, cpuLimit: null, memory: null, memoryLimit: null, disk: null, diskLimit: null, uptimeMs: null, networkRx: null, networkTx: null, suspended: false, error: null };
  try {
    const [res, lim] = await Promise.all([panel(`/servers/${s.id}/resources`), limitsFor(s.id).catch(() => null)]);
    const a = (res as { attributes?: { current_state?: string; is_suspended?: boolean; resources?: Record<string, number> } } | null)?.attributes;
    const r = a?.resources ?? {};
    const state = String(a?.current_state ?? "");
    return {
      ...base,
      state: (STATES.has(state) ? state : "unknown") as ServerState,
      cpu: typeof r.cpu_absolute === "number" ? r.cpu_absolute : null,
      cpuLimit: lim?.limits.cpu ?? null,
      memory: typeof r.memory_bytes === "number" ? r.memory_bytes : null,
      memoryLimit: lim?.limits.memory ?? null,
      disk: typeof r.disk_bytes === "number" ? r.disk_bytes : null,
      diskLimit: lim?.limits.disk ?? null,
      uptimeMs: typeof r.uptime === "number" ? r.uptime : null,
      networkRx: typeof r.network_rx_bytes === "number" ? r.network_rx_bytes : null,
      networkTx: typeof r.network_tx_bytes === "number" ? r.network_tx_bytes : null,
      suspended: Boolean(a?.is_suspended ?? lim?.suspended),
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Couldn't reach SparkedHost." };
  }
}

export async function allStatuses() {
  return Promise.all(BOT_SERVERS.map(serverStatus));
}

export async function sendPower(s: BotServer, signal: PowerSignal) {
  await panel(`/servers/${s.id}/power`, { method: "POST", body: JSON.stringify({ signal }) });
}

/**
 * The console's recent output (Wings keeps the last ~150 lines). Opens the server's console websocket, asks for the
 * log history, collects it until the stream goes quiet, then closes. Lines keep their ANSI colors.
 */
export async function recentLogs(s: BotServer): Promise<string[]> {
  const creds = (await panel(`/servers/${s.id}/websocket`)) as { data?: { token?: string; socket?: string } } | null;
  const token = creds?.data?.token;
  const socket = creds?.data?.socket;
  if (!token || !socket) throw new PanelError("SparkedHost didn't return console access for this server.", 502);

  return new Promise<string[]>((resolve, reject) => {
    const lines: string[] = [];
    let settled = false;
    let quiet: ReturnType<typeof setTimeout> | undefined;
    // Wings checks the Origin against the panel's address
    const ws = new WebSocket(socket, { headers: { Origin: panelUrl() }, handshakeTimeout: 6_000 });
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(quiet);
      clearTimeout(hard);
      try {
        ws.close();
      } catch {
        // already closed
      }
      if (error && !lines.length) reject(error);
      else resolve(lines.slice(-400));
    };
    // Never hold the request open long: whatever arrived by then is the answer
    const hard = setTimeout(() => finish(), 6_000);
    ws.on("open", () => ws.send(JSON.stringify({ event: "auth", args: [token] })));
    ws.on("message", (raw) => {
      let msg: { event?: string; args?: unknown[] };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.event === "auth success") {
        ws.send(JSON.stringify({ event: "send logs", args: [null] }));
        // An offline server with no history sends nothing: don't wait the full time
        quiet = setTimeout(() => finish(), 1_500);
      } else if (msg.event === "console output" || msg.event === "install output" || msg.event === "daemon message") {
        for (const a of msg.args ?? []) if (typeof a === "string") lines.push(...a.split(/\r?\n/));
        clearTimeout(quiet);
        quiet = setTimeout(() => finish(), 500);
      } else if (msg.event === "jwt error" || msg.event === "token expired") {
        finish(new PanelError("SparkedHost rejected the console token.", 502));
      }
    });
    ws.on("error", (e) => finish(new PanelError(`Couldn't open the console: ${e.message}`, 502)));
    ws.on("close", () => finish());
  });
}

export { PanelError };
