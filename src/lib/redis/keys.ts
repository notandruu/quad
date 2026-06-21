/**
 * Centralized Redis key builders. Keep every key shape here so the event
 * spine stays consistent across publisher, replay, and counters.
 */
import { tenantKey } from "@/lib/security";

export const streamKeys = {
  auditEvents: (runId: string) => `audit:run:${runId}:events`,
  employeeEvents: (employeeId: string) => `employee:${employeeId}:events`,
  voiceEvents: (sessionId: string) => `voice:session:${sessionId}:events`,
  toolEvents: (toolRunId: string) => `tool:run:${toolRunId}:events`,
};

export const metaKeys = {
  auditRun: (runId: string) => `audit:run:${runId}:meta`,
  employeeActiveSession: (employeeId: string) =>
    `employee:${employeeId}:active_session`,
  voiceSession: (sessionId: string) => `voice:session:${sessionId}:meta`,
};

export const counterKeys = {
  pagesDiscovered: (runId: string) => `audit:run:${runId}:pages_discovered`,
  pagesFetched: (runId: string) => `audit:run:${runId}:pages_fetched`,
  pagesAnalyzed: (runId: string) => `audit:run:${runId}:pages_analyzed`,
  findingsCreated: (runId: string) => `audit:run:${runId}:findings_created`,
  failures: (runId: string) => `audit:run:${runId}:failures`,
};

export type CounterName = keyof typeof counterKeys;

export const tenantScopedKeys = {
  auditEvents: (orgId: string, runId: string) => tenantKey(orgId, "audit", "run", runId, "events"),
  auditRun: (orgId: string, runId: string) => tenantKey(orgId, "audit", "run", runId, "meta"),
  pagesDiscovered: (orgId: string, runId: string) =>
    tenantKey(orgId, "audit", "run", runId, "pages_discovered"),
  modelCall: (orgId: string, requestId: string) => tenantKey(orgId, "model", "call", requestId),
  approval: (orgId: string, approvalId: string) => tenantKey(orgId, "approval", approvalId),
};
