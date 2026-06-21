export type EnterpriseProofPromptKind = "trust_question" | "general";

export type EnterpriseProofMessageInput = {
  status: "answered" | "needs_human";
  answer?: string;
  confidence?: number;
  wasReused?: boolean;
  sourceCount: number;
  brainGrowth?: {
    status: "learned" | "reused" | "needs_human";
    memoryId: string | null;
    title: string | null;
    visibility: "company" | "team" | "personal";
    approvalRequired: boolean;
  } | null;
};

export function classifyEnterpriseProofPrompt(text: string): EnterpriseProofPromptKind {
  const normalized = text.toLowerCase();
  if (/\b(enterprise proof|trust question|security questionnaire|vendor questionnaire|customer trust|soc ?2|compliance questionnaire|rfp)\b/.test(normalized)) {
    return "trust_question";
  }
  if (/\b(mfa|rbac|incident response|data retention|encryption|subprocessor|access review|penetration test|breach|tenant isolation)\b/.test(normalized)) {
    return "trust_question";
  }
  return "general";
}

export function formatEnterpriseProofMessage(input: EnterpriseProofMessageInput): string {
  if (input.status === "needs_human") {
    return [
      input.answer?.trim() || "I could not answer that from verified evidence yet.",
      "Needs human evidence before quad writes this into memory.",
      `Sources checked: ${input.sourceCount}.`,
    ].join("\n\n");
  }

  const confidence = typeof input.confidence === "number" ? `${Math.round(input.confidence * 100)}%` : "unknown";
  const memoryLine = input.brainGrowth?.status === "reused"
    ? `Reused verified memory: ${input.brainGrowth.title ?? input.brainGrowth.memoryId ?? "existing answer"}.`
    : `Learned a ${input.brainGrowth?.visibility ?? "company"} memory${input.brainGrowth?.approvalRequired ? " and queued approval before customer-facing use" : ""}.`;

  return [
    input.answer?.trim() || "Answered from verified enterprise proof context.",
    `${memoryLine} Confidence: ${confidence}. Sources checked: ${input.sourceCount}.`,
  ].join("\n\n");
}
