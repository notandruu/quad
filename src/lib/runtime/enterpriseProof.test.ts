import { describe, expect, it } from "vitest";
import { classifyEnterpriseProofPrompt, formatEnterpriseProofMessage } from "./enterpriseProof";

describe("enterprise proof prompt helpers", () => {
  it("detects questionnaire and security-control prompts", () => {
    expect(classifyEnterpriseProofPrompt("answer this security questionnaire: do we enforce MFA?")).toBe("trust_question");
    expect(classifyEnterpriseProofPrompt("Do you have incident response coverage?")).toBe("trust_question");
    expect(classifyEnterpriseProofPrompt("hello quad")).toBe("general");
  });

  it("formats learned, reused, and needs-human states for chat", () => {
    expect(formatEnterpriseProofMessage({
      status: "answered",
      answer: "Yes, MFA is enforced.",
      confidence: 0.91,
      sourceCount: 3,
      brainGrowth: {
        status: "learned",
        memoryId: "mem_1",
        title: "MFA answer",
        visibility: "company",
        approvalRequired: true,
      },
    })).toContain("Learned a company memory");

    expect(formatEnterpriseProofMessage({
      status: "answered",
      answer: "Yes, MFA is enforced.",
      confidence: 0.91,
      sourceCount: 3,
      brainGrowth: {
        status: "reused",
        memoryId: "mem_1",
        title: "MFA answer",
        visibility: "company",
        approvalRequired: false,
      },
    })).toContain("Reused verified memory");

    expect(formatEnterpriseProofMessage({
      status: "needs_human",
      sourceCount: 0,
    })).toContain("Needs human evidence");
  });
});
