import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { executeApprovedPublish } from "@/lib/fde/execution";
import { dryRunPublish } from "@/lib/fde/publisher";
import {
  addArtifact,
  createWorkflowRun,
  deleteRunSnapshots,
  requestApproval,
} from "@/lib/runs";
import { decideWorkflowApproval } from "@/lib/runs/approvalDecision";
import { GET } from "./route";

describe("GET /api/operator", () => {
  let createdRunId: string | null = null;

  afterEach(async () => {
    if (createdRunId) await deleteRunSnapshots({ orgId: DEMO_ORG_ID, runId: createdRunId });
    createdRunId = null;
    vi.unstubAllEnvs();
  });

  it("surfaces a safe browser-action outcome summary for approved executions", async () => {
    clearHostedEnv();
    installPublisherEnv();
    const run = await createApprovedRun(`operator_outcome_${crypto.randomUUID()}`);
    createdRunId = run.runId;
    await dryRunPublish({
      runId: run.runId,
      orgId: DEMO_ORG_ID,
      actor: "operator.test",
      env: publisherEnv(),
    });
    await executeApprovedPublish({
      runId: run.runId,
      orgId: DEMO_ORG_ID,
      actor: "operator.test",
      env: publisherEnv(),
      now: "2026-06-21T00:00:04.000Z",
    });

    const response = await GET(new Request(`http://localhost/api/operator?orgId=${DEMO_ORG_ID}&limit=5`));
    const body = await response.json();
    const artifact = body.artifacts.find((item: { outcome?: { target?: { connectorId?: string } } }) =>
      item.outcome?.target?.connectorId === "browserbase.write_browser" || item.outcome?.target?.connectorId === "cms.publisher"
    );

    expect(response.status).toBe(200);
    expect(artifact?.outcome).toMatchObject({
      submitted: false,
      evidence: [
        expect.objectContaining({ label: "Before capture", storageMode: "external_provider" }),
        expect.objectContaining({ label: "After capture", storageMode: "external_provider" }),
      ],
      fields: [
        expect.objectContaining({ label: "section title", valueHash: expect.stringMatching(/^fnv1a:/) }),
        expect.objectContaining({ label: "section body", valueHash: expect.stringMatching(/^fnv1a:/) }),
      ],
      verifier: expect.objectContaining({ required: true }),
      autonomy: expect.objectContaining({
        tier: "tier_2_confirm",
        label: "draft and confirm",
        submitsExternally: false,
        nextTier: "tier_3_approve",
      }),
      openObligations: expect.arrayContaining(["Human must review the filled browser session before final submit."]),
    });
    expect(body.usage).toMatchObject({
      posture: {
        source: "receipt_sample",
      },
      totals: {
        runs: expect.any(Number),
        connectorActions: expect.any(Number),
        quadchainPackets: expect.any(Number),
        evidenceBundles: expect.any(Number),
        modelCalls: expect.any(Number),
        estimatedCostUsd: expect.any(Number),
      },
    });
    expect(body.capabilities.catalog).toMatchObject({
      total: expect.any(Number),
      active: expect.any(Number),
      writeCapable: expect.any(Number),
      starterBundle: {
        total: expect.any(Number),
        active: expect.any(Number),
      },
    });
    expect(body.capabilities.catalog.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "browserbase.write_browser",
          active: true,
          stateLabel: "active",
        }),
      ])
    );
    expect(JSON.stringify(body)).not.toMatch(/cms_test|linear_test|section body value|sk-ant-|sk-proj-/);
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
  vi.stubEnv("QUAD_CAPABILITY_ALLOWLIST", "cms.publisher,task.publisher,trust_packet.exporter,browserbase.write_browser");
  vi.stubEnv("QUAD_CAPABILITY_FORCE_INSTALLED", "cms.publisher,task.publisher,browserbase.write_browser");
  vi.stubEnv("CMS_API_KEY", "cms_test");
  vi.stubEnv("LINEAR_API_KEY", "linear_test");
  vi.stubEnv("BROWSERBASE_API_KEY", "bb_test");
  vi.stubEnv("BROWSERBASE_PROJECT_ID", "browserbase_project_test");
}

function publisherEnv() {
  return {
    QUAD_CAPABILITY_ALLOWLIST: "cms.publisher,task.publisher,trust_packet.exporter,browserbase.write_browser",
    QUAD_CAPABILITY_FORCE_INSTALLED: "cms.publisher,task.publisher,browserbase.write_browser",
    CMS_API_KEY: "cms_test",
    LINEAR_API_KEY: "linear_test",
    BROWSERBASE_API_KEY: "bb_test",
    BROWSERBASE_PROJECT_ID: "browserbase_project_test",
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
    approver: "operator.test",
    now: "2026-06-21T00:00:03.000Z",
  });

  return { runId: run.id };
}
