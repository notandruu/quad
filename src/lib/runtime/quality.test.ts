import { describe, it, expect } from "vitest";
import { checkFinding, partitionFindings } from "./quality";
import type { AuditFinding } from "@/lib/types";

function finding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    id: "f1",
    runId: "r1",
    pageUrl: "https://example.org",
    title: "Missing scholarship page",
    category: "missing_public_explanation",
    severity: "medium",
    confidence: 0.8,
    evidence: { quote: "youth mentorship", sourceType: "browser" },
    reasoning: "The brain lists scholarships but the page omits them.",
    businessImpact: "Families cannot discover the scholarship program.",
    recommendedFix: "Add a scholarship section with eligibility and deadline.",
    eval: { grounded: true, useful: true, duplicate: false, hallucinationRisk: "low" },
    ...overrides,
  };
}

const TODAY = new Date("2026-06-20T00:00:00Z");

describe("checkFinding quality gates", () => {
  it("passes a complete, grounded, useful finding", () => {
    expect(checkFinding(finding(), TODAY).pass).toBe(true);
  });

  it("rejects a finding with no evidence", () => {
    const r = checkFinding(finding({ evidence: { sourceType: "browser" } }), TODAY);
    expect(r.pass).toBe(false);
    expect(r.reasons).toContain("no_evidence");
  });

  it("rejects the ESPN failure mode: flagging the current year as stale", () => {
    const r = checkFinding(
      finding({
        category: "outdated_information",
        title: "Outdated 2026 copyright",
        reasoning: "The footer says 2026 which looks outdated.",
        recommendedFix: "Change the copyright from 2026 to 2024.",
      }),
      TODAY
    );
    expect(r.pass).toBe(false);
    expect(r.reasons).toContain("contradicts_current_date");
  });

  it("still allows a genuinely stale date (older than current year)", () => {
    const r = checkFinding(
      finding({
        category: "outdated_information",
        title: "Copyright still reads 2019",
        reasoning: "The footer copyright is 2019, well before the current year.",
        recommendedFix: "Update the copyright year to the current year.",
      }),
      TODAY
    );
    expect(r.pass).toBe(true);
  });

  it("rejects findings the eval flagged as duplicate, ungrounded, or useless", () => {
    expect(checkFinding(finding({ eval: { grounded: true, useful: true, duplicate: true, hallucinationRisk: "low" } }), TODAY).reasons).toContain("duplicate");
    expect(checkFinding(finding({ eval: { grounded: false, useful: true, duplicate: false, hallucinationRisk: "high" } }), TODAY).reasons).toContain("not_grounded");
    expect(checkFinding(finding({ eval: { grounded: true, useful: false, duplicate: false, hallucinationRisk: "low" } }), TODAY).reasons).toContain("not_useful");
  });

  it("rejects findings missing business impact or a fix", () => {
    expect(checkFinding(finding({ businessImpact: "  " }), TODAY).reasons).toContain("no_business_impact");
    expect(checkFinding(finding({ recommendedFix: "" }), TODAY).reasons).toContain("no_fix");
  });
});

describe("partitionFindings", () => {
  it("splits shown from filtered", () => {
    const good = finding();
    const bad = finding({ id: "f2", evidence: { sourceType: "browser" } });
    const { shown, filtered } = partitionFindings([good, bad], TODAY);
    expect(shown.map((f) => f.id)).toEqual(["f1"]);
    expect(filtered.map((f) => f.id)).toEqual(["f2"]);
  });
});
