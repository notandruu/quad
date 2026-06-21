import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { dryRunPublish } from "@/lib/fde/publisher";
import {
  addArtifact,
  createWorkflowRun,
  getRunSnapshot,
  requestApproval,
  summarizeTaskStream,
} from "@/lib/runs";
import { decideWorkflowApproval } from "@/lib/runs/approvalDecision";
import { POST } from "./route";

describe("POST /api/publish/execute", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks execution when staged write connectors are not active for the org", async () => {
    clearHostedEnv();
    const run = await createApprovedRun("route_execute_blocked");
    await dryRunPublish({
      runId: run.runId,
      orgId: DEMO_ORG_ID,
      env: publisherEnv(),
    });
    clearHostedEnv();

    const response = await POST(jsonRequest({ runId: run.runId, orgId: DEMO_ORG_ID }));
    const body = await response.json();
    const snapshot = getRunSnapshot(run.runId);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      code: "capability_blocked",
    });
    expect(snapshot?.artifacts.some((artifact) => artifact.kind === "connector_execution")).toBe(false);
    expect(summarizeTaskStream(snapshot!).filter((event) => event.kind === "task.blocked")).toHaveLength(2);
  });

  it("executes staged connector artifacts when approval and connectors are present", async () => {
    clearHostedEnv();
    installPublisherEnv();
    const run = await createApprovedRun("route_execute_allowed");
    await dryRunPublish({
      runId: run.runId,
      orgId: DEMO_ORG_ID,
      actor: "route.test",
      env: publisherEnv(),
    });

    const response = await POST(jsonRequest({ runId: run.runId, orgId: DEMO_ORG_ID, actor: "route.test" }));
    const body = await response.json();
    const snapshot = getRunSnapshot(run.runId);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.executed.map((item: { artifact: { kind: string } }) => item.artifact.kind)).toEqual([
      "connector_execution",
      "connector_execution",
      "connector_execution",
    ]);
    expect(snapshot?.artifacts.find((artifact) => artifact.kind === "connector_execution")?.data).toMatchObject({
      schemaVersion: "quad.connector_execution.v1",
      connector: { mode: "approved_execution" },
      dryRun: false,
      postExecutionVerification: { required: true },
    });
    expect(snapshot?.receipts.filter((receipt) => receipt.status === "executed").length).toBeGreaterThanOrEqual(3);
    expect(summarizeTaskStream(snapshot!).filter((event) => event.kind === "task.completed")).toHaveLength(6);
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

function installPublisherEnv() {
  vi.stubEnv("QUAD_CAPABILITY_ALLOWLIST", "cms.publisher,task.publisher,trust_packet.exporter");
  vi.stubEnv("QUAD_CAPABILITY_FORCE_INSTALLED", "cms.publisher,task.publisher");
  vi.stubEnv("CMS_API_KEY", "cms_test");
  vi.stubEnv("LINEAR_API_KEY", "linear_test");
}

function publisherEnv() {
  return {
    QUAD_CAPABILITY_ALLOWLIST: "cms.publisher,task.publisher,trust_packet.exporter",
    QUAD_CAPABILITY_FORCE_INSTALLED: "cms.publisher,task.publisher",
    CMS_API_KEY: "cms_test",
    LINEAR_API_KEY: "linear_test",
  };
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
  return new NextRequest("http://localhost/api/publish/execute", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
