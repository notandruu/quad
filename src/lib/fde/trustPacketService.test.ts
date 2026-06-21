import { describe, expect, it } from "vitest";
import { buildDashboardTrustPacket } from "./trustPacketService";
import type { AuditReport } from "@/lib/types";

const report: AuditReport = {
  runId: "run_service_1",
  orgId: "org_1",
  targetUrl: "https://example.com/security",
  summary: "security page is missing enterprise proof.",
  topFindings: [
    {
      id: "finding_1",
      runId: "run_service_1",
      pageUrl: "https://example.com/security",
      title: "Missing mfa proof",
      category: "missing_trust_signal",
      severity: "high",
      confidence: 0.95,
      evidence: {
        quote: "MFA is enforced for all production access",
        selector: "main",
        screenshotUrl: "/screenshots/run_service_1.png",
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

describe("trust packet service", () => {
  it("builds a dashboard approval packet with a saved quadchain summary", async () => {
    const result = await buildDashboardTrustPacket({
      report,
      env: {},
      now: "2026-06-21T00:00:00.000Z",
    });

    expect(result.workflow.workflowId).toBe("fde_run_service_1");
    expect(result.packet.type).toBe("trust_packet");
    expect(result.packet.accepted).toBe(true);
    expect(result.task.runId).toBe("trust_run_service_1");
    expect(result.task.status).toBe("needs_approval");
    expect(result.task.approvals).toHaveLength(1);
    expect(result.task.receipts[0]?.status).toBe("ready");
    expect(result.task.nextAction).toMatch(/Human approval required/);
  });

  it("blocks the receipt when required evidence is missing", async () => {
    const weakReport: AuditReport = {
      ...report,
      runId: "run_service_weak",
      topFindings: [
        {
          ...report.topFindings[0],
          id: "finding_weak",
          runId: "run_service_weak",
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

    const result = await buildDashboardTrustPacket({
      report: weakReport,
      env: {},
      now: "2026-06-21T00:00:00.000Z",
    });

    expect(result.packet.accepted).toBe(false);
    expect(result.task.status).toBe("failed");
    expect(result.task.receipts[0]?.status).toBe("blocked");
    expect(result.workflow.openObligations.length).toBeGreaterThan(0);
  });
});
