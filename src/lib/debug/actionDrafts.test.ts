import { describe, expect, it } from "vitest";
import type { AuditFinding } from "@/lib/types";
import { actionTone, draftFindingAction } from "./actionDrafts";

const finding: AuditFinding = {
  id: "finding_1",
  runId: "run_1",
  pageUrl: "https://redcross.example/programs",
  title: "Scholarship support is missing",
  category: "missing_public_explanation",
  severity: "medium",
  confidence: 0.87,
  evidence: {
    quote: "Youth mentorship",
    sourceType: "comparison",
  },
  reasoning: "The internal brain lists scholarship support.",
  businessImpact: "Families cannot find tuition help.",
  recommendedFix: "Add a scholarship support section with eligibility and deadlines.",
};

describe("draftFindingAction", () => {
  it("creates a task draft with page and impact context", () => {
    const draft = draftFindingAction("create task", finding);
    expect(draft.title).toBe("Task: Scholarship support is missing");
    expect(draft.body).toContain("https://redcross.example/programs");
    expect(draft.body).toContain("Families cannot find tuition help.");
    expect(draft.status).toBe("ready");
  });

  it("creates an approval-safe email draft", () => {
    const draft = draftFindingAction("draft email", finding);
    expect(draft.body).toContain("Hi team,");
    expect(draft.body).toContain("Recommended fix:");
    expect(draft.cta).toBe("Keep draft");
  });

  it("never turns ignored findings into ready work", () => {
    const draft = draftFindingAction("ignore", finding);
    expect(draft.status).toBe("ignored");
    expect(actionTone(draft.status)).toBe("Ignored");
  });
});
