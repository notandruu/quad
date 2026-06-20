import { describe, it, expect } from "vitest";
import { heuristicJudge } from "./evals";
import type { AuditFinding, RenderedPageEvidence } from "@/lib/types";

function evidence(text: string): RenderedPageEvidence {
  return {
    url: "https://example.org",
    title: "Home",
    status: 200,
    text,
    headings: [],
    links: [],
    buttons: [],
    images: [],
    forms: [],
    selectors: [],
    metadata: {},
  };
}

function finding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    id: "f1",
    runId: "r1",
    pageUrl: "https://example.org",
    title: "x",
    category: "missing_faq",
    severity: "low",
    confidence: 0.5,
    evidence: { quote: "we run youth mentorship", sourceType: "browser" },
    reasoning: "r",
    businessImpact: "impact",
    recommendedFix: "fix",
    ...overrides,
  };
}

describe("heuristicJudge", () => {
  it("marks grounded when the quote appears in the page text", () => {
    const r = heuristicJudge(finding(), evidence("welcome, we run youth mentorship for kids"));
    expect(r.grounded).toBe(true);
    expect(r.hallucinationRisk).toBe("low");
  });

  it("marks ungrounded with medium risk when the quote is not on the page", () => {
    const r = heuristicJudge(finding(), evidence("totally unrelated copy"));
    expect(r.grounded).toBe(false);
    expect(r.hallucinationRisk).toBe("medium");
  });

  it("marks high risk when there is no citation at all", () => {
    const r = heuristicJudge(finding({ evidence: { sourceType: "comparison" } }), evidence("x"));
    expect(r.grounded).toBe(false);
    expect(r.hallucinationRisk).toBe("high");
  });

  it("is not useful when impact or fix is empty", () => {
    expect(heuristicJudge(finding({ businessImpact: "" }), evidence("x")).useful).toBe(false);
  });
});
