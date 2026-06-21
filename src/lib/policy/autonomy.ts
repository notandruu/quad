export type AutonomyTier =
  | "tier_0_observe"
  | "tier_1_draft"
  | "tier_2_confirm"
  | "tier_3_approve"
  | "tier_4_restricted";

export type AutonomyPolicy = {
  tier: AutonomyTier;
  label: string;
  approvalRequired: boolean;
  humanReviewRequired: boolean;
  submitsExternally: boolean;
  reversible: boolean;
  nextTier?: AutonomyTier;
  receiptRequired: boolean;
};

const POLICY: Record<AutonomyTier, Omit<AutonomyPolicy, "reversible" | "nextTier">> = {
  tier_0_observe: {
    tier: "tier_0_observe",
    label: "observe only",
    approvalRequired: false,
    humanReviewRequired: false,
    submitsExternally: false,
    receiptRequired: true,
  },
  tier_1_draft: {
    tier: "tier_1_draft",
    label: "draft only",
    approvalRequired: true,
    humanReviewRequired: true,
    submitsExternally: false,
    receiptRequired: true,
  },
  tier_2_confirm: {
    tier: "tier_2_confirm",
    label: "draft and confirm",
    approvalRequired: true,
    humanReviewRequired: true,
    submitsExternally: false,
    receiptRequired: true,
  },
  tier_3_approve: {
    tier: "tier_3_approve",
    label: "explicit approve",
    approvalRequired: true,
    humanReviewRequired: true,
    submitsExternally: true,
    receiptRequired: true,
  },
  tier_4_restricted: {
    tier: "tier_4_restricted",
    label: "restricted irreversible",
    approvalRequired: true,
    humanReviewRequired: true,
    submitsExternally: true,
    receiptRequired: true,
  },
};

export function buildAutonomyPolicy(input: {
  tier: AutonomyTier;
  reversible: boolean;
  nextTier?: AutonomyTier;
}): AutonomyPolicy {
  return {
    ...POLICY[input.tier],
    reversible: input.reversible,
    nextTier: input.nextTier,
  };
}

export function validateAutonomyPolicy(policy: AutonomyPolicy): Array<{ id: string; passed: boolean; detail: string }> {
  return [
    {
      id: "autonomy_receipt_required",
      passed: policy.receiptRequired,
      detail: "Every customer-impacting action must leave a receipt.",
    },
    {
      id: "external_submit_requires_tier_3",
      passed: !policy.submitsExternally || policy.tier === "tier_3_approve" || policy.tier === "tier_4_restricted",
      detail: policy.submitsExternally
        ? "External submit is only allowed at explicit approval tiers."
        : "This action does not submit externally.",
    },
    {
      id: "human_gate_for_approval_tiers",
      passed: !policy.approvalRequired || policy.humanReviewRequired,
      detail: "Approval-required actions must keep a human review gate.",
    },
  ];
}
