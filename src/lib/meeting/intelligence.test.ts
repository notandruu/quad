import { describe, expect, it, vi } from "vitest";
import { getQuadChainPackets } from "@/lib/quad-chain/registry";
import { getRunSnapshot } from "@/lib/runs";
import { decideWorkflowApproval } from "@/lib/runs/approvalDecision";
import { learnFromMeeting } from "@/lib/skills/learnFromMeeting";
import { buildMeetingIntelligence, extractMeetingFollowups } from "./intelligence";

vi.mock("@/lib/brain/db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

vi.mock("@/lib/llm/anthropic", () => ({
  complete: vi.fn(async () => ""),
  auditModel: vi.fn(() => "claude-test"),
  extractJsonArray: vi.fn(() => []),
  extractJsonObject: vi.fn(() => null),
}));

vi.mock("@/lib/redis/publisher", () => ({
  publishAuditEvent: vi.fn(async (runId: string, type: string, payload: Record<string, unknown>) => ({
    id: `${runId}:${type}`,
    runId,
    type,
    ...payload,
  })),
}));

describe("meeting intelligence", () => {
  it("stages meeting-derived memory behind approval and emits quadchain packets", async () => {
    const result = await learnFromMeeting({
      orgId: "org_meeting_intelligence",
      runId: "meeting_intelligence_1",
      title: "Weekly launch meeting",
      writePolicy: "approval",
      utterances: [
        {
          speaker: "Maddy",
          text: "The virtual CPR page needs to go live before July first because the course already has twenty-four hundred completions.",
        },
      ],
      _extractOverride: async () => [
        {
          claim: "The virtual CPR page needs to go live before July first because the course already has twenty-four hundred completions.",
          category: "deadline",
          sourceQuote: "virtual CPR page needs to go live before July first",
        },
      ],
      _judgeOverride: async () => ({
        passed: true,
        durable: true,
        confidence: 0.93,
        reason: "grounded in transcript",
      }),
      _ingestOverride: vi.fn(async () => {
        throw new Error("approval mode should not write directly");
      }),
    });

    expect(result.learnedCount).toBe(0);
    expect(result.proposedCount).toBe(1);
    expect(result.facts[0]?.status).toBe("proposed");

    const intelligence = await buildMeetingIntelligence(result);
    const snapshot = getRunSnapshot(intelligence.runId);
    const packets = await getQuadChainPackets({ runId: intelligence.runId });

    expect(snapshot?.run.workflowKind).toBe("meeting_agent");
    expect(snapshot?.run.status).toBe("needs_approval");
    expect(intelligence.receipt.status).toBe("blocked");
    expect(intelligence.approval.decision).toBe("pending");
    expect(intelligence.artifacts.map((artifact) => artifact.kind)).toEqual(
      expect.arrayContaining(["meeting_transcript", "meeting_summary", "context_capture", "meeting_memory_proposal", "meeting_followup"])
    );
    expect(snapshot?.taskEvents.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["memory.candidate"])
    );
    expect(intelligence.packets.map((packet) => packet.type)).toEqual(
      expect.arrayContaining(["voice_transcript", "approval", "agent_handoff"])
    );
    expect(packets.every((packet) => packet.verification.accepted)).toBe(true);

    const approved = await decideWorkflowApproval({
      runId: intelligence.runId,
      approvalId: intelligence.approval.id,
      orgId: "org_meeting_intelligence",
      decision: "approved",
      approver: "stephen",
    });

    expect(approved.sideEffect?.kind).toBe("brain_memory_write");
    expect(approved.receipt.status).toBe("executed");
  });

  it("extracts followups from action-bearing meeting facts", () => {
    const followups = extractMeetingFollowups({
      runId: "meeting_followups_1",
      orgId: "org_meeting_followups",
      title: "Ops sync",
      transcript: "alex: the blood drive page needs an urgent update",
      learnedCount: 0,
      proposedCount: 1,
      rejectedCount: 0,
      summary: "Blood drive update needed.",
      facts: [
        {
          fact: {
            claim: "The blood drive page needs an urgent update before Saturday.",
            category: "deadline",
            sourceQuote: "blood drive page needs an urgent update",
          },
          status: "proposed",
          confidence: 0.9,
          sourceId: "meeting_fact:org:test",
        },
      ],
    });

    expect(followups[0]).toMatchObject({
      title: "Update blood drive proof on the site",
      status: "blocked",
      owner: "quad",
    });
  });
});
