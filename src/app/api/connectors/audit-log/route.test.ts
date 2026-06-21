import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { installConnectorCredential } from "@/lib/connectors";
import { GET } from "./route";

describe("GET /api/connectors/audit-log", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns safe connector credential audit logs", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", DEMO_ORG_ID);
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");

    const installed = await installConnectorCredential({
      orgId: DEMO_ORG_ID,
      capabilityId: "cms.publisher",
      credential: { token: "cms-secret-token" },
      scopes: ["cms:draft"],
      actor: "operator@example.com",
      now: "2026-06-21T00:00:00.000Z",
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/connectors/audit-log?orgId=${DEMO_ORG_ID}&capabilityId=cms.publisher`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      orgId: DEMO_ORG_ID,
      auditLogs: [
        expect.objectContaining({
          action: "installed",
          capabilityId: "cms.publisher",
          installId: installed.summary.id,
          actor: "operator@example.com",
          packetId: installed.packet.id,
        }),
      ],
    });
    expect(JSON.stringify(body)).not.toContain("cms-secret-token");
  });
});
