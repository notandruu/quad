"use client";

/** Approval-first action bar. No external action fires without a click here. */
const ACTIONS = [
  "approve",
  "edit",
  "save to brain",
  "create task",
  "draft email",
  "post to Slack",
  "ignore",
] as const;

export function ApprovalButtons({
  onAction,
}: {
  onAction?: (action: (typeof ACTIONS)[number]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((a) => (
        <button
          key={a}
          onClick={() => onAction?.(a)}
          className="rounded-md border border-edge bg-panel px-2.5 py-1 text-xs text-neutral-300 hover:border-accent/40 hover:text-accent"
        >
          {a}
        </button>
      ))}
    </div>
  );
}
