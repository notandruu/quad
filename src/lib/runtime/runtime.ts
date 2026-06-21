import type { Intent, QuadEmployee } from "@/lib/types";
import type { QuadChainPacketSummary } from "@/lib/quad-chain";
import { complete, chatModel } from "@/lib/llm/anthropic";
import { buildQuadCoreContext, type QuadCoreContext, type QuadCoreSurface } from "@/lib/core";

export type RuntimeInput = {
  orgId: string;
  employee: QuadEmployee;
  runId: string;
  text: string;
  pinnedUrl?: string;
  hasActiveAudit?: boolean;
  surface?: QuadCoreSurface;
  coreContext?: QuadCoreContext;
};

export type RuntimeResult = {
  intent: Intent;
  requiresApproval: boolean;
  context: QuadCoreContext["memories"];
  verifiedContext: QuadChainPacketSummary[];
  detectedUrl: string | null;
  message: string;
};

/**
 * The employee runtime loop, condensed:
 *   normalize -> classify intent -> retrieve context -> permission check ->
 *   (tool execution happens in the route/worker) -> synthesize -> approval.
 *
 * This function handles the deterministic front half and emits employee
 * events; tool execution (audit, drafting) is dispatched by the API route so
 * it can stream. Response synthesis (the model call) is a TODO.
 */
export async function runEmployee(input: RuntimeInput): Promise<RuntimeResult> {
  const { orgId, employee, runId, text } = input;

  const core = input.coreContext ?? await buildQuadCoreContext({
    orgId,
    employee,
    runId,
    text,
    surface: input.surface ?? "chat",
    pinnedUrl: input.pinnedUrl,
    hasActiveAudit: input.hasActiveAudit,
  });

  // Synthesize the final response with the chat model, grounded in retrieved
  // memories. Falls back to a deterministic acknowledgement with no API key.
  const message =
    (await synthesizeReply({ orgId, runId, employee, text, context: core.memories })) ??
    draftMessage(core.intent, core.memories.length, core.detectedUrl);

  return {
    intent: core.intent,
    requiresApproval: core.permission.requiresApproval,
    context: core.memories,
    verifiedContext: core.verifiedContext,
    detectedUrl: core.detectedUrl,
    message,
  };
}

/**
 * Answer the user grounded in retrieved company memories, in the employee's
 * tone. Returns null when no model is configured so the caller can fall back.
 */
async function synthesizeReply(input: {
  orgId: string;
  runId: string;
  employee: QuadEmployee;
  text: string;
  context: RuntimeResult["context"];
}): Promise<string | null> {
  const memos = input.context
    .map((m) => `- [${m.sourceType}] ${m.title}: ${m.summary ?? m.content}`)
    .join("\n");

  return complete({
    orgId: input.orgId,
    runId: input.runId,
    model: chatModel(),
    system: `You are ${input.employee.name}, an AI ${input.employee.role.replace("_", " ")}. Tone: ${input.employee.tone}. Answer only from the company memory provided. Cite the source titles you used. If the memory does not cover it, say so plainly.`,
    prompt: `COMPANY MEMORY:\n${memos || "(none retrieved)"}\n\nUSER:\n${input.text}`,
    maxTokens: 800,
    purpose: "chat",
  });
}

function draftMessage(intent: Intent, contextCount: number, url: string | null): string {
  switch (intent) {
    case "website_audit":
      return url
        ? `Starting an audit of ${url}. I will compare it against ${contextCount} internal memories and stream progress live.`
        : "Share a URL and I will start the audit.";
    case "company_question":
      return `Answering from ${contextCount} company memories.`;
    case "audit_follow_up":
      return "Working from the completed audit. I can prioritize fixes, draft FAQs, or create tasks.";
    default:
      return `Got it. Retrieved ${contextCount} relevant memories.`;
  }
}

export * from "./intent";
export * from "./permissions";
export * from "./quality";
export * from "./prompts";
