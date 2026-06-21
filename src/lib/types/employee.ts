export type EmployeeRole =
  | "chief_of_staff"
  | "growth"
  | "support"
  | "fundraising"
  | "ops";

/**
 * How loudly the employee participates. Start conservative.
 */
export type CommunicationMode =
  | "silent"
  | "on_demand"
  | "suggestive"
  | "active";

/**
 * What the employee is allowed to do without a human in the loop.
 * MVP ships approval_required.
 */
export type ActionMode =
  | "read_only"
  | "draft_only"
  | "approval_required"
  | "autonomous";

export type ToolPermission = {
  toolName: string;
  actionMode: ActionMode;
};

export type QuadEmployee = {
  id: string;
  orgId: string;
  name: string;
  role: EmployeeRole;
  mission: string;
  tools: ToolPermission[];
  memoryScopes: string[];
  communicationMode: CommunicationMode;
  actionMode: ActionMode;
  tone: string;
  createdAt: string;
  updatedAt: string;
};
