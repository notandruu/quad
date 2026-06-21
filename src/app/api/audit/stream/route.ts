import { NextRequest } from "next/server";
import { runAudit } from "@/lib/tools/auditAnalyzer";
import { getEmployee } from "@/lib/employees";
import { DEMO_ORG_ID } from "@/data/seed";
import { cacheReport } from "@/lib/runtime/reportCache";

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
        // Pass onEvent so every published event is forwarded to the SSE
        // client immediately as it happens rather than replayed at the end.
        const report = await runAudit({
          orgId,
          runId,
          targetUrl,
          limit,
          onEvent: (e) => send(e),
        });
        cacheReport(report);
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
      // Stop nginx/edge proxies from buffering the stream into one burst,
      // which would defeat the live event animation on a hosted demo.
      "x-accel-buffering": "no",
    },
  });
}
