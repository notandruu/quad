import { NextRequest } from "next/server";
import { runAudit } from "@/lib/tools/auditAnalyzer";
import { replayAuditEvents } from "@/lib/redis";
import { getEmployee } from "@/lib/employees";
import { DEMO_ORG_ID } from "@/data/seed";

export const runtime = "nodejs";
// Audits can run longer than the default serverless budget.
export const maxDuration = 300;

/**
 * Start an audit and stream live events back to the client over SSE. The same
 * events are persisted to Redis so the log survives a refresh (see the events
 * replay route).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const orgId: string = body.orgId ?? DEMO_ORG_ID;
  const targetUrl: string = body.targetUrl;
  const limit: number = body.limit ?? 12;
  const runId: string = body.runId ?? crypto.randomUUID();
  getEmployee(body.employeeId);

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "targetUrl required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      send({ type: "run.created", runId, targetUrl });

      try {
        // The worker publishes to Redis; we poll the stream and forward new
        // events so the client sees them live. Kept simple for the scaffold.
        const report = await runAudit({ orgId, runId, targetUrl, limit });
        const events = await replayAuditEvents(runId);
        for (const e of events) send(e);
        send({ type: "audit.report", report });
      } catch (err) {
        send({ type: "audit.failed", error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
