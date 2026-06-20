import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

export function auditModel(): string {
  return process.env.KALI_AUDIT_MODEL || "claude-opus-4-8";
}

export function chatModel(): string {
  return process.env.KALI_CHAT_MODEL || "claude-opus-4-8";
}

/**
 * Run a single-shot completion and return the concatenated text. Returns null
 * when no API key is configured so callers can fall back to a heuristic.
 */
export async function complete(opts: {
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string | null> {
  const anthropic = getAnthropic();
  if (!anthropic) return null;

  const res = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  return res.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

/** Pull the first JSON array out of a model response, tolerating prose around it. */
export function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Pull the first JSON object out of a model response, tolerating prose around it. */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
