import { describe, expect, it, vi } from "vitest";
import { getRunSnapshot, createWorkflowRun } from "@/lib/runs";
import { captureContextEvents, proposeContextCaptureWrites, summarizeContextCapture } from ".";

vi.mock("@/lib/brain/db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

describe("context capture", () => {
  it("classifies durable context signals and filters noise before writeback", () => {
    const run = createWorkflowRun({
      id: "run_context_capture_unit",
      orgId: "org_context_capture",
      workflowKind: "meeting_agent",
      title: "Context capture test",
      createdBy: "agent",
      now: "2026-06-21T00:00:00.000Z",
    });

    const capture = captureContextEvents({
      orgId: run.orgId,
      runId: run.id,
      sourceName: "meeting:test",
      now: "2026-06-21T00:00:00.000Z",
      events: [
        {
          id: "line_1",
          sourceType: "meeting",
          text: "Maddy: The security questionnaire must ship by July 1 and already has 24 approved controls.",
        },
        {
          id: "line_2",
          sourceType: "meeting",
          text: "okay sounds good",
        },
      ],
    });
    const summary = summarizeContextCapture(capture);
    const snapshot = getRunSnapshot(run.id);

    expect(capture.summary).toMatchObject({
      signalCount: 1,
      noiseCount: 1,
      suggestedWriteCount: 1,
    });
    expect(capture.signals[0]).toMatchObject({
      sourceType: "meeting",
      category: "deadline",
      suggestedVisibility: "company",
    });
    expect(capture.noise[0]).toMatchObject({ reason: "too_short" });
    expect(summary.latestSignals[0]).toMatchObject({
      sourceType: "meeting",
      category: "deadline",
    });
    expect(snapshot?.taskEvents.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["memory.candidate", "memory.noise"])
    );
  });

  it("stages captured signals as approval-backed memory proposals", async () => {
    const capture = captureContextEvents({
      orgId: "org_context_capture_proposal",
      sourceName: "voice:test",
      events: [
        {
          id: "voice_1",
          sourceType: "meeting",
          text: "Stephen: The SOC 2 audit response policy must cite approved packet receipts for every customer answer.",
        },
      ],
    });

    const result = await proposeContextCaptureWrites({ capture, limit: 1 });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].proposal).toMatchObject({
      ok: true,
      mode: "proposal",
      approval: {
        decision: "pending",
      },
      packet: {
        type: "approval",
        accepted: true,
      },
    });
  });
});
