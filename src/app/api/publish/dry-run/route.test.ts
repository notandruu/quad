import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { decideWorkflowApproval } from "@/lib/runs/approvalDecision";
import {
  addArtifact,
  createWorkflowRun,
  getRunSnapshot,
  requestApproval,
  summarizeTaskStream,
} from "@/lib/runs";
import { POST } from "./route";

describe("POST /api/publish/dry-run", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks approved publish staging when write connectors are not active for the org", async () => {
    clearHostedEnv();
    const run = await createApprovedRun("route_publish_blocked");

    const response = await POST(jsonRequest({ runId: run.runId, orgId: DEMO_ORG_ID }));
    const body = await response.json();
    const snapshot = getRunSnapshot(run.runId);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      code: "capability_blocked",
    });
    expect(snapshot?.artifacts.some((artifact) => artifact.kind === "cms_draft")).toBe(false);
    expect(summarizeTaskStream(snapshot!).filter((event) => event.kind === "task.blocked")).toHaveLength(2);
  });

  it("stages connector artifacts when write connectors are allowlisted and configured", async () => {
    clearHostedEnv();
    vi.stubEnv("QUAD_CAPABILITY_ALLOWLIST", "cms.publisher,task.publisher,trust_packet.exporter");
    vi.stubEnv("QUAD_CAPABILITY_FORCE_INSTALLED", "cms.publisher,task.publisher");
    vi.stubEnv("CMS_API_KEY", "cms_test");
    vi.stubEnv("LINEAR_API_KEY", "linear_test");
    const run = await createApprovedRun("route_publish_allowed");

    const response = await POST(jsonRequest({ runId: run.runId, orgId: DEMO_ORG_ID, actor: "route.test" }));
    const body = await response.json();
    const snapshot = getRunSnapshot(run.runId);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.staged.map((item: { artifact: { kind: string } }) => item.artifact.kind)).toEqual([
      "cms_draft",
      "task_draft",
      "trust_packet_export",
    ]);
    expect(snapshot?.receipts.filter((receipt) => receipt.status === "ready").length).toBeGreaterThanOrEqual(3);
    expect(summarizeTaskStream(snapshot!).filter((event) => event.kind === "task.completed")).toHaveLength(3);
  });
});

function clearHostedEnv() {
  vi.stubEnv("QUAD_API_SECRET", "");
  vi.stubEnv("QUAD_SERVICE_TOKENS", "");
  vi.stubEnv("QUAD_ALLOWED_ORGS", DEMO_ORG_ID);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_KEY", "");
  vi.stubEnv("QUAD_REDIS_REST_URL", "");
  vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
  vi.stubEnv("QUAD_CAPABILITY_ALLOWLIST", "");
  vi.stubEnv("QUAD_CAPABILITY_DISABLED", "");
  vi.stubEnv("QUAD_CAPABILITY_FORCE_INSTALLED", "");
  vi.stubEnv("CMS_API_KEY", "");
  vi.stubEnv("LINEAR_API_KEY", "");
}

async function createApprovedRun(runId: string): Promise<{ runId: string }> {
  const run = createWorkflowRun({
    id: runId,
    orgId: DEMO_ORG_ID,
    workflowKind: "trust_packet",
    title: "Enterprise proof trust packet",
    createdBy: "dashboard",
    targetUrl: "https://example.com",
    now: "2026-06-21T00:00:00.000Z",
  });
  const artifact = addArtifact({
    runId: run.id,
    kind: "trust_packet",
    title: "Enterprise proof trust packet",
    data: {
      targetUrl: "https://example.com",
      artifacts: [
        {
          title: "Missing security proof",
          summary: "Add a concise security proof block with controls and owner.",
        },
      ],
    },
    now: "2026-06-21T00:00:01.000Z",
  });
  const approval = requestApproval({
    runId: run.id,
    artifactId: artifact.id,
    reason: "Needs approval.",
    evidenceVisible: true,
    now: "2026-06-21T00:00:02.000Z",
  });
  await decideWorkflowApproval({
    runId: run.id,
    approvalId: approval.id,
    decision: "approved",
    approver: "route.test",
    now: "2026-06-21T00:00:03.000Z",
  });

  return { runId: run.id };
}

function jsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/publish/dry-run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
