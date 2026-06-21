import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkflowRun } from "@/lib/runs";
import { authorizeRunAccess } from "./access";

describe("run access authorization", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides existing runs from service tokens scoped to another org", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", JSON.stringify([
      {
        token: "other-org-token",
        orgs: ["org_other"],
        scopes: ["jobs:read"],
      },
    ]));

    const run = createWorkflowRun({
      id: "run_access_private",
      orgId: "org_private_access",
      workflowKind: "website_audit",
      title: "Private run",
      createdBy: "dashboard",
      now: "2026-06-21T00:00:00.000Z",
    });

    const access = await authorizeRunAccess({
      runId: run.id,
      headers: new Headers({ authorization: "Bearer other-org-token" }),
    });

    expect(access).toMatchObject({
      ok: false,
      status: 404,
      body: {
        code: "run_not_found",
      },
    });
  });
});
