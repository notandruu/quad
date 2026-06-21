import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { runQuadCoreCommand } from "@/lib/core/run";
import type { BrainMemoryRequester } from "@/lib/brain/permissions";

export const runtime = "nodejs";
// Grounded chat makes a model call; give it headroom over the serverless default.
export const maxDuration = 60;

/**
 * Chat is now a surface over the shared Quad Core command facade. The route
 * keeps the dashboard response contract stable while the runtime path is shared
 * with future voice, fetch, cli, and agent surfaces.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text : "";

  try {
    const result = await runQuadCoreCommand({
      command: "chat",
      orgId: typeof body.orgId === "string" ? body.orgId : DEMO_ORG_ID,
      employeeId: typeof body.employeeId === "string" ? body.employeeId : undefined,
      runId: typeof body.runId === "string" ? body.runId : undefined,
      text,
      pinnedUrl: typeof body.pinnedUrl === "string" ? body.pinnedUrl : undefined,
      hasActiveAudit: body.hasActiveAudit === true,
      surface: "chat",
      requester: buildMemoryRequester(body),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        message: "I hit an error answering that. Try again in a moment.",
      },
      { status: /required/.test(message) ? 400 : 500 }
    );
  }
}

function buildMemoryRequester(body: Record<string, unknown>): BrainMemoryRequester | undefined {
  const userId = typeof body.userId === "string" ? body.userId : undefined;
  const teamIds = Array.isArray(body.teamIds)
    ? body.teamIds.map(String)
    : typeof body.teamId === "string"
      ? [body.teamId]
      : undefined;
  const includePersonal = body.includePersonal === true;
  if (!userId && !teamIds?.length && !includePersonal) return undefined;
  return { userId, teamIds, includePersonal };
}
