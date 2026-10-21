// Claude (Anthropic API) for the few places the website uses AI, like ticket summaries.
// Needs ANTHROPIC_API_KEY in the environment (Vercel → Settings → Environment Variables); without it
// those features say they're off. ANTHROPIC_MODEL picks the model (default below); ANTHROPIC_BASE_URL can point
// at a proxy or a local stand-in for testing.

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
/** For jobs that need more reading between the lines (e.g. manual tickets). ANTHROPIC_MODEL_DETAILED overrides it. */
export const AI_MODEL_DETAILED = process.env.ANTHROPIC_MODEL_DETAILED || "claude-sonnet-5-5";

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

export type AiImage = { mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp"; data: string };
export type AiPart = { type: "text"; text: string } | { type: "image"; image: AiImage };

export class AiError extends Error {}

/** One request to Claude. Returns the text of the reply. */
export async function askClaude({ system, parts, maxTokens = 600, timeoutMs = 50_000, model = AI_MODEL }: { system: string; parts: AiPart[]; maxTokens?: number; timeoutMs?: number; model?: string }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError("AI isn't set up (ANTHROPIC_API_KEY is missing).");
  const content = parts.map((p) => (p.type === "text" ? { type: "text", text: p.text } : { type: "image", source: { type: "base64", media_type: p.image.mediaType, data: p.image.data } }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content }] }),
      signal: controller.signal,
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[]; error?: { message?: string } } | null;
    if (!res.ok) throw new AiError(body?.error?.message ? `AI error: ${body.error.message}` : `AI error (${res.status}).`);
    return (body?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError(controller.signal.aborted ? "The AI took too long to answer." : "Couldn't reach the AI.");
  } finally {
    clearTimeout(timer);
  }
}
