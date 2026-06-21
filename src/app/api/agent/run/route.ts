import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { validateAgentRunRequest, type AgentRunRequestBody } from "@/lib/agent/runRequest";
import { buildQuadCoreContext, saveQuadCoreReceipt } from "@/lib/core";
import { getEmployee } from "@/lib/employees";
import { buildTrustPacketWorkflow } from "@/lib/fde/workflows";
import type { QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
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
} from "@/lib/runs";
import { cacheReport } from "@/lib/runtime/reportCache";
import { runAudit } from "@/lib/tools/auditAnalyzer";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Thin external-agent bridge. Fetch/Agentverse or any future agent surface can
 * call this route and get the same normalized task summary the dashboard can
 * eventually consume. Durable work still lives in the quad runtime substrate.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as AgentRunRequestBody;
  const validation = validateAgentRunRequest({
    body,
    headers: req.headers,
    defaultOrgId: DEMO_ORG_ID,
    env: process.env,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }
  const { orgId, targetUrl, workflow, limit } = validation;
  const quadChain: QuadChainPacketSummary[] = [];

  const run = createWorkflowRun({
    orgId,
    workflowKind: workflow === "enterprise_proof" ? "enterprise_proof" : "website_audit",
    title: workflow === "enterprise_proof" ? "Enterprise proof run" : "Website audit run",
    createdBy: "agent",
    targetUrl,
  });

  try {
    const coreContext = await buildQuadCoreContext({
      orgId,
      employee: getEmployee(),
      runId: run.id,
      text: `run audit ${targetUrl} for ${workflow}`,
      surface: "fetch_agent",
      pinnedUrl: targetUrl,
      hasActiveAudit: workflow === "website_audit",
    });
    const handoffReceipt = await saveQuadCoreReceipt({
      context: coreContext,
      type: "agent_handoff",
      output: `External agent requested ${workflow} for ${targetUrl}.`,
      producer: "quad.fetch_agent",
      consumer: "quad.runtime",
      sources: [
        {
          id: "agent_run_request",
          kind: "event",
          content: {
            workflow,
            targetUrl,
            limit,
            selectedTools: coreContext.selectedTools.map((tool) => tool.id),
            missingCapabilities: coreContext.missingCapabilities.map((capability) => capability.id),
          },
        },
      ],
      answerConcepts: ["agent", "handoff", workflow],
      visibility: "internal",
    });
    quadChain.push(handoffReceipt);

    transitionRun(run.id, "running");
    addTask({
      runId: run.id,
      title: "Run website audit",
      status: "running",
      owner: "quad",
      detail: "Audit worker is collecting browser evidence and company-brain context.",
    });

    const report = await runAudit({
      orgId,
      runId: run.id,
      targetUrl,
      limit,
    });
    cacheReport(report);
    addArtifact({
      runId: run.id,
      kind: "audit_report",
      title: "Audit report",
      data: report,
    });
    addTask({
      runId: run.id,
      title: "Audit complete",
      status: "completed",
      owner: "quad",
      detail: `${report.metrics.findingsShown} findings shown after quality gates.`,
    });

    if (workflow === "enterprise_proof") {
      const plan = buildTrustPacketWorkflow({ report, activeTools: coreContext.capabilities.activeTools });
      const packetArtifact = addArtifact({
        runId: run.id,
        kind: "trust_packet",
        title: plan.title,
        data: plan,
      });
      addArtifact({
        runId: run.id,
        kind: "quad_chain_certificate",
        title: "Quad chain certificate",
        data: plan.certificate,
      });
      const savedPacket = await saveQuadChainPacket(plan.packet);
      quadChain.push(savedPacket.summary);
      const approval = requestApproval({
        runId: run.id,
        artifactId: packetArtifact.id,
        reason: "Customer-facing trust packet needs human approval before publishing.",
        evidenceVisible: true,
      });
      createReceipt({
        runId: run.id,
        artifactId: packetArtifact.id,
        approvalId: approval.id,
        status: plan.receiptPreview.status === "blocked" ? "blocked" : "ready",
        summary: plan.receiptPreview.summary,
      });
      for (const step of plan.steps) {
        addTask({
          runId: run.id,
          title: step.title,
          status: step.status === "blocked" ? "blocked" : step.status === "needs_human" ? "blocked" : "completed",
          owner: step.owner,
          capabilityId: step.capabilityId,
          detail: step.detail,
        });
      }
      transitionRun(run.id, plan.receiptPreview.status === "blocked" ? "failed" : "needs_approval", {
        failureReason: plan.receiptPreview.status === "blocked" ? plan.receiptPreview.summary : undefined,
      });
      addArtifact({
        runId: run.id,
        kind: "receipt",
        title: "Quadchain packet summary",
        data: savedPacket.summary,
      });
    } else {
      transitionRun(run.id, "completed");
    }

    const snapshot = getRunSnapshot(run.id);
    await saveRunSnapshot(run.id);
    return NextResponse.json({
      agent: "quad",
      workflow,
      summary: snapshot ? summarizeAgentTask(snapshot) : null,
      quadChain,
      runtime: {
        surface: coreContext.surface,
        selectedTools: coreContext.selectedTools.map((tool) => tool.id),
        missingCapabilities: coreContext.missingCapabilities.map((capability) => ({
          id: capability.id,
          missingEnvCount: capability.missingEnv.length,
        })),
      },
    });
  } catch (err) {
    transitionRun(run.id, "failed", {
      failureReason: err instanceof Error ? err.message : String(err),
    });
    const snapshot = getRunSnapshot(run.id);
    await saveRunSnapshot(run.id).catch(() => null);
    return NextResponse.json(
      {
        agent: "quad",
        workflow,
        summary: snapshot ? summarizeAgentTask(snapshot) : null,
        quadChain,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
