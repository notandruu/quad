import { NextRequest, NextResponse } from "next/server";
import { ENTERPRISE_PROOF_ORG_ID } from "@/data/demo/enterprise-proof";
import { ENTERPRISE_PROOF_CONNECTOR_DOCS } from "@/data/demo/enterprise-proof";
import { registerLocalDocuments } from "@/lib/connectors/documents";
import { answerTrustQuestion } from "@/lib/skills/answerTrustQuestion";
import {
  addArtifact,
  addTask,
  createWorkflowRun,
  getRunSnapshot,
  requestApproval,
  createReceipt,
  saveRunSnapshot,
  summarizeAgentTask,
  transitionRun,
} from "@/lib/runs";

export const runtime = "nodejs";
export const maxDuration = 120;

type RequestBody = {
  orgId?: string;
  question?: string;
  runId?: string;
};

/**
 * POST /api/enterprise-proof
 *
 * Answer one enterprise proof / security questionnaire question. Retrieve
 * from brain and connector docs, ground the answer, evaluate with LLM-as-judge,
 * and write back to brain only on pass. Returns the full result including
 * quadchain receipt.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const orgId = typeof body.orgId === "string" && body.orgId ? body.orgId : ENTERPRISE_PROOF_ORG_ID;

  // Register local connector fixtures for the demo org
  registerLocalDocuments(ENTERPRISE_PROOF_CONNECTOR_DOCS);

  const run = createWorkflowRun({
    orgId,
    workflowKind: "enterprise_proof",
    title: `Trust question: ${question.slice(0, 60)}`,
    createdBy: "dashboard",
  });

  try {
    transitionRun(run.id, "running");
    addTask({
      runId: run.id,
      title: "Answer trust question",
      status: "running",
      owner: "quad",
      detail: question,
    });

    const result = await answerTrustQuestion({
      orgId,
      question,
      runId: run.id,
    });

    addArtifact({
      runId: run.id,
      kind: "trust_packet",
      title: result.status === "answered" ? "Trust question answer" : "Escalation — needs human review",
      data: result,
    });

    if (result.status === "answered") {
      addTask({
        runId: run.id,
        title: "Answer drafted and evaluated",
        status: "completed",
        owner: "quad",
        detail: `Confidence ${((result.confidence ?? 0) * 100).toFixed(0)}%. Sources: ${result.sources.length}.`,
      });

      if (!result.wasReused) {
        const artifact = addArtifact({
          runId: run.id,
          kind: "trust_packet",
          title: "Learned organizational fact",
          data: { memoryId: result.memory?.id, sourceId: result.questionId },
        });
        const approval = requestApproval({
          runId: run.id,
          artifactId: artifact.id,
          reason: "New organizational fact requires operator review before use in customer-facing trust packets.",
          evidenceVisible: true,
        });
        createReceipt({
          runId: run.id,
          artifactId: artifact.id,
          approvalId: approval.id,
          status: "ready",
          summary: "Fact learned; pending operator approval for trust packet use.",
        });
      }

      transitionRun(run.id, result.wasReused ? "completed" : "needs_approval");
    } else {
      addTask({
        runId: run.id,
        title: "Escalated for human review",
        status: "blocked",
        owner: "human",
        detail: `Insufficient evidence to answer: ${question}`,
      });
      transitionRun(run.id, "failed", {
        failureReason: "Insufficient evidence — human review required.",
      });
    }

    const snapshot = getRunSnapshot(run.id);
    await saveRunSnapshot(run.id);

    return NextResponse.json({
      result,
      run: snapshot ? summarizeAgentTask(snapshot) : null,
    });
  } catch (err) {
    transitionRun(run.id, "failed", {
      failureReason: err instanceof Error ? err.message : String(err),
    });
    await saveRunSnapshot(run.id).catch(() => null);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
