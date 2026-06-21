import { buildTrustPacketWorkflow, type FdeWorkflowPlan } from "@/lib/fde/workflows";
import { summarizeCapabilities } from "@/lib/metaregistry";
import {
  addArtifact,
  addTask,
  createReceipt,
  createWorkflowRun,
  getRunSnapshot,
  requestApproval,
  summarizeAgentTask,
  transitionRun,
  type AgentTaskSummary,
  type WorkflowTaskRecord,
} from "@/lib/runs";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import { summarizeQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import type { AuditReport } from "@/lib/types";

export type DashboardTrustPacket = {
  workflow: FdeWorkflowPlan;
  task: AgentTaskSummary;
  packet: QuadChainPacketSummary;
};

export async function buildDashboardTrustPacket(input: {
  report: AuditReport;
  env?: Record<string, string | undefined>;
  now?: string;
}): Promise<DashboardTrustPacket> {
  const capabilitySummary = summarizeCapabilities(input.env ?? process.env);
  const workflow = buildTrustPacketWorkflow({
    report: input.report,
    activeTools: capabilitySummary.activeTools,
    createdAt: input.now,
  });
  const savedPacket = await saveQuadChainPacket(workflow.packet);
  const run = createWorkflowRun({
    id: `trust_${input.report.runId}`,
    orgId: input.report.orgId,
    workflowKind: "trust_packet",
    title: workflow.title,
    createdBy: "dashboard",
    targetUrl: input.report.targetUrl,
    now: input.now,
  });

  workflow.steps.forEach((step) => {
    addTask({
      runId: run.id,
      title: step.title,
      owner: step.owner,
      status: toTaskStatus(step.status),
      capabilityId: step.capabilityId,
      detail: step.detail,
      now: input.now,
    });
  });

  const packetArtifact = addArtifact({
    runId: run.id,
    kind: "trust_packet",
    title: "Enterprise proof trust packet",
    data: {
      workflowId: workflow.workflowId,
      targetUrl: workflow.targetUrl,
      artifacts: workflow.artifacts,
      openObligations: workflow.openObligations,
      packet: savedPacket.summary,
    },
    now: input.now,
  });
  addArtifact({
    runId: run.id,
    kind: "quad_chain_certificate",
    title: "Quadchain certificate",
    data: workflow.certificate,
    now: input.now,
  });

  const approval = requestApproval({
    runId: run.id,
    artifactId: packetArtifact.id,
    reason: workflow.receiptPreview.summary,
    evidenceVisible: true,
    now: input.now,
  });
  createReceipt({
    runId: run.id,
    artifactId: packetArtifact.id,
    approvalId: approval.id,
    status: workflow.receiptPreview.status === "ready_for_approval" ? "ready" : "blocked",
    summary: workflow.receiptPreview.summary,
    now: input.now,
  });
  transitionRun(
    run.id,
    workflow.receiptPreview.status === "ready_for_approval" ? "needs_approval" : "failed",
    {
      now: input.now,
      failureReason:
        workflow.receiptPreview.status === "blocked" ? workflow.receiptPreview.summary : undefined,
    }
  );

  const snapshot = getRunSnapshot(run.id);
  if (!snapshot) throw new Error(`Trust packet run was not persisted: ${run.id}`);

  return {
    workflow,
    task: summarizeAgentTask(snapshot),
    packet: summarizeQuadChainPacket(workflow.packet) ?? savedPacket.summary,
  };
}

function toTaskStatus(status: FdeWorkflowPlan["steps"][number]["status"]): WorkflowTaskRecord["status"] {
  if (status === "ready" || status === "dry_run") return "completed";
  if (status === "needs_human") return "blocked";
  return "blocked";
}
