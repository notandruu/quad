import { createQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import {
  addArtifact,
  addTask,
  createReceipt,
  createWorkflowRun,
  getRunSnapshot,
  requestApproval,
  saveRunSnapshot,
  transitionRun,
  type ApprovalRecord,
  type AgentTaskSummary,
  type ReceiptRecord,
  type RunLedgerSnapshot,
  type WorkflowArtifactRecord,
} from "@/lib/runs";
import { summarizeAgentTask } from "@/lib/runs";
import type { BrainEvidence } from "@/lib/types";
import type { IngestInput } from "./ingest";
import type { BrainMemoryMetadata } from "./metadata";
import { normalizeMemoryMetadata } from "./metadata";
import { normalizeMemoryPermissions } from "./permissions";

export const MEMORY_WRITE_PROPOSAL_TYPE = "brain_memory_write" as const;

export type MemoryWriteProposalPayload = {
  proposalType: typeof MEMORY_WRITE_PROPOSAL_TYPE;
  memory: IngestInput;
  preview: {
    title: string;
    sourceId: string;
    sourceType: string;
    summary: string;
    confidence: number;
    permissions: string[];
    metadata: BrainMemoryMetadata;
    evidenceCount: number;
  };
  policy: {
    requiresApproval: true;
    writesSharedBrain: true;
    reason: string;
  };
};

export type ProposeMemoryWriteInput = IngestInput & {
  requestedBy?: "dashboard" | "agent" | "system";
  reason?: string;
  now?: string;
};

export type ProposeMemoryWriteResult = {
  ok: true;
  mode: "proposal";
  runId: string;
  approvalId: string;
  artifact: Pick<WorkflowArtifactRecord, "id" | "kind" | "title" | "hash">;
  approval: Pick<ApprovalRecord, "id" | "decision" | "reason" | "evidenceVisible">;
  receipt: Pick<ReceiptRecord, "id" | "status" | "summary" | "artifactHash">;
  packet: QuadChainPacketSummary;
  task: AgentTaskSummary;
};

export async function proposeMemoryWrite(input: ProposeMemoryWriteInput): Promise<ProposeMemoryWriteResult> {
  const now = input.now ?? new Date().toISOString();
  const evidenceQuotes = (input.evidence ?? [])
    .filter((item) => Boolean(item.quote))
    .slice(0, 6)
    .map((item) => item.quote as string);
  const run = createWorkflowRun({
    orgId: input.orgId,
    workflowKind: "memory_write",
    title: `Memory write approval: ${input.title}`,
    createdBy: input.requestedBy ?? "dashboard",
    targetUrl: input.sourceType === "website" ? input.sourceId : undefined,
    now,
  });
  addTask({
    runId: run.id,
    title: "Verify proposed memory write",
    status: "blocked",
    owner: "human",
    detail: "Shared company memory is blocked until a human approves the source evidence.",
    now,
  });

  const payload = buildMemoryWriteProposalPayload(input);
  const artifact = addArtifact({
    runId: run.id,
    kind: "approval_request",
    title: "Proposed company brain memory",
    data: payload,
    now,
  });
  const approval = requestApproval({
    runId: run.id,
    artifactId: artifact.id,
    reason: input.reason ?? "Shared company brain memory requires approval before writeback.",
    evidenceVisible: (input.evidence?.length ?? 0) > 0,
    now,
  });
  const receipt = createReceipt({
    runId: run.id,
    artifactId: artifact.id,
    approvalId: approval.id,
    status: "blocked",
    summary: "Memory write is staged but blocked until approval.",
    now,
  });
  transitionRun(run.id, "needs_approval", { now });

  const packet = createQuadChainPacket({
    type: "approval",
    orgId: input.orgId,
    runId: run.id,
    producer: "quad.company_brain",
    consumer: "quad.operator_console",
    sources: [
      {
        id: artifact.id,
        kind: "artifact",
        content: {
          proposalType: payload.proposalType,
          title: payload.preview.title,
          sourceId: payload.preview.sourceId,
          sourceType: payload.preview.sourceType,
          evidenceCount: payload.preview.evidenceCount,
          permissions: payload.preview.permissions,
        },
      },
    ],
    evidence: buildProposalEvidence(input.evidence ?? [], artifact.id),
    output: [
      `memory write proposed: ${input.title}`,
      `source type: ${input.sourceType}`,
      `approval id: ${approval.id}`,
      "shared brain writeback: blocked until approval",
      ...evidenceQuotes.map((quote) => `evidence: ${quote}`),
    ].join("\n"),
    answerConcepts: ["memory", "approval", "writeback"],
    visibility: "restricted",
    createdAt: now,
  });
  const savedPacket = await saveQuadChainPacket(packet);
  await saveRunSnapshot(run.id);
  const snapshot = requireSavedSnapshot(run.id);

  return {
    ok: true,
    mode: "proposal",
    runId: run.id,
    approvalId: approval.id,
    artifact: {
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      hash: artifact.hash,
    },
    approval: {
      id: approval.id,
      decision: approval.decision,
      reason: approval.reason,
      evidenceVisible: approval.evidenceVisible,
    },
    receipt: {
      id: receipt.id,
      status: receipt.status,
      summary: receipt.summary,
      artifactHash: receipt.artifactHash,
    },
    packet: savedPacket.summary,
    task: summarizeAgentTask(snapshot),
  };
}

export function isMemoryWriteProposalPayload(value: unknown): value is MemoryWriteProposalPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MemoryWriteProposalPayload>;
  return candidate.proposalType === MEMORY_WRITE_PROPOSAL_TYPE && Boolean(candidate.memory);
}

function buildMemoryWriteProposalPayload(input: IngestInput): MemoryWriteProposalPayload {
  const permissions = normalizeMemoryPermissions(input);
  const metadata = normalizeMemoryMetadata({ ...input, permissions });
  return {
    proposalType: MEMORY_WRITE_PROPOSAL_TYPE,
    memory: input,
    preview: {
      title: input.title,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      summary: input.summary ?? input.content.slice(0, 240),
      confidence: input.confidence ?? 0.6,
      permissions,
      metadata,
      evidenceCount: input.evidence?.length ?? 0,
    },
    policy: {
      requiresApproval: true,
      writesSharedBrain: true,
      reason: "shared company brain writeback",
    },
  };
}

function buildProposalEvidence(evidence: BrainEvidence[], artifactId: string) {
  return evidence
    .filter((item) => Boolean(item.quote))
    .slice(0, 6)
    .map((item, index) => ({
      id: `${artifactId}:evidence_${index + 1}`,
      sourceId: artifactId,
      quote: item.quote as string,
      required: true,
    }));
}

function requireSavedSnapshot(runId: string): RunLedgerSnapshot {
  const snapshot = getRunSnapshot(runId);
  if (!snapshot) throw new Error(`Run not found: ${runId}`);
  return snapshot;
}
