import { buildTrustPacketWorkflow } from "@/lib/fde/workflows";
import { summarizeCapabilities } from "@/lib/metaregistry";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import {
  addArtifact,
  addTask,
  createReceipt,
  getRunSnapshot,
  requestApproval,
  saveRunSnapshot,
  transitionRun,
} from "@/lib/runs";
import { cacheReport } from "@/lib/runtime/reportCache";
import { runAudit } from "@/lib/tools/auditAnalyzer";
import {
  claimNextJob,
  deadLetterJob,
  retryJob,
  updateJob,
  type AgentRunJobPayload,
  type AuditJobPayload,
  type QuadJob,
} from "./queue";

export type ProcessJobResult = {
  processed: boolean;
  job: QuadJob | null;
};

export async function processNextJob(): Promise<ProcessJobResult> {
  const job = await claimNextJob();
  if (!job) return { processed: false, job: null };
  const completed = await processJob(job);
  return { processed: true, job: completed };
}

export async function processJob(job: QuadJob): Promise<QuadJob> {
  try {
    if (job.type === "agent_run") {
      await runAgentJob(job.payload as AgentRunJobPayload);
    } else {
      await runAuditJob(job.payload as AuditJobPayload);
    }

    return (await updateJob(job.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: {
        runId: job.runId,
        orgId: job.orgId,
      },
    }))!;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (job.attempts < job.maxAttempts) {
      const retrying = await retryJob(job, { error: message });
      try {
        transitionRun(job.runId, "running", { failureReason: `Retrying after worker error: ${message}` });
        await saveRunSnapshot(job.runId);
      } catch {
        // Job retry state is still authoritative even if the run snapshot is unavailable.
      }
      return retrying;
    }

    const failed = await deadLetterJob(job, { error: message });

    try {
      transitionRun(job.runId, "failed", { failureReason: message });
      await saveRunSnapshot(job.runId);
    } catch {
      // The job failure itself is the important state here.
    }

    return failed ?? job;
  }
}

async function runAuditJob(payload: AuditJobPayload) {
  transitionRun(payload.runId, "running");
  addTask({
    runId: payload.runId,
    title: "Run website audit",
    status: "running",
    owner: "quad",
    detail: "Backend worker is collecting browser evidence and company-brain context.",
  });
  await saveRunSnapshot(payload.runId);

  const report = await runAudit({
    orgId: payload.orgId,
    runId: payload.runId,
    targetUrl: payload.targetUrl,
    limit: payload.limit,
  });
  cacheReport(report);
  addArtifact({
    runId: payload.runId,
    kind: "audit_report",
    title: "Audit report",
    data: report,
  });
  addTask({
    runId: payload.runId,
    title: "Audit complete",
    status: "completed",
    owner: "quad",
    detail: `${report.metrics.findingsShown} findings shown after quality gates.`,
  });
  transitionRun(payload.runId, "completed");
  await saveRunSnapshot(payload.runId);
}

async function runAgentJob(payload: AgentRunJobPayload) {
  transitionRun(payload.runId, "running");
  addTask({
    runId: payload.runId,
    title: "Run website audit",
    status: "running",
    owner: "quad",
    detail: "Backend worker is collecting browser evidence and company-brain context.",
  });
  await saveRunSnapshot(payload.runId);

  const report = await runAudit({
    orgId: payload.orgId,
    runId: payload.runId,
    targetUrl: payload.targetUrl,
    limit: payload.limit,
  });
  cacheReport(report);
  addArtifact({
    runId: payload.runId,
    kind: "audit_report",
    title: "Audit report",
    data: report,
  });

  if (payload.workflow !== "enterprise_proof") {
    addTask({
      runId: payload.runId,
      title: "Audit complete",
      status: "completed",
      owner: "quad",
      detail: `${report.metrics.findingsShown} findings shown after quality gates.`,
    });
    transitionRun(payload.runId, "completed");
    await saveRunSnapshot(payload.runId);
    return;
  }

  const capabilities = summarizeCapabilities(process.env).activeTools;
  const plan = buildTrustPacketWorkflow({ report, activeTools: capabilities });
  const packetArtifact = addArtifact({
    runId: payload.runId,
    kind: "trust_packet",
    title: plan.title,
    data: plan,
  });
  addArtifact({
    runId: payload.runId,
    kind: "quad_chain_certificate",
    title: "Quad chain certificate",
    data: plan.certificate,
  });
  const savedPacket = await saveQuadChainPacket(plan.packet);
  const approval = requestApproval({
    runId: payload.runId,
    artifactId: packetArtifact.id,
    reason: "Customer-facing trust packet needs human approval before publishing.",
    evidenceVisible: true,
  });
  createReceipt({
    runId: payload.runId,
    artifactId: packetArtifact.id,
    approvalId: approval.id,
    status: plan.receiptPreview.status === "blocked" ? "blocked" : "ready",
    summary: plan.receiptPreview.summary,
  });
  for (const step of plan.steps) {
    addTask({
      runId: payload.runId,
      title: step.title,
      status: step.status === "blocked" ? "blocked" : step.status === "needs_human" ? "blocked" : "completed",
      owner: step.owner,
      capabilityId: step.capabilityId,
      detail: step.detail,
    });
  }
  transitionRun(payload.runId, plan.receiptPreview.status === "blocked" ? "failed" : "needs_approval", {
    failureReason: plan.receiptPreview.status === "blocked" ? plan.receiptPreview.summary : undefined,
  });
  addArtifact({
    runId: payload.runId,
    kind: "receipt",
    title: "Quadchain packet summary",
    data: savedPacket.summary,
  });
  const snapshot = getRunSnapshot(payload.runId);
  if (!snapshot) throw new Error(`Run not found after agent job: ${payload.runId}`);
  await saveRunSnapshot(payload.runId);
}
