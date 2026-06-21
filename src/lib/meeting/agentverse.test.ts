import { afterEach, describe, expect, it, vi } from "vitest";
import { runMeetingAgentverseHandoff } from "./agentverse";

describe("meeting agentverse handoff", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes meeting follow-up work through the fetch agent bridge", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const events: string[] = [];
    const handoff = await runMeetingAgentverseHandoff({
      orgId: "org_meeting_agentverse",
      meetingRunId: "meeting_agentverse_test",
      targetUrl: "https://example.com/",
      workflow: "enterprise_proof",
      onEvent: (event) => events.push(event.type),
    });

    expect(events).toEqual(["meeting.agentverse.started", "meeting.agentverse.completed"]);
    expect(handoff.surface).toBe("fetch_agent");
    expect(handoff.workflow).toBe("enterprise_proof");
    expect(handoff.jobStatus).toBe("queued");
    expect(handoff.selectedTools).toContain("fetch.agent_bridge");
    expect(handoff.quadChain).toMatchObject({
      type: "agent_handoff",
      accepted: true,
    });
  });
});
