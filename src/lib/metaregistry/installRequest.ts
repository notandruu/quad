import {
  addArtifact,
  addTask,
  createReceipt,
  createWorkflowRun,
  getRunSnapshot,
  requestApproval,
  saveRunSnapshot,
  summarizeAgentTask,
  transitionRun,
  type AgentTaskSummary,
  type RunLedgerSnapshot,
} from "@/lib/runs";
import { createQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import { buildCapabilityInstallPlan, type CapabilityInstallPlan } from ".";

export type CreateCapabilityInstallRequestInput = {
  orgId: string;
  actor?: string;
  capabilityIds?: string[];
  includeWriteTools?: boolean;
  env?: Record<string, string | undefined>;
  now?: string;
};

export type CapabilityInstallRequestResult = {
  runId: string;
  approvalId: string;
  task: AgentTaskSummary;
  plan: CapabilityInstallPlan;
  packet: QuadChainPacketSummary;
};

export async function createCapabilityInstallRequest(
  input: CreateCapabilityInstallRequestInput
): Promise<CapabilityInstallRequestResult> {
  const now = input.now ?? new Date().toISOString();
  const plan = buildCapabilityInstallPlan({
    env: input.env ?? process.env,
    orgId: input.orgId,
    capabilityIds: input.capabilityIds,
    includeWriteTools: input.includeWriteTools,
  });
  if (plan.knownIds.length === 0) {
    throw new CapabilityInstallRequestError("empty_plan", 400, "No known capabilities were requested.");
  }

  const run = createWorkflowRun({
    orgId: input.orgId,
    workflowKind: "capability_install",
    title: "Capability install request",
    createdBy: "dashboard",
    now,
  });
  transitionRun(run.id, "running", { now });
  addTask({
    runId: run.id,
    title: "Review capability install plan",
    status: plan.blockedAfterInstall.length > 0 ? "blocked" : "completed",
    owner: "human",
    detail: plan.blockedAfterInstall.length > 0
      ? `${plan.blockedAfterInstall.length} capabilities need env or policy fixes before install.`
      : "Capability bundle can be enabled after approval.",
    now,
  });
  const artifact = addArtifact({
    runId: run.id,
    kind: "approval_request",
    title: "Enterprise proof starter install plan",
    data: {
      actor: input.actor ?? "demo.operator",
      bundleId: plan.bundleId,
      requestedIds: plan.requestedIds,
      knownIds: plan.knownIds,
      unknownIds: plan.unknownIds,
      newlyAllowlisted: plan.newlyAllowlisted,
      newlyForceInstalled: plan.newlyForceInstalled,
      envRequired: plan.envRequired,
      blockedAfterInstall: plan.blockedAfterInstall,
      activeAfterInstall: plan.activeAfterInstall.map((tool) => ({
        id: tool.id,
        kind: tool.kind,
        approvalMode: tool.approvalMode,
      })),
      policyPreview: plan.policyPreview,
    },
    now,
  });
  const approval = requestApproval({
    runId: run.id,
    artifactId: artifact.id,
    reason: plan.blockedAfterInstall.length > 0
      ? "Review capability blockers before enabling this bundle."
      : "Approve capability allowlist and install policy changes.",
    evidenceVisible: true,
    now,
  });
  createReceipt({
    runId: run.id,
    artifactId: artifact.id,
    approvalId: approval.id,
    status: plan.blockedAfterInstall.length > 0 ? "blocked" : "ready",
    summary: plan.blockedAfterInstall.length > 0
      ? "Capability install request is blocked until missing configuration is supplied."
      : "Capability install request is ready for approval.",
    now,
  });
  transitionRun(run.id, "needs_approval", { now });
  const packet = createQuadChainPacket({
    type: "connector_action",
    orgId: input.orgId,
    runId: run.id,
    producer: "quad.metaregistry",
    consumer: "quad.operator_console",
    sources: [
      {
        id: artifact.id,
        kind: "artifact",
        content: artifact.data,
      },
      {
        id: approval.id,
        kind: "approval",
        content: {
          decision: approval.decision,
          evidenceVisible: approval.evidenceVisible,
          reason: approval.reason,
        },
      },
    ],
    evidence: [
      {
        id: "capability-install-request-created",
        sourceId: artifact.id,
        quote: "capability install request created",
        required: true,
      },
      {
        id: "approval-required",
        sourceId: approval.id,
        quote: "approval required before connector policy changes",
        required: true,
      },
    ],
    omittedRanges: plan.envRequired.length > 0
      ? [
          {
            sourceId: artifact.id,
            rangeId: "env-values",
            reason: "Only env key names are recorded; env values and connector secrets stay out of quadchain packets.",
            content: plan.envRequired,
          },
        ]
      : [],
    output: [
      "capability install request created by quad.metaregistry.",
      "approval required before connector policy changes.",
      "metaregistry recorded the requested capability policy update without installing connector secrets.",
    ].join(" "),
    answerConcepts: ["capability install", "approval required", "metaregistry"],
    visibility: "internal",
    createdAt: now,
  });
  const packetSave = await saveQuadChainPacket(packet);
  await saveRunSnapshot(run.id);
  const snapshot = getRunSnapshot(run.id);
  if (!snapshot) throw new CapabilityInstallRequestError("run_not_found", 404, "Install request run not found.");

  return {
    runId: run.id,
    approvalId: approval.id,
    task: summarizeAgentTask(snapshot as RunLedgerSnapshot),
    plan,
    packet: packetSave.summary,
  };
}

export class CapabilityInstallRequestError extends Error {
  constructor(
    public readonly code: "empty_plan" | "run_not_found",
    public readonly status: 400 | 404,
    message: string
  ) {
    super(message);
    this.name = "CapabilityInstallRequestError";
  }
}
