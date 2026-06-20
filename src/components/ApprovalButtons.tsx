"use client";

import type { FindingAction } from "@/lib/debug/actionDrafts";

/** Approval-first action bar. No external action fires without a click here. */
const ACTIONS = [
  { value: "approve", label: "Approve" },
  { value: "edit", label: "Edit" },
  { value: "save to brain", label: "Save to brain" },
  { value: "create task", label: "Create task" },
  { value: "draft email", label: "Draft email" },
  { value: "post to Slack", label: "Post to Slack" },
  { value: "ignore", label: "Ignore" },
] as const;

export function ApprovalButtons({
  onAction,
}: {
  onAction?: (action: FindingAction) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((a) => (
        <button
          key={a.value}
          onClick={() => onAction?.(a.value)}
          className="rounded-md border border-edge bg-panel px-2.5 py-1 text-xs text-neutral-300 hover:border-accent/40 hover:text-accent"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
