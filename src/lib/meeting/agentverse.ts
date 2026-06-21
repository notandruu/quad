import { runQuadCoreCommand } from "@/lib/core/run";
import type { QuadChainPacketSummary } from "@/lib/quad-chain";
import { publishAuditEvent, type PublishedEvent } from "@/lib/redis/publisher";

export type MeetingAgentverseHandoff = {
  targetUrl: string;
  workflow: "enterprise_proof" | "website_audit";
  surface: "fetch_agent";
  queuedRunId: string;
  jobId: string;
  jobStatus: string;
  selectedTools: string[];
  missingCapabilities: string[];
  quadChain: QuadChainPacketSummary | null;
};

export type MeetingAgentverseHandoffInput = {
  orgId: string;
  meetingRunId: string;
  targetUrl: string;
  workflow?: "enterprise_proof" | "website_audit";
  limit?: number;
  onEvent?: (event: PublishedEvent) => void;
};

export async function runMeetingAgentverseHandoff(
  input: MeetingAgentverseHandoffInput
): Promise<MeetingAgentverseHandoff> {
  const workflow = input.workflow ?? "enterprise_proof";
  await emit(input, "meeting.agentverse.started", {
    detail: "Meeting agent handed the transcript summary to Agentverse / ASI:One.",
    targetUrl: input.targetUrl,
    workflow,
    surface: "fetch_agent",
  });

  try {
    const result = await runQuadCoreCommand({
      command: "queue_audit",
      orgId: input.orgId,
      targetUrl: input.targetUrl,
      workflow,
      limit: input.limit ?? 3,
      surface: "fetch_agent",
      createdBy: "agent",
    });
    if (result.command !== "queue_audit") {
      throw new Error("Agentverse handoff expected queued audit result.");
    }

    const handoff: MeetingAgentverseHandoff = {
      targetUrl: input.targetUrl,
      workflow,
      surface: "fetch_agent",
      queuedRunId: result.runId,
      jobId: result.job.id,
      jobStatus: result.job.status,
      selectedTools: result.runtime.selectedTools,
      missingCapabilities: result.runtime.missingCapabilities.map((capability) => capability.id),
      quadChain: result.quadChain[0] ?? result.agentLoop.quadChain ?? null,
    };

    await emit(input, "meeting.agentverse.completed", {
      ...handoff,
      detail: "Fetch agent bridge queued the next enterprise proof run.",
    });

    return handoff;
  } catch (error) {
    await emit(input, "meeting.agentverse.failed", {
      detail: error instanceof Error ? error.message : String(error),
      targetUrl: input.targetUrl,
      workflow,
      surface: "fetch_agent",
    });
    throw error;
  }
}

async function emit(
  input: MeetingAgentverseHandoffInput,
  type: "meeting.agentverse.started" | "meeting.agentverse.completed" | "meeting.agentverse.failed",
  payload: Record<string, unknown>
) {
  const event = await publishAuditEvent(input.meetingRunId, type, payload, { orgId: input.orgId });
  if (event) input.onEvent?.(event);
}
