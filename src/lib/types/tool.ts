export type ToolStatus = "queued" | "running" | "succeeded" | "failed";

/**
 * Shared interface for every tool the runtime can invoke. Each tool call emits
 * Redis events and Sentry/Arize spans so the work is observable end to end.
 */
export type ToolCall = {
  id: string;
  orgId: string;
  employeeId: string;
  runId: string;
  name: string;
  input: unknown;
  status: ToolStatus;
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

/**
 * A tool implementation. Tools are pure functions over a typed input that
 * return a typed output; the runtime wraps them with eventing and tracing.
 */
export type Tool<TInput = unknown, TOutput = unknown> = {
  name: string;
  describe: string;
  run: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
};

export type ToolContext = {
  orgId: string;
  employeeId: string;
  runId: string;
};
