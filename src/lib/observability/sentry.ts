import * as Sentry from "@sentry/nextjs";

export type QuadSpanTags = {
  orgId?: string;
  runId?: string;
  employeeId?: string;
  toolName?: string;
  model?: string;
  provider?: string;
  eventBackend?: string;
  auditLimit?: number;
};

/**
 * Wrap an async unit of work in a Sentry span and attach Quad's standard tags.
 * Used around route handlers, the audit worker, Browserbase sessions, Redis
 * publishes, and model/tool calls so every failure carries run context.
 */
export async function withSpan<T>(
  name: string,
  tags: QuadSpanTags,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan({ name, attributes: cleanTags(tags) }, async () => {
    try {
      return await fn();
    } catch (err) {
      Sentry.captureException(err, { tags: cleanTags(tags) });
      throw err;
    }
  });
}

/**
 * Record a handled failure (for example, a single page that failed to render)
 * without crashing the whole audit run.
 */
export function captureHandled(err: unknown, tags: QuadSpanTags): void {
  Sentry.captureException(err, { level: "warning", tags: cleanTags(tags) });
}

function cleanTags(tags: QuadSpanTags): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(tags)) {
    if (v !== undefined && v !== null) out[k] = v as string | number;
  }
  return out;
}
