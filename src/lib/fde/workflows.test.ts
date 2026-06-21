import { describe, expect, it } from "vitest";
import { buildTrustPacketWorkflow } from "./workflows";
import type { ActiveTool } from "@/lib/metaregistry";
import type { AuditReport } from "@/lib/types";

const activeTools: ActiveTool[] = [
  {
    id: "quad.chain_verifier",
    name: "Quad chain verifier",
    kind: "verifier",
    approvalMode: "none",
    scopes: ["handoffs:verify"],
  },
  {
    id: "trust_packet.exporter",
    name: "Trust packet exporter",
    kind: "publisher",
    approvalMode: "dry_run",
    scopes: ["packets:export"],
  },
  {
    id: "cms.publisher",
    name: "Cms publisher",
    kind: "publisher",
    approvalMode: "human_approval",
    scopes: ["cms:draft"],
  },
  {
    id: "task.publisher",
    name: "Task publisher",
    kind: "publisher",
    approvalMode: "human_approval",
    scopes: ["tasks:create"],
  },
];

const report: AuditReport = {
  runId: "run_1",
  orgId: "org_1",
  targetUrl: "https://example.com/security",
  summary: "security page is missing enterprise proof.",
  topFindings: [
    {
      id: "finding_1",
      runId: "run_1",
      pageUrl: "https://example.com/security",
      title: "Missing mfa proof",
      category: "missing_trust_signal",
      severity: "high",
      confidence: 0.95,
      evidence: {
        quote: "MFA is enforced for all production access",
        selector: "main",
        screenshotUrl: "/screenshots/run_1.png",
        sourceType: "browser",
      },
      reasoning: "The page claims security readiness but omits mfa proof.",
      businessImpact: "Enterprise buyers cannot verify the control quickly.",
      recommendedFix: "Add a public mfa control statement to the security page.",
      sourceComparison: {
        internalClaim: "MFA is enforced for all production access",
        externalClaim: "Security page omits mfa proof",
      },
      eval: {
        grounded: true,
        useful: true,
        duplicate: false,
        hallucinationRisk: "low",
      },
    },
  ],
  allFindings: [],
  recommendedActions: [],
  metrics: {
    pagesAnalyzed: 1,
    findingsShown: 1,
    findingsFiltered: 0,
    averageConfidence: 0.95,
  },
};

describe("fde workflows", () => {
  it("builds a trust packet workflow with a quad chain certificate", () => {
    const plan = buildTrustPacketWorkflow({
      report,
      activeTools,
      createdAt: "2026-06-20T00:00:00.000Z",
    });

    expect(plan.workflowId).toBe("fde_run_1");
    expect(plan.artifacts).toHaveLength(1);
    expect(plan.openObligations).toEqual([]);
    expect(plan.certificate.proofChain.accepted).toBe(true);
    expect(plan.receiptPreview.status).toBe("ready_for_approval");
  });

  it("blocks publishing when connector capabilities are missing", () => {
    const plan = buildTrustPacketWorkflow({
      report,
      activeTools: activeTools.filter((tool) => tool.id === "quad.chain_verifier"),
    });

    expect(plan.steps.find((step) => step.capabilityId === "trust_packet.exporter")?.status).toBe("blocked");
    expect(plan.receiptPreview.status).toBe("blocked");
  });

  it("turns weak findings into human obligations", () => {
    const weakReport: AuditReport = {
      ...report,
      topFindings: [
        {
          ...report.topFindings[0],
          evidence: {
            sourceType: "browser",
          },
          eval: {
            grounded: false,
            useful: true,
            duplicate: false,
            hallucinationRisk: "high",
          },
        },
      ],
    };
    const plan = buildTrustPacketWorkflow({ report: weakReport, activeTools });

    expect(plan.openObligations.map((item) => item.kind)).toContain("needs_human");
    expect(plan.openObligations.map((item) => item.kind)).toContain("evidence_missing");
    expect(plan.certificate.proofChain.accepted).toBe(false);
  });
});
