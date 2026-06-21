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
  await saveRunSnapshot(run.id);
  const snapshot = getRunSnapshot(run.id);
  if (!snapshot) throw new CapabilityInstallRequestError("run_not_found", 404, "Install request run not found.");

  return {
    runId: run.id,
    approvalId: approval.id,
    task: summarizeAgentTask(snapshot as RunLedgerSnapshot),
    plan,
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
