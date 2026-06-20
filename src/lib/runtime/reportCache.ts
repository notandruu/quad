import type { AuditReport } from "@/lib/types";

// Attach to globalThis so the cache survives Next.js dev-mode module reloads
// and is shared across all route handlers in the same Node.js process.
const g = globalThis as typeof globalThis & { __kaliReportCache?: Map<string, AuditReport> };
if (!g.__kaliReportCache) g.__kaliReportCache = new Map();
const cache = g.__kaliReportCache;

export function cacheReport(report: AuditReport): void {
  cache.set(report.runId, report);
  // Keep at most 20 reports so this doesn't grow unbounded.
  if (cache.size > 20) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

export function getCachedReport(runId: string): AuditReport | null {
  return cache.get(runId) ?? null;
}
