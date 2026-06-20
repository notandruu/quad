export * from "./discover";
export * from "./fetchPage";
export * from "./browserbase";
export * from "./auditAnalyzer";
export * from "./actions";

import { runAudit } from "./auditAnalyzer";
import { renderPage } from "./browserbase";
import { retrieveMemories } from "@/lib/brain";
import { createTask, draftFaq, draftSlack, saveToBrain } from "./actions";

/**
 * Tool registry. The runtime router looks up tools by name; each entry also
 * carries the action mode so the permission checker can gate it.
 */
export const TOOLS = {
  audit_website: { actionMode: "read_only", run: runAudit },
  render_page: { actionMode: "read_only", run: renderPage },
  brain_retrieve: { actionMode: "read_only", run: retrieveMemories },
  create_task: { actionMode: "approval_required", run: createTask },
  draft_faq: { actionMode: "draft_only", run: draftFaq },
  draft_slack: { actionMode: "draft_only", run: draftSlack },
  save_memory: { actionMode: "approval_required", run: saveToBrain },
} as const;

export type ToolName = keyof typeof TOOLS;
