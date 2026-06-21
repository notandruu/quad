import { describe, expect, it, vi } from "vitest";
import { createQuadChainPacket } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import { addArtifact, createWorkflowRun } from "@/lib/runs";
import type { AuditReport } from "@/lib/types";
import { loadAuditChatContext } from "./auditChatContext";
import { cacheReport } from "./reportCache";

describe("audit chat context", () => {
  it("loads cached audit reports and returns audit packet summaries", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
    const report = auditReport({
      orgId: "org_audit_chat_cached",
      runId: "run_audit_chat_cached",
    });
    cacheReport(report);
    await saveQuadChainPacket(auditPacket({
      orgId: report.orgId,
      runId: report.runId,
      type: "audit_report",
      sourceId: `${report.runId}:audit_report`,
    }));
    await saveQuadChainPacket(auditPacket({
      orgId: report.orgId,
      runId: report.runId,
      type: "finding",
      sourceId: "finding_chat_1",
    }));

    const context = await loadAuditChatContext({
      orgId: report.orgId,
      runId: report.runId,
    });

    expect(context.report?.summary).toBe("Audit found one gap.");
    expect(context.verifiedContext.map((packet) => packet.type)).toEqual(expect.arrayContaining([
      "audit_report",
      "finding",
    ]));
    expect(context.sources.map((source) => source.kind)).toEqual(["artifact", "finding"]);
  });

  it("falls back to durable run artifacts when the report cache is empty", async () => {
    const report = auditReport({
      orgId: "org_audit_chat_artifact",
      runId: "run_audit_chat_artifact",
    });
    createWorkflowRun({
      id: report.runId,
      orgId: report.orgId,
      workflowKind: "website_audit",
      title: "Artifact audit",
      createdBy: "dashboard",
      now: "2026-06-21T00:00:00.000Z",
    });
    addArtifact({
      runId: report.runId,
      kind: "audit_report",
      title: "Audit report",
      data: report,
      now: "2026-06-21T00:00:00.000Z",
    });

    const context = await loadAuditChatContext({
      orgId: report.orgId,
      runId: report.runId,
    });

    expect(context.report?.runId).toBe(report.runId);
    expect(context.sources[0]).toMatchObject({
      id: `${report.runId}:audit_report`,
      kind: "artifact",
    });
  });

  it("does not return cached reports across org boundaries", async () => {
    const report = auditReport({
      orgId: "org_audit_chat_private",
      runId: "run_audit_chat_private",
    });
    cacheReport(report);

    const context = await loadAuditChatContext({
      orgId: "org_audit_chat_other",
      runId: report.runId,
    });

    expect(context).toEqual({
      report: null,
      verifiedContext: [],
      sources: [],
    });
  });
});

function auditReport(input: { orgId: string; runId: string }): AuditReport {
  return {
    runId: input.runId,
    orgId: input.orgId,
    targetUrl: "https://example.com",
    summary: "Audit found one gap.",
    topFindings: [
      {
        id: "finding_chat_1",
        runId: input.runId,
        pageUrl: "https://example.com/security",
        title: "Missing trust proof",
        category: "missing_trust_signal",
        severity: "high",
        confidence: 0.91,
        evidence: {
          quote: "Security",
          sourceType: "browser",
        },
        reasoning: "Security page lacks concrete proof.",
        businessImpact: "Buyers cannot verify the claim.",
        recommendedFix: "Add the approved trust packet summary.",
      },
    ],
    allFindings: [],
    recommendedActions: [],
    metrics: {
      pagesAnalyzed: 1,
      findingsShown: 1,
      findingsFiltered: 0,
      averageConfidence: 0.91,
    },
  };
}

function auditPacket(input: {
  orgId: string;
  runId: string;
  type: "audit_report" | "finding";
  sourceId: string;
}) {
  return createQuadChainPacket({
    type: input.type,
    orgId: input.orgId,
    runId: input.runId,
    producer: "test",
    consumer: "test",
    sources: [
      {
        id: input.sourceId,
        kind: input.type === "finding" ? "finding" : "artifact",
        content: "Audit found one gap.",
      },
    ],
    evidence: [
      {
        id: `${input.sourceId}:evidence`,
        sourceId: input.sourceId,
        quote: "Audit found one gap",
        required: true,
      },
    ],
    output: "Audit found one gap in the verified website evidence.",
    answerConcepts: ["audit", "gap"],
  });
}
