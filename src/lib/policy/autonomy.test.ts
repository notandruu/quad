import { describe, expect, it } from "vitest";
import { buildAutonomyPolicy, validateAutonomyPolicy } from "./autonomy";

describe("autonomy policy", () => {
  it("allows tier 2 browser confirmation without external submit", () => {
    const policy = buildAutonomyPolicy({
      tier: "tier_2_confirm",
      reversible: true,
      nextTier: "tier_3_approve",
    });

    expect(policy).toMatchObject({
      label: "draft and confirm",
      approvalRequired: true,
      humanReviewRequired: true,
      submitsExternally: false,
      nextTier: "tier_3_approve",
    });
    expect(validateAutonomyPolicy(policy).every((check) => check.passed)).toBe(true);
  });

  it("rejects external submit below explicit approval tiers", () => {
    const checks = validateAutonomyPolicy({
      ...buildAutonomyPolicy({ tier: "tier_2_confirm", reversible: true }),
      submitsExternally: true,
    });

    expect(checks.find((check) => check.id === "external_submit_requires_tier_3")).toMatchObject({
      passed: false,
    });
  });
});
