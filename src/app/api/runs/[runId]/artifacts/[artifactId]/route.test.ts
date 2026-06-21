import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addArtifact, createWorkflowRun } from "@/lib/runs";
import { GET } from "./route";

describe("GET /api/runs/[runId]/artifacts/[artifactId]", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps raw artifact data behind admin secret auth", async () => {
    vi.stubEnv("QUAD_API_SECRET", "admin-secret");
    vi.stubEnv("QUAD_ALLOWED_ORGS", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", JSON.stringify([
      {
        token: "artifact-reader-token",
        orgs: ["org_artifact_route"],
        scopes: ["jobs:read"],
      },
    ]));
    const { runId, artifactId } = createArtifactFixture();

    const serviceResponse = await GET(authRequest("artifact-reader-token", "raw=1"), {
      params: { runId, artifactId },
    });
    const serviceBody = await serviceResponse.json();

    expect(serviceResponse.status).toBe(403);
    expect(serviceBody).toMatchObject({
      code: "raw_artifact_requires_secret",
    });

    const adminResponse = await GET(authRequest("admin-secret", "raw=1"), {
      params: { runId, artifactId },
    });
    const adminBody = await adminResponse.json();

    expect(adminResponse.status).toBe(200);
    expect(adminBody.artifact.rawDataIncluded).toBe(true);
    expect(JSON.stringify(adminBody.artifact.data)).toContain("customer-private-proof");
  });

  it("redacts artifact data by default", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", JSON.stringify([
      {
        token: "artifact-preview-token",
        orgs: ["org_artifact_route"],
        scopes: ["jobs:read"],
      },
    ]));
    const { runId, artifactId } = createArtifactFixture("run_artifact_preview");

    const response = await GET(authRequest("artifact-preview-token"), {
      params: { runId, artifactId },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.artifact.rawDataIncluded).toBe(false);
    expect(JSON.stringify(body)).not.toContain("customer-private-proof");
  });
});

function createArtifactFixture(runId = "run_artifact_raw"): { runId: string; artifactId: string } {
  const run = createWorkflowRun({
    id: runId,
    orgId: "org_artifact_route",
    workflowKind: "website_audit",
    title: "Artifact run",
    createdBy: "dashboard",
    now: "2026-06-21T00:00:00.000Z",
  });
  const artifact = addArtifact({
    runId: run.id,
    kind: "trust_packet",
    title: "Private artifact",
    data: {
      evidence: "customer-private-proof",
      publicSummary: "safe summary",
    },
    now: "2026-06-21T00:00:00.000Z",
  });

  return { runId: run.id, artifactId: artifact.id };
}

function authRequest(token: string, search = ""): NextRequest {
  const suffix = search ? `?${search}` : "";
  return new NextRequest(`http://localhost/api/runs/test/artifacts/test${suffix}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}
