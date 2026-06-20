/**
 * Intents the employee runtime can classify. MVP intents are listed first;
 * the rest are roadmap and should route to a "not yet supported" response.
 */
export type Intent =
  | "general_chat"
  | "company_question"
  | "website_audit"
  | "audit_follow_up"
  | "draft_content"
  | "create_task"
  | "summarize_meeting"
  | "save_memory"
  // roadmap
  | "send_email"
  | "post_slack"
  | "update_crm"
  | "schedule_meeting";

export const MVP_INTENTS: Intent[] = [
  "general_chat",
  "company_question",
  "website_audit",
  "audit_follow_up",
  "draft_content",
  "create_task",
  "summarize_meeting",
  "save_memory",
];

export type AgentHandoff = {
  id: string;
  fromAgent: string;
  toAgent: string;
  runId: string;
  task: string;
  context: string;
  requiredOutputSchema: string;
  deadline?: string;
  status: "requested" | "accepted" | "completed" | "failed";
};
