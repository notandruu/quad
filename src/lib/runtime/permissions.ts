import type { ActionMode, KaliEmployee, Intent } from "@/lib/types";

/** Intents that perform an external-facing action and need approval first. */
const EXTERNAL_ACTION_INTENTS: Intent[] = [
  "send_email",
  "post_slack",
  "update_crm",
  "schedule_meeting",
];

export type PermissionDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
};

/**
 * Conservative permission model. MVP employees run approval_required: they can
 * read, draft, and propose, but external actions always need a human approval.
 */
export function checkPermission(
  employee: KaliEmployee,
  intent: Intent
): PermissionDecision {
  const external = EXTERNAL_ACTION_INTENTS.includes(intent);

  if (external && employee.actionMode !== "autonomous") {
    return {
      allowed: true,
      requiresApproval: true,
      reason: "external_action_needs_approval",
    };
  }

  if (employee.actionMode === "read_only" && intent !== "company_question" && intent !== "general_chat") {
    return { allowed: false, requiresApproval: false, reason: "read_only_employee" };
  }

  return { allowed: true, requiresApproval: false };
}

export function defaultActionMode(): ActionMode {
  return "approval_required";
}
