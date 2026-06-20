import type { RecommendedAction } from "@/lib/types";
import { traced, SPAN } from "@/lib/observability/phoenix";
import { ingestMemory } from "@/lib/brain";

/**
 * Draft-only action tools. None of these send anything externally; they
 * produce drafts and proposed tasks that the user approves in the UI. This is
 * the approval-first contract from the plan.
 */

export async function createTask(input: {
  orgId: string;
  title: string;
  description: string;
}): Promise<RecommendedAction> {
  return traced(SPAN.createTask, { "org.id": input.orgId }, async () => ({
    id: crypto.randomUUID(),
    type: "create_task",
    title: input.title,
    description: input.description,
    input,
    requiresApproval: true,
  }));
}

export function draftFaq(input: {
  question: string;
  answer: string;
  tone?: string;
}): RecommendedAction {
  return {
    id: crypto.randomUUID(),
    type: "draft_faq",
    title: `FAQ: ${input.question}`,
    description: input.answer,
    input,
    requiresApproval: true,
  };
}

export function draftSlack(input: { message: string }): RecommendedAction {
  return {
    id: crypto.randomUUID(),
    type: "draft_slack",
    title: "Slack update (draft)",
    description: input.message,
    input,
    requiresApproval: true,
  };
}

/**
 * Save an approved recommendation back into the company brain. Only call this
 * after the user approves, closing the loop from audit to durable memory.
 */
export async function saveToBrain(input: {
  orgId: string;
  title: string;
  content: string;
}) {
  return ingestMemory({
    orgId: input.orgId,
    sourceId: `audit_${Date.now()}`,
    sourceType: "audit",
    title: input.title,
    content: input.content,
    confidence: 0.8,
    permissions: ["read"],
  });
}
