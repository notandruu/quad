import { describe, expect, it } from "vitest";
import type { AuditFinding } from "@/lib/types";
import {
  buildApprovalGate,
  buildEvalSignals,
  buildEvidenceView,
  buildTraceSteps,
  hasScreenshot,
  scoreEvidence,
} from "./findingEvidence";

function finding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    id: "finding_1",
    runId: "run_1",
    pageUrl: "https://example.org/programs/",
    title: "missing scholarship support",
    category: "missing_public_explanation",
    severity: "medium",
    confidence: 0.8,
    evidence: {
      quote: "youth mentorship",
      selector: " main h2 ",
      screenshotUrl: "data:image/png;base64,abc",
      sourceType: "browser",
    },
    reasoning: "the page omits a known program.",
    businessImpact: "families cannot find it.",
    recommendedFix: "add a scholarship support section.",
    ...overrides,
  };
}

describe("buildEvidenceView", () => {
  it("normalizes browser evidence into labels for the card", () => {
    expect(buildEvidenceView(finding())).toEqual({
      sourceLabel: "Browser evidence",
      selectorLabel: "main h2",
      screenshotUrl: "data:image/png;base64,abc",
      pageHost: "example.org/programs",
      categoryLabel: "Missing public explanation",
      severityLabel: "Medium",
      proofScore: 69,
      proofLabel: "Medium proof",
      proofTone: "medium",
      proofReasons: ["Browser source", "Quoted evidence", "Selector", "Screenshot"],
      approvalGate: {
        canApprove: false,
        label: "Needs review before approval",
        detail: "Approval is held until evidence and eval checks are clean.",
        reasons: ["Eval missing"],
        tone: "review",
      },
      traceSummary: "2/5 checks passed · 3 need attention",
      traceSteps: [
        {
          id: "browserbase.render_page",
          label: "Render page",
          detail: "Browser evidence is attached to this finding.",
          status: "passed",
        },
        {
          id: "brain.retrieve",
          label: "Retrieve brain",
          detail: "No company-brain comparison attached.",
          status: "warning",
        },
        {
          id: "llm.analyze_page",
          label: "Analyze page",
          detail: "Reasoning is captured for replay.",
          status: "passed",
        },
        {
          id: "llm.evaluate_finding",
          label: "Evaluate finding",
          detail: "Local eval result is not attached yet.",
          status: "missing",
        },
        {
          id: "approval.gate",
          label: "Approval gate",
          detail: "Approval is held until evidence and eval checks are clean.",
          status: "warning",
        },
      ],
      evalSignals: [
        {
          label: "Eval status",
          value: "Not attached",
          status: "missing",
        },
      ],
    });
  });

  it("handles comparison evidence without screenshots or selectors", () => {
    const view = buildEvidenceView(
      finding({
        evidence: {
          sourceType: "comparison",
        },
      })
    );

    expect(view.sourceLabel).toBe("Brain vs website");
    expect(view.selectorLabel).toBeNull();
    expect(view.screenshotUrl).toBeNull();
  });
});

describe("buildTraceSteps", () => {
  it("marks grounded eval traces as passed and keeps approval pending", () => {
    const steps = buildTraceSteps(
      finding({
        sourceComparison: {
          internalClaim: "Internal docs mention scholarships.",
          externalClaim: "The page omits scholarships.",
        },
        eval: {
          grounded: true,
          useful: true,
          duplicate: false,
          hallucinationRisk: "low",
        },
      })
    );

    expect(steps.map((step) => [step.id, step.status])).toEqual([
      ["browserbase.render_page", "passed"],
      ["brain.retrieve", "passed"],
      ["llm.analyze_page", "passed"],
      ["llm.evaluate_finding", "passed"],
      ["approval.gate", "pending"],
    ]);
  });

  it("flags risky evals and puts approval into review", () => {
    const steps = buildTraceSteps(
      finding({
        eval: {
          grounded: false,
          useful: false,
          duplicate: true,
          hallucinationRisk: "high",
        },
      })
    );

    expect(steps.find((step) => step.id === "llm.evaluate_finding")?.status).toBe("warning");
    expect(steps.find((step) => step.id === "approval.gate")?.status).toBe("warning");
  });
});

describe("buildApprovalGate", () => {
  it("allows approval when proof and eval checks are clean", () => {
    expect(
      buildApprovalGate(
        finding({
          sourceComparison: {
            internalClaim: "Internal docs mention scholarships.",
            externalClaim: "The page omits scholarships.",
          },
          eval: {
            grounded: true,
            useful: true,
            duplicate: false,
            hallucinationRisk: "low",
          },
        })
      )
    ).toEqual({
      canApprove: true,
      label: "Ready for human approval",
      detail: "Evidence score 99/100 with no blocking eval issues.",
      reasons: ["Evidence and eval checks passed"],
      tone: "ready",
    });
  });

  it("requires review for weak or risky findings", () => {
    expect(
      buildApprovalGate(
        finding({
          confidence: 0.2,
          evidence: { sourceType: "comparison" },
          eval: {
            grounded: false,
            useful: false,
            duplicate: true,
            hallucinationRisk: "high",
          },
        })
      )
    ).toEqual({
      canApprove: false,
      label: "Needs review before approval",
      detail: "Approval is held until evidence and eval checks are clean.",
      reasons: [
        "Weak evidence",
        "Grounding failed",
        "Usefulness failed",
        "Duplicate flagged",
        "High hallucination risk",
      ],
      tone: "review",
    });
  });
});

describe("buildEvalSignals", () => {
  it("turns finding evals into compact review badges", () => {
    expect(
      buildEvalSignals(
        finding({
          eval: {
            grounded: true,
            useful: false,
            duplicate: true,
            hallucinationRisk: "medium",
          },
        })
      )
    ).toEqual([
      { label: "Grounded", value: "Pass", status: "passed" },
      { label: "Useful", value: "Fail", status: "warning" },
      { label: "Duplicate", value: "Flagged", status: "warning" },
      { label: "Risk", value: "Medium", status: "passed" },
    ]);
  });
});

describe("hasScreenshot", () => {
  it("reports whether screenshot evidence is available", () => {
    expect(hasScreenshot(finding())).toBe(true);
    expect(hasScreenshot(finding({ evidence: { sourceType: "comparison" } }))).toBe(false);
  });
});

describe("scoreEvidence", () => {
  it("marks fully grounded browser findings as strong proof", () => {
    const proof = scoreEvidence(
      finding({
        sourceComparison: {
          internalClaim: "Internal docs mention scholarships.",
          externalClaim: "The page omits scholarships.",
        },
        eval: {
          grounded: true,
          useful: true,
          duplicate: false,
          hallucinationRisk: "low",
        },
      })
    );

    expect(proof.proofTone).toBe("strong");
    expect(proof.proofScore).toBe(99);
    expect(proof.proofReasons).toContain("Grounded eval");
  });

  it("marks unsupported comparison findings as weak proof", () => {
    const proof = scoreEvidence(
      finding({
        confidence: 0.4,
        evidence: {
          sourceType: "comparison",
        },
      })
    );

    expect(proof.proofTone).toBe("weak");
    expect(proof.proofLabel).toBe("Weak proof");
  });
});
