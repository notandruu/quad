import Anthropic from "@anthropic-ai/sdk";
import { runTextModelCall } from "@/lib/llm/gateway";
import type { ModelPurpose } from "@/lib/security";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

export function auditModel(): string {
  return process.env.QUAD_AUDIT_MODEL || "claude-opus-4-8";
}

export function chatModel(): string {
  return process.env.QUAD_CHAT_MODEL || "claude-opus-4-8";
}

/**
 * Run a single-shot completion and return the concatenated text. Returns null
 * when no API key is configured so callers can fall back to a heuristic.
 */
export async function complete(opts: {
  orgId?: string;
  runId?: string;
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
  purpose?: Extract<ModelPurpose, "chat" | "audit" | "evaluation" | "trust_packet">;
  maxAttempts?: number;
}): Promise<string | null> {
  const anthropic = getAnthropic();
  const purpose = opts.purpose ?? "chat";
  const result = await runTextModelCall({
    orgId: opts.orgId,
    runId: opts.runId,
    provider: "anthropic",
    model: opts.model,
    system: opts.system,
    prompt: opts.prompt,
    maxTokens: opts.maxTokens ?? 2048,
    purpose,
    maxAttempts: opts.maxAttempts,
    execute: anthropic
      ? async (payload) => {
          const res = await anthropic.messages.create({
            model: payload.model,
            max_tokens: payload.maxTokens,
            system: payload.system,
            messages: [{ role: "user", content: payload.prompt }],
          });
          return {
            text: res.content
              .map((block) => (block.type === "text" ? block.text : ""))
              .join("")
              .trim(),
            usage: {
              inputTokens: res.usage.input_tokens,
              outputTokens: res.usage.output_tokens,
            },
          };
        }
      : null,
  });

  return result.text;
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
