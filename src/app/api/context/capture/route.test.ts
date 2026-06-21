import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/brain/db", () => ({
  ensureSchema: vi.fn(async () => undefined),
  getClient: vi.fn(() => null),
}));

describe("POST /api/context/capture", () => {
  it("returns signal/noise classification without writing by default", async () => {
    const response = await POST(jsonRequest({
      orgId: "org_redcross",
      sourceName: "route test",
      events: [
        {
          id: "event_1",
          sourceType: "meeting",
          text: "Maddy: The customer trust packet must include SOC 2 evidence by July 1.",
        },
        {
          id: "event_2",
          sourceType: "meeting",
          text: "thanks",
        },
      ],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      summary: {
        signalCount: 1,
        noiseCount: 1,
      },
      proposals: [],
    });
    expect(body.capture.signals[0]).toMatchObject({
      sourceType: "meeting",
      suggestedVisibility: "company",
    });
    expect(JSON.stringify(body)).not.toMatch(/sk-ant-|sk-proj-|postgres:\/\/|service_role|bb_live_|gQAAAA/);
  });

  it("can stage captured signals as approval-backed memory proposals", async () => {
    const response = await POST(jsonRequest({
      orgId: "org_redcross",
      sourceName: "proposal route test",
      proposeWrites: true,
      proposalLimit: 1,
      events: [
        {
          id: "event_1",
          sourceType: "meeting",
          text: "Stephen: Every security questionnaire answer must cite an approved quadchain receipt.",
        },
      ],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      summary: {
        signalCount: 1,
        suggestedWriteCount: 1,
      },
      proposals: [
        {
          approvalId: expect.stringMatching(/^approval_/),
          packet: {
            type: "approval",
            accepted: true,
          },
        },
      ],
    });
  });
});

function jsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/context/capture", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
