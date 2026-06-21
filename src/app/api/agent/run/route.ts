import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { validateAgentRunRequest, type AgentRunRequestBody } from "@/lib/agent/runRequest";
import { runQuadCoreCommand } from "@/lib/core/run";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * External-agent bridge for Fetch/Agentverse-style callers. The route keeps the
 * public agent response shape stable, but delegates execution to Quad Core so
 * agent, dashboard, chat, voice, and future cli surfaces share one runtime
 * contract.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as AgentRunRequestBody;
  const validation = validateAgentRunRequest({
    body,
    headers: req.headers,
    defaultOrgId: DEMO_ORG_ID,
    env: process.env,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  try {
    const result = await runQuadCoreCommand({
      command: "queue_audit",
      orgId: validation.orgId,
      targetUrl: validation.targetUrl,
      workflow: validation.workflow,
      limit: validation.limit,
      surface: "fetch_agent",
      createdBy: "agent",
    });
    if (result.command !== "queue_audit") {
      throw new Error("agent run expected queued audit result");
    }

    return NextResponse.json({
      agent: "quad",
      workflow: validation.workflow,
      summary: result.task,
      quadChain: result.quadChain,
      runtime: result.runtime,
      agentLoop: result.agentLoop,
      job: result.job,
      mode: result.mode,
    });
  } catch (err) {
    return NextResponse.json(
      {
        agent: "quad",
        workflow: validation.workflow,
        summary: null,
        quadChain: [],
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
