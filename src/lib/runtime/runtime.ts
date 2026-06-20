import type { Intent, KaliEmployee } from "@/lib/types";
import { publishAuditEvent } from "@/lib/redis";
import { retrieveMemories } from "@/lib/brain";
import { classifyIntent, extractUrl } from "./intent";
import { checkPermission } from "./permissions";

export type RuntimeInput = {
  orgId: string;
  employee: KaliEmployee;
  runId: string;
  text: string;
  pinnedUrl?: string;
  hasActiveAudit?: boolean;
};

export type RuntimeResult = {
  intent: Intent;
  requiresApproval: boolean;
  context: Awaited<ReturnType<typeof retrieveMemories>>;
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

  await publishEmployee(employee.id, "employee.input_received", { runId });

  const intent = classifyIntent(text, {
    hasActiveAudit: input.hasActiveAudit,
    pinnedUrl: input.pinnedUrl,
  });
  await publishEmployee(employee.id, "employee.intent_classified", { intent });

  const context = await retrieveMemories({ orgId, query: text, limit: 6 });
  await publishEmployee(employee.id, "employee.context_retrieved", {
    count: context.length,
  });

  const permission = checkPermission(employee, intent);
  await publishEmployee(employee.id, "employee.permission_checked", {
    allowed: permission.allowed,
    requiresApproval: permission.requiresApproval,
  });

  const detectedUrl = extractUrl(text) ?? input.pinnedUrl ?? null;

  // TODO: synthesize the final response with KALI_CHAT_MODEL, grounded in
  // `context`. For now return a deterministic, source-aware acknowledgement.
  const message = draftMessage(intent, context.length, detectedUrl);

  await publishEmployee(employee.id, "employee.response_completed", { intent });

  return {
    intent,
    requiresApproval: permission.requiresApproval,
    context,
    detectedUrl,
    message,
  };
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

async function publishEmployee(
  employeeId: string,
  type: string,
  payload: Record<string, unknown>
) {
  // Employee events share the audit publisher contract but on the employee
  // stream. Reuse the audit publisher keyed by employee for the scaffold.
  await publishAuditEvent(`employee:${employeeId}`, type, payload);
}

export * from "./intent";
export * from "./permissions";
export * from "./quality";
export * from "./prompts";
