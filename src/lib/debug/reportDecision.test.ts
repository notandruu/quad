import { describe, expect, it } from "vitest";
import type { AuditFinding, AuditReport } from "@/lib/types";
import { summarizeDecisionQueue } from "./reportDecision";

function finding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    id: "finding_1",
    runId: "run_1",
    pageUrl: "https://example.org/",
    title: "missing proof",
    category: "missing_trust_signal",
    severity: "medium",
    confidence: 0.9,
    evidence: {
      quote: "trusted partner",
      selector: "main h1",
      screenshotUrl: "data:image/png;base64,abc",
      sourceType: "browser",
    },
    reasoning: "the page needs stronger proof.",
    businessImpact: "visitors may not trust the claim.",
    recommendedFix: "add approved proof.",
    sourceComparison: {
      internalClaim: "internal proof exists.",
      externalClaim: "site claim is vague.",
    },
    eval: {
      grounded: true,
      useful: true,
      duplicate: false,
      hallucinationRisk: "low",
    },
    ...overrides,
  };
}

function report(findings: AuditFinding[]): AuditReport {
  return {
    runId: "run_1",
    orgId: "org_1",
    targetUrl: "https://example.org/",
    summary: "summary",
    topFindings: findings,
    allFindings: findings,
    recommendedActions: [],
    metrics: {
      pagesAnalyzed: 1,
      findingsShown: findings.length,
      findingsFiltered: 0,
      averageConfidence: 0.9,
    },
  };
}

describe("summarizeDecisionQueue", () => {
  it("marks all-clean findings as ready for approval", () => {
    expect(summarizeDecisionQueue(report([finding()]))).toEqual({
      total: 1,
      ready: 1,
      needsReview: 0,
      averageProofScore: 99,
      label: "Approval queue ready",
      nextAction: "Approve or edit the drafted fixes.",
      tone: "ready",
    });
  });

  it("surfaces review work when any finding is blocked", () => {
    expect(
      summarizeDecisionQueue(
        report([
          finding(),
          finding({
            id: "finding_2",
            confidence: 0.2,
            evidence: { sourceType: "comparison" },
            eval: {
              grounded: false,
              useful: false,
              duplicate: true,
              hallucinationRisk: "high",
            },
          }),
        ])
      )
    ).toEqual({
      total: 2,
      ready: 1,
      needsReview: 1,
      averageProofScore: 57,
      label: "Review queue active",
      nextAction: "Review blocked findings before approving external work.",
      tone: "review",
    });
  });

  it("handles an empty findings list", () => {
    expect(summarizeDecisionQueue(report([]))).toEqual({
      total: 0,
      ready: 0,
      needsReview: 0,
      averageProofScore: 0,
      label: "No findings ready",
      nextAction: "Run a broader audit or add more company-brain sources.",
      tone: "empty",
    });
  });
});
