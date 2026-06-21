import type { AuditFinding } from "@/lib/types";

export type FindingAction =
  | "approve"
  | "edit"
  | "save to brain"
  | "create task"
  | "draft email"
  | "post to Slack"
  | "ignore";

export type ActionDraft = {
  action: FindingAction;
  title: string;
  body: string;
  status: "ready" | "needs_edit" | "saved" | "ignored";
  cta: string;
};

export function draftFindingAction(
  action: FindingAction,
  finding: AuditFinding
): ActionDraft {
  switch (action) {
    case "approve":
      return {
        action,
        title: "Approved fix",
        body: `Approved recommendation: ${finding.recommendedFix}`,
        status: "saved",
        cta: "Approved",
      };
    case "edit":
      return {
        action,
        title: "Edit recommendation",
        body: finding.recommendedFix,
        status: "needs_edit",
        cta: "Open editor",
      };
    case "save to brain":
      return {
        action,
        title: `Memory update: ${finding.title}`,
        body: [
          `Finding: ${finding.title}`,
          `Evidence: ${finding.evidence.quote ?? finding.pageUrl}`,
          `Decision: ${finding.recommendedFix}`,
        ].join("\n"),
        status: "ready",
        cta: "Save memory",
      };
    case "create task":
      return {
        action,
        title: `Task: ${finding.title}`,
        body: [
          finding.recommendedFix,
          "",
          `Page: ${finding.pageUrl}`,
          `Impact: ${finding.businessImpact}`,
        ].join("\n"),
        status: "ready",
        cta: "Create task",
      };
    case "draft email":
      return {
        action,
        title: `Email draft: ${finding.title}`,
        body: [
          "Hi team,",
          "",
          `Quad found a website gap on ${finding.pageUrl}. ${finding.businessImpact}`,
          "",
          `Recommended fix: ${finding.recommendedFix}`,
          "",
          "Can you review and approve this update?",
        ].join("\n"),
        status: "ready",
        cta: "Keep draft",
      };
    case "post to Slack":
      return {
        action,
        title: `Slack draft: ${finding.title}`,
        body: `Website audit finding: ${finding.title}\nImpact: ${finding.businessImpact}\nFix: ${finding.recommendedFix}`,
        status: "ready",
        cta: "Keep draft",
      };
    case "ignore":
      return {
        action,
        title: "Finding ignored",
        body: "This finding will stay out of the approved work queue.",
        status: "ignored",
        cta: "Ignored",
      };
  }
}

export function actionTone(status: ActionDraft["status"]): string {
  return {
    ready: "Ready for approval",
    needs_edit: "Needs human edit",
    saved: "Saved",
    ignored: "Ignored",
  }[status];
}
